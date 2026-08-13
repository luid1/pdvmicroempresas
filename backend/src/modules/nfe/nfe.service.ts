import { Injectable, BadRequestException, NotFoundException, Logger, Inject } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { TipoMovimentacao, StatusDFe } from '@prisma/client';
import { proximoNumero } from '../../common/utils/sequencia.util';
import { NFE_PROVIDER, NfeProvider } from './providers/nfe-provider.interface';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const addDias = (base: Date, dias: number) => new Date(base.getTime() + dias * 86400000);

@Injectable()
export class NFeService {
  private readonly logger = new Logger(NFeService.name);

  constructor(
    private prisma: PrismaService,
    private estoque: EstoqueService,
    private fiscal: FiscalService,
    private events: EventEmitter2,
    @Inject(NFE_PROVIDER) private nfeProvider: NfeProvider,
  ) {}

  // ─────────────────────────────────────────
  // GERAÇÃO — monta a NF-e a partir do pedido (com motor fiscal + parcelas)
  // ─────────────────────────────────────────
  async gerarDesPedido(tenantId: string, pedidoId: string, filialId: string, usuarioId: string) {
    // 1. Validação anti-erro — bloqueia se houver pendência grave
    const validacao = await this.fiscal.validarFaturamento(tenantId, pedidoId);
    if (!validacao.podeFaturar) {
      const motivos = validacao.checks.filter((c) => !c.ok && c.severidade === 'BLOQUEIO').map((c) => c.label).join('; ');
      throw new BadRequestException(`Faturamento bloqueado: ${motivos}`);
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
    if (pedido.status !== 'SEPARADO' && pedido.status !== 'CONFIRMADO') {
      throw new BadRequestException(`Pedido com status ${pedido.status} não pode ser faturado.`);
    }

    // Não fatura itens cortados na separação
    pedido.itens = pedido.itens.filter((i: any) => !i.cortado);
    if (pedido.itens.length === 0) throw new BadRequestException('Todos os itens do pedido foram cortados.');

    const filial = pedido.filialOrigem;

    // 2. Motor fiscal — calcula impostos item a item
    const calc = await this.fiscal.calcularPedido(tenantId, pedido, { tipoOperacao: 'VENDA' });
    const cfopPrincipal = calc.itens[0]?.imposto.cfop || '5102';

    // 3. Próximo número da filial/série
    const ultimo = await this.prisma.nFe.findFirst({
      where: { tenantId, filialId, serie: '1', modelo: '55' },
      orderBy: { numero: 'desc' },
    });
    const numero = await proximoNumero(this.prisma, tenantId, `nfe:${filialId}:55:1`, ultimo?.numero || 0);

    const valorNfe = r2(Number(pedido.valorTotal) + calc.totais.valorIcmsSt + calc.totais.valorIpi);

    const nfe = await this.prisma.nFe.create({
      data: {
        tenantId,
        filialId,
        clienteId: pedido.clienteId,
        pedidoId,
        tipo: 'NFE',
        modelo: '55',
        serie: '1',
        numero,
        status: StatusDFe.RASCUNHO,
        tipoOperacao: 'SAIDA',
        finalidade: '1',
        naturezaOperacao: 'VENDA DE MERCADORIAS',
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
            baseCalcFcp: imposto.baseCalcFcp,
            aliquotaFcp: imposto.aliquotaFcp,
            valorFcp: imposto.valorFcp,
            valorFcpSt: imposto.valorFcpSt,
            cstPis: imposto.cstPis,
            baseCalcPis: imposto.baseCalcPis,
            aliquotaPis: imposto.aliquotaPis,
            valorPis: imposto.valorPis,
            cstCofins: imposto.cstCofins,
            baseCalcCofins: imposto.baseCalcCofins,
            aliquotaCofins: imposto.aliquotaCofins,
            valorCofins: imposto.valorCofins,
          })),
        },
      },
      include: { itens: true },
    });

    // 4. Desdobramento financeiro — gera as duplicatas conforme a condição de pagamento
    const parcelas = this.montarParcelas(valorNfe, pedido);
    if (parcelas.length) {
      await this.prisma.duplicataNFe.createMany({
        data: parcelas.map((p) => ({ nfeId: nfe.id, numero: p.numero, dataVenc: p.dataVenc, valor: p.valor })),
      });
    }

    this.logger.log(`📝 NF-e ${nfe.serie}/${nfe.numero} gerada (rascunho) — ${parcelas.length} parcela(s)`);
    return { ...nfe, duplicatas: parcelas };
  }

  /**
   * Quebra o valor da nota em parcelas conforme a condição de pagamento do pedido.
   * Aceita formatos "30/60/90" (dias) ou usa numeroParcelas com passo de 30 dias.
   * À vista (DINHEIRO/PIX/CARTAO + 1 parcela) → vencimento hoje.
   */
  private montarParcelas(valor: number, pedido: any): { numero: string; dataVenc: Date; valor: number }[] {
    const hoje = new Date();
    const forma = (pedido.formaPagamento || '').toUpperCase();
    const aVista = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO'].includes(forma);

    // dias de vencimento de cada parcela
    let dias: number[] = [];
    const cond = (pedido.condicaoPagamento || '').replace(/\s/g, '');
    if (/^\d+(\/\d+)+$/.test(cond)) {
      dias = cond.split('/').map((d: string) => parseInt(d, 10));
    } else {
      const n = Math.max(1, Number(pedido.numeroParcelas) || 1);
      if (n === 1) {
        dias = [aVista ? 0 : Number(pedido.cliente?.prazoMedio) || 30];
      } else {
        for (let i = 1; i <= n; i++) dias.push(i * 30);
      }
    }

    const n = dias.length;
    const base = Math.floor((valor / n) * 100) / 100;
    return dias.map((d, i) => {
      // última parcela absorve o resíduo de arredondamento
      const v = i === n - 1 ? r2(valor - base * (n - 1)) : base;
      return { numero: `D${String(i + 1).padStart(3, '0')}`, dataVenc: addDias(hoje, d), valor: v };
    });
  }

  // ─────────────────────────────────────────
  // EMISSÃO — "transmite" ao SEFAZ (mock) → dispara evento de baixa/financeiro
  // ─────────────────────────────────────────
  async emitir(tenantId: string, nfeId: string, usuarioId: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { id: nfeId, tenantId },
      include: { itens: { include: { produto: true } }, pedido: true, filial: true, duplicatas: true },
    });
    if (!nfe) throw new NotFoundException('NF-e não encontrada.');
    if (nfe.status !== StatusDFe.RASCUNHO && nfe.status !== StatusDFe.PENDENTE_EMISSAO) {
      throw new BadRequestException(`NF-e com status ${nfe.status} não pode ser emitida.`);
    }

    await this.prisma.nFe.update({ where: { id: nfeId }, data: { status: StatusDFe.PENDENTE_EMISSAO } });

    try {
      const resultado = await this.nfeProvider.autorizar(nfe);

      await this.prisma.nFe.update({
        where: { id: nfeId },
        data: {
          status: StatusDFe.EMITIDO,
          chaveAcesso: resultado.chaveAcesso,
          protocolo: resultado.protocolo,
          xmlEmitido: resultado.xml,
          pdfDanfe: resultado.danfeUrl,
          dataEmissao: new Date(),
        },
      });

      this.logger.log(`✅ NF-e ${nfe.serie}/${nfe.numero} emitida — chave: ${resultado.chaveAcesso}`);

      // 🔥 EVENTO: baixa de estoque + financeiro (Event-Driven)
      this.events.emit('nfe.emitida', {
        tenantId, nfeId, filialId: nfe.filialId, pedidoId: nfe.pedidoId,
        itens: nfe.itens, valorNfe: nfe.valorNfe, clienteId: nfe.clienteId,
        formaPagamento: nfe.formaPagamento, duplicatas: nfe.duplicatas, usuarioId,
      });

      return { status: 'EMITIDA', chaveAcesso: resultado.chaveAcesso, danfeUrl: resultado.danfeUrl };
    } catch (err) {
      await this.prisma.nFe.update({ where: { id: nfeId }, data: { status: StatusDFe.RASCUNHO } });
      throw new BadRequestException(`Erro ao emitir NF-e: ${err.message}`);
    }
  }

  /**
   * Listener 'nfe.emitida': baixa estoque, gera Contas a Receber (1 por duplicata,
   * com boleto/pix fake) e marca o pedido como FATURADO.
   */
  @OnEvent('nfe.emitida')
  async handleNFeEmitida(payload: {
    tenantId: string; nfeId: string; filialId: string; pedidoId?: string;
    itens: any[]; valorNfe: any; clienteId?: string; formaPagamento?: string; duplicatas: any[]; usuarioId: string;
  }) {
    this.logger.log(`📦 Processando nfe.emitida — NF-e ${payload.nfeId}`);

    // A NF-e JÁ está autorizada no SEFAZ; não podemos "desfazê-la". O que fazemos
    // aqui (baixa de estoque + financeiro) é a consequência interna. Se algo falhar,
    // NÃO seguimos em silêncio: acumulamos os erros e marcamos a NF-e como pendente
    // (baixaPendente=true + motivo) para retry/alerta, em vez de só logar e esquecer.
    const falhas: string[] = [];

    // Rastreabilidade (P2-6): o lote que a separadora efetivamente pegou está no
    // ItemPedido; a NF-e só carrega produtoId. Montamos produtoId → loteId separado
    // para baixar o MESMO lote (e não um FEFO qualquer que pode divergir do impresso).
    const loteSeparadoPorProduto = new Map<string, string>();
    if (payload.pedidoId) {
      const itensPedido = await this.prisma.itemPedido.findMany({
        where: { pedidoId: payload.pedidoId, loteId: { not: null } },
        select: { produtoId: true, loteId: true },
      });
      for (const ip of itensPedido) {
        if (ip.loteId) loteSeparadoPorProduto.set(ip.produtoId, ip.loteId);
      }
    }

    // 1. Baixa de estoque (SAIDA_VENDA, FEFO) — permite saldo negativo (venda "a comprar").
    //    Cada item é isolado: uma falha pontual vira pendência, não perde o restante.
    for (const item of payload.itens) {
      if (!item.produtoId) continue;
      try {
        await this.estoque.baixarFefo(payload.tenantId, {
          filialId: payload.filialId,
          produtoId: item.produtoId,
          tipo: TipoMovimentacao.SAIDA_VENDA,
          quantidade: Number(item.quantidade),
          loteId: loteSeparadoPorProduto.get(item.produtoId),
          nfeId: payload.nfeId,
          usuarioId: payload.usuarioId,
          observacoes: `Baixa automática NF-e ${payload.nfeId.slice(0, 8)}`,
        });
      } catch (e: any) {
        falhas.push(`baixa de estoque do produto ${item.produtoId}: ${e.message}`);
        this.logger.warn(`⚠️ Baixa de estoque falhou p/ produto ${item.produtoId}: ${e.message}`);
      }
    }

    // 2. Financeiro (Contas a Receber) + liberação da reserva + status do pedido:
    //    tudo em UMA transação. Ou gera todos os títulos e libera a reserva, ou nada
    //    (antes: título parcial + pedido faturado sem cobrança = entrega e não cobra).
    const dups = payload.duplicatas?.length
      ? payload.duplicatas
      : [{ numero: 'D001', dataVenc: addDias(new Date(), 30), valor: Number(payload.valorNfe) }];

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const dup of dups) {
          const forma = (payload.formaPagamento || '').toUpperCase();
          const { linkBoleto, pixCopiaECola } = this.gerarCobranca(forma, dup);
          await tx.contaReceber.create({
            data: {
              tenantId: payload.tenantId,
              filialId: payload.filialId,
              clienteId: payload.clienteId,
              pedidoId: payload.pedidoId,
              nfeId: payload.nfeId,
              descricao: `Venda — NF-e ${payload.nfeId.slice(0, 8)} · parc. ${dup.numero}`,
              numero: dup.numero,
              valorOriginal: Number(dup.valor),
              dataVencimento: new Date(dup.dataVenc),
              status: 'ABERTO',
              formaPagamento: payload.formaPagamento,
              linkBoleto,
              pixCopiaECola,
            },
          });
        }

        // Libera a reserva do pedido (a mercadoria saiu de fato) + marca FATURADO,
        // dentro da mesma transação do financeiro.
        if (payload.pedidoId) {
          const ped = await tx.pedido.findFirst({
            where: { id: payload.pedidoId },
            include: { itens: { select: { produtoId: true, quantidade: true } } },
          });
          if (ped) {
            await this.estoque.liberarReserva(
              payload.tenantId,
              ped.filialOrigemId,
              ped.itens
                .filter((i) => !!i.produtoId)
                .map((i) => ({ produtoId: i.produtoId as string, quantidade: Number(i.quantidade) })),
              tx,
            );
          }
          await tx.pedido.update({ where: { id: payload.pedidoId }, data: { status: 'FATURADO' } });
        }
      });
    } catch (e: any) {
      falhas.push(`geração do financeiro/liberação de reserva: ${e.message}`);
      this.logger.error(`❌ Financeiro da NF-e ${payload.nfeId} falhou: ${e.message}`, e.stack);
    }

    // 3. Fecha o processamento: se houve qualquer falha, a NF-e fica PENDENTE (visível
    //    para o operador/retry) e emitimos um alerta. Sucesso limpa qualquer pendência.
    if (falhas.length > 0) {
      const motivo = falhas.join(' | ');
      await this.prisma.nFe.update({
        where: { id: payload.nfeId },
        data: { baixaPendente: true, pendenciaMotivo: motivo.slice(0, 2000) },
      });
      this.events.emit('nfe.pendencia', { tenantId: payload.tenantId, nfeId: payload.nfeId, motivo });
      this.logger.error(`🚨 NF-e ${payload.nfeId} EMITIDA com PENDÊNCIA: ${motivo}`);
    } else {
      await this.prisma.nFe.update({
        where: { id: payload.nfeId },
        data: { baixaPendente: false, pendenciaMotivo: null },
      });
      this.logger.log(`✅ nfe.emitida ok — estoque baixado + ${dups.length} título(s) gerado(s)`);
    }
  }

  /** Gera código de boleto/pix fake (modo teste). */
  private gerarCobranca(forma: string, dup: any): { linkBoleto: string | null; pixCopiaECola: string | null } {
    if (forma === 'BOLETO' || forma === 'A_PRAZO') {
      const linha = `34191.${rnd(5)} ${rnd(5)}.${rnd(6)} ${rnd(5)}.${rnd(6)} ${rnd(1)} ${rnd(14)}`;
      return { linkBoleto: linha, pixCopiaECola: null };
    }
    if (forma === 'PIX') {
      const pix = `00020126BR.GOV.BCB.PIX${rnd(20)}5204000053039865802BR5913HETROS TESTE6009SAO PAULO62${rnd(8)}6304${rnd(4)}`;
      return { linkBoleto: null, pixCopiaECola: pix };
    }
    return { linkBoleto: null, pixCopiaECola: null };
  }

  // ─────────────────────────────────────────
  // CANCELAMENTO — reverte financeiro e estoque
  // ─────────────────────────────────────────
  async cancelar(tenantId: string, nfeId: string, motivo: string, usuarioId: string) {
    const nfe = await this.prisma.nFe.findFirst({ where: { id: nfeId, tenantId } });
    if (!nfe) throw new NotFoundException('NF-e não encontrada.');
    if (nfe.status !== StatusDFe.EMITIDO) throw new BadRequestException('Apenas NF-e emitidas podem ser canceladas.');
    if (!nfe.chaveAcesso) throw new BadRequestException('NF-e sem chave de acesso.');
    if (!motivo || motivo.trim().length < 15) throw new BadRequestException('Motivo do cancelamento deve ter ao menos 15 caracteres.');

    const cancelamento = await this.nfeProvider.cancelar(nfe.chaveAcesso, motivo, nfe);

    await this.prisma.nFe.update({
      where: { id: nfeId },
      data: { status: StatusDFe.CANCELADO, motivoCancelamento: motivo, xmlCancelamento: cancelamento.xml, dataCancelamento: new Date() },
    });

    this.events.emit('nfe.cancelada', { tenantId, nfeId, usuarioId });
    return { status: 'CANCELADA' };
  }

  /** Listener: estorna estoque (volta a entrar) e cancela contas a receber em aberto. */
  @OnEvent('nfe.cancelada')
  async handleNFeCancelada(payload: { tenantId: string; nfeId: string; usuarioId: string }) {
    try {
      const nfe = await this.prisma.nFe.findFirst({
        where: { id: payload.nfeId, tenantId: payload.tenantId },
        include: { itens: true, contasReceber: true, pedido: true },
      });
      if (!nfe) return;

      // 1. Devolve o estoque
      for (const item of nfe.itens) {
        if (!item.produtoId) continue;
        await this.estoque.movimentar(payload.tenantId, {
          filialId: nfe.filialId,
          produtoId: item.produtoId,
          tipo: TipoMovimentacao.ENTRADA_DEVOLUCAO,
          quantidade: Number(item.quantidade),
          nfeId: nfe.id,
          usuarioId: payload.usuarioId,
          observacoes: `Estorno por cancelamento NF-e ${nfe.numero}`,
        });
      }

      // 2. Cancela títulos ainda em aberto
      await this.prisma.contaReceber.updateMany({
        where: { nfeId: nfe.id, status: { in: ['ABERTO', 'PARCIAL', 'VENCIDO'] } },
        data: { status: 'CANCELADO' },
      });

      // 3. Volta o pedido para SEPARADO (pode refaturar)
      if (nfe.pedidoId) {
        await this.prisma.pedido.update({ where: { id: nfe.pedidoId }, data: { status: 'SEPARADO' } });
      }

      this.logger.log(`↩️ nfe.cancelada processada — estoque devolvido + títulos cancelados`);
    } catch (err) {
      this.logger.error(`❌ Erro ao processar nfe.cancelada: ${err.message}`, err.stack);
    }
  }

  // ─────────────────────────────────────────
  // CARTA DE CORREÇÃO ELETRÔNICA (CC-e)
  // ─────────────────────────────────────────
  async emitirCartaCorrecao(tenantId: string, nfeId: string, correcao: string, usuarioId: string) {
    const nfe = await this.prisma.nFe.findFirst({ where: { id: nfeId, tenantId } });
    if (!nfe) throw new NotFoundException('NF-e não encontrada.');
    if (nfe.status !== StatusDFe.EMITIDO) throw new BadRequestException('CC-e só é permitida para NF-e emitida.');
    const texto = (correcao || '').trim();
    if (texto.length < 15 || texto.length > 1000) throw new BadRequestException('A correção deve ter entre 15 e 1000 caracteres.');

    const ultima = await this.prisma.cartaCorrecao.findFirst({ where: { nfeId }, orderBy: { sequencia: 'desc' } });
    const sequencia = (ultima?.sequencia || 0) + 1;
    if (sequencia > 20) throw new BadRequestException('Limite de 20 cartas de correção por NF-e atingido.');

    const cce = await this.nfeProvider.cartaCorrecao(nfe.chaveAcesso || '', sequencia, texto, nfe);
    return this.prisma.cartaCorrecao.create({
      data: {
        tenantId, nfeId, sequencia, correcao: texto,
        protocolo: cce.protocolo, xml: cce.xml, status: cce.status, usuarioId,
      },
    });
  }

  listarCartasCorrecao(tenantId: string, nfeId: string) {
    return this.prisma.cartaCorrecao.findMany({ where: { tenantId, nfeId }, orderBy: { sequencia: 'asc' } });
  }

  // ─────────────────────────────────────────
  // NOTA FISCAL DE DEVOLUÇÃO — espelha a entrada e anula o efeito financeiro
  // ─────────────────────────────────────────
  async gerarDevolucao(tenantId: string, nfeOrigemId: string, usuarioId: string, itensSel?: { itemNfeId: string; quantidade: number }[]) {
    const origem = await this.prisma.nFe.findFirst({
      where: { id: nfeOrigemId, tenantId },
      include: { itens: { include: { produto: { include: { unidadeMedida: true } } } }, cliente: true, filial: true },
    });
    if (!origem) throw new NotFoundException('NF-e de origem não encontrada.');
    if (origem.status !== StatusDFe.EMITIDO) throw new BadRequestException('Só é possível devolver NF-e emitida.');

    // Define os itens a devolver (total por padrão, ou parcial pela seleção)
    const selMap = new Map((itensSel || []).map((s) => [s.itemNfeId, Number(s.quantidade)]));
    const itensDev = origem.itens
      .map((it) => {
        const qtd = itensSel ? (selMap.get(it.id) || 0) : Number(it.quantidade);
        if (qtd <= 0) return null;
        const unit = Number(it.valorUnitario);
        return { it, qtd, valorTotal: r2(qtd * unit) };
      })
      .filter(Boolean) as { it: any; qtd: number; valorTotal: number }[];
    if (itensDev.length === 0) throw new BadRequestException('Selecione ao menos um item para devolver.');

    const ufOrigem = (origem.filial?.endereco as any)?.uf || 'SP';
    const ufDestino = (origem.cliente?.enderecoJson as any)?.uf || ufOrigem;
    const interestadual = ufOrigem !== ufDestino;
    const cfopDev = interestadual ? '6202' : '5202';

    const ultimo = await this.prisma.nFe.findFirst({
      where: { tenantId, filialId: origem.filialId, serie: '1', modelo: '55' },
      orderBy: { numero: 'desc' },
    });
    const numero = await proximoNumero(this.prisma, tenantId, `nfe:${origem.filialId}:55:1`, ultimo?.numero || 0);
    const valorProdutos = r2(itensDev.reduce((s, d) => s + d.valorTotal, 0));

    const nfe = await this.prisma.nFe.create({
      data: {
        tenantId, filialId: origem.filialId, clienteId: origem.clienteId,
        pedidoId: origem.pedidoId, tipo: 'NFE', modelo: '55', serie: '1', numero,
        status: StatusDFe.RASCUNHO,
        tipoOperacao: 'ENTRADA', finalidade: '4',
        nfeReferenciadaId: origem.id, chaveReferenciada: origem.chaveAcesso,
        naturezaOperacao: 'DEVOLUCAO DE VENDA', cfop: cfopDev,
        emitenteCnpj: origem.emitenteCnpj,
        destCnpjCpf: origem.destCnpjCpf, destRazaoSocial: origem.destRazaoSocial, destEnderecoJson: origem.destEnderecoJson,
        valorProdutos, valorNfe: valorProdutos,
        itens: {
          create: itensDev.map((d, idx) => ({
            produtoId: d.it.produtoId, ordem: idx + 1, codigo: d.it.codigo, descricao: d.it.descricao,
            ncm: d.it.ncm, cfop: cfopDev, unidade: d.it.unidade, quantidade: d.qtd,
            valorUnitario: d.it.valorUnitario, valorTotal: d.valorTotal,
            origemProd: d.it.origemProd, cstCsosn: d.it.cstCsosn,
            cstPis: d.it.cstPis, cstCofins: d.it.cstCofins,
          })),
        },
      },
      include: { itens: true },
    });

    this.logger.log(`↩️ NF-e de devolução ${nfe.numero} gerada (ref. ${origem.numero})`);
    return nfe;
  }

  async emitirDevolucao(tenantId: string, nfeId: string, usuarioId: string) {
    const nfe = await this.prisma.nFe.findFirst({
      where: { id: nfeId, tenantId, finalidade: '4' },
      include: { itens: true },
    });
    if (!nfe) throw new NotFoundException('NF-e de devolução não encontrada.');
    if (nfe.status !== StatusDFe.RASCUNHO) throw new BadRequestException('Devolução já emitida.');

    const resultado = await this.nfeProvider.autorizar(nfe);
    await this.prisma.nFe.update({
      where: { id: nfeId },
      data: { status: StatusDFe.EMITIDO, chaveAcesso: resultado.chaveAcesso, protocolo: resultado.protocolo,
        xmlEmitido: resultado.xml, pdfDanfe: resultado.danfeUrl, dataEmissao: new Date() },
    });

    this.events.emit('nfe.devolvida', { tenantId, nfeId, filialId: nfe.filialId, itens: nfe.itens, usuarioId });
    return { status: 'EMITIDA', chaveAcesso: resultado.chaveAcesso };
  }

  /** Listener: a devolução faz a mercadoria voltar ao estoque e gera crédito ao cliente. */
  @OnEvent('nfe.devolvida')
  async handleNFeDevolvida(payload: { tenantId: string; nfeId: string; filialId: string; itens: any[]; usuarioId: string }) {
    try {
      const nfe = await this.prisma.nFe.findFirst({ where: { id: payload.nfeId } });
      // 1. Entrada de estoque (devolução)
      for (const item of payload.itens) {
        if (!item.produtoId) continue;
        await this.estoque.movimentar(payload.tenantId, {
          filialId: payload.filialId, produtoId: item.produtoId,
          tipo: TipoMovimentacao.ENTRADA_DEVOLUCAO, quantidade: Number(item.quantidade),
          nfeId: payload.nfeId, usuarioId: payload.usuarioId,
          observacoes: `Devolução NF-e ${nfe?.numero}`,
        });
      }
      // 2. Anula o efeito financeiro — gera um título de crédito (valor negativo) ou cancela os títulos da nota original
      if (nfe?.nfeReferenciadaId) {
        await this.prisma.contaReceber.updateMany({
          where: { nfeId: nfe.nfeReferenciadaId, status: { in: ['ABERTO', 'VENCIDO', 'PARCIAL'] } },
          data: { status: 'CANCELADO', observacoes: `Cancelado por devolução (NF-e ${nfe.numero})` },
        });
      }
      this.logger.log(`✅ nfe.devolvida processada — estoque reentrou + financeiro anulado`);
    } catch (err) {
      this.logger.error(`❌ Erro ao processar nfe.devolvida: ${err.message}`, err.stack);
    }
  }

  // ─────────────────────────────────────────
  // CONSULTAS
  // ─────────────────────────────────────────
  async findAll(tenantId: string, filialId: string, filters: { status?: StatusDFe; dataInicio?: Date; dataFim?: Date }) {
    return this.prisma.nFe.findMany({
      where: {
        tenantId, filialId,
        ...(filters.status && { status: filters.status }),
        ...(filters.dataInicio && { dataEmissao: { gte: filters.dataInicio, ...(filters.dataFim && { lte: filters.dataFim }) } }),
      },
      include: {
        cliente: { select: { razaoSocial: true, cnpjCpf: true } },
        pedido: { select: { numero: true } },
        _count: { select: { itens: true, cartasCorrecao: true } },
      },
      orderBy: { numero: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.nFe.findFirst({
      where: { id, tenantId },
      include: {
        itens: { include: { produto: { select: { codigo: true, descricao: true } } } },
        cliente: true, duplicatas: { orderBy: { numero: 'asc' } },
        cartasCorrecao: { orderBy: { sequencia: 'asc' } },
      },
    });
  }

}

function rnd(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}
