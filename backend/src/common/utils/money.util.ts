/**
 * Utilitários monetários — evitam inconsistências de ponto flutuante.
 *
 * O Prisma retorna colunas Decimal como objeto/`string` (Prisma.Decimal), então
 * qualquer conta precisa converter com segurança e SEMPRE arredondar para 2 casas
 * (centavos). A estratégia é trabalhar internamente em centavos inteiros e voltar
 * para reais só no final, eliminando erros como 0.1 + 0.2 !== 0.3.
 */

/** Converte qualquer entrada (Prisma.Decimal, string, number, null) para número seguro. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Converte reais para centavos inteiros (arredondamento bancário simples). */
export function toCents(v: unknown): number {
  return Math.round(toNumber(v) * 100);
}

/** Converte centavos inteiros de volta para reais com 2 casas. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Normaliza um valor monetário para exatamente 2 casas decimais. */
export function money(v: unknown): number {
  return fromCents(toCents(v));
}

/** Soma uma lista de valores monetários sem drift de float (opera em centavos). */
export function sumMoney(values: unknown[]): number {
  return fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));
}

/** Subtração monetária segura (a - b), nunca retornando -0. */
export function subMoney(a: unknown, b: unknown): number {
  return fromCents(toCents(a) - toCents(b));
}

/** Valida que um valor é monetário estritamente positivo; lança se não for. */
export function assertValorPositivo(v: unknown, campo = 'valor'): number {
  const n = money(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`O campo "${campo}" deve ser um valor monetário positivo.`);
  }
  return n;
}

/**
 * Divide um total em N parcelas em centavos, distribuindo a sobra do
 * arredondamento nas primeiras parcelas (soma das parcelas === total exato).
 */
export function ratearParcelas(total: unknown, n: number): number[] {
  const parcelas = Math.max(1, Math.floor(n));
  const totalCents = toCents(total);
  const base = Math.floor(totalCents / parcelas);
  const resto = totalCents - base * parcelas;
  return Array.from({ length: parcelas }, (_, i) =>
    fromCents(base + (i < resto ? 1 : 0)),
  );
}
