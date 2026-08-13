/**
 * Bipes do caixa via Web Audio API (sem dependência de hardware/arquivo).
 *   - beepOk   → leitura bem-sucedida (agudo, curto)
 *   - beepErro → código não encontrado / falha (grave, mais longo)
 * O AudioContext é criado sob demanda e "acordado" no primeiro uso, pois
 * navegadores só liberam áudio após uma interação do usuário.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, ms: number, type: OscillatorType = 'square', vol = 0.14) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);
  const t0 = ac.currentTime;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.start(t0);
  osc.stop(t0 + ms / 1000);
}

/** Leitura OK — bipe agudo e curto, como o do supermercado. */
export function beepOk() {
  tone(880, 90, 'square');
}

/** Erro — dois tons graves rápidos, claramente diferente do OK. */
export function beepErro() {
  tone(200, 160, 'sawtooth', 0.2);
  setTimeout(() => tone(160, 200, 'sawtooth', 0.2), 130);
}
