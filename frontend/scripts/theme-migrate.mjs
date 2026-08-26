#!/usr/bin/env node
/**
 * theme-migrate — remapeia a paleta CLARA legada para os tokens ESCUROS do
 * tema "site" (near-black #08090A + accent #01B8FA + números brancos).
 *
 * É o mesmo passe que fizemos à mão no Dashboard, agora repetível por pasta.
 * NÃO redesenha layout — só troca cor/linha/fundo. Depois de rodar, revise a
 * tela e faça o polimento fino (charts, inputs, estados de hover específicos).
 *
 * Uso:
 *   node scripts/theme-migrate.mjs --dry  src/modules/financeiro     # só conta
 *   node scripts/theme-migrate.mjs        src/modules/financeiro     # aplica
 *   node scripts/theme-migrate.mjs        src/modules/**\/*.tsx        # aplica
 *
 * Flags:
 *   --dry   não grava; imprime quantas trocas cada arquivo receberia
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

// Ordem IMPORTA: mais específico → mais genérico. Cada par é [de, para].
// Regex globais; usamos strings simples escapadas p/ hex.
const MAP = [
  // ── Fundos ──
  ['bg-white', 'bg-[#101216]'],            // cards, painéis, inputs → surface
  ['#F7F7F8', '#0C0D10'],                  // canvas/hover claro → surface-2
  ['#F9FAFB', '#0C0D10'],
  ['#FAFBFC', '#0C0D10'],
  // ── Linhas / bordas ──
  ['#E5E7EB', '#23262F'],
  ['#EDEFF3', '#23262F'],
  ['#E7E8EC', '#23262F'],
  ['#D9E4E1', '#23262F'],
  ['#EAECEF', '#23262F'],
  // ── Texto ──
  ['#202123', '#F7F8FA'],                  // tinta principal
  ['#5F6065', '#8A90A0'],                  // texto secundário
  ['#8E8F94', '#8A90A0'],                  // texto terciário
  ['#C7C9D4', '#5E6472'],                  // texto/ícone apagado
  // ── Accent (azul do site) ──
  ['#2348C7', '#0E86D4'],                  // accent-2 (hover escuro)
  ['#2F5FE0', '#01B8FA'],                  // accent principal
  ['#5B7BF0', '#22D3EE'],                  // accent claro
  ['#0B0F2B', '#08090A'],                  // navy antigo → near-black
  ['#151A3D', '#101216'],
  ['#39C5A5', '#01B8FA'],
  // ── Semânticos (mantêm o significado, tom p/ fundo escuro) ──
  ['#0FA968', '#2DD4A7'],  ['#0b7d4e', '#2DD4A7'],  ['#0B7D4E', '#2DD4A7'],
  ['#E0483D', '#FF6B7A'],  ['#c3352b', '#FF6B7A'],  ['#C3352B', '#FF6B7A'],

  // ══════════════════════════════════════════════════════════════════════
  // PASSE 2 — sobras do primeiro remap que a revisão tela-a-tela pegou:
  // texto que ficou ILEGÍVEL (tinta escura sobre fundo escuro), placas/bordas
  // ainda claras e o accent OURO legado. Só troca o que é inequívoco.
  // ══════════════════════════════════════════════════════════════════════
  // Tinta escura usada como TEXTO → tinta clara. (O mesmo hex como fundo de
  // backdrop, ex. bg-[#16171D]/40, NÃO casa: só mexemos no prefixo text-/hover:text-.)
  ['hover:text-[#16171D]', 'hover:text-[#F7F8FA]'],
  ['text-[#16171D]', 'text-[#F7F8FA]'],
  // Bordas e placas claras remanescentes → linha/superfície escura.
  ['#E7E5DF', '#23262F'],  ['#E7E5DE', '#23262F'],
  ['#F6F5F2', '#0C0D10'],  ['#EFEDE7', '#0C0D10'],
  // Fundos claros porcelana/creme que sobraram (cabeçalhos de tabela, placas).
  // CLASS-QUALIFIED em bg- para nunca tocar a mesma cor usada como texto/borda.
  ['bg-[#FBFAF7]', 'bg-[#0C0D10]'],  ['bg-[#F0EEE9]', 'bg-[#0C0D10]'],
  ['bg-[#FAFAFA]', 'bg-[#0C0D10]'],  ['bg-[#FAFAF8]', 'bg-[#0C0D10]'],
  ['bg-[#F1F1F3]', 'bg-[#0C0D10]'],  ['bg-[#F4F5F7]', 'bg-[#0C0D10]'],
  ['bg-[#F3F4F6]', 'bg-[#0C0D10]'],  ['bg-[#F0F2F3]', 'bg-[#0C0D10]'],
  // Accent OURO legado (badge/botão/borda/foco) → ciano do site.
  ['hover:bg-[#F5B841]', 'hover:bg-[#0E86D4]'],  ['#F5B841', '#0E86D4'],
  ['#E8A317', '#01B8FA'],  ['#a9760a', '#0E86D4'],
  // Tints amber (Tailwind nomeado) de linhas/botões/chips → neutro ou ciano.
  ['hover:bg-amber-500/20', 'hover:bg-[#01B8FA]/20'],
  ['hover:bg-amber-500/5', 'hover:bg-white/[0.03]'],
  ['bg-amber-500/[0.08]', 'bg-[#01B8FA]/[0.08]'],
  ['bg-amber-500/15', 'bg-[#01B8FA]/12'],
  // Amber SEMÂNTICO (aviso/pendente) → âmbar próprio do tema escuro.
  // (bg-amber-100/50 saíram daqui: o literal 'bg-amber-50' engolia o '50' de
  //  'bg-amber-500'. Agora vão no MAP_RE com fronteira (?![0-9/]).)
  ['text-amber-800', 'text-[#FF9F45]'], ['text-amber-700', 'text-[#FF9F45]'],
  ['text-amber-600', 'text-[#FF9F45]'],

  // ══════════════════════════════════════════════════════════════════════
  // PASSE 3 — hexes cinza claros que a varredura tela-a-tela do app inteiro
  // pegou (secundário/terciário/linha). Os HEX casam MAIÚSC/minúsc porque o
  // loop usa flag `i` para qualquer par que contenha um código hex.
  // ══════════════════════════════════════════════════════════════════════
  ['#8b8d98', '#8A90A0'], ['#5b5d69', '#8A90A0'],
  ['#a0a2ad', '#8A90A0'], ['#9ba1ad', '#8A90A0'],
  ['#6e7480', '#5E6472'], ['#d1d5db', '#23262F'],
  ['#c7c9d2', '#5E6472'], ['#d7d8de', '#5E6472'],
  // Linhas/divisores claros que sobraram (bg claro dessas já foi tratado acima).
  ['#eeede9', '#23262F'], ['#f1f1f3', '#23262F'], ['#eaeaea', '#23262F'],
  // Ouro legado remanescente (hover de botão) → ciano-escuro do tema.
  ['#d6960f', '#0E86D4'],
  // Números em mono legado → utilitário próprio do tema (JetBrains Mono).
  ['font-mono', 'font-num'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ══════════════════════════════════════════════════════════════════════════
// PASSE 3 (regex) — famílias de cor NOMEADAS do Tailwind (slate/rose/emerald/…)
// que o mapa literal não alcança. Cada regra preserva o PREFIXO do utilitário
// (o `hover:`/`focus:`/`md:` e o `text-`/`bg-`/`border-` continuam intactos) e
// troca só "família-tom" por um valor arbitrário `[#hex]`. A opacidade
// (`…/10`, `…/[0.08]`) sobrevive porque a regex não a consome.
// Lookbehind `(?<![\w-])` evita casar "to-" dentro de "photo-", etc.
// Lookahead `(?![0-9])` + tons em ordem maior→menor garantem que "50" nunca
// engole "500".
// ══════════════════════════════════════════════════════════════════════════
const GREY = 'slate|gray|neutral|zinc|stone';
const SH = '950|900|800|700|600|500|400|300|200|100|50';
const COLOR_UTIL = 'text|bg|border|ring|divide|outline|from|via|to|placeholder|fill|stroke';
// keep = mantém o prefixo capturado (p1) e troca só "família-tom" pelo [hex].
const keep = (re, tail) => [re, (_m, p1) => p1 + tail];
// fix = substituição constante (sem capturar prefixo).
const fix = (re, str) => [re, () => str];

// Famílias SEMÂNTICAS: [alternância de nomes, hex do tema escuro].
const SEMANTIC = [
  ['rose|red|pink', '#FF6B7A'],           // perigo / negativo
  ['emerald|green|teal|lime', '#2DD4A7'], // ok / positivo
  ['orange|yellow', '#FF9F45'],           // aviso
  ['violet|purple|fuchsia', '#A78BFA'],   // roxo
  ['amber|cyan|sky|blue|indigo', '#01B8FA'], // MARCA (o dourado legado virou ciano)
];

const MAP_RE = [
  // ── Greys → TEXTO ──  escuros = tinta clara; médio/claro = mudo.
  keep(new RegExp(`(?<![\\w-])(text-)(?:${GREY})-(?:950|900|800|700)(?![0-9])`, 'g'), '[#F7F8FA]'),
  keep(new RegExp(`(?<![\\w-])(text-)(?:${GREY})-(?:600|500|400|300|200|100|50)(?![0-9])`, 'g'), '[#8A90A0]'),
  keep(new RegExp(`(?<![\\w-])(placeholder-)(?:${GREY})-(?:${SH})(?![0-9])`, 'g'), '[#5E6472]'),
  // ── Greys → FUNDO ──  claros=canvas, médios=raised, escuros=canvas.
  keep(new RegExp(`(?<![\\w-])(bg-)(?:${GREY})-(?:50|100)(?![0-9])`, 'g'), '[#0C0D10]'),
  keep(new RegExp(`(?<![\\w-])(bg-)(?:${GREY})-(?:200|300|400|500|600)(?![0-9])`, 'g'), '[#16181F]'),
  keep(new RegExp(`(?<![\\w-])(bg-)(?:${GREY})-(?:700|800|900|950)(?![0-9])`, 'g'), '[#0C0D10]'),
  // ── Greys → LINHAS (border/divide/ring/outline) ──
  keep(new RegExp(`(?<![\\w-])((?:border|divide|ring|outline)-)(?:${GREY})-(?:${SH})(?![0-9])`, 'g'), '[#23262F]'),
  // ── Greys → GRADIENTES ──
  keep(new RegExp(`(?<![\\w-])((?:from|via)-)(?:${GREY})-(?:${SH})(?![0-9])`, 'g'), '[#101216]'),
  keep(new RegExp(`(?<![\\w-])(to-)(?:${GREY})-(?:${SH})(?![0-9])`, 'g'), '[#0C0D10]'),

  // ── Âmbar AVISO ── bg-amber-50/100 SEM opacidade = chip/banner de aviso →
  // tint laranja. Fronteira (?![0-9/]) impede engolir "500" e respeita
  // opacidades já existentes (essas caem na regra genérica da MARCA).
  fix(/(?<![\w-])bg-amber-(?:100|50)(?![0-9/])/g, 'bg-[#FF9F45]/12'),
  // ── HOVER de botão da MARCA ── o hover sólido do accent vira o ciano-escuro,
  // senão base e hover ficariam idênticos (sem feedback). Roda ANTES do
  // genérico da marca. Só tons sólidos (300–600), sem opacidade.
  fix(/(?<![\w-])hover:bg-(?:amber|cyan|sky|blue|indigo)-(?:600|500|400|300)(?![0-9/])/g, 'hover:bg-[#0E86D4]'),
];

// Semânticos: por família, do MAIS específico ao genérico.
//  1) fundo claro (50/100/200 SEM opacidade)  → tint /12   (evita bloco sólido
//     ilegível, ex.: banner de erro bg-rose-50 + text-rose-700).
//  2) borda/ring/divide claro (100/200/300)   → linha /25.
//  3) genérico (qualquer utilitário/tom)       → cor sólida (botões, textos,
//     e tints que já trazem /opacidade preservada).
for (const [fam, hex] of SEMANTIC) {
  MAP_RE.push(fix(new RegExp(`(?<![\\w-])bg-(?:${fam})-(?:200|100|50)(?![0-9/])`, 'g'), `bg-[${hex}]/12`));
  MAP_RE.push(keep(new RegExp(`(?<![\\w-])((?:border|ring|divide)-)(?:${fam})-(?:300|200|100)(?![0-9/])`, 'g'), `[${hex}]/25`));
  MAP_RE.push(keep(new RegExp(`(?<![\\w-])((?:${COLOR_UTIL})-)(?:${fam})-(?:${SH})(?![0-9])`, 'g'), `[${hex}]`));
}

const DRY = process.argv.includes('--dry');
const args = process.argv.slice(2).filter((a) => a !== '--dry');
if (args.length === 0) {
  console.error('Informe pelo menos um arquivo ou pasta. Ex.: node scripts/theme-migrate.mjs src/modules/financeiro');
  process.exit(1);
}

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) walk(join(p, name), out);
  } else if (['.tsx', '.ts', '.jsx', '.css'].includes(extname(p))) {
    out.push(p);
  }
  return out;
}

const files = [];
for (const a of args) {
  try { walk(a, files); } catch { console.warn('ignorado (não existe):', a); }
}

let totalTrocas = 0;
let arquivosMexidos = 0;
for (const file of files) {
  let src = readFileSync(file, 'utf8');
  let n = 0;
  for (const [de, para] of MAP) {
    // Pares que contêm um código hex casam MAIÚSC/minúsc (#E8A317 == #e8a317).
    const isHex = /#[0-9a-fA-F]{3,8}/.test(de);
    const re = new RegExp(escapeRe(de), isHex ? 'gi' : 'g');
    src = src.replace(re, () => { n++; return para; });
  }
  for (const [re, rep] of MAP_RE) {
    src = src.replace(re, (...a) => { n++; return rep(...a); });
  }
  if (n > 0) {
    totalTrocas += n;
    arquivosMexidos++;
    console.log(`${DRY ? '[dry] ' : ''}${file}  —  ${n} troca(s)`);
    if (!DRY) writeFileSync(file, src);
  }
}

console.log(`\n${DRY ? 'PRÉVIA' : 'APLICADO'}: ${totalTrocas} troca(s) em ${arquivosMexidos} arquivo(s) (de ${files.length} analisados).`);
if (DRY) console.log('Nada foi gravado. Rode sem --dry para aplicar.');
