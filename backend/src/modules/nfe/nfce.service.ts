import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { StatusDFe } from '@prisma/client';
import { proximoNumero } from '../../common/utils/sequencia.util';
import { MockNfeProvider } from './providers/mock.provider';
import { RealNfeProvider } from './providers/real.provider';
import { NfeProvider, AutorizacaoNfceResultado } from './providers/nfe-provider.interface';
import { ConfiguracaoFiscalService } from './configuracao-fiscal.service';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Status locais que ainda aguardam autorização do SEFAZ (fila de reenvio). */
const PENDENTES: StatusDFe[] = [
  StatusDFe.PENDENTE_EMISSAO,
  StatusDFe.CONTINGENCIA,
  StatusDFe.RASCUNHO,
];

/**
 * Emissão de NFC-e (modelo 65) — cupom fiscal eletrônico do consumidor, emitido no PDV.
 *
 * CAMADA PLUGÁVEL, DESLIGADA POR PADRÃO (como o TEF). Controlada por NFCE_MODO:
 *   'desligado' (default) → PDV não emite nada.
 *   'simulado'            → MockNfeProvider (gera chave/QR fake, não transmite).
 *   'focus' | 'sefaz'     → RealNfeProvider (transmite de verdade; exige FOCUS_NFE_TOKEN).
 *
 * STORE-AND-FORWARD: toda tentativa de emissão grava o documento no banco (NFe).
 * Se o SEFAZ recusar/cair, o documento fica salvo em CONTINGENCIA para reenvio
 * posterior (nunca perdemos a venda). O Monitor Fiscal lista tudo: emitidas,
 * pendentes, canceladas e as que precisam reenviar/consultar.
 *
 * Diferente da NF-e (modelo 55), a NFC-e NÃO dispara baixa de estoque nem financeiro:
 * o PDV já fez isso na venda (registrarVenda). Aqui só documentamos fiscalmente a venda.
 */
@Injectable()
export class NfceService {
  private readonly logger = new Logger(NfceService.name);

  constructor(
    private prisma: PrismaService,
    private fiscal: FiscalService,
    private mock: MockNfeProvider,
    private real: RealNfeProvider,
    private configuracaoFiscal: ConfiguracaoFiscalService,
  ) {}

  /** Modo configurado (normalizado). */
  private modo(): 'desligado' | 'simulado' | 'focus' | 'sefaz' {
    const m = (process.env.NFCE_MODO || 'desligado').toLowerCase();
    if (['simulado', 'mock', 'homologacao'].includes(m)) return 'simulado';
    if (m === 'focus') return 'focus';
    if (m === 'sefaz') return 'sefaz';
    return 'desligado';
  }

  /** true se a emissão de NFC-e está habilitada por variável de ambiente (NFCE_MODO). */
  habilitado(): boolean {
    return this.modo() !== 'desligado';
  }

  /**
   * true se a NFC-e deve ser emitida para ESTA filial — turnkey.
   * Basta o usuário ativar a configuração fiscal no painel (Central Fiscal):
   * o PDV passa a emitir sem depender de nenhuma variável de ambiente.
   */
  async habilitadoParaFilial(tenantId: string, filialId: string): Promise<boolean> {
    if (this.habilitado()) return true;
    return this.configuracaoFiscal.deveTransmitir(tenantId, filialId);
  }

  /** Provider conforme o modo/configuração da filial. */
  private async providerDaFilial(tenantId: string, filialId: string): Promise<NfeProvider> {
    const configuracaoAtiva = await this.configuracaoFiscal.deveTransmitir(tenantId, filialId);
    if (configuracaoAtiva) return this.real;
    return this.modo() === 'simulado' ? this.mock : this.real;
  }

  /** Monta o objeto de retorno padronizado a partir de uma NFe persistida. */
  private resultado(nfe: any, status: string, extra: Record<string, any> = {}) {
    return {
      status,
      nfeId: nfe.id,
      modelo: nfe.modelo,
      numero: nfe.numero,
      serie: nfe.serie,
      chaveAcesso: nfe.chaveAcesso ?? null,
      protocolo: nfe.protocolo ?? null,
      qrCode: nfe.qrCode ?? null,
      urlConsulta: nfe.urlConsultaNfce ?? null,
      danfeUrl: nfe.pdfDanfe ?? null,
      destCnpjCpf: nfe.destCnpjCpf ?? null,
      pendenciaMotivo: nfe.pendenciaMotivo ?? null,
      simulacao: this.modo() === 'simulado',
      ...extra,
    };
  }

  /**
   * Emite (ou reaproveita) a NFC-e de um pedido do PDV.
   *  1. Se já existe NFC-e EMITIDA para o pedido → retorna ela (idempotência).
   *  2. Garante o documento salvo (PENDENTE_EMISSAO) — store-and-forward.
   *  3. Tenta transmitir. Falha vira CONTINGENCIA (salvo p/ reenvio), nunca derruba a venda.
   */
  async emitirDePedido(
    tenantId: string,
    pedidoId: string,
    filialId: string,
    _usuarioId: string,
    opts?: { cpfNota?: string },
  ) {
    const existente = await this.prisma.nFe.findFirst({
      where: { tenantId, pedidoId, modelo: '65' },
      orderBy: { createdAt: 'desc' },
    });

    if (existente) {
      if (existente.status === StatusDFe.EMITIDO) {
        return this.resultado(existente, 'EMITIDA', { reaproveitada: true });
      }
      if (existente.status !== StatusDFe.CANCELADO) {
        // Já existe um documento pendente para este pedido — completa/atualiza o CPF e retransmite.
        if (opts?.cpfNota) {
          const cpf = opts.cpfNota.replace(/\D/g, '');
          if (cpf && cpf !== existente.destCnpjCpf) {
            await this.prisma.nFe.update({
              where: { id: existente.id },
              data: { destCnpjCpf: cpf, destRazaoSocial: existente.destRazaoSocial || 'CONSUMIDOR' },
            });
          }
        }
        return this.transmitir(tenantId, existente.id);
      }
    }

    const nfe = await this.criarPendente(tenantId, pedidoId, filialId, opts);
    return this.transmitir(tenantId, nfe.id);
  }

  /**
   * Cria o documento fiscal (NFe modelo 65) já em PENDENTE_EMISSAO, com itens e
   * impostos calculados. NÃO transmite — apenas persiste (store-and-forward).
   */
  private async criarPendente(
    tenantId: string,
    pedidoId: string,
    filialId: string,
    opts?: { cpfNota?: string },
  ) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId },
      include: {
        cliente: true,
        itens: { include: { produto: { include: { unidadeMedida: true } } } },
        filialOrigem: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');

    pedido.itens = pedido.itens.filter((i: any) => !i.cortado && i.produtoId);
    if (pedido.itens.length === 0) throw new BadRequestException('Pedido sem itens para a NFC-e.');

    const filial = pedido.filialOrigem;

    // Motor fiscal — reaproveita o cálculo de impostos item a item (consumidor final).
    const calc = await this.fiscal.calcularPedido(tenantId, pedido, { tipoOperacao: 'VENDA' });
    const cfopPrincipal = calc.itens[0]?.imposto.cfop || '5102';

    const ultimo = await this.prisma.nFe.findFirst({
      where: { tenantId, filialId, serie: '1', modelo: '65' },
      orderBy: { numero: 'desc' },
    });
    const numero = await proximoNumero(this.prisma, tenantId, `nfe:${filialId}:65:1`, ultimo?.numero || 0);

    const valorNfe = r2(Number(pedido.valorTotal) + calc.totais.valorIcmsSt + calc.totais.valorIpi);

    // CPF na nota: aceita o CPF do consumidor (mercadinho) sem exigir cadastro de Cliente.
    const cpf = (opts?.cpfNota || '').replace(/\D/g, '');
    const destDoc = cpf || pedido.cliente?.cnpjCpf || undefined;

    return this.prisma.nFe.create({
      data: {
        tenantId,
        filialId,
        clienteId: pedido.clienteId,
        pedidoId,
        tipo: 'NFCE',
        modelo: '65',
        serie: '1',
        numero,
        status: StatusDFe.PENDENTE_EMISSAO,
        tipoOperacao: 'SAIDA',
        finalidade: '1',
        consumidorFinal: 1,
        presencaComprador: 1,
        indicadorIeDestinatario: 9,
        naturezaOperacao: 'VENDA AO CONSUMIDOR',
        cfop: cfopPrincipal,
        emitenteCnpj: filial.cnpj || '',
        destCnpjCpf: destDoc,
        destRazaoSocial: pedido.cliente?.razaoSocial || (cpf ? 'CONSUMIDOR' : undefined),
        destEnderecoJson: pedido.cliente?.enderecoJson,
        formaPagamento: pedido.formaPagamento,
        valorProdutos: pedido.subtotal,
        valorFrete: pedido.valorFrete,
        valorDesconto: pedido.descontoTotal,
        valorIcms: calc.totais.valorIcms,
        valorIcmsSt: calc.totais.valorIcmsSt,
        valorFcp: calc.totais.valorFcp,
        valorIpi: calc.totais.valorIpi,
        valorPis: calc.totais.valorPis,
        valorCofins: calc.totais.valorCofins,
        valorNfe,
        itens: {
          create: calc.itens.map(({ item, imposto }, idx) => ({
            produtoId: item.produtoId,
            ordem: idx + 1,
            codigo: item.produto.codigo,
            descricao: item.descricao,
            ncm: item.produto.ncm,
            cfop: imposto.cfop,
            unidade: item.produto.unidadeMedida.sigla,
            quantidade: item.quantidade,
            valorUnitario: item.precoUnitario,
            valorDesconto: item.desconto,
            valorTotal: item.valorTotal,
            origemProd: imposto.origemProd,
            cstCsosn: imposto.cstCsosn,
            baseCalcIcms: imposto.baseCalcIcms,
            aliquotaIcms: imposto.aliquotaIcms,
            valorIcms: imposto.valorIcms,
            cstPis: imposto.cstPis,
            valorPis: imposto.valorPis,
            cstCofins: imposto.cstCofins,
            valorCofins: imposto.valorCofins,
          })),
        },
      },
      include: { itens: { include: { produto: true } }, filial: true },
    });
  }

  /**
   * Transmite um documento já persistido ao SEFAZ. Nunca lança por recusa do SEFAZ:
   * a falha vira CONTINGENCIA (salvo para reenvio). Idempotente para EMITIDO.
   */
  async transmitir(tenantId: string, nfeId: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { id: nfeId, tenantId },
      include: { itens: { include: { produto: true } }, filial: true },
    });
    if (!nfe) throw new NotFoundException('Documento fiscal não encontrado.');
    if (nfe.status === StatusDFe.EMITIDO) return this.resultado(nfe, 'EMITIDA', { reaproveitada: true });
    if (nfe.status === StatusDFe.CANCELADO) {
      throw new BadRequestException('Documento cancelado não pode ser transmitido.');
    }

    const configuracaoAtiva = await this.configuracaoFiscal.deveTransmitir(tenantId, nfe.filialId);
    if (!this.habilitado() && !configuracaoAtiva) {
      // Fica salvo para emitir depois (quando a Central Fiscal for ativada).
      return this.resultado(nfe, 'PENDENTE', {
        motivo: 'Emissão fiscal desligada para esta filial — documento salvo para emitir depois.',
      });
    }

    const provider = configuracaoAtiva ? this.real : this.mock;
    try {
      const resultado: AutorizacaoNfceResultado = await provider.autorizarNfce(nfe);
      const atualizado = await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: {
          status: StatusDFe.EMITIDO,
          chaveAcesso: resultado.chaveAcesso,
          protocolo: resultado.protocolo,
          xmlEmitido: resultado.xml,
          qrCode: resultado.qrCode,
          urlConsultaNfce: resultado.urlConsulta,
          pdfDanfe: resultado.danfeUrl,
          dataEmissao: new Date(),
          baixaPendente: false,
          pendenciaMotivo: null,
        },
      });
      this.logger.log(
        `🧾 NFC-e ${nfe.serie}/${nfe.numero} ${resultado.simulacao ? '(SIMULAÇÃO) ' : ''}emitida — chave ${resultado.chaveAcesso}`,
      );
      return this.resultado(atualizado, 'EMITIDA', { simulacao: resultado.simulacao });
    } catch (err: any) {
      const motivo = (err?.message || 'Falha ao transmitir ao SEFAZ').slice(0, 2000);
      const atualizado = await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: { status: StatusDFe.CONTINGENCIA, pendenciaMotivo: motivo, baixaPendente: true },
      });
      this.logger.warn(`⚠️ NFC-e ${nfe.serie}/${nfe.numero} em CONTINGÊNCIA — ${motivo}`);
      return this.resultado(atualizado, 'CONTINGENCIA', { erro: motivo, pendente: true });
    }
  }

  /**
   * Consulta o status REAL do documento no SEFAZ e reconcilia o status local.
   * É o "cobrar na SEFAZ se foi aprovada ou não" — atualiza EMITIDO/CANCELADO.
   */
  async consultarStatus(tenantId: string, nfeId: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { id: nfeId, tenantId },
      include: { filial: true },
    });
    if (!nfe) throw new NotFoundException('Documento fiscal não encontrado.');

    const provider = await this.providerDaFilial(tenantId, nfe.filialId);
    if (!provider.consultarNfce) {
      throw new BadRequestException('O provedor fiscal atual não suporta consulta de status.');
    }

    const r = await provider.consultarNfce(nfe);

    if (r.autorizado && nfe.status !== StatusDFe.EMITIDO) {
      await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: {
          status: StatusDFe.EMITIDO,
          chaveAcesso: r.chaveAcesso ?? nfe.chaveAcesso,
          protocolo: r.protocolo ?? nfe.protocolo,
          qrCode: r.qrCode ?? nfe.qrCode,
          urlConsultaNfce: r.urlConsulta ?? nfe.urlConsultaNfce,
          pdfDanfe: r.danfeUrl ?? nfe.pdfDanfe,
          xmlEmitido: r.xml ?? nfe.xmlEmitido,
          dataEmissao: nfe.dataEmissao ?? new Date(),
          baixaPendente: false,
          pendenciaMotivo: null,
        },
      });
    } else if (r.status === 'cancelado' && nfe.status !== StatusDFe.CANCELADO) {
      await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: { status: StatusDFe.CANCELADO, dataCancelamento: new Date() },
      });
    } else if (!r.autorizado && r.motivo) {
      await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: { pendenciaMotivo: r.motivo.slice(0, 2000) },
      });
    }

    return { ...r, nfeId: nfe.id, numero: nfe.numero, serie: nfe.serie };
  }

  /** Reenvia (transmite) todos os documentos pendentes/contingência da filial. */
  async reprocessarPendentes(tenantId: string, filialId?: string) {
    const pendentes = await this.prisma.nFe.findMany({
      where: {
        tenantId,
        modelo: '65',
        status: { in: PENDENTES },
        ...(filialId && { filialId }),
      },
      orderBy: { numero: 'asc' },
      take: 50,
    });

    const resultados: any[] = [];
    for (const p of pendentes) {
      try {
        resultados.push(await this.transmitir(tenantId, p.id));
      } catch (e: any) {
        resultados.push({ status: 'ERRO', nfeId: p.id, numero: p.numero, erro: e?.message });
      }
    }
    return {
      total: pendentes.length,
      emitidas: resultados.filter((r) => r.status === 'EMITIDA').length,
      pendentes: resultados.filter((r) => r.status !== 'EMITIDA').length,
      resultados,
    };
  }

  /** Cancela uma NFC-e autorizada no SEFAZ (usado no estorno da venda). */
  async cancelarNfce(tenantId: string, nfeId: string, motivo?: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { id: nfeId, tenantId },
      include: { filial: true },
    });
    if (!nfe) throw new NotFoundException('Documento fiscal não encontrado.');
    if (nfe.status !== StatusDFe.EMITIDO) {
      throw new BadRequestException('Só é possível cancelar uma NFC-e autorizada.');
    }

    const justificativa = (motivo || 'Cancelamento a pedido do operador do caixa')
      .padEnd(15, '.')
      .slice(0, 255);
    const provider = await this.providerDaFilial(tenantId, nfe.filialId);
    const r = await provider.cancelar(nfe.chaveAcesso || '', justificativa, nfe);

    const atualizado = await this.prisma.nFe.update({
      where: { id: nfe.id },
      data: {
        status: StatusDFe.CANCELADO,
        motivoCancelamento: justificativa,
        xmlCancelamento: r.xml,
        dataCancelamento: new Date(),
      },
    });
    this.logger.log(`🚫 NFC-e ${nfe.serie}/${nfe.numero} cancelada — ${justificativa}`);
    return this.resultado(atualizado, 'CANCELADA', { simulacao: r.simulacao });
  }

  /** Cancela a NFC-e vinculada a um pedido (best-effort; usado no estorno). */
  async cancelarPorPedido(tenantId: string, pedidoId: string, motivo?: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { tenantId, pedidoId, modelo: '65', status: StatusDFe.EMITIDO },
      orderBy: { createdAt: 'desc' },
    });
    if (!nfe) return null;
    return this.cancelarNfce(tenantId, nfe.id, motivo);
  }

  /** Lista para o Monitor Fiscal: documentos com status, pendências e vínculo com a venda. */
  async listarMonitor(
    tenantId: string,
    filtros: { filialId?: string; status?: string; busca?: string; dias?: number } = {},
  ) {
    const where: any = { tenantId };
    if (filtros.filialId) where.filialId = filtros.filialId;
    if (filtros.status) where.status = filtros.status as StatusDFe;
    if (filtros.dias) where.createdAt = { gte: new Date(Date.now() - filtros.dias * 86400000) };
    if (filtros.busca) {
      const n = Number(filtros.busca);
      where.OR = [
        { chaveAcesso: { contains: filtros.busca } },
        { destCnpjCpf: { contains: filtros.busca.replace(/\D/g, '') } },
        ...(Number.isFinite(n) ? [{ numero: n }] : []),
      ];
    }

    const docs = await this.prisma.nFe.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { pedido: { select: { numero: true, status: true, valorTotal: true } } },
    });

    return docs.map((d) => ({
      id: d.id,
      modelo: d.modelo,
      tipo: d.tipo,
      serie: d.serie,
      numero: d.numero,
      status: d.status,
      chaveAcesso: d.chaveAcesso,
      protocolo: d.protocolo,
      destCnpjCpf: d.destCnpjCpf,
      valorNfe: Number(d.valorNfe),
      qrCode: d.qrCode,
      urlConsulta: d.urlConsultaNfce,
      danfeUrl: d.pdfDanfe,
      pendenciaMotivo: d.pendenciaMotivo,
      baixaPendente: d.baixaPendente,
      dataEmissao: d.dataEmissao,
      dataCancelamento: d.dataCancelamento,
      createdAt: d.createdAt,
      pedidoId: d.pedidoId,
      pedidoNumero: d.pedido?.numero ?? null,
      pedidoStatus: d.pedido?.status ?? null,
      pedidoEstornado: d.pedido?.status === 'CANCELADO',
    }));
  }

  /** Resumo por status (cartões do topo do Monitor Fiscal). */
  async resumoMonitor(tenantId: string, filialId?: string) {
    const grupos = await this.prisma.nFe.groupBy({
      by: ['status'],
      where: { tenantId, modelo: '65', ...(filialId && { filialId }) },
      _count: { _all: true },
    });
    const map: Record<string, number> = {};
    for (const g of grupos) map[g.status] = g._count._all;
    return {
      emitidas: map[StatusDFe.EMITIDO] || 0,
      pendentes:
        (map[StatusDFe.PENDENTE_EMISSAO] || 0) +
        (map[StatusDFe.CONTINGENCIA] || 0) +
        (map[StatusDFe.RASCUNHO] || 0),
      canceladas: map[StatusDFe.CANCELADO] || 0,
      denegadas: map[StatusDFe.DENEGADO] || 0,
      porStatus: map,
    };
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.nFe.findFirst({
      where: { id, tenantId, modelo: '65' },
      include: {
        itens: { include: { produto: { select: { codigo: true, descricao: true } } } },
        cliente: true,
      },
    });
  }
}
