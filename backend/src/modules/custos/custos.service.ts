import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Análise de custos e margem (área do Financeiro/Custos).
 * Custo Base Composto = Aquisição (custo médio das entradas) + Frete rateado + Chapa/descarga.
 * Tudo herdado automaticamente de outros módulos — a equipe NÃO digita custo manual.
 */
@Injectable()
export class CustosService {
  constructor(private prisma: PrismaService) {}

  // Chapa/descarga: valor fixo por caixa (operacional). Configurável no futuro.
  private readonly CHAPA_POR_CAIXA = 0.5;

  /**
   * Monta a composição de custo por produto:
   *  - aquisicao: custo médio do estoque (vem das entradas/compras — FOB do fornecedor)
   *  - chapa: descarga por caixa (fixo) rateado por unidade
   */
  private async composicao(tenantId: string, filialId: string) {
    // Sem rateio de frete operacional no mercado (custo já embutido na aquisição).
    const freteKg = 0;

    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, ativo: true },
      select: {
        id: true, codigo: true, descricao: true, precoVenda: true, precoCusto: true,
        pesoCaixaria: true, pesoLiquido: true,
        unidadeMedida: { select: { sigla: true } },
        estoques: { where: { filialId }, select: { quantidade: true, custoMedio: true } },
      },
    });

    const porProduto = new Map<string, any>();
    for (const p of produtos) {
      const sigla = p.unidadeMedida?.sigla || 'UN';
      const pesoCx = Number(p.pesoCaixaria) || 0;
      const pesoLiq = Number(p.pesoLiquido) || 0;
      // custo médio do estoque (peso do saldo) — senão precoCusto cadastrado
      const custoMedio = Number(p.estoques.find((e) => Number(e.custoMedio) > 0)?.custoMedio ?? p.precoCusto ?? 0);
      const estoqueKg = p.estoques.reduce((s, e) => s + Number(e.quantidade), 0);

      // kg por unidade de venda (KG=1, CX=peso da caixa, UN=peso líquido)
      const kgPorUn = sigla === 'KG' ? 1 : pesoCx > 0 ? pesoCx : pesoLiq > 0 ? pesoLiq : 1;
      const aquisicao = custoMedio;
      const frete = freteKg * kgPorUn;
      // chapa por caixa: CX = 1 caixa; KG/UN = fração pelo peso da caixa (se conhecido)
      const chapa = sigla === 'CX' ? this.CHAPA_POR_CAIXA : pesoCx > 0 ? this.CHAPA_POR_CAIXA * (kgPorUn / pesoCx) : 0;
      const composto = aquisicao + frete + chapa;

      porProduto.set(p.id, {
        produtoId: p.id, codigo: p.codigo, descricao: p.descricao, unidade: sigla, estoqueKg,
        precoVenda: Number(p.precoVenda) || 0, kgPorUn,
        aquisicao, frete, chapa, composto,
      });
    }
    return { freteKg, chapaCaixa: this.CHAPA_POR_CAIXA, porProduto };
  }

  /** Todos os produtos ativos com a composição de custo (para a aba "Custos por produto" + gaveta). */
  async getComposicao(tenantId: string, filialId: string, q?: string) {
    const { freteKg, chapaCaixa, porProduto } = await this.composicao(tenantId, filialId);
    let linhas = Array.from(porProduto.values()).map((c) => {
      const margem = c.precoVenda > 0 ? ((c.precoVenda - c.composto) / c.precoVenda) * 100 : 0;
      return { ...c, margem };
    });
    if (q) {
      const s = q.toLowerCase();
      linhas = linhas.filter((l) => l.descricao.toLowerCase().includes(s) || l.codigo.toLowerCase().includes(s));
    }
    linhas.sort((a, b) => a.descricao.localeCompare(b.descricao));
    return { freteKg, chapaCaixa, produtos: linhas };
  }

  /**
   * Rentabilidade por CLIENTE (expansível para produtos) — estilo relatório NewOxxy.
   * Cada cliente: receita, CMV (custo composto), resultado líquido, margem e peso;
   * ao expandir, os produtos que ele comprou com lucro e % por item.
   */
  async getRentabilidade(tenantId: string, filialId: string, dataIni?: string, dataFim?: string) {
    const range = dataIni
      ? { gte: new Date(dataIni), ...(dataFim && { lte: new Date(dataFim + 'T23:59:59') }) }
      : undefined;

    const itens = await this.prisma.itemNFe.findMany({
      where: {
        produtoId: { not: null },
        nfe: { tenantId, filialId, status: 'EMITIDO', finalidade: { not: '4' }, ...(range && { dataEmissao: range }) },
      },
      select: {
        produtoId: true, codigo: true, descricao: true, quantidade: true, valorTotal: true,
        nfe: { select: { cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } },
      },
    });

    const { porProduto } = await this.composicao(tenantId, filialId);

    type Prod = { codigo: string; descricao: string; qtd: number; venda: number; cmv: number };
    type Cli = { clienteId: string; nome: string; receita: number; cmv: number; peso: number; produtos: Map<string, Prod> };
    const clientes = new Map<string, Cli>();

    for (const it of itens) {
      const cli = it.nfe?.cliente;
      if (!cli) continue;
      const comp = porProduto.get(it.produtoId as string);
      const qtd = Number(it.quantidade);
      const venda = Number(it.valorTotal || 0);
      const cmv = (comp?.composto || 0) * qtd;
      const peso = (comp?.kgPorUn || 1) * qtd;

      if (!clientes.has(cli.id)) {
        clientes.set(cli.id, { clienteId: cli.id, nome: cli.nomeFantasia || cli.razaoSocial || '—', receita: 0, cmv: 0, peso: 0, produtos: new Map() });
      }
      const c = clientes.get(cli.id)!;
      c.receita += venda; c.cmv += cmv; c.peso += peso;

      const pk = it.produtoId as string;
      if (!c.produtos.has(pk)) c.produtos.set(pk, { codigo: it.codigo || comp?.codigo || '', descricao: it.descricao || comp?.descricao || '—', qtd: 0, venda: 0, cmv: 0 });
      const pr = c.produtos.get(pk)!;
      pr.qtd += qtd; pr.venda += venda; pr.cmv += cmv;
    }

    const linhas = Array.from(clientes.values()).map((c) => {
      const resultado = c.receita - c.cmv;
      return {
        clienteId: c.clienteId, nome: c.nome,
        receita: c.receita, custos: c.cmv, resultado,
        margemPct: c.receita > 0 ? (resultado / c.receita) * 100 : 0,
        peso: c.peso,
        produtos: Array.from(c.produtos.values())
          .map((p) => ({
            codigo: p.codigo, descricao: p.descricao, qtd: p.qtd, venda: p.venda, cmv: p.cmv,
            lucroBruto: p.venda - p.cmv, margemPct: p.venda > 0 ? ((p.venda - p.cmv) / p.venda) * 100 : 0,
          }))
          .sort((a, b) => b.margemPct - a.margemPct),
      };
    }).sort((a, b) => b.receita - a.receita);

    const totais = {
      receita: linhas.reduce((s, l) => s + l.receita, 0),
      custos: linhas.reduce((s, l) => s + l.custos, 0),
      resultado: linhas.reduce((s, l) => s + l.resultado, 0),
      peso: linhas.reduce((s, l) => s + l.peso, 0),
      clientes: linhas.length,
      produtos: linhas.reduce((s, l) => s + l.produtos.length, 0),
    };
    totais['margemPct'] = totais.receita > 0 ? (totais.resultado / totais.receita) * 100 : 0;

    return { clientes: linhas, totais };
  }

  /** Salva as cotações (preço do dia) definidas no Web — o app dos compradores lê depois. */
  async salvarCotacao(tenantId: string, filialId: string, usuarioId: string, itens: any[]) {
    const dados = (itens || [])
      .filter((i) => Number(i.precoVenda) > 0)
      .map((i) => ({
        tenantId, filialId, usuarioId,
        produtoId: i.produtoId || null,
        codigo: String(i.codigo || ''),
        descricao: String(i.descricao || ''),
        unidade: i.unidade || null,
        precoVenda: Number(i.precoVenda),
        custoComposto: Number(i.custoComposto || 0),
        cobrir: !!i.cobrir,
        motivo: i.motivo || null,
      }));
    if (dados.length === 0) return { salvas: 0 };
    await this.prisma.cotacao.createMany({ data: dados });
    return { salvas: dados.length };
  }

  /**
   * Cotações de um dia (padrão hoje) — só o que o cliente vê (preço), sem custo interno.
   * Usado pelo app de compras.
   */
  async listarCotacoes(tenantId: string, filialId: string, data?: string) {
    const dia = data ? new Date(data) : new Date();
    const ini = new Date(dia); ini.setHours(0, 0, 0, 0);
    const fim = new Date(dia); fim.setHours(23, 59, 59, 999);
    const cots = await this.prisma.cotacao.findMany({
      where: { tenantId, filialId, data: { gte: ini, lte: fim } },
      orderBy: [{ data: 'desc' }],
      select: { id: true, produtoId: true, codigo: true, descricao: true, unidade: true, precoVenda: true, data: true },
    });
    // Mantém só a cotação mais recente por produto (o último preço do dia)
    const vistos = new Set<string>();
    const recentes = cots.filter((c) => {
      const k = c.produtoId || c.codigo;
      if (vistos.has(k)) return false;
      vistos.add(k); return true;
    });
    return recentes
      .map((c) => ({ ...c, precoVenda: Number(c.precoVenda) }))
      .sort((a, b) => a.descricao.localeCompare(b.descricao));
  }

  async getMargem(tenantId: string, filialId: string, dataIni?: string, dataFim?: string) {
    const range = dataIni
      ? { gte: new Date(dataIni), ...(dataFim && { lte: new Date(dataFim + 'T23:59:59') }) }
      : undefined;

    const vendasMov = await this.prisma.movimentacaoEstoque.findMany({
      where: { tenantId, filialId, tipo: 'SAIDA_VENDA', ...(range && { dataMovimento: range }) },
      select: { produtoId: true, quantidade: true, custoUnitario: true },
    });
    const perdasMov = await this.prisma.movimentacaoEstoque.findMany({
      where: { tenantId, filialId, tipo: { in: ['PERDA', 'AVARIA'] }, ...(range && { dataMovimento: range }) },
      select: { quantidade: true, custoUnitario: true },
    });
    const itensNfe = await this.prisma.itemNFe.findMany({
      where: {
        produtoId: { not: null },
        nfe: { tenantId, filialId, status: 'EMITIDO', finalidade: { not: '4' }, ...(range && { dataEmissao: range }) },
      },
      select: { produtoId: true, quantidade: true, valorTotal: true },
    });

    // Composição de custo (compra+frete+chapa) por produto
    const { porProduto } = await this.composicao(tenantId, filialId);

    type Ag = { qtdVendida: number; qtdFat: number; receita: number };
    const map = new Map<string, Ag>();
    const get = (id: string) => { if (!map.has(id)) map.set(id, { qtdVendida: 0, qtdFat: 0, receita: 0 }); return map.get(id)!; };
    for (const m of vendasMov) { get(m.produtoId).qtdVendida += Number(m.quantidade); }
    for (const it of itensNfe) { const g = get(it.produtoId as string); g.qtdFat += Number(it.quantidade); g.receita += Number(it.valorTotal || 0); }

    const linhas = Array.from(map.keys()).map((id) => {
      const g = map.get(id)!;
      const comp = porProduto.get(id);
      const custoComposto = comp?.composto || 0;
      const precoMedioVenda = g.qtdFat > 0 ? g.receita / g.qtdFat : 0;
      const custoTotal = custoComposto * g.qtdVendida; // CMV pelo custo composto
      const lucroBruto = g.receita - custoTotal;
      const margemPct = g.receita > 0 ? (lucroBruto / g.receita) * 100 : 0;
      return {
        produtoId: id, codigo: comp?.codigo || '', descricao: comp?.descricao || '—',
        unidade: comp?.unidade || '', qtdVendida: g.qtdVendida, precoMedioVenda,
        custoComposto, aquisicao: comp?.aquisicao || 0, frete: comp?.frete || 0, chapa: comp?.chapa || 0,
        receita: g.receita, custoTotal, lucroBruto, margemPct,
      };
    }).sort((a, b) => b.receita - a.receita);

    const cmv = linhas.reduce((s, l) => s + l.custoTotal, 0);
    const receitaTotal = linhas.reduce((s, l) => s + l.receita, 0);
    const perdas = perdasMov.reduce((s, m) => s + Number(m.quantidade) * Number(m.custoUnitario || 0), 0);
    const margemMediaPct = receitaTotal > 0 ? ((receitaTotal - cmv) / receitaTotal) * 100 : 0;

    return {
      kpis: { cmv, receitaTotal, perdas, lucroBruto: receitaTotal - cmv, margemMediaPct },
      produtos: linhas,
    };
  }
}
