// ══════════════════════════════════════════════════════════════════════════
//  PRODUTO UNIVERSAL — FONTE ÚNICA dos tipos de produto (multissegmento).
//
//  O mesmo cadastro de produto serve a mercado e restaurante. O que muda é o
//  TIPO, que define como o item se comporta na venda, no estoque e no custo:
//
//   • SIMPLES   → vendido por unidade, baixa 1 do estoque (refrigerante, doce).
//   • PESAVEL   → vendido por peso/balança (hortifruti, frios, buffet por kg).
//   • PRODUZIDO → feito na casa a partir de INSUMOS via ficha técnica (pizza,
//                 hambúrguer, prato). Baixa os insumos, não a si mesmo.
//   • COMPOSTO  → combo/kit de outros produtos vendidos juntos (combo lanche).
//   • ADICIONAL → complemento/modificador de outro item (bacon extra, borda).
//   • INSUMO    → matéria-prima que NÃO se vende sozinha; só entra em fichas
//                 técnicas (farinha, queijo, molho). Controla estoque de base.
//
//  Fase 2: os tipos vivem aqui no frontend como conceito (sem migração). A
//  ficha técnica é montada/estimada no cliente para validar CMV e margem antes
//  de subir ao backend numa fase futura.
// ══════════════════════════════════════════════════════════════════════════

import {
  Box, Scale, ChefHat, Layers, PlusCircle, Wheat, type LucideIcon,
} from 'lucide-react';
import type { SegmentoTela } from './segmentos';

export type ProdutoTipo =
  | 'SIMPLES'
  | 'PESAVEL'
  | 'PRODUZIDO'
  | 'COMPOSTO'
  | 'ADICIONAL'
  | 'INSUMO';

export interface ProdutoTipoInfo {
  key: ProdutoTipo;
  label: string;
  descricao: string;
  icon: LucideIcon;
  /** Onde este tipo costuma aparecer (só rótulo/UX; ausente = todos os modos). */
  segmentos?: SegmentoTela[];
  /** Tem ficha técnica (consome insumos)? */
  temFicha: boolean;
  /** Aparece para venda direta ao cliente? (INSUMO não) */
  vendavel: boolean;
}

export const PRODUTO_TIPOS: ProdutoTipoInfo[] = [
  { key: 'SIMPLES',   label: 'Simples',   descricao: 'Vendido por unidade. Baixa 1 do estoque.',                 icon: Box,        temFicha: false, vendavel: true },
  { key: 'PESAVEL',   label: 'Pesável',   descricao: 'Vendido por peso na balança (kg).',                        icon: Scale,      temFicha: false, vendavel: true },
  { key: 'PRODUZIDO', label: 'Produzido', descricao: 'Feito na casa a partir de insumos (ficha técnica).',       icon: ChefHat,    segmentos: ['RESTAURANTE'], temFicha: true,  vendavel: true },
  { key: 'COMPOSTO',  label: 'Combo/Kit', descricao: 'Vários produtos vendidos juntos por um preço.',            icon: Layers,     temFicha: true,  vendavel: true },
  { key: 'ADICIONAL', label: 'Adicional', descricao: 'Complemento de outro item (bacon, borda, molho extra).',  icon: PlusCircle, segmentos: ['RESTAURANTE'], temFicha: false, vendavel: true },
  { key: 'INSUMO',    label: 'Insumo',    descricao: 'Matéria-prima. Só entra em fichas — não se vende sozinho.', icon: Wheat,      temFicha: false, vendavel: false },
];

export const produtoTipoInfo = (t: ProdutoTipo): ProdutoTipoInfo =>
  PRODUTO_TIPOS.find((x) => x.key === t) || PRODUTO_TIPOS[0];
