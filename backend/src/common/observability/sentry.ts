/**
 * Observabilidade de erros — Sentry OPCIONAL.
 *
 * Liga sozinho apenas quando SENTRY_DSN está definido. Sem DSN, tudo vira no-op
 * (nenhuma dependência é carregada), então o comportamento em dev/local não muda.
 * O objetivo é capturar exceções 5xx em produção sem acoplar o código à ferramenta.
 */

let sentry: typeof import('@sentry/node') | null = null;
let ligado = false;

/** Inicializa o Sentry se houver SENTRY_DSN. Chamado uma vez no bootstrap. */
export async function initObservabilidade(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    sentry = await import('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    ligado = true;
    console.log('🛰️  Sentry ligado para captura de erros.');
  } catch (e) {
    // Falta o pacote ou falhou o init: nunca pode derrubar o boot por causa disso.
    console.warn('⚠️  SENTRY_DSN definido, mas não consegui iniciar o Sentry:', (e as Error).message);
    sentry = null;
    ligado = false;
  }
}

/** Envia uma exceção ao Sentry (no-op se desligado). */
export function capturarExcecao(erro: unknown, contexto?: Record<string, unknown>): void {
  if (!ligado || !sentry) return;
  try {
    sentry.captureException(erro, contexto ? { extra: contexto } : undefined);
  } catch {
    /* nunca propaga erro de telemetria */
  }
}

export function observabilidadeLigada(): boolean {
  return ligado;
}
