import { useMemo, useReducer, useRef, useState } from 'react';
import {
  Coins, Percent, Users, CalendarRange, Printer, FileSpreadsheet,
  Calculator, TrendingUp, TrendingDown, Boxes, Search, Pencil, Building2, Tag,
  FileText, Scale, X,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════════
   CUSTOS & MARGEM — Data Grid de tesouraria (Dark Navy/Slate) · Mercado PDV
   Abas: (1) Custos por Produto & Médias — EDIÇÃO INLINE + conversão p/ KG
         (2) Tabelas de Preços por Cliente (exceções comerciais editáveis)
         (3) Rentabilidade por Cliente (grid denso + totalizador)
         (4) Visão Semanal/Diária (fechamento consolidado Custos x Vendas)
         (5) Relatório do Cliente — documento branco elegante p/ impressão/PDF
   Regra do KG: toda quantidade (CX/UN/G/KG) é normalizada para KG; Custo Médio e
   Valor de Venda Médio são SEMPRE por KG.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── Helpers ───────────────────────────────────── */
const R$ = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nkg = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;
const numBR = (v: string) => (v === '' ? 0 : parseFloat(String(v).replace(',', '.')) || 0);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const corMargem = (m: number) => (m < 12 ? 'text-rose-400' : m < 22 ? 'text-amber-400' : 'text-emerald-300');
const corResultado = (v: number) => (v < 0 ? 'text-rose-400' : v === 0 ? 'text-slate-300' : 'text-emerald-300');

/* ══════════════════════════════════════════════════════════════════════════════
   REQUISITO 1 — MOTOR DE CONVERSÃO DE UNIDADES (THE KG RULE)
   normalizeToKg(quantity, unit, weightPerUnit): converte qualquer entrada para KG.
   ════════════════════════════════════════════════════════════════════════════ */
export type Unidade = 'KG' | 'G' | 'CX' | 'UN';
export const UNIDADES: Unidade[] = ['KG', 'G', 'CX', 'UN'];

export function normalizeToKg(quantity: number, unit: Unidade, weightPerUnit = 1): number {
  const q = Number(quantity) || 0;
  const w = Number(weightPerUnit) || 0;
  switch (unit) {
    case 'KG': return q;                 // já está em quilos
    case 'G': return q / 1000;           // gramas → kg
    case 'CX': return q * w;             // caixas × peso da caixa (kg)
    case 'UN': return q * w;             // unidades × peso unitário (kg)
    default: return q;
  }
}

/** Média ponderada de pares {peso, valor}. */
function mediaPonderada(itens: { peso: number; valor: number }[]): number {
  const somaPeso = itens.reduce((s, i) => s + i.peso, 0);
  if (somaPeso <= 0) return 0;
  return itens.reduce((s, i) => s + i.peso * i.valor, 0) / somaPeso;
}

/** Dispara download de um CSV a partir de linhas. */
function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((l) => l.map((c) => {
      const s = String(c ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}_${hojeISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════════
   MOCK DATA — supermercado
   Cada produto tem UMA linha operável: quantidade + unidade de entrada + peso por
   unidade (kg) + custo por unidade de entrada + venda por unidade de entrada.
   ════════════════════════════════════════════════════════════════════════════ */
interface ProdutoMock {
  codigo: string;
  nome: string;
  quantidade: number;
  unidade: Unidade;
  pesoPorUnidade: number; // kg por CX/UN (ignorado em KG/G)
  custoUnit: number;      // custo por unidade de entrada
  vendaUnit: number;      // preço de venda por unidade de entrada
}

const PRODUTOS_MOCK: ProdutoMock[] = [
  { codigo: 'FLV-0012', nome: 'Alface Crespa', quantidade: 730, unidade: 'UN', pesoPorUnidade: 0.30, custoUnit: 1.95, vendaUnit: 3.60 },
  { codigo: 'FLV-0034', nome: 'Laranja Lima', quantidade: 190, unidade: 'CX', pesoPorUnidade: 20, custoUnit: 38.00, vendaUnit: 53.00 },
  { codigo: 'FLV-0051', nome: 'Tomate Italiano', quantidade: 145, unidade: 'CX', pesoPorUnidade: 20, custoUnit: 62.50, vendaUnit: 78.00 },
  { codigo: 'FLV-0088', nome: 'Cogumelo Enoke', quantidade: 790, unidade: 'UN', pesoPorUnidade: 0.10, custoUnit: 3.20, vendaUnit: 6.50 },
  { codigo: 'FLV-0102', nome: 'Batata Lavada', quantidade: 350, unidade: 'CX', pesoPorUnidade: 25, custoUnit: 74.00, vendaUnit: 92.00 },
  { codigo: 'FLV-0119', nome: 'Cebola Nacional', quantidade: 300, unidade: 'CX', pesoPorUnidade: 20, custoUnit: 55.00, vendaUnit: 68.00 },
  { codigo: 'FLV-0143', nome: 'Banana Prata', quantidade: 380, unidade: 'CX', pesoPorUnidade: 22, custoUnit: 44.00, vendaUnit: 56.00 },
  { codigo: 'FLV-0177', nome: 'Cenoura Extra', quantidade: 240, unidade: 'CX', pesoPorUnidade: 25, custoUnit: 48.00, vendaUnit: 60.00 },
  { codigo: 'FLV-0205', nome: 'Maçã Fuji Graúda', quantidade: 160, unidade: 'CX', pesoPorUnidade: 18, custoUnit: 89.00, vendaUnit: 118.00 },
  { codigo: 'FLV-0231', nome: 'Rúcula Hidropônica', quantidade: 900, unidade: 'UN', pesoPorUnidade: 0.25, custoUnit: 1.60, vendaUnit: 2.80 },
  { codigo: 'FLV-0260', nome: 'Pimentão Vermelho', quantidade: 140, unidade: 'CX', pesoPorUnidade: 10, custoUnit: 41.00, vendaUnit: 58.00 },
  { codigo: 'FLV-0288', nome: 'Cogumelo Shitake (granel)', quantidade: 85000, unidade: 'G', pesoPorUnidade: 1, custoUnit: 0.028, vendaUnit: 0.052 },
];

/* Clientes com tabela de preços negociada (Aba 2). */
interface ClienteMock { id: string; fantasia: string; tipo: string; cidade: string }
const CLIENTES_MOCK: ClienteMock[] = [
  { id: 'c1', fantasia: 'Restaurante Bela Vista', tipo: 'Food Service', cidade: 'São Paulo/SP' },
  { id: 'c2', fantasia: 'Hotel Grand Plaza', tipo: 'Rede Hoteleira', cidade: 'Guarulhos/SP' },
  { id: 'c3', fantasia: 'Sacolão do Zé', tipo: 'Varejo', cidade: 'Osasco/SP' },
  { id: 'c4', fantasia: 'Rede Hortifruti Premium', tipo: 'Rede Varejo', cidade: 'Campinas/SP' },
  { id: 'c5', fantasia: 'Buffet Delícias & Cia', tipo: 'Eventos', cidade: 'Santo André/SP' },
];

/* Rentabilidade por cliente (Aba 3). */
interface RentCliente {
  id: string; fantasia: string; bruto: number; devolucoes: number;
  cmv: number; frete: number; despesas: number; peso: number;
}
const RENT_CLIENTES: RentCliente[] = [
  { id: 'c1', fantasia: 'Restaurante Bela Vista', bruto: 48200, devolucoes: 620, cmv: 31800, frete: 1450, despesas: 2100, peso: 4820 },
  { id: 'c2', fantasia: 'Hotel Grand Plaza', bruto: 91600, devolucoes: 1240, cmv: 61200, frete: 2980, despesas: 3850, peso: 9160 },
  { id: 'c3', fantasia: 'Sacolão do Zé', bruto: 27400, devolucoes: 340, cmv: 21900, frete: 980, despesas: 1120, peso: 3420 },
  { id: 'c4', fantasia: 'Rede Hortifruti Premium', bruto: 134800, devolucoes: 2100, cmv: 92300, frete: 4600, despesas: 6200, peso: 15870 },
  { id: 'c5', fantasia: 'Buffet Delícias & Cia', bruto: 19850, devolucoes: 180, cmv: 16400, frete: 720, despesas: 940, peso: 2210 },
  { id: 'c6', fantasia: 'Mercado Central Ltda', bruto: 62300, devolucoes: 890, cmv: 44100, frete: 2050, despesas: 2680, peso: 7640 },
  { id: 'c7', fantasia: 'Pizzaria Forno a Lenha', bruto: 15600, devolucoes: 95, cmv: 12100, frete: 540, despesas: 610, peso: 1480 },
];

/* Fechamento por período (Aba 4). */
interface FechamentoLinha { rotulo: string; vendas: number; custos: number; frete: number; devolucoes: number; peso: number }
const FECHAMENTO_SEMANAL: FechamentoLinha[] = [
  { rotulo: 'Semana 1 · 01–07 Jul', vendas: 128400, custos: 89600, frete: 3800, devolucoes: 1420, peso: 18240 },
  { rotulo: 'Semana 2 · 08–14 Jul', vendas: 141200, custos: 94800, frete: 4100, devolucoes: 1680, peso: 20110 },
  { rotulo: 'Semana 3 · 15–21 Jul', vendas: 118900, custos: 84200, frete: 3550, devolucoes: 1210, peso: 16820 },
  { rotulo: 'Semana 4 · 22–28 Jul', vendas: 156300, custos: 102400, frete: 4620, devolucoes: 2040, peso: 22380 },
  { rotulo: 'Semana 5 · 29–31 Jul', vendas: 61200, custos: 41800, frete: 1780, devolucoes: 560, peso: 8640 },
];
const FECHAMENTO_DIARIO: FechamentoLinha[] = [
  { rotulo: 'Seg · 01 Jul', vendas: 21400, custos: 15100, frete: 640, devolucoes: 240, peso: 3020 },
  { rotulo: 'Ter · 02 Jul', vendas: 18900, custos: 13200, frete: 560, devolucoes: 190, peso: 2680 },
  { rotulo: 'Qua · 03 Jul', vendas: 23600, custos: 16400, frete: 700, devolucoes: 280, peso: 3340 },
  { rotulo: 'Qui · 04 Jul', vendas: 20100, custos: 14000, frete: 600, devolucoes: 210, peso: 2860 },
  { rotulo: 'Sex · 05 Jul', vendas: 26800, custos: 18600, frete: 780, devolucoes: 320, peso: 3780 },
  { rotulo: 'Sáb · 06 Jul', vendas: 17600, custos: 12300, frete: 520, devolucoes: 180, peso: 2560 },
];

/* Compras por cliente (Aba 5 — relatório). qtd em KG, preço médio por KG. */
interface CompraCliente { produto: string; codigo: string; pesoKg: number; precoMedioKg: number }
const COMPRAS_POR_CLIENTE: Record<string, CompraCliente[]> = {
  c1: [
    { produto: 'Tomate Italiano', codigo: 'FLV-0051', pesoKg: 640, precoMedioKg: 3.95 },
    { produto: 'Alface Crespa', codigo: 'FLV-0012', pesoKg: 210, precoMedioKg: 12.20 },
    { produto: 'Cebola Nacional', codigo: 'FLV-0119', pesoKg: 480, precoMedioKg: 3.45 },
    { produto: 'Rúcula Hidropônica', codigo: 'FLV-0231', pesoKg: 95, precoMedioKg: 11.40 },
    { produto: 'Cogumelo Enoke', codigo: 'FLV-0088', pesoKg: 60, precoMedioKg: 66.00 },
  ],
  c2: [
    { produto: 'Maçã Fuji Graúda', codigo: 'FLV-0205', pesoKg: 1080, precoMedioKg: 6.75 },
    { produto: 'Banana Prata', codigo: 'FLV-0143', pesoKg: 1540, precoMedioKg: 2.62 },
    { produto: 'Laranja Lima', codigo: 'FLV-0034', pesoKg: 2200, precoMedioKg: 2.70 },
    { produto: 'Batata Lavada', codigo: 'FLV-0102', pesoKg: 1750, precoMedioKg: 3.72 },
    { produto: 'Tomate Italiano', codigo: 'FLV-0051', pesoKg: 880, precoMedioKg: 3.90 },
  ],
  c3: [
    { produto: 'Batata Lavada', codigo: 'FLV-0102', pesoKg: 900, precoMedioKg: 3.68 },
    { produto: 'Cebola Nacional', codigo: 'FLV-0119', pesoKg: 620, precoMedioKg: 3.40 },
    { produto: 'Cenoura Extra', codigo: 'FLV-0177', pesoKg: 540, precoMedioKg: 2.42 },
    { produto: 'Banana Prata', codigo: 'FLV-0143', pesoKg: 760, precoMedioKg: 2.55 },
  ],
  c4: [
    { produto: 'Maçã Fuji Graúda', codigo: 'FLV-0205', pesoKg: 2160, precoMedioKg: 6.90 },
    { produto: 'Pimentão Vermelho', codigo: 'FLV-0260', pesoKg: 640, precoMedioKg: 5.85 },
    { produto: 'Tomate Italiano', codigo: 'FLV-0051', pesoKg: 1920, precoMedioKg: 3.98 },
    { produto: 'Rúcula Hidropônica', codigo: 'FLV-0231', pesoKg: 220, precoMedioKg: 11.20 },
    { produto: 'Cogumelo Shitake', codigo: 'FLV-0288', pesoKg: 85, precoMedioKg: 52.00 },
    { produto: 'Alface Crespa', codigo: 'FLV-0012', pesoKg: 360, precoMedioKg: 12.00 },
  ],
  c5: [
    { produto: 'Cogumelo Enoke', codigo: 'FLV-0088', pesoKg: 48, precoMedioKg: 65.00 },
    { produto: 'Pimentão Vermelho', codigo: 'FLV-0260', pesoKg: 180, precoMedioKg: 5.80 },
    { produto: 'Maçã Fuji Graúda', codigo: 'FLV-0205', pesoKg: 320, precoMedioKg: 6.95 },
    { produto: 'Rúcula Hidropônica', codigo: 'FLV-0231', pesoKg: 70, precoMedioKg: 11.60 },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════════
   Reducer — edição inline dos produtos (Aba 1) e preços por cliente (Aba 2)
   ════════════════════════════════════════════════════════════════════════════ */
type ProdState = Record<string, ProdutoMock>;
type AcaoProd =
  | { tipo: 'setNum'; codigo: string; campo: 'quantidade' | 'pesoPorUnidade' | 'custoUnit' | 'vendaUnit'; valor: number }
  | { tipo: 'setUnidade'; codigo: string; valor: Unidade };
function reducerProd(state: ProdState, a: AcaoProd): ProdState {
  const atual = state[a.codigo];
  if (!atual) return state;
  if (a.tipo === 'setUnidade') return { ...state, [a.codigo]: { ...atual, unidade: a.valor } };
  return { ...state, [a.codigo]: { ...atual, [a.campo]: a.valor } };
}
const initProd = (): ProdState => Object.fromEntries(PRODUTOS_MOCK.map((p) => [p.codigo, { ...p }]));

interface PrecoNegociado { precoFixo: number; margemMinima: number }
type PrecoClienteState = Record<string, Record<string, PrecoNegociado>>;
function initPrecoCliente(prod: ProdState): PrecoClienteState {
  const st: PrecoClienteState = {};
  for (const c of CLIENTES_MOCK) {
    st[c.id] = {};
    for (const p of PRODUTOS_MOCK) {
      const calc = calcularProduto(prod[p.codigo]);
      st[c.id][p.codigo] = { precoFixo: Math.round(calc.vendaMedioKg * 0.96 * 100) / 100, margemMinima: 12 };
    }
  }
  return st;
}
type AcaoPreco =
  | { tipo: 'setPrecoFixo'; clienteId: string; codigo: string; valor: number }
  | { tipo: 'setMargemMinima'; clienteId: string; codigo: string; valor: number };
function reducerPreco(state: PrecoClienteState, a: AcaoPreco): PrecoClienteState {
  const atual = state[a.clienteId]?.[a.codigo] ?? { precoFixo: 0, margemMinima: 0 };
  const patch = a.tipo === 'setPrecoFixo' ? { precoFixo: a.valor } : { margemMinima: a.valor };
  return { ...state, [a.clienteId]: { ...state[a.clienteId], [a.codigo]: { ...atual, ...patch } } };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Funções de cálculo (KG rule, margem, resultado)
   ════════════════════════════════════════════════════════════════════════════ */
function calcularProduto(p: ProdutoMock) {
  const pesoKg = normalizeToKg(p.quantidade, p.unidade, p.pesoPorUnidade);
  const custoTotal = (Number(p.quantidade) || 0) * (Number(p.custoUnit) || 0);
  const vendaTotal = (Number(p.quantidade) || 0) * (Number(p.vendaUnit) || 0);
  const custoMedioKg = pesoKg > 0 ? custoTotal / pesoKg : 0;
  const vendaMedioKg = pesoKg > 0 ? vendaTotal / pesoKg : 0;
  const lucroKg = vendaMedioKg - custoMedioKg;
  const lucroBruto = vendaTotal - custoTotal;
  const margem = vendaMedioKg > 0 ? (lucroKg / vendaMedioKg) * 100 : 0;
  return { pesoKg, custoTotal, vendaTotal, custoMedioKg, vendaMedioKg, lucroKg, lucroBruto, margem };
}
function calcularRent(c: RentCliente) {
  const liquido = c.bruto - c.devolucoes;
  const totalCustos = c.cmv + c.frete + c.despesas;
  const resultado = liquido - totalCustos;
  const margem = liquido > 0 ? (resultado / liquido) * 100 : 0;
  return { liquido, totalCustos, resultado, margem };
}
function calcularFechamento(f: FechamentoLinha) {
  const liquido = f.vendas - f.devolucoes;
  const totalSaidas = f.custos + f.frete;
  const resultado = liquido - totalSaidas;
  const margem = liquido > 0 ? (resultado / liquido) * 100 : 0;
  return { liquido, totalSaidas, resultado, margem };
}

/* ══════════════════════════════════════════════════════════════════════════════
   REQUISITO 2 — CÉLULA COM EDIÇÃO INLINE INSTANTÂNEA (Click-to-Edit)
   ════════════════════════════════════════════════════════════════════════════ */
function EditableCell({
  value,
  onCommit,
  prefix,
  suffix,
  step = 0.01,
  format,
  className = '',
  tone = 'amber',
}: {
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  format?: (v: number) => string;
  className?: string;
  tone?: 'amber' | 'sky' | 'violet';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const toneBg = tone === 'sky' ? 'bg-sky-500/[0.06]' : tone === 'violet' ? 'bg-violet-500/[0.06]' : 'bg-amber-500/[0.06]';
  const toneText = tone === 'sky' ? 'text-sky-200' : tone === 'violet' ? 'text-violet-200' : 'text-amber-200';

  const iniciar = () => {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = () => {
    onCommit(numBR(draft));
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <td className={`px-2 py-1.5 ${toneBg} ${className}`}>
        <div className="flex items-center bg-slate-900 border-2 border-blue-500 rounded-md overflow-hidden ring-2 ring-blue-500/30 w-32 ml-auto">
          {prefix && <span className="pl-2 text-slate-500 text-xs">{prefix}</span>}
          <input
            ref={inputRef}
            type="number"
            step={step}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            className={`w-full bg-transparent px-1.5 py-1 text-sm text-right font-mono ${toneText} focus:outline-none`}
          />
          {suffix && <span className="pr-2 text-slate-500 text-xs">{suffix}</span>}
        </div>
      </td>
    );
  }
  return (
    <td className={`px-3 py-2 text-right ${toneBg} ${className}`}>
      <button
        onClick={iniciar}
        className={`group inline-flex items-center gap-1 font-mono font-semibold ${toneText} hover:underline decoration-dashed underline-offset-2`}
        title="Clique para editar"
      >
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        {format ? format(value) : `${prefix ?? ''}${nkg(value)}${suffix ?? ''}`}
      </button>
    </td>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
type Aba = 'produtos' | 'precos' | 'rentabilidade' | 'semanal' | 'relatorio';

export default function Custos() {
  const [aba, setAba] = useState<Aba>('produtos');
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());
  const [periodo, setPeriodo] = useState<'diaria' | 'semanal'>('semanal');

  const [prod, dispProd] = useReducer(reducerProd, undefined, initProd);
  const [precoCliente, dispPreco] = useReducer(reducerPreco, undefined, () => initPrecoCliente(initProd()));

  const exportar = () => {
    if (aba === 'produtos') {
      const linhas: (string | number)[][] = [['Código', 'Produto', 'Qtd', 'Un', 'Peso/Un kg', 'Peso Total kg', 'Custo Médio/kg', 'Venda Média/kg', 'Lucro Bruto', 'Margem %']];
      for (const codigo of Object.keys(prod)) {
        const p = prod[codigo];
        const c = calcularProduto(p);
        linhas.push([p.codigo, p.nome, nkg(p.quantidade), p.unidade, nkg(p.pesoPorUnidade), nkg(c.pesoKg), R$(c.custoMedioKg), R$(c.vendaMedioKg), R$(c.lucroBruto), pct(c.margem)]);
      }
      baixarCSV('custos_por_produto_kg', linhas);
    } else if (aba === 'rentabilidade') {
      const linhas: (string | number)[][] = [['Cliente', 'Bruto', 'Líquido', 'CMV', 'Frete', 'Custos & Desp.', 'Resultado', '% Lucro', 'Peso kg']];
      for (const c of RENT_CLIENTES) {
        const r = calcularRent(c);
        linhas.push([c.fantasia, R$(c.bruto), R$(r.liquido), R$(c.cmv), R$(c.frete), R$(r.totalCustos), R$(r.resultado), pct(r.margem), nkg(c.peso)]);
      }
      baixarCSV('rentabilidade_clientes', linhas);
    } else if (aba === 'semanal') {
      const fonte = periodo === 'semanal' ? FECHAMENTO_SEMANAL : FECHAMENTO_DIARIO;
      const linhas: (string | number)[][] = [['Período', 'Vendas', 'Devoluções', 'Custos', 'Frete', 'Resultado', 'Margem %', 'Peso kg']];
      for (const f of fonte) {
        const r = calcularFechamento(f);
        linhas.push([f.rotulo, R$(f.vendas), R$(f.devolucoes), R$(f.custos), R$(f.frete), R$(r.resultado), pct(r.margem), nkg(f.peso)]);
      }
      baixarCSV(`fechamento_${periodo}`, linhas);
    } else if (aba === 'precos') {
      const linhas: (string | number)[][] = [['Cliente', 'Código', 'Produto', 'Preço Fixo Negociado', 'Margem Mínima %']];
      for (const cl of CLIENTES_MOCK) {
        for (const p of PRODUTOS_MOCK) {
          const nn = precoCliente[cl.id][p.codigo];
          linhas.push([cl.fantasia, p.codigo, p.nome, R$(nn.precoFixo), pct(nn.margemMinima)]);
        }
      }
      baixarCSV('tabela_precos_cliente', linhas);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* ── Toolbar ── */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 pt-4 shrink-0 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-300" /> Custos & Margem
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Conversão automática para KG · edição inline · média ponderada · relatório do cliente
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>

            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
              {(['diaria', 'semanal'] as const).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${periodo === p ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {p === 'diaria' ? 'Diária' : 'Semanal'}
                </button>
              ))}
            </div>

            {aba !== 'relatorio' && (
              <button onClick={exportar} className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-sm px-3 py-1.5 rounded-lg transition-colors">
                <FileSpreadsheet className="h-4 w-4" /> Exportar CSV
              </button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-semibold text-sm px-3 py-1.5 rounded-lg transition-colors">
              <Printer className="h-4 w-4 text-sky-400" /> Imprimir
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 overflow-x-auto">
          {([
            ['produtos', 'Custos por Produto & Médias', Calculator],
            ['precos', 'Tabelas de Preços por Cliente', Tag],
            ['rentabilidade', 'Rentabilidade por Cliente', Users],
            ['semanal', 'Visão Semanal (Fechamento)', CalendarRange],
            ['relatorio', 'Relatório do Cliente', FileText],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setAba(key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                aba === key ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-auto">
        {aba === 'produtos' && <AbaProdutos prod={prod} dispProd={dispProd} />}
        {aba === 'precos' && <AbaPrecosCliente precoCliente={precoCliente} dispPreco={dispPreco} prod={prod} />}
        {aba === 'rentabilidade' && <AbaRentabilidade />}
        {aba === 'semanal' && <AbaFechamento periodo={periodo} />}
        {aba === 'relatorio' && <AbaRelatorioCliente />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 1 — Custos por Produto & Médias (EDIÇÃO INLINE + KG RULE)
   ════════════════════════════════════════════════════════════════════════════ */
function AbaProdutos({ prod, dispProd }: { prod: ProdState; dispProd: React.Dispatch<AcaoProd> }) {
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => {
    const arr = PRODUTOS_MOCK.map((p) => prod[p.codigo]);
    const q = busca.trim().toLowerCase();
    return q ? arr.filter((p) => p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)) : arr;
  }, [busca, prod]);

  const totais = useMemo(() => {
    let lucro = 0, receita = 0, custo = 0, pesoKg = 0;
    for (const p of Object.values(prod)) {
      const c = calcularProduto(p);
      lucro += c.lucroBruto; receita += c.vendaTotal; custo += c.custoTotal; pesoKg += c.pesoKg;
    }
    const margem = receita > 0 ? ((receita - custo) / receita) * 100 : 0;
    return { lucro, receita, custo, pesoKg, margem };
  }, [prod]);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
        <Kpi icon={<Boxes className="h-4 w-4" />} cor="sky" label="Receita total" valor={R$(totais.receita)} />
        <Kpi icon={<Coins className="h-4 w-4" />} cor="amber" label="Custo total" valor={R$(totais.custo)} />
        <Kpi icon={<Scale className="h-4 w-4" />} cor="violet" label="Peso total (KG)" valor={`${nkg(totais.pesoKg)} kg`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="emerald" label="Lucro bruto" valor={R$(totais.lucro)} />
        <Kpi icon={<Percent className="h-4 w-4" />} cor="rose" label="Margem consolidada" valor={pct(totais.margem)} />
      </div>

      <div className="flex items-center gap-3 print:hidden">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou código..." className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 w-full focus:outline-none focus:border-amber-400" />
        </div>
        <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Pencil className="h-3 w-3 text-amber-400" /> Clique nas células âmbar/azul para editar · Enter ou sair do campo recalcula tudo
        </span>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-900 z-20">Código</th>
                <th className="px-3 py-3 text-left font-semibold sticky left-[92px] bg-slate-900 z-20">Produto</th>
                <th className="px-3 py-3 text-right font-semibold bg-amber-500/10 text-amber-200"><Ed>Quantidade</Ed></th>
                <th className="px-3 py-3 text-center font-semibold">Un</th>
                <th className="px-3 py-3 text-right font-semibold bg-amber-500/10 text-amber-200"><Ed>Peso/Un</Ed></th>
                <th className="px-3 py-3 text-right font-semibold bg-violet-500/10 text-violet-200">Peso Total KG</th>
                <th className="px-3 py-3 text-right font-semibold bg-amber-500/10 text-amber-200"><Ed>Custo/Un</Ed></th>
                <th className="px-3 py-3 text-right font-semibold">Custo Médio/kg</th>
                <th className="px-3 py-3 text-right font-semibold bg-sky-500/10 text-sky-200"><Ed>Venda/Un</Ed></th>
                <th className="px-3 py-3 text-right font-semibold">Venda Média/kg</th>
                <th className="px-3 py-3 text-right font-semibold">Lucro Bruto</th>
                <th className="px-3 py-3 text-right font-semibold">% Margem</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const c = calcularProduto(p);
                const abaixoCusto = c.vendaMedioKg < c.custoMedioKg;
                return (
                  <tr key={p.codigo} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono text-xs font-bold text-sky-300 sticky left-0 bg-slate-900/95">{p.codigo}</td>
                    <td className="px-3 py-2 sticky left-[92px] bg-slate-900/95">
                      <span className="font-semibold text-slate-100">{p.nome}</span>
                    </td>
                    <EditableCell value={p.quantidade} step={1} tone="amber" onCommit={(v) => dispProd({ tipo: 'setNum', codigo: p.codigo, campo: 'quantidade', valor: v })} format={(v) => nkg(v)} />
                    <td className="px-2 py-1.5 text-center">
                      <select
                        value={p.unidade}
                        onChange={(e) => dispProd({ tipo: 'setUnidade', codigo: p.codigo, valor: e.target.value as Unidade })}
                        className="bg-slate-900 border border-slate-600 rounded-md px-1.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <EditableCell value={p.pesoPorUnidade} step={0.01} tone="amber" onCommit={(v) => dispProd({ tipo: 'setNum', codigo: p.codigo, campo: 'pesoPorUnidade', valor: v })} suffix=" kg" format={(v) => `${nkg(v)} kg`} />
                    <td className="px-3 py-2 text-right font-mono font-bold text-violet-200 bg-violet-500/[0.06]">{nkg(c.pesoKg)} kg</td>
                    <EditableCell value={p.custoUnit} step={0.01} tone="amber" prefix="R$" onCommit={(v) => dispProd({ tipo: 'setNum', codigo: p.codigo, campo: 'custoUnit', valor: v })} format={(v) => R$(v)} />
                    <td className="px-3 py-2 text-right font-mono text-slate-400">{R$(c.custoMedioKg)}<span className="text-slate-600 text-[10px]">/kg</span></td>
                    <EditableCell value={p.vendaUnit} step={0.01} tone="sky" prefix="R$" onCommit={(v) => dispProd({ tipo: 'setNum', codigo: p.codigo, campo: 'vendaUnit', valor: v })} format={(v) => R$(v)} />
                    <td className="px-3 py-2 text-right font-mono font-bold text-sky-300 bg-sky-500/[0.06]">{R$(c.vendaMedioKg)}<span className="text-slate-600 text-[10px]">/kg</span></td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${abaixoCusto ? 'text-rose-400' : 'text-slate-100'}`}>{R$(c.lucroBruto)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-extrabold ${corMargem(c.margem)}`}>{pct(c.margem)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 border-t-2 border-amber-400/40 font-bold sticky bottom-0">
                <td className="px-3 py-2.5 text-slate-200 sticky left-0 bg-slate-900" colSpan={2}>TOTAL · {PRODUTOS_MOCK.length} produtos</td>
                <td colSpan={3} />
                <td className="px-3 py-2.5 text-right font-mono text-violet-200">{nkg(totais.pesoKg)} kg</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-300">{R$(totais.custo)}</td>
                <td />
                <td className="px-3 py-2.5 text-right font-mono text-sky-300">{R$(totais.receita)}</td>
                <td />
                <td className="px-3 py-2.5 text-right font-mono text-emerald-300">{R$(totais.lucro)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${corMargem(totais.margem)}`}>{pct(totais.margem)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
/** Selo "editável" no cabeçalho. */
function Ed({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> {children}</span>;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 2 — Tabelas de Preços por Cliente
   ════════════════════════════════════════════════════════════════════════════ */
function AbaPrecosCliente({
  precoCliente,
  dispPreco,
  prod,
}: {
  precoCliente: PrecoClienteState;
  dispPreco: React.Dispatch<AcaoPreco>;
  prod: ProdState;
}) {
  const [clienteId, setClienteId] = useState(CLIENTES_MOCK[0].id);
  const cliente = CLIENTES_MOCK.find((c) => c.id === clienteId)!;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/60 overflow-y-auto print:hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Clientes</p>
        </div>
        {CLIENTES_MOCK.map((c) => (
          <button key={c.id} onClick={() => setClienteId(c.id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-800/70 transition-colors ${clienteId === c.id ? 'bg-amber-500/10 border-l-2 border-l-amber-400' : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'}`}>
            <p className={`text-sm font-semibold truncate ${clienteId === c.id ? 'text-amber-200' : 'text-slate-200'}`}>{c.fantasia}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{c.tipo} · {c.cidade}</p>
          </button>
        ))}
      </aside>

      <div className="flex-1 min-w-0 overflow-auto p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-5 w-5 text-amber-300" />
          <div>
            <h2 className="text-base font-bold text-white">{cliente.fantasia}</h2>
            <p className="text-xs text-slate-500">Preços fixos negociados e margem mínima aceitável por produto (base KG)</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Produto</th>
                  <th className="px-3 py-3 text-right font-semibold">Custo Médio/kg</th>
                  <th className="px-3 py-3 text-right font-semibold">Venda Média/kg</th>
                  <th className="px-3 py-3 text-right font-semibold bg-amber-500/10 text-amber-200"><Ed>Preço Fixo Negociado</Ed></th>
                  <th className="px-3 py-3 text-right font-semibold bg-violet-500/10 text-violet-200"><Ed>Margem Mín. %</Ed></th>
                  <th className="px-3 py-3 text-right font-semibold">Margem no Preço Fixo</th>
                  <th className="px-3 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {PRODUTOS_MOCK.map((pm) => {
                  const p = prod[pm.codigo];
                  const c = calcularProduto(p);
                  const neg = precoCliente[clienteId][p.codigo];
                  const margemFixo = neg.precoFixo > 0 ? ((neg.precoFixo - c.custoMedioKg) / neg.precoFixo) * 100 : 0;
                  const violado = margemFixo < neg.margemMinima;
                  return (
                    <tr key={p.codigo} className="border-t border-slate-800 hover:bg-slate-800/40">
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-100">{p.nome}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">{p.codigo}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-300/90">{R$(c.custoMedioKg)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400">{R$(c.vendaMedioKg)}</td>
                      <EditableCell value={neg.precoFixo} step={0.01} tone="amber" prefix="R$" onCommit={(v) => dispPreco({ tipo: 'setPrecoFixo', clienteId, codigo: p.codigo, valor: v })} format={(v) => R$(v)} />
                      <EditableCell value={neg.margemMinima} step={0.5} tone="violet" suffix="%" onCommit={(v) => dispPreco({ tipo: 'setMargemMinima', clienteId, codigo: p.codigo, valor: v })} format={(v) => pct(v)} />
                      <td className={`px-3 py-2 text-right font-mono font-bold ${corMargem(margemFixo)}`}>{pct(margemFixo)}</td>
                      <td className="px-3 py-2 text-center">
                        {violado
                          ? <span className="inline-block bg-rose-500/15 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Abaixo do mínimo</span>
                          : <span className="inline-block bg-emerald-500/15 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">OK</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 3 — Rentabilidade por Cliente
   ════════════════════════════════════════════════════════════════════════════ */
function AbaRentabilidade() {
  const linhas = useMemo(() => [...RENT_CLIENTES].sort((a, b) => calcularRent(b).resultado - calcularRent(a).resultado), []);
  const totais = useMemo(() => {
    const t = RENT_CLIENTES.reduce(
      (acc, c) => {
        const r = calcularRent(c);
        acc.bruto += c.bruto; acc.liquido += r.liquido; acc.cmv += c.cmv; acc.frete += c.frete;
        acc.custos += r.totalCustos; acc.resultado += r.resultado; acc.peso += c.peso;
        return acc;
      },
      { bruto: 0, liquido: 0, cmv: 0, frete: 0, custos: 0, resultado: 0, peso: 0 },
    );
    return { ...t, margem: t.liquido > 0 ? (t.resultado / t.liquido) * 100 : 0 };
  }, []);

  return (
    <div className="p-4">
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-900 z-20">Nome Fantasia</th>
                <th className="px-3 py-3 text-right font-semibold">Vlr Bruto Vendido</th>
                <th className="px-3 py-3 text-right font-semibold">Vlr Líquido</th>
                <th className="px-3 py-3 text-right font-semibold">Total CMV</th>
                <th className="px-3 py-3 text-right font-semibold">Valor Frete</th>
                <th className="px-3 py-3 text-right font-semibold">Total Custos & Desp.</th>
                <th className="px-3 py-3 text-right font-semibold bg-emerald-500/10 text-emerald-200">Resultado Líquido</th>
                <th className="px-3 py-3 text-right font-semibold">% Lucro</th>
                <th className="px-3 py-3 text-right font-semibold">Peso Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => {
                const r = calcularRent(c);
                return (
                  <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-bold text-slate-100 sticky left-0 bg-slate-900/95">{c.fantasia}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(c.bruto)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(r.liquido)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{R$(c.cmv)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{R$(c.frete)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{R$(r.totalCustos)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-extrabold bg-emerald-500/[0.05] ${corResultado(r.resultado)}`}>{R$(r.resultado)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-bold ${corMargem(r.margem)}`}>{pct(r.margem)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">{nkg(c.peso)} kg</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 border-t-2 border-amber-400/40 font-bold sticky bottom-0">
                <td className="px-3 py-2.5 text-slate-200 sticky left-0 bg-slate-900">TOTAL GERAL · {RENT_CLIENTES.length} clientes</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-200">{R$(totais.bruto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-200">{R$(totais.liquido)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(totais.cmv)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(totais.frete)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(totais.custos)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${corResultado(totais.resultado)}`}>{R$(totais.resultado)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${corMargem(totais.margem)}`}>{pct(totais.margem)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{nkg(totais.peso)} kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 4 — Visão Semanal / Diária (Fechamento)
   ════════════════════════════════════════════════════════════════════════════ */
function AbaFechamento({ periodo }: { periodo: 'diaria' | 'semanal' }) {
  const fonte = periodo === 'semanal' ? FECHAMENTO_SEMANAL : FECHAMENTO_DIARIO;
  const totais = useMemo(() => {
    const t = fonte.reduce(
      (acc, f) => {
        const r = calcularFechamento(f);
        acc.vendas += f.vendas; acc.devolucoes += f.devolucoes; acc.custos += f.custos;
        acc.frete += f.frete; acc.resultado += r.resultado; acc.peso += f.peso;
        return acc;
      },
      { vendas: 0, devolucoes: 0, custos: 0, frete: 0, resultado: 0, peso: 0 },
    );
    const liq = t.vendas - t.devolucoes;
    return { ...t, margem: liq > 0 ? (t.resultado / liq) * 100 : 0 };
  }, [fonte]);
  const maxVendas = Math.max(...fonte.map((f) => f.vendas), 1);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="sky" label={`Vendas (${periodo === 'semanal' ? 'mês' : 'período'})`} valor={R$(totais.vendas)} />
        <Kpi icon={<Coins className="h-4 w-4" />} cor="amber" label="Custos totais" valor={R$(totais.custos)} />
        <Kpi icon={totais.resultado < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />} cor={totais.resultado < 0 ? 'rose' : 'emerald'} label="Resultado" valor={R$(totais.resultado)} />
        <Kpi icon={<Percent className="h-4 w-4" />} cor="violet" label="Margem consolidada" valor={pct(totais.margem)} />
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
        <h3 className="font-semibold text-sm text-slate-200 px-5 py-3 border-b border-slate-700/60 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-amber-300" /> Fechamento {periodo === 'semanal' ? 'Semanal' : 'Diário'} · Custos × Vendas
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-900 z-20">Período</th>
                <th className="px-3 py-3 text-right font-semibold">Vendas</th>
                <th className="px-3 py-3 text-right font-semibold">Devoluções</th>
                <th className="px-3 py-3 text-right font-semibold">Custos</th>
                <th className="px-3 py-3 text-right font-semibold">Frete</th>
                <th className="px-3 py-3 text-right font-semibold bg-emerald-500/10 text-emerald-200">Resultado</th>
                <th className="px-3 py-3 text-right font-semibold">Margem %</th>
                <th className="px-3 py-3 text-right font-semibold">Peso kg</th>
                <th className="px-3 py-3 text-left font-semibold w-40">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {fonte.map((f) => {
                const r = calcularFechamento(f);
                return (
                  <tr key={f.rotulo} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-semibold text-slate-100 sticky left-0 bg-slate-900/95">{f.rotulo}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sky-300">{R$(f.vendas)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">{R$(f.devolucoes)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-300/90">{R$(f.custos)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{R$(f.frete)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-extrabold bg-emerald-500/[0.05] ${corResultado(r.resultado)}`}>{R$(r.resultado)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-bold ${corMargem(r.margem)}`}>{pct(r.margem)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">{nkg(f.peso)}</td>
                    <td className="px-3 py-2.5">
                      <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${(f.vendas / maxVendas) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 border-t-2 border-amber-400/40 font-bold sticky bottom-0">
                <td className="px-3 py-2.5 text-slate-200 sticky left-0 bg-slate-900">CONSOLIDADO · {fonte.length} períodos</td>
                <td className="px-3 py-2.5 text-right font-mono text-sky-300">{R$(totais.vendas)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{R$(totais.devolucoes)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-300">{R$(totais.custos)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{R$(totais.frete)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${corResultado(totais.resultado)}`}>{R$(totais.resultado)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${corMargem(totais.margem)}`}>{pct(totais.margem)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{nkg(totais.peso)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   REQUISITO 3 — ABA 5 — RELATÓRIO DO CLIENTE (documento branco elegante + PDF)
   ════════════════════════════════════════════════════════════════════════════ */
function AbaRelatorioCliente() {
  const [clienteId, setClienteId] = useState(CLIENTES_MOCK[0].id);
  const [visao, setVisao] = useState<'diaria' | 'semanal' | 'mensal'>('mensal');
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());

  const cliente = CLIENTES_MOCK.find((c) => c.id === clienteId)!;
  const compras = COMPRAS_POR_CLIENTE[clienteId] ?? [];

  const linhas = compras.map((cp) => ({ ...cp, total: cp.pesoKg * cp.precoMedioKg }));
  const totalPeso = linhas.reduce((s, l) => s + l.pesoKg, 0);
  const totalFaturado = linhas.reduce((s, l) => s + l.total, 0);
  const precoMedioGeral = totalPeso > 0 ? totalFaturado / totalPeso : 0;

  const fmtData = (iso: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—');
  const emissao = new Date().toLocaleString('pt-BR');
  const VISAO_LABEL: Record<string, string> = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };

  return (
    <div className="p-4">
      {/* CSS de impressão: no print, esconde tudo menos o documento */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #relatorio-doc, #relatorio-doc * { visibility: visible !important; }
          #relatorio-doc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      {/* Filtros (não imprime) */}
      <div className="no-print bg-slate-800/50 rounded-2xl border border-slate-700/60 p-4 mb-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">
          Cliente
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400 min-w-[220px]">
            {CLIENTES_MOCK.map((c) => <option key={c.id} value={c.id}>{c.fantasia}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">
          Tipo de Visão
          <select value={visao} onChange={(e) => setVisao(e.target.value as 'diaria' | 'semanal' | 'mensal')}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400">
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">De
          <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">Até
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </label>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-lg shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento elegante (branco) — este é o que imprime */}
      <div id="relatorio-doc" className="mx-auto max-w-3xl bg-white text-slate-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Cabeçalho com logo */}
        <div className="px-10 pt-10 pb-6 border-b-4 border-emerald-600">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl tracking-tight">H</div>
              <div>
                <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">HETROS</p>
                <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-700 font-semibold mt-1">Hortifruti & Distribuição</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">Relatório de Compras</p>
              <p className="text-xs text-slate-500 mt-0.5">Visão {VISAO_LABEL[visao]}</p>
              <p className="text-xs text-slate-500">Emitido em {emissao}</p>
            </div>
          </div>
        </div>

        {/* Dados do cliente + período */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Cliente</p>
            <p className="text-lg font-bold text-slate-900">{cliente.fantasia}</p>
            <p className="text-sm text-slate-500">{cliente.tipo} · {cliente.cidade}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Período de Referência</p>
            <p className="text-lg font-bold text-slate-900">{fmtData(ini)} — {fmtData(fim)}</p>
            <p className="text-sm text-slate-500">{linhas.length} produtos adquiridos</p>
          </div>
        </div>

        {/* Tabela do documento */}
        <div className="px-10 pb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-3 py-2.5 border-b-2 border-slate-200">Produto</th>
                <th className="text-right font-semibold px-3 py-2.5 border-b-2 border-slate-200">Qtd (kg)</th>
                <th className="text-right font-semibold px-3 py-2.5 border-b-2 border-slate-200">Preço Médio (R$/kg)</th>
                <th className="text-right font-semibold px-3 py-2.5 border-b-2 border-slate-200">Total Faturado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className="border-b border-slate-100">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-slate-800">{l.produto}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">{l.codigo}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{nkg(l.pesoKg)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{R$(l.precoMedioKg)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">{R$(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totalizadores no rodapé */}
        <div className="px-10 pb-8">
          <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 p-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Peso Total</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{nkg(totalPeso)} kg</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Preço Médio Geral</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{R$(precoMedioGeral)}<span className="text-sm font-semibold text-slate-400">/kg</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Total Faturado no Período</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">{R$(totalFaturado)}</p>
            </div>
          </div>
        </div>

        {/* Rodapé documento */}
        <div className="px-10 py-4 bg-slate-900 text-slate-300 text-[11px] flex items-center justify-between">
          <span>Mercado Central · CNPJ 00.000.000/0001-00 · São Paulo/SP</span>
          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Documento gerado eletronicamente</span>
        </div>
      </div>
    </div>
  );
}

/* dummy export para manter X importado (usado em telas de modal futuras) */
export const _X = X;

/* ══════════════════════════════════════════════════════════════════════════════
   KPI card
   ════════════════════════════════════════════════════════════════════════════ */
const CORES: Record<string, string> = {
  amber: 'bg-amber-400/10 text-amber-300',
  sky: 'bg-sky-400/10 text-sky-300',
  rose: 'bg-rose-400/10 text-rose-300',
  emerald: 'bg-emerald-400/10 text-emerald-300',
  violet: 'bg-violet-400/10 text-violet-300',
};
function Kpi({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string; cor: string }) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-white tracking-tight truncate">{valor}</p>
    </div>
  );
}
