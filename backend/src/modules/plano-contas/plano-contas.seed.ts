import { TipoLancamento } from '@prisma/client';

/**
 * Plano de Contas gerencial padrão (foco em DRE).
 *
 * Estrutura por níveis:
 *   nível 1 = grupo (ex.: 3 RESULTADO)
 *   nível 2 = subgrupo (ex.: 3.4 Despesas Operacionais)
 *   nível 3 = conta ANALÍTICA (aceita lançamentos)
 *
 * `tipo` (DEBITO/CREDITO) segue a natureza da conta de resultado:
 *   - CREDITO → aumenta o resultado (receitas)
 *   - DEBITO  → reduz o resultado (deduções, custos, despesas)
 *
 * A classificação dos blocos do DRE é derivada do prefixo do código
 * (3.1 receita, 3.2 dedução, 3.3 custo, 3.4/3.5 despesa, 3.6 outras receitas),
 * então NÃO invente códigos fora deste desenho sem ajustar o DreService.
 */

/** Códigos semânticos usados pelo restante do ERP (nunca hardcode a string solta). */
export const CONTA = {
  // Receitas
  RECEITA_VENDAS: '3.1.01',
  RECEITA_SERVICOS: '3.1.02',
  // Deduções
  IMPOSTOS_VENDA: '3.2.01',
  DEVOLUCOES: '3.2.02',
  // Custos
  CMV: '3.3.01',
  PERDAS: '3.3.02',
  // Despesas operacionais
  SALARIOS: '3.4.01',
  ENCARGOS: '3.4.02',
  COMISSOES: '3.4.03',
  FRETE_MOTORISTA: '3.4.04',
  ALUGUEL: '3.4.05',
  ADMINISTRATIVAS: '3.4.06',
  UTILIDADES: '3.4.07',
  // Despesas financeiras / outras
  DESPESAS_FINANCEIRAS: '3.5.01',
  OUTRAS_DESPESAS: '3.5.02',
  // Outras receitas
  RECEITAS_FINANCEIRAS: '3.6.01',
} as const;

export type ContaCodigo = (typeof CONTA)[keyof typeof CONTA];

interface ContaSeed {
  codigo: string;
  descricao: string;
  tipo: TipoLancamento;
  nivel: number;
  pai: string | null;
  analitica: boolean;
}

const C = TipoLancamento.CREDITO;
const D = TipoLancamento.DEBITO;

/** Chart of accounts padrão semeado por tenant. */
export const PLANO_PADRAO: ContaSeed[] = [
  { codigo: '3', descricao: 'RESULTADO', tipo: C, nivel: 1, pai: null, analitica: false },

  { codigo: '3.1', descricao: 'Receita Bruta', tipo: C, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.1.01', descricao: 'Receita de Vendas', tipo: C, nivel: 3, pai: '3.1', analitica: true },
  { codigo: '3.1.02', descricao: 'Receita de Serviços', tipo: C, nivel: 3, pai: '3.1', analitica: true },

  { codigo: '3.2', descricao: 'Deduções da Receita', tipo: D, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.2.01', descricao: 'Impostos sobre Vendas', tipo: D, nivel: 3, pai: '3.2', analitica: true },
  { codigo: '3.2.02', descricao: 'Devoluções e Abatimentos', tipo: D, nivel: 3, pai: '3.2', analitica: true },

  { codigo: '3.3', descricao: 'Custos', tipo: D, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.3.01', descricao: 'CMV — Custo da Mercadoria Vendida', tipo: D, nivel: 3, pai: '3.3', analitica: true },
  { codigo: '3.3.02', descricao: 'Perdas e Quebras', tipo: D, nivel: 3, pai: '3.3', analitica: true },

  { codigo: '3.4', descricao: 'Despesas Operacionais', tipo: D, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.4.01', descricao: 'Salários e Ordenados', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.02', descricao: 'Encargos e Benefícios', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.03', descricao: 'Comissões de Vendas', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.04', descricao: 'Frete e Diárias de Motorista', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.05', descricao: 'Aluguel e Ocupação', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.06', descricao: 'Despesas Administrativas', tipo: D, nivel: 3, pai: '3.4', analitica: true },
  { codigo: '3.4.07', descricao: 'Água, Luz, Telefone e Internet', tipo: D, nivel: 3, pai: '3.4', analitica: true },

  { codigo: '3.5', descricao: 'Despesas Financeiras e Outras', tipo: D, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.5.01', descricao: 'Juros e Tarifas Bancárias', tipo: D, nivel: 3, pai: '3.5', analitica: true },
  { codigo: '3.5.02', descricao: 'Outras Despesas', tipo: D, nivel: 3, pai: '3.5', analitica: true },

  { codigo: '3.6', descricao: 'Outras Receitas', tipo: C, nivel: 2, pai: '3', analitica: false },
  { codigo: '3.6.01', descricao: 'Receitas Financeiras', tipo: C, nivel: 3, pai: '3.6', analitica: true },
];

/** Interface mínima do Prisma client necessária ao seed (facilita usar dentro de $transaction). */
interface PlanoContasWriter {
  planoContas: {
    count(args: { where: { tenantId: string } }): Promise<number>;
    createMany(args: { data: any[]; skipDuplicates?: boolean }): Promise<unknown>;
  };
}

/**
 * Semeia o plano de contas padrão para um tenant. Idempotente: se já houver
 * qualquer conta para o tenant, não faz nada. Seguro para chamar em onboarding
 * ou de forma preguiçosa (lazy) na primeira leitura da tela.
 */
export async function seedPlanoContas(prisma: PlanoContasWriter, tenantId: string): Promise<number> {
  const existentes = await prisma.planoContas.count({ where: { tenantId } });
  if (existentes > 0) return 0;

  await prisma.planoContas.createMany({
    data: PLANO_PADRAO.map((c) => ({ ...c, tenantId })),
    skipDuplicates: true,
  });
  return PLANO_PADRAO.length;
}
