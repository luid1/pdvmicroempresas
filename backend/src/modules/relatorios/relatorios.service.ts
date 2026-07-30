import { Injectable } from '@nestjs/common';
import { StatusFinanceiro, StatusPedido, TipoMovimentacao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Pedidos que representam venda concretizada (para faturamento/ABC/ranking).
const VENDAS_STATUS: StatusPedido[] = [
  StatusPedido.FATURADO,
  StatusPedido.ENTREGUE,
];

interface Periodo {
  de?: string;
  ate?: string;
  filialId?: string;
}

function intervalo(p: Periodo) {
  const ate = p.ate ? new Date(p.ate) : new Date();
  ate.setHours(23, 59, 59, 999);
  const de = p.de ? new Date(p.de) : new Date(ate.getTime() - 30 * 24 * 60 * 60 * 1000);
  de.setHours(0, 0, 0, 0);
  return { de, ate };
}

function classificarABC(percentualAcumulado: number): 'A' | 'B' | 'C' {
  if (percentualAcumulado <= 80) return 'A';
  if (percentualAcumulado <= 95) return 'B';
  return 'C';
}

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────── Curva ABC ─────────────────────────
  /**
   * Curva ABC (Pareto 80/15/5) por produto ou por cliente, com base no
   * faturamento (valorTotal dos itens de pedidos faturados/entregues) no período.
   */
  async curvaABC(tenantId: string, tipo: 'produto' | 'cliente', p: Periodo) {
    const { de, ate } = intervalo(p);

    const itens = await this.prisma.itemPedido.findMany({
      where: {
        pedido: {
          tenantId,
          status: { in: VENDAS_STATUS },
          dataEmissao: { gte: de, lte: ate },
          ...(p.filialId ? { filialOrigemId: p.filialId } : {}),
        },
      },
      select: {
        quantidade: true,
        valorTotal: true,
        produtoId: true,
        descricao: true,
        produto: { select: { codigo: true, descricao: true } },
        pedido: { select: { clienteId: true, cliente: { select: { razaoSocial: true } } } },
      },
      take: 100000,
    });

    const mapa = new Map<
      string,
      { id: string; rotulo: string; valor: number; quantidade: number }
    >();

    for (const it of itens) {
      let chave: string;
      let rotulo: string;
      if (tipo === 'produto') {
        chave = it.produtoId;
        rotulo = it.produto
          ? `${it.produto.descricao}${it.produto.codigo ? ` (${it.produto.codigo})` : ''}`
          : it.descricao;
      } else {
        chave = it.pedido?.clienteId || 'SEM_CLIENTE';
        rotulo = it.pedido?.cliente?.razaoSocial || 'Sem cliente';
      }
      const atual = mapa.get(chave) || { id: chave, rotulo, valor: 0, quantidade: 0 };
      atual.valor += Number(it.valorTotal);
      atual.quantidade += Number(it.quantidade);
      mapa.set(chave, atual);
    }

    const linhas = [...mapa.values()].sort((a, b) => b.valor - a.valor);
    const total = linhas.reduce((s, l) => s + l.valor, 0);

    let acumulado = 0;
    const resultado = linhas.map((l, idx) => {
      acumulado += l.valor;
      const percentual = total > 0 ? (l.valor / total) * 100 : 0;
      const percentualAcumulado = total > 0 ? (acumulado / total) * 100 : 0;
      return {
        posicao: idx + 1,
        id: l.id,
        rotulo: l.rotulo,
        quantidade: Number(l.quantidade.toFixed(3)),
        valor: Number(l.valor.toFixed(2)),
        percentual: Number(percentual.toFixed(2)),
        percentualAcumulado: Number(percentualAcumulado.toFixed(2)),
        classe: classificarABC(percentualAcumulado),
      };
    });

    const resumo = { A: 0, B: 0, C: 0 };
    const valorClasse = { A: 0, B: 0, C: 0 };
    for (const r of resultado) {
      resumo[r.classe] += 1;
      valorClasse[r.classe] += r.valor;
    }

    return {
      periodo: { de, ate },
      tipo,
      total: Number(total.toFixed(2)),
      itens: resultado,
      resumo: {
        A: { itens: resumo.A, valor: Number(valorClasse.A.toFixed(2)) },
        B: { itens: resumo.B, valor: Number(valorClasse.B.toFixed(2)) },
        C: { itens: resumo.C, valor: Number(valorClasse.C.toFixed(2)) },
      },
    };
  }

  // ───────────────────────── Giro de estoque ─────────────────────────
  /**
   * Giro e cobertura de estoque no período: consumo (saídas de venda) vs saldo
   * atual. Itens parados = sem saída no período mas com saldo em estoque.
   */
  async giroEstoque(tenantId: string, p: Periodo) {
    const { de, ate } = intervalo(p);
    const dias = Math.max(1, Math.round((ate.getTime() - de.getTime()) / (24 * 60 * 60 * 1000)));

    // Consumo por produto (saída de venda no período).
    const consumo = await this.prisma.movimentacaoEstoque.groupBy({
      by: ['produtoId'],
      where: {
        tenantId,
        tipo: TipoMovimentacao.SAIDA_VENDA,
        dataMovimento: { gte: de, lte: ate },
        ...(p.filialId ? { filialId: p.filialId } : {}),
      },
      _sum: { quantidade: true },
    });
    const mapaConsumo = new Map(consumo.map((c) => [c.produtoId, Number(c._sum.quantidade ?? 0)]));

    // Saldo atual por produto.
    const saldos = await this.prisma.estoqueSaldo.groupBy({
      by: ['produtoId'],
      where: { tenantId, ...(p.filialId ? { filialId: p.filialId } : {}) },
      _sum: { quantidade: true },
    });
    const mapaSaldo = new Map(saldos.map((s) => [s.produtoId, Number(s._sum.quantidade ?? 0)]));

    const idsProduto = new Set<string>([...mapaConsumo.keys(), ...mapaSaldo.keys()]);
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: [...idsProduto] } },
      select: { id: true, codigo: true, descricao: true },
    });
    const nome = new Map(produtos.map((p) => [p.id, p]));

    const linhas = [...idsProduto].map((id) => {
      const cons = mapaConsumo.get(id) ?? 0;
      const saldo = mapaSaldo.get(id) ?? 0;
      const consumoDiario = cons / dias;
      const giroAnual = saldo > 0 ? (cons / saldo) * (365 / dias) : 0;
      const coberturaDias = consumoDiario > 0 ? saldo / consumoDiario : null; // null = sem consumo
      const prod = nome.get(id);
      return {
        produtoId: id,
        rotulo: prod ? `${prod.descricao}${prod.codigo ? ` (${prod.codigo})` : ''}` : id,
        consumo: Number(cons.toFixed(3)),
        saldoAtual: Number(saldo.toFixed(3)),
        giroAnualizado: Number(giroAnual.toFixed(2)),
        coberturaDias: coberturaDias === null ? null : Math.round(coberturaDias),
        parado: cons <= 0 && saldo > 0,
      };
    });

    linhas.sort((a, b) => b.giroAnualizado - a.giroAnualizado);

    return {
      periodo: { de, ate },
      dias,
      itens: linhas,
      resumo: {
        totalItens: linhas.length,
        parados: linhas.filter((l) => l.parado).length,
      },
    };
  }

  // ───────────────────────── Rankings ─────────────────────────
  async ranking(tenantId: string, tipo: 'cliente' | 'produto', p: Periodo) {
    if (tipo === 'produto') {
      const abc = await this.curvaABC(tenantId, 'produto', p);
      return {
        periodo: abc.periodo,
        tipo,
        itens: abc.itens.slice(0, 50).map((i) => ({
          id: i.id,
          rotulo: i.rotulo,
          valor: i.valor,
          quantidade: i.quantidade,
        })),
      };
    }

    const { de, ate } = intervalo(p);
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        status: { in: VENDAS_STATUS },
        dataEmissao: { gte: de, lte: ate },
        ...(p.filialId ? { filialOrigemId: p.filialId } : {}),
      },
      select: {
        valorTotal: true,
        clienteId: true,
        cliente: { select: { razaoSocial: true } },
      },
      take: 100000,
    });

    const mapa = new Map<string, { id: string; rotulo: string; valor: number; pedidos: number }>();
    for (const ped of pedidos) {
      const chave = ped.clienteId || 'SEM_CLIENTE';
      const rotulo = ped.cliente?.razaoSocial || 'Sem cliente';
      const atual = mapa.get(chave) || { id: chave, rotulo, valor: 0, pedidos: 0 };
      atual.valor += Number(ped.valorTotal);
      atual.pedidos += 1;
      mapa.set(chave, atual);
    }

    const itens = [...mapa.values()]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 50)
      .map((l, idx) => ({
        posicao: idx + 1,
        id: l.id,
        rotulo: l.rotulo,
        valor: Number(l.valor.toFixed(2)),
        pedidos: l.pedidos,
        ticketMedio: Number((l.valor / l.pedidos).toFixed(2)),
      }));

    return { periodo: { de, ate }, tipo, itens };
  }

  // ───────────────────────── Aging financeiro ─────────────────────────
  /**
   * Posição por vencimento (aging) de contas a receber e a pagar em aberto,
   * bucketizadas em: a vencer, 1–30, 31–60, 61–90, 90+ dias de atraso.
   */
  async agingFinanceiro(tenantId: string, filialId?: string) {
    const ABERTOS: StatusFinanceiro[] = [
      StatusFinanceiro.ABERTO,
      StatusFinanceiro.PARCIAL,
      StatusFinanceiro.VENCIDO,
    ];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const bucket = () => ({ aVencer: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90mais: 0, total: 0 });
    const somar = (
      acc: ReturnType<typeof bucket>,
      venc: Date,
      saldo: number,
    ) => {
      acc.total += saldo;
      const diasAtraso = Math.floor((hoje.getTime() - venc.getTime()) / (24 * 60 * 60 * 1000));
      if (diasAtraso <= 0) acc.aVencer += saldo;
      else if (diasAtraso <= 30) acc.d1_30 += saldo;
      else if (diasAtraso <= 60) acc.d31_60 += saldo;
      else if (diasAtraso <= 90) acc.d61_90 += saldo;
      else acc.d90mais += saldo;
    };

    const [receber, pagar] = await Promise.all([
      this.prisma.contaReceber.findMany({
        where: { tenantId, status: { in: ABERTOS }, ...(filialId ? { filialId } : {}) },
        select: { valorOriginal: true, valorPago: true, valorDesconto: true, dataVencimento: true },
        take: 100000,
      }),
      this.prisma.contaPagar.findMany({
        where: { tenantId, status: { in: ABERTOS }, ...(filialId ? { filialId } : {}) },
        select: { valorOriginal: true, valorPago: true, valorDesconto: true, dataVencimento: true },
        take: 100000,
      }),
    ]);

    const aReceber = bucket();
    for (const c of receber) {
      const saldo = Number(c.valorOriginal) - Number(c.valorPago) - Number(c.valorDesconto);
      if (saldo > 0.005) somar(aReceber, new Date(c.dataVencimento), saldo);
    }
    const aPagar = bucket();
    for (const c of pagar) {
      const saldo = Number(c.valorOriginal) - Number(c.valorPago) - Number(c.valorDesconto);
      if (saldo > 0.005) somar(aPagar, new Date(c.dataVencimento), saldo);
    }

    const arredondar = (b: ReturnType<typeof bucket>) => ({
      aVencer: Number(b.aVencer.toFixed(2)),
      d1_30: Number(b.d1_30.toFixed(2)),
      d31_60: Number(b.d31_60.toFixed(2)),
      d61_90: Number(b.d61_90.toFixed(2)),
      d90mais: Number(b.d90mais.toFixed(2)),
      total: Number(b.total.toFixed(2)),
    });

    const r = arredondar(aReceber);
    const p = arredondar(aPagar);
    return {
      geradoEm: hoje,
      aReceber: r,
      aPagar: p,
      saldoLiquido: Number((r.total - p.total).toFixed(2)),
    };
  }
}
