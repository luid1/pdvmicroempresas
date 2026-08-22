// ══════════════════════════════════════════════════════════════════════════
//  MODOS DE OPERAÇÃO (multissegmento) — FONTE ÚNICA.
//
//  O Lumin é UM núcleo com vários "modos". A empresa escolhe o tipo principal
//  da operação e o sistema mostra/esconde telas, atalhos e dashboards conforme
//  esse modo. Nada é duplicado por segmento: o mesmo financeiro, estoque,
//  clientes e relatórios servem a todos.
//
//  Fase 1: o segmento fica guardado nas PREFERÊNCIAS do usuário (JSON já
//  persistido no backend) — sem migração de banco. Numa fase futura ele migra
//  para o tenant (empresa) de forma definitiva.
// ══════════════════════════════════════════════════════════════════════════

import { Store, UtensilsCrossed, LayoutGrid, type LucideIcon } from 'lucide-react';

/** Modo principal escolhido pela empresa. */
export type Segmento = 'VAREJO' | 'RESTAURANTE' | 'HIBRIDO';

/**
 * Etiqueta de segmento que uma TELA pode carregar.
 * Uma tela SEM etiqueta é "compartilhada" (aparece em todos os modos).
 * Uma tela etiquetada só aparece nos modos compatíveis.
 */
export type SegmentoTela = 'VAREJO' | 'RESTAURANTE';

export const SEGMENTO_PADRAO: Segmento = 'VAREJO';

export interface SegmentoInfo {
  key: Segmento;
  label: string;
  descricao: string;
  exemplos: string;
  icon: LucideIcon;
}

export const SEGMENTOS: SegmentoInfo[] = [
  {
    key: 'VAREJO',
    label: 'Varejo',
    descricao: 'Venda por balcão e código de barras, com caixa rápido.',
    exemplos: 'Mercado, minimercado, conveniência, loja, distribuidora, padaria de balcão.',
    icon: Store,
  },
  {
    key: 'RESTAURANTE',
    label: 'Restaurante',
    descricao: 'Mesas, comandas, cozinha e delivery, com ficha técnica.',
    exemplos: 'Restaurante, bar, pizzaria, hamburgueria, cafeteria, lanchonete, delivery.',
    icon: UtensilsCrossed,
  },
  {
    key: 'HIBRIDO',
    label: 'Híbrido',
    descricao: 'Varejo e restaurante juntos, no mesmo caixa e estoque.',
    exemplos: 'Padaria com salão, mercado com cafeteria, conveniência com lanchonete.',
    icon: LayoutGrid,
  },
];

export const segmentoInfo = (s: Segmento): SegmentoInfo =>
  SEGMENTOS.find((x) => x.key === s) || SEGMENTOS[0];

/**
 * Uma tela deve aparecer no modo atual?
 *  • Sem etiquetas  → compartilhada, aparece em todos os modos.
 *  • Modo HÍBRIDO   → vê tudo (varejo + restaurante).
 *  • Caso contrário → só aparece se a etiqueta bater com o modo.
 */
export function telaNoSegmento(
  etiquetas: SegmentoTela[] | undefined,
  segmento: Segmento,
): boolean {
  if (!etiquetas || etiquetas.length === 0) return true;
  if (segmento === 'HIBRIDO') return true;
  return etiquetas.includes(segmento as SegmentoTela);
}

const CHAVE_PREF = 'segmento';

/** Lê o segmento salvo nas preferências do usuário (com fallback seguro). */
export function segmentoDasPreferencias(preferencias: Record<string, unknown> | undefined): Segmento {
  const v = preferencias?.[CHAVE_PREF];
  if (v === 'VAREJO' || v === 'RESTAURANTE' || v === 'HIBRIDO') return v;
  return SEGMENTO_PADRAO;
}

export const PREF_SEGMENTO = CHAVE_PREF;
