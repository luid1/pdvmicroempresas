import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StatusDFe, TipoMovimentacao } from '@prisma/client';
import { money, sumMoney } from '../../common/utils/money.util';
import { PlanoContasService } from '../plano-contas/plano-contas.service';

export interface DreLinha {
  chave: string;
  label: string;
  valor: number;                 // negativo em deduções/custos/despesas
  tipo: 'receita' | 'deducao' | 'resultado' | 'custo' | 'despesa';
  destaque?: boolean;
  /** Detalhamento por conta analítica (drill-down), quando aplicável. */
  detalhe?: { codigo: string; descricao: string; valor: number }[];
}

/**
 * DRE realizada (P0-5 → real). Monta a Demonstração de Resultado a partir dos
 * fatos já registrados no ERP, em regime de competência pela data do documento:
 *
 *  - Receita Bruta ....... NF-e EMITIDAS (valorProdutos) + vendas sem nota
 *                          (Pedidos faturados sem NF-e), sem dupla contagem
 *  - (-) Deduções ........ impostos sobre venda da NF-e (ICMS + ICMS-ST + PIS + COFINS)
 *  - (=) Receita Líquida
 *  - (-) CMV ............. custo das movimentações de SAÍDA por venda (custoUnitário × qtd)
 *  - (=) Lucro Bruto
 *  - (-) Perdas/Quebras .. custo das movimentações PERDA/AVARIA
 *  - (=) Resultado Operacional
 *
 * Observação honesta: despesas administrativas/operacionais fora do CMV dependem
 * de um Plano de Contas com lançamentos classificados — que ainda não é alimentado
 * pelo fluxo. Enquanto isso, o DRE mostra o que é rastreável de fato (sem inventar).
 */
@Injectable()
export class DreService {
  constructor(
    private prisma: PrismaService,
    private planoContas: PlanoContasService,
  ) {}

  /** Compat: a rota antiga `GET /dre` retorna só as linhas. */
  async findAll(tenantId: string, filtros?: { filialId?: string; dataInicio?: string; dataFim?: string }) {
    const { linhas } = await this.gerar(tenantId, filtros);
    return linhas;
  }

  async gerar(tenantId: string, filtros?: { filialId?: string; dataInicio?: string | Date; dataFim?: string | Date }) {
    const { inicio, fim, label } = this.resolverPeriodo(filtros);
    const filialId = filtros?.filialId || undefined;

    // 1. Receita bruta + impostos (NF-e emitidas no período).
    const nfes = await this.prisma.nFe.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialId } : {}),
        status: StatusDFe.EMITIDO,
        dataEmissao: { gte: inicio, lte: fim },
      },
      select: {
        valorProdutos: true, valorIcms: true, valorIcmsSt: true,
        valorPis: true, valorCofins: true,
      },
    });

    const receitaNota = sumMoney(nfes.map((n) => n.valorProdutos));
    const deducoes = sumMoney(
      nfes.flatMap((n) => [n.valorIcms, n.valorIcmsSt, n.valorPis, n.valorCofins]),
    );

    // 1b. Vendas realizadas SEM documento fiscal. O PDV pode operar sem NFC-e
    //     (NFCE_MODO desligado / Central Fiscal inativa): a venda vira um Pedido
    //     FATURADO com baixa de estoque — o CMV entra, mas não há NF-e. Sem isto
    //     a receita ficaria zerada enquanto o custo aparece, gerando um DRE
    //     negativo irreal. Somamos o valor de produtos (subtotal) desses pedidos,
    //     EXCLUINDO os que já possuem NF-e/NFC-e EMITIDA (senão a mesma venda
    //     seria contada duas vezes — a fiscal e a do pedido).
    const vendasSemNota = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialOrigemId: filialId } : {}),
        tipo: 'VENDA',
        status: { in: ['FATURADO', 'ENTREGUE'] },
        dataEmissao: { gte: inicio, lte: fim },
        nfes: { none: { status: StatusDFe.EMITIDO } },
      },
      select: { subtotal: true },
    });
    const receitaSemNota = sumMoney(vendasSemNota.map((p) => p.subtotal));

    const receitaBruta = money(receitaNota + receitaSemNota);
    const receitaLiquida = money(receitaBruta - deducoes);

    // 2. CMV — custo das saídas por venda no período.
    const saidas = await this.prisma.movimentacaoEstoque.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialId } : {}),
        tipo: TipoMovimentacao.SAIDA_VENDA,
        dataMovimento: { gte: inicio, lte: fim },
      },
      select: { quantidade: true, custoUnitario: true },
    });
    const cmv = sumMoney(saidas.map((m) => Number(m.quantidade) * Number(m.custoUnitario)));
    const lucroBruto = money(receitaLiquida - cmv);

    // 3. Perdas e quebras — custo das movimentações PERDA/AVARIA.
    const perdasMov = await this.prisma.movimentacaoEstoque.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialId } : {}),
        tipo: { in: [TipoMovimentacao.PERDA, TipoMovimentacao.AVARIA] },
        dataMovimento: { gte: inicio, lte: fim },
      },
      select: { quantidade: true, custoUnitario: true },
    });
    const perdas = sumMoney(perdasMov.map((m) => Number(m.quantidade) * Number(m.custoUnitario)));
    const resultadoOperacionalBruto = money(lucroBruto - perdas);

    // 4. Despesas operacionais/financeiras + outras receitas — vêm do razão
    //    gerencial (LancamentoFinanceiro classificado no Plano de Contas).
    const { despesasOperacionais, despesasFinanceiras, outrasReceitas } =
      await this.planoContas.despesasPorConta(tenantId, inicio, fim, filialId);

    const resultadoLiquido = money(
      resultadoOperacionalBruto -
        despesasOperacionais.total -
        despesasFinanceiras.total +
        outrasReceitas.total,
    );

    const margemBruta = receitaLiquida > 0 ? Math.round((lucroBruto / receitaLiquida) * 1000) / 10 : 0;
    const margemLiquida =
      receitaLiquida > 0 ? Math.round((resultadoLiquido / receitaLiquida) * 1000) / 10 : 0;

    const linhas: DreLinha[] = [
      { chave: 'receita_bruta', label: 'Receita Bruta de Vendas', valor: receitaBruta, tipo: 'receita', destaque: true },
      { chave: 'deducoes', label: '(-) Impostos sobre Vendas (ICMS/ST/PIS/COFINS)', valor: -deducoes, tipo: 'deducao' },
      { chave: 'receita_liquida', label: '(=) Receita Líquida', valor: receitaLiquida, tipo: 'resultado', destaque: true },
      { chave: 'cmv', label: '(-) CMV — Custo da Mercadoria Vendida', valor: -cmv, tipo: 'custo' },
      { chave: 'lucro_bruto', label: '(=) Lucro Bruto', valor: lucroBruto, tipo: 'resultado', destaque: true },
      { chave: 'perdas', label: '(-) Perdas e Quebras', valor: -perdas, tipo: 'custo' },
      { chave: 'resultado_operacional', label: '(=) Resultado Operacional Bruto', valor: resultadoOperacionalBruto, tipo: 'resultado', destaque: true },
      {
        chave: 'despesas_operacionais',
        label: '(-) Despesas Operacionais',
        valor: -despesasOperacionais.total,
        tipo: 'despesa',
        detalhe: despesasOperacionais.contas,
      },
      {
        chave: 'despesas_financeiras',
        label: '(-) Despesas Financeiras',
        valor: -despesasFinanceiras.total,
        tipo: 'despesa',
        detalhe: despesasFinanceiras.contas,
      },
      {
        chave: 'outras_receitas',
        label: '(+) Outras Receitas',
        valor: outrasReceitas.total,
        tipo: 'receita',
        detalhe: outrasReceitas.contas,
      },
      { chave: 'resultado_liquido', label: '(=) Resultado Líquido', valor: resultadoLiquido, tipo: 'resultado', destaque: true },
    ];

    return {
      periodo: { inicio, fim, label },
      linhas,
      kpis: {
        receitaBruta,
        deducoes,
        receitaLiquida,
        cmv,
        lucroBruto,
        perdas,
        resultado: resultadoOperacionalBruto,
        despesasOperacionais: despesasOperacionais.total,
        despesasFinanceiras: despesasFinanceiras.total,
        outrasReceitas: outrasReceitas.total,
        resultadoLiquido,
        margemBruta,
        margemLiquida,
      },
      cobertura: {
        nfesEmitidas: nfes.length,
        vendasSemNota: vendasSemNota.length,
        movimentacoesVenda: saidas.length,
        observacao:
          'DRE realizada: receita = NF-e emitidas + vendas realizadas sem nota (Pedidos ' +
          'faturados sem NF-e), sem dupla contagem; impostos das NF-e; CMV/perdas das ' +
          'movimentações; despesas do Plano de Contas (contas a pagar categorizadas).',
      },
    };
  }

  /** Período: usa dataInicio/dataFim se informados; senão o mês corrente.
   * A data final é estendida ao FIM DO DIA (23:59:59.999) — senão um filtro
   * de dia único ou que termina "hoje" perderia todas as vendas do último dia
   * (a NF-e é emitida com hora, e `new Date('YYYY-MM-DD')` cai à meia-noite). */
  private resolverPeriodo(filtros?: { dataInicio?: string | Date; dataFim?: string | Date }) {
    const agora = new Date();
    // Aceita Date pronto, 'YYYY-MM-DD' ou ISO completo — sempre resulta em data válida.
    const parse = (v: string | Date, fimDoDia: boolean) => {
      if (v instanceof Date) return v;
      const dia = String(v).slice(0, 10); // descarta qualquer parte de hora/fuso
      return new Date(`${dia}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}`);
    };
    const inicio = filtros?.dataInicio
      ? parse(filtros.dataInicio, false)
      : new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const fim = filtros?.dataFim
      ? parse(filtros.dataFim, true)
      : new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { inicio, fim, label };
  }
}
