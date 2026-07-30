/**
 * Máquina de estados do pedido (P1-3). Só transições legítimas são aceitas pela
 * rota genérica de logística. Confirmar/cancelar/faturar têm endpoints dedicados
 * com lógica própria (reserva, NF-e), então não passam por aqui.
 *
 * Extraído para um módulo puro para poder ser testado sem instanciar o serviço/Prisma.
 */
export const TRANSICOES_PEDIDO: Record<string, string[]> = {
  RASCUNHO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EM_SEPARACAO', 'CANCELADO'],
  EM_SEPARACAO: ['SEPARADO', 'CONFIRMADO', 'CANCELADO'],
  SEPARADO: ['EM_SEPARACAO', 'FATURADO', 'CANCELADO'],
  FATURADO: ['ENTREGUE', 'DEVOLVIDO'],
  ENTREGUE: ['DEVOLVIDO'],
  CANCELADO: [],
  DEVOLVIDO: [],
};

export type ResultadoTransicao =
  | { ok: true; idempotente?: boolean }
  | { ok: false; motivo: string };

/**
 * Avalia se o pedido pode ir de `atual` para `novo`. Retorna um resultado
 * descritivo em vez de lançar — o chamador decide como reagir (ex.: 400).
 * Transição para o mesmo status é idempotente (ok, sem efeito).
 */
export function avaliarTransicaoPedido(atual: string, novo: string): ResultadoTransicao {
  if (atual === novo) return { ok: true, idempotente: true };
  const permitidas = TRANSICOES_PEDIDO[atual];
  if (!permitidas) return { ok: false, motivo: `Status atual inválido: ${atual}.` };
  if (!permitidas.includes(novo)) {
    return { ok: false, motivo: `Transição de ${atual} para ${novo} não é permitida.` };
  }
  return { ok: true };
}
