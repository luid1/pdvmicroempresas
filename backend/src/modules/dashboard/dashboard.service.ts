import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DreService } from '../dre/dre.service';

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'custom';
interface Filtros { filialId?: string; periodo?: Periodo; dataInicio?: string; dataFim?: string }

const n = (v: any) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const delta = (atual: number, ant: number) =>
  ant > 0 ? r2(((atual - ant) / ant) * 100) : atual > 0 ? 100 : 0;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService, private dre: DreService) {}

  async findAll(tenantId: string, filialId?: string, periodo: Periodo = 'hoje', dataInicio?: string, dataFim?: string) {
    return this.getDashboard(tenantId, { filialId, periodo, dataInicio, dataFim });
  }

  /**
   * Janela do período atual + a janela anterior de mesmo tamanho.
   * `modo` define a granularidade da série ('dia' p/ períodos curtos, 'mes' p/ longos).
   * Aceita intervalo personalizado (dataInicio/dataFim) — permite ver um dia, mês ou
   * ano específico (faturamento, produtos mais vendidos, etc.).
   */
  private janela(periodo: Periodo, dataInicio?: string, dataFim?: string) {
    const agora = new Date();
    let inicio: Date, fim: Date, label: string;

    if ((periodo === 'custom' || dataInicio || dataFim) && (dataInicio || dataFim)) {
      // Parse de 'YYYY-MM-DD' como data LOCAL (evita o deslocamento de fuso do `new Date(iso)`).
      const local = (s: string, endOfDay = false) => {
        const [y, m, d] = s.slice(0, 10).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
      };
      inicio = local(dataInicio || dataFim!);
      fim = local(dataFim || dataInicio!, true);
      label = inicio.toDateString() === fim.toDateString()
        ? inicio.toLocaleDateString('pt-BR')
        : `${inicio.toLocaleDateString('pt-BR')} – ${fim.toLocaleDateString('pt-BR')}`;
    } else if (periodo === 'ano') {
      inicio = new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0);
      fim = new Date(agora.getFullYear(), 11, 31, 23, 59, 59, 999);
      label = String(agora.getFullYear());
    } else if (periodo === 'mes') {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
      label = inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (periodo === 'semana') {
      inicio = new Date(agora); inicio.setDate(inicio.getDate() - 6); inicio.setHours(0, 0, 0, 0);
      fim = new Date(agora); fim.setHours(23, 59, 59, 999);
      label = '7 dias';
    } else {
      inicio = new Date(agora); inicio.setHours(0, 0, 0, 0);
      fim = new Date(agora); fim.setHours(23, 59, 59, 999);
      label = 'Hoje';
    }

    // Janela anterior de mesmo tamanho (para o Δ%).
    const durMs = fim.getTime() - inicio.getTime();
    const fimAnt = new Date(inicio.getTime() - 1);
    const inicioAnt = new Date(inicio.getTime() - durMs - 1);

    // Granularidade da série: por dia até ~45 dias; por mês acima disso (ano etc.).
    const dias = Math.ceil(durMs / 86400000) + 1;
    const modo: 'dia' | 'mes' = dias > 45 ? 'mes' : 'dia';

    return { inicio, fim, inicioAnt, fimAnt, modo, label };
  }

  async getDashboard(tenantId: string, filtros: Filtros = {}) {
    const { filialId, periodo = 'hoje', dataInicio, dataFim } = filtros;
    const { inicio, fim, inicioAnt, fimAnt, modo, label } = this.janela(periodo, dataInicio, dataFim);
    const agora = new Date();
    const em3 = new Date(agora); em3.setDate(em3.getDate() + 3);
    const em7 = new Date(agora); em7.setDate(em7.getDate() + 7);
    const filF = filialId ? { filialId } : {};
    const pedF = filialId ? { filialOrigemId: filialId } : {};

    const [
      fatPeriodo, fatAnterior, nfesPeriodo, porStatus,
      saldos, validadeSaldos, movsSaida, perdas,
      crAbertas, cpAbertas, vendasSerie, clientesFat, movimentacoesPeriodo,
      entradasPeriodo, produtosAtivos, produtosComSaldo,
      dreRes,
    ] = await Promise.all([
      this.prisma.pedido.aggregate({ _sum: { valorTotal: true }, _count: true, where: { tenantId, ...pedF, tipo: 'VENDA', status: { notIn: ['CANCELADO', 'DEVOLVIDO', 'RASCUNHO'] }, dataEmissao: { gte: inicio, lte: fim } } }),
      this.prisma.pedido.aggregate({ _sum: { valorTotal: true }, _count: true, where: { tenantId, ...pedF, tipo: 'VENDA', status: { notIn: ['CANCELADO', 'DEVOLVIDO', 'RASCUNHO'] }, dataEmissao: { gte: inicioAnt, lte: fimAnt } } }),
      this.prisma.nFe.count({ where: { tenantId, ...filF, status: 'EMITIDO', dataEmissao: { gte: inicio, lte: fim } } }),
      this.prisma.pedido.groupBy({ by: ['status'], where: { tenantId, ...pedF }, _count: true }),
      this.prisma.estoqueSaldo.findMany({ where: { tenantId, ...filF, quantidade: { gt: 0 } }, select: { quantidade: true, custoMedio: true } }),
      this.prisma.estoqueSaldo.findMany({ where: { tenantId, ...filF, quantidade: { gt: 0 }, lote: { dataValidade: { lte: em7 } } }, select: { quantidade: true, custoMedio: true, lote: { select: { dataValidade: true } } } }),
      this.prisma.movimentacaoEstoque.findMany({ where: { tenantId, ...filF, tipo: 'SAIDA_VENDA', dataMovimento: { gte: inicio, lte: fim } }, select: { produtoId: true, quantidade: true, custoUnitario: true } }),
      this.prisma.movimentacaoEstoque.findMany({ where: { tenantId, ...filF, tipo: { in: ['PERDA', 'AVARIA'] }, dataMovimento: { gte: inicio, lte: fim } }, select: { quantidade: true, custoUnitario: true } }),
      this.prisma.contaReceber.findMany({ where: { tenantId, ...(filialId && { filialId }), status: { in: ['ABERTO', 'PARCIAL', 'VENCIDO'] } }, select: { valorOriginal: true, valorPago: true, dataVencimento: true } }),
      this.prisma.contaPagar.findMany({ where: { tenantId, ...(filialId && { filialId }), status: { in: ['ABERTO', 'PARCIAL', 'VENCIDO'] } }, select: { valorOriginal: true, valorPago: true, dataVencimento: true } }),
      this.prisma.pedido.findMany({ where: { tenantId, ...pedF, tipo: 'VENDA', status: { notIn: ['CANCELADO', 'DEVOLVIDO', 'RASCUNHO'] }, dataEmissao: { gte: inicio, lte: fim } }, select: { dataEmissao: true, valorTotal: true } }),
      this.prisma.nFe.groupBy({ by: ['clienteId'], where: { tenantId, ...filF, status: 'EMITIDO', dataEmissao: { gte: inicio, lte: fim }, clienteId: { not: null } }, _sum: { valorNfe: true }, _count: true }),
      this.prisma.movimentacaoEstoque.count({ where: { tenantId, ...filF, dataMovimento: { gte: inicio, lte: fim } } }),
      this.prisma.entradaMercadoria.count({ where: { tenantId, dataEntrada: { gte: inicio, lte: fim } } }),
      this.prisma.produto.count({ where: { tenantId, ativo: true } }),
      this.prisma.estoqueSaldo.groupBy({ by: ['produtoId'], where: { tenantId, ...filF, quantidade: { gt: 0 } } }),
      this.dre.gerar(tenantId, { filialId, dataInicio: inicio.toISOString(), dataFim: fim.toISOString() }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of porStatus) statusMap[g.status] = (g as any)._count;

    // ── Financeiro ──
    const faturamento = n(fatPeriodo._sum.valorTotal);
    const faturamentoAnt = n(fatAnterior._sum.valorTotal);
    const vendasCount = (fatPeriodo as any)._count || 0;
    const ticketMedio = vendasCount > 0 ? r2(faturamento / vendasCount) : 0;

    const aging = (contas: { valorOriginal: any; valorPago: any; dataVencimento: Date }[]) => {
      const b = { vencido: 0, ate7: 0, ate30: 0, mais30: 0, total: 0, qtd: contas.length };
      for (const c of contas) {
        const saldo = n(c.valorOriginal) - n(c.valorPago);
        if (saldo <= 0) continue;
        b.total += saldo;
        const dias = Math.floor((c.dataVencimento.getTime() - agora.getTime()) / 86400000);
        if (dias < 0) b.vencido += saldo;
        else if (dias <= 7) b.ate7 += saldo;
        else if (dias <= 30) b.ate30 += saldo;
        else b.mais30 += saldo;
      }
      for (const k of Object.keys(b) as (keyof typeof b)[]) if (k !== 'qtd') b[k] = r2(b[k] as number);
      return b;
    };
    const receber = aging(crAbertas);
    const pagar = aging(cpAbertas);
    const inadimplenciaPct = receber.total > 0 ? r2((receber.vencido / receber.total) * 100) : 0;
    const saldoProjetado = r2(receber.total - pagar.total);

    // ── Estoque ──
    const valorEstoque = r2(saldos.reduce((s, x) => s + n(x.quantidade) * n(x.custoMedio), 0));
    const validade = { vencido: 0, ate3: 0, ate7: 0 };
    for (const x of validadeSaldos) {
      const dv = x.lote?.dataValidade; if (!dv) continue;
      const dias = Math.floor((dv.getTime() - agora.getTime()) / 86400000);
      if (dias < 0) validade.vencido++;
      else if (dias <= 3) validade.ate3++;
      else if (dias <= 7) validade.ate7++;
    }
    const perdaValor = r2(perdas.reduce((s, m) => s + n(m.quantidade) * n(m.custoUnitario), 0));
    const perdaQtd = r2(perdas.reduce((s, m) => s + n(m.quantidade), 0));
    const rupturas = Math.max(0, produtosAtivos - produtosComSaldo.length);

    // ── Top produtos (saídas por qtd + custo) ──
    const prodAgg = new Map<string, { qtd: number; custo: number }>();
    for (const m of movsSaida) {
      if (!m.produtoId) continue;
      const cur = prodAgg.get(m.produtoId) || { qtd: 0, custo: 0 };
      cur.qtd += n(m.quantidade);
      cur.custo += n(m.quantidade) * n(m.custoUnitario);
      prodAgg.set(m.produtoId, cur);
    }
    const topProdIds = [...prodAgg.entries()].sort((a, b) => b[1].custo - a[1].custo).slice(0, 8);
    const produtos = topProdIds.length
      ? await this.prisma.produto.findMany({ where: { id: { in: topProdIds.map(([id]) => id) } }, select: { id: true, codigo: true, descricao: true } })
      : [];
    const topProdutos = topProdIds.map(([id, v]) => {
      const p = produtos.find((x) => x.id === id);
      return { produtoId: id, codigo: p?.codigo || '—', descricao: p?.descricao || 'Produto', qtd: r2(v.qtd), custo: r2(v.custo) };
    });

    // ── Top clientes (faturamento no período) ──
    const cliIds = clientesFat.map((c) => c.clienteId!).filter(Boolean);
    const clientes = cliIds.length
      ? await this.prisma.cliente.findMany({ where: { id: { in: cliIds } }, select: { id: true, razaoSocial: true, nomeFantasia: true } })
      : [];
    const topClientes = clientesFat
      .map((c) => {
        const cli = clientes.find((x) => x.id === c.clienteId);
        return { clienteId: c.clienteId, nome: cli?.nomeFantasia || cli?.razaoSocial || 'Cliente', valor: r2(n(c._sum.valorNfe)), pedidos: (c as any)._count };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // ── Série de faturamento — buckets por dia ou por mês, cobrindo [inicio, fim] ──
    const chaveBucket = (dt: Date) => modo === 'mes'
      ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      : dt.toISOString().slice(0, 10);
    const labelBucket = (dt: Date) => modo === 'mes'
      ? dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;

    const serie: { dia: string; label: string; valor: number }[] = [];
    const cursor = new Date(inicio);
    if (modo === 'mes') cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= fim) {
      serie.push({ dia: chaveBucket(cursor), label: labelBucket(cursor), valor: 0 });
      if (modo === 'mes') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
    const idx = new Map(serie.map((s, i) => [s.dia, i]));
    for (const v of vendasSerie) {
      if (!v.dataEmissao) continue;
      const i = idx.get(chaveBucket(v.dataEmissao));
      if (i !== undefined) serie[i].valor = r2(serie[i].valor + n(v.valorTotal));
    }

    return {
      periodo, periodoLabel: label,
      // KPIs legados (compat) + novos
      kpis: {
        itensEstoque: produtosComSaldo.length,
        valorEstoque,
        alertasValidade: validade.vencido + validade.ate3 + validade.ate7,
        pedidosPendentes: statusMap['CONFIRMADO'] || 0,
        pedidosSeparacao: statusMap['EM_SEPARACAO'] || 0,
        pedidosSeparados: statusMap['SEPARADO'] || 0,
        nfesHoje: nfesPeriodo,
        faturadoHoje: faturamento,
        contasReceberQtd: receber.qtd,
        contasReceberValor: receber.total,
        movimentacoesHoje: movimentacoesPeriodo,
        perdaHojeValor: perdaValor,
        perdaHojeQtd: perdaQtd,
      },
      financeiro: {
        faturamento, faturamentoAnterior: faturamentoAnt, faturamentoDelta: delta(faturamento, faturamentoAnt),
        nfes: nfesPeriodo, nfesAnterior: 0, vendas: vendasCount,
        ticketMedio,
        margemBruta: dreRes.kpis.margemBruta,
        cmv: dreRes.kpis.cmv,
        resultadoOperacional: dreRes.kpis.resultado,
        receber, pagar, inadimplenciaPct, saldoProjetado,
      },
      estoque: { itensComSaldo: produtosComSaldo.length, valorEstoque, validade, perdaValor, perdaQtd, rupturas, produtosAtivos },
      topClientes,
      topProdutos,
      pedidosPorStatus: {
        RASCUNHO: statusMap['RASCUNHO'] || 0,
        CONFIRMADO: statusMap['CONFIRMADO'] || 0,
        EM_SEPARACAO: statusMap['EM_SEPARACAO'] || 0,
        SEPARADO: statusMap['SEPARADO'] || 0,
        FATURADO: statusMap['FATURADO'] || 0,
        ENTREGUE: statusMap['ENTREGUE'] || 0,
        CANCELADO: statusMap['CANCELADO'] || 0,
      },
      serieFaturamento: serie,
      fluxoDia: {
        entradas: entradasPeriodo,
        faturados: nfesPeriodo,
        entregues: statusMap['ENTREGUE'] || 0,
      },
    };
  }
}
