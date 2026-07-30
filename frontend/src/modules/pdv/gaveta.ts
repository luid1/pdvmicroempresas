/**
 * Gaveta de dinheiro plugável.
 *
 * A gaveta abre por um "pulso" ESC/POS enviado à impressora térmica
 * (comando ESC p m t1 t2). Como o navegador não imprime bytes crus via
 * window.print, usamos a Web Serial API para falar direto com a porta
 * serial/USB da impressora — sem agente nativo instalado.
 *
 * Modos (VITE_GAVETA_MODO):
 *   - 'desligada' (default) → sem gaveta integrada; o botão manual avisa.
 *   - 'serial'              → abre via Web Serial (Chrome/Edge, contexto seguro).
 *
 * Observação de negócio: muitas térmicas já abrem a gaveta sozinhas ao cortar
 * o cupom, se o driver estiver configurado com o "kick" no corte. Nesse caso
 * deixe em 'desligada' e confie no driver. O modo 'serial' é para quando você
 * quer controlar o pulso pelo PDV.
 */

export type GavetaResultado = { ok: boolean; mensagem?: string };

// Pulso padrão: ESC p 0 25 250  (pino 2 / conector RJ11 da impressora).
const PULSO = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

type SerialLike = {
  requestPort: () => Promise<any>;
  getPorts: () => Promise<any[]>;
};

function serial(): SerialLike | null {
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null;
}

let _porta: any | null = null;

async function garantirPorta(interativo: boolean): Promise<any | null> {
  const s = serial();
  if (!s) return null;
  if (_porta) return _porta;

  // Reaproveita uma porta já autorizada (não exige gesto do usuário).
  const jaAutorizadas = await s.getPorts();
  if (jaAutorizadas.length > 0) {
    _porta = jaAutorizadas[0];
  } else if (interativo) {
    // requestPort exige um gesto do usuário (clique do botão "Abrir gaveta").
    _porta = await s.requestPort();
  } else {
    return null;
  }

  try {
    await _porta.open({ baudRate: 9600 });
  } catch (e: any) {
    // "already open" é ok; qualquer outro erro derruba a porta memoizada.
    if (!/already open/i.test(String(e?.message))) {
      _porta = null;
      throw e;
    }
  }
  return _porta;
}

async function enviarPulso(porta: any): Promise<void> {
  const writer = porta.writable.getWriter();
  try {
    await writer.write(PULSO);
  } finally {
    writer.releaseLock();
  }
}

/** true se a Web Serial existe (habilita o modo 'serial'). */
export function gavetaSerialSuportada(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const modo = (env.VITE_GAVETA_MODO || 'desligada').toString().toLowerCase();
  return modo === 'serial' && !!serial();
}

/**
 * Abre a gaveta manualmente (botão). Pode pedir a seleção da porta na 1ª vez.
 * `interativo=true` porque parte de um clique do operador.
 */
export async function abrirGavetaManual(): Promise<GavetaResultado> {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const modo = (env.VITE_GAVETA_MODO || 'desligada').toString().toLowerCase();
  if (modo !== 'serial') {
    return { ok: false, mensagem: 'Gaveta integrada desligada. Configure VITE_GAVETA_MODO=serial ou use o driver da impressora.' };
  }
  if (!serial()) {
    return { ok: false, mensagem: 'Este navegador não suporta Web Serial (use Chrome/Edge em HTTPS).' };
  }
  try {
    const porta = await garantirPorta(true);
    if (!porta) return { ok: false, mensagem: 'Nenhuma porta selecionada.' };
    await enviarPulso(porta);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, mensagem: e?.message || 'Falha ao abrir a gaveta.' };
  }
}

/**
 * Abertura automática (após venda em dinheiro). Best-effort: só usa uma porta
 * já autorizada — nunca abre um diálogo no meio da venda nem lança erro.
 */
export async function abrirGavetaAuto(): Promise<GavetaResultado> {
  if (!gavetaSerialSuportada()) return { ok: false };
  try {
    const porta = await garantirPorta(false);
    if (!porta) return { ok: false, mensagem: 'Autorize a porta uma vez no botão "Abrir gaveta".' };
    await enviarPulso(porta);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
