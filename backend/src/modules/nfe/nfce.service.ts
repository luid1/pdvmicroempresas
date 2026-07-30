import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { StatusDFe } from '@prisma/client';
import { proximoNumero } from '../../common/utils/sequencia.util';
import { MockNfeProvider } from './providers/mock.provider';
import { RealNfeProvider } from './providers/real.provider';
import { NfeProvider, AutorizacaoNfceResultado } from './providers/nfe-provider.interface';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Emissão de NFC-e (modelo 65) — cupom fiscal eletrônico do consumidor, emitido no PDV.
 *
 * CAMADA PLUGÁVEL, DESLIGADA POR PADRÃO (como o TEF). Controlada por NFCE_MODO:
 *   'desligado' (default) → PDV não emite nada.
 *   'simulado'            → MockNfeProvider (gera chave/QR fake, não transmite).
 *   'focus' | 'sefaz'     → RealNfeProvider (transmite de verdade; exige FOCUS_NFE_TOKEN).
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
  ) {}

  /** Modo configurado (normalizado). */
  private modo(): 'desligado' | 'simulado' | 'focus' | 'sefaz' {
    const m = (process.env.NFCE_MODO || 'desligado').toLowerCase();
    if (['simulado', 'mock', 'homologacao'].includes(m)) return 'simulado';
    if (m === 'focus') return 'focus';
    if (m === 'sefaz') return 'sefaz';
    return 'desligado';
  }

  /** true se a emissão de NFC-e está habilitada. */
  habilitado(): boolean {
    return this.modo() !== 'desligado';
  }

  /** Seleciona o provider conforme o modo. */
  private provider(): NfeProvider {
    return this.modo() === 'simulado' ? this.mock : this.real;
  }

  /**
   * Emite a NFC-e (modelo 65) a partir de um pedido já faturado pelo PDV.
   * Idempotente: se já existir NFC-e emitida para o pedido, retorna a existente.
   */
  async emitirDePedido(tenantId: string, pedidoId: string, filialId: string, _usuarioId: string) {
    if (!this.habilitado()) {
      throw new BadRequestException('Emissão de NFC-e desligada (defina NFCE_MODO=simulado|focus|sefaz).');
    }

    // Idempotência: não emite duas NFC-e para a mesma venda.
    const existente = await this.prisma.nFe.findFirst({
      where: { tenantId, pedidoId, modelo: '65', status: StatusDFe.EMITIDO },
    });
    if (existente) {
      return {
        status: 'EMITIDA',
        modelo: '65',
        chaveAcesso: existente.chaveAcesso,
        qrCode: existente.qrCode,
        urlConsulta: existente.urlConsultaNfce,
        danfeUrl: existente.pdfDanfe,
        simulacao: this.modo() === 'simulado',
        reaproveitada: true,
      };
    }

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

    // Cria a NFC-e já em PENDENTE_EMISSAO; se autorizar, vira EMITIDO.
    const nfe = await this.prisma.nFe.create({
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
        naturezaOperacao: 'VENDA AO CONSUMIDOR',
        cfop: cfopPrincipal,
        emitenteCnpj: filial.cnpj || '',
        destCnpjCpf: pedido.cliente?.cnpjCpf,
        destRazaoSocial: pedido.cliente?.razaoSocial,
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
      include: { itens: { include: { produto: true } } },
    });

    try {
      const resultado: AutorizacaoNfceResultado = await this.provider().autorizarNfce(nfe);

      await this.prisma.nFe.update({
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
        },
      });

      this.logger.log(
        `🧾 NFC-e ${nfe.serie}/${nfe.numero} ${resultado.simulacao ? '(SIMULAÇÃO) ' : ''}emitida — chave ${resultado.chaveAcesso}`,
      );

      return {
        status: 'EMITIDA',
        nfeId: nfe.id,
        modelo: '65',
        numero: nfe.numero,
        serie: nfe.serie,
        chaveAcesso: resultado.chaveAcesso,
        protocolo: resultado.protocolo,
        qrCode: resultado.qrCode,
        urlConsulta: resultado.urlConsulta,
        danfeUrl: resultado.danfeUrl,
        simulacao: resultado.simulacao,
      };
    } catch (err: any) {
      await this.prisma.nFe.update({
        where: { id: nfe.id },
        data: { status: StatusDFe.RASCUNHO, pendenciaMotivo: (err.message || '').slice(0, 2000), baixaPendente: true },
      });
      throw new BadRequestException(`Erro ao emitir NFC-e: ${err.message}`);
    }
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
