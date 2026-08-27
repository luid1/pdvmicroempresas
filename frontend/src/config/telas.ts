// Catálogo central das telas do ERP — FONTE ÚNICA usada pelo menu (AppShell),
// pelo guard de rotas e pela tela de Perfis (Usuários & Acessos).
// A "key" é a própria rota. O menu deriva 100% desta lista.

import {
  LayoutDashboard, Users, Package, Warehouse, FileText,
  DollarSign, ClipboardList, BarChart3, Settings,
  Building2, AlertTriangle, Receipt, ShieldCheck,
  ShoppingCart, Coins, Landmark, Repeat,
  Tags, Undo2, Gauge, Store,
  LayoutGrid, ChefHat, Bike, ClipboardCheck, QrCode, SplitSquareHorizontal,
} from 'lucide-react';
import type { ElementType } from 'react';
import { telaNoSegmento, type Segmento, type SegmentoTela } from './segmentos';

/** Sub-item exibido no flyout (menu que abre ao passar o mouse no item pai). */
export interface SubTela {
  key: string;      // rota (deve existir como TelaDef p/ herdar permissão)
  label: string;
  icon?: ElementType;
  hint?: string;    // descrição curta opcional exibida abaixo do rótulo
}

export interface TelaDef {
  key: string;
  label: string;
  grupo: string;
  icon?: ElementType;
  /** Destaca o item (cor âmbar) no menu. */
  highlight?: boolean;
  /** Selo pequeno ao lado do rótulo (ex.: '!'). */
  badge?: string;
  badgeColor?: string;
  /** Fora do menu lateral, mas ainda acessível por rota/permissão. */
  oculto?: boolean;
  /**
   * Tela do DONO DA PLATAFORMA (SaaS): só o super-admin enxerga/acessa,
   * mesmo o ADMIN da loja (que normalmente vê tudo) fica de fora.
   */
  soDono?: boolean;
  /**
   * Item "pasta": NÃO é uma página (o `key` é sintético, não uma rota).
   * Serve só de abridor — ao passar o mouse, o submenu lista as páginas
   * reais de conteúdo. Cada página do submenu existe também como TelaDef
   * própria (marcada `oculto`) para herdar rota/permissão.
   */
  pasta?: boolean;
  /** Sub-páginas exibidas num flyout ao passar o mouse (hover) sobre este item. */
  submenu?: SubTela[];
  /**
   * Modos de operação em que a tela aparece (multissegmento).
   * Ausente/vazio = tela COMPARTILHADA (aparece em Varejo, Restaurante e Híbrido).
   * Ex.: ['RESTAURANTE'] → só em Restaurante e Híbrido.
   */
  segmentos?: SegmentoTela[];
}

export const TELAS: TelaDef[] = [
  // ══════════════════════════════════════════════════════════════════════
  //  MODO MERCADO — telas organizadas pela área responsável.
  // ══════════════════════════════════════════════════════════════════════

  // ── Operação ──────────────────────────────────────────────────────────
  { key: '/pdv', label: 'Caixa (PDV)', grupo: 'Operação', icon: ShoppingCart, highlight: true },
  { key: '/pdv/config', label: 'Segurança do Caixa', grupo: 'Operação', icon: ShieldCheck },
  // Dashboard "de mercado" só no Varejo — no Restaurante quem manda é o
  // "Dashboard do Restaurante". No Híbrido os dois aparecem (visões distintas).
  { key: '/dashboard', label: 'Dashboard', grupo: 'Operação', icon: LayoutDashboard, segmentos: ['VAREJO'] },

  // ══════════════════════════════════════════════════════════════════════
  //  MODO RESTAURANTE — salão, cozinha e delivery. Só aparece nos modos
  //  Restaurante e Híbrido (invisível para um mercado puro).
  // ══════════════════════════════════════════════════════════════════════
  { key: '/restaurante/mesas', label: 'Mapa de Mesas', grupo: 'Restaurante', icon: LayoutGrid, segmentos: ['RESTAURANTE'], highlight: true },
  { key: '/restaurante/comandas', label: 'Comandas', grupo: 'Restaurante', icon: ClipboardCheck, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/cozinha', label: 'Cozinha (KDS)', grupo: 'Restaurante', icon: ChefHat, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/delivery', label: 'Delivery', grupo: 'Restaurante', icon: Bike, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/ficha-tecnica', label: 'Fichas Técnicas', grupo: 'Restaurante', icon: ChefHat, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/cardapio', label: 'Cardápio Digital (QR)', grupo: 'Restaurante', icon: QrCode, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/divisao-conta', label: 'Divisão de Conta', grupo: 'Restaurante', icon: SplitSquareHorizontal, segmentos: ['RESTAURANTE'] },
  { key: '/restaurante/dashboard', label: 'Dashboard do Restaurante', grupo: 'Restaurante', icon: Gauge, segmentos: ['RESTAURANTE'] },

  // ── Cadastros ─────────────────────────────────────────────────────────
  { key: '/cadastros/produtos', label: 'Produtos & Código de Barras', grupo: 'Cadastros', icon: Package },
  { key: '/cadastros/tabelas-preco', label: 'Preços & Ofertas', grupo: 'Cadastros', icon: Tags },
  { key: '/cadastros/fornecedores', label: 'Fornecedores', grupo: 'Cadastros', icon: Building2 },
  { key: '/cadastros/clientes', label: 'Clientes (fiado)', grupo: 'Cadastros', icon: Users },
  { key: '/cadastros/filiais', label: 'Lojas', grupo: 'Cadastros', icon: Warehouse },

  // ── Estoque ───────────────────────────────────────────────────────────
  { key: '/wms/posicao', label: 'Posição de Estoque', grupo: 'Estoque', icon: Warehouse },
  { key: '/wms/inventario', label: 'Inventário', grupo: 'Estoque', icon: ClipboardList },
  { key: '/wms/pereciveis', label: 'Perecíveis / FLV', grupo: 'Estoque', icon: AlertTriangle, badge: '!', badgeColor: 'bg-red-500', segmentos: ['VAREJO'] },
  { key: 'grupo:gestao-estoque', label: 'Gestão de Estoque', grupo: 'Estoque', icon: BarChart3, pasta: true, submenu: [
    { key: '/wms/transferencias', label: 'Transferências entre Filiais', icon: Repeat, hint: 'Solicitação, trânsito e recebimento' },
    { key: '/wms/movimentacoes', label: 'Movimentações', icon: Warehouse, hint: 'Entradas e saídas detalhadas' },
    { key: '/wms/analise-estoque', label: 'Análise de Estoque Físico', icon: BarChart3, hint: 'Contagem, perdas e divergências' },
  ] },

  // ── Compras ───────────────────────────────────────────────────────────
  { key: '/wms/compras', label: 'Ordens de Compra', grupo: 'Compras', icon: ShoppingCart },
  { key: '/wms/entradas', label: 'Entradas (XML NF-e)', grupo: 'Compras', icon: ClipboardList },
  { key: 'grupo:gestao-compras', label: 'Gestão de Compras', grupo: 'Compras', icon: ShoppingCart, pasta: true, submenu: [
    { key: '/wms/devolucoes-compra', label: 'Devoluções ao Fornecedor', icon: Undo2, hint: 'Retorno e controle de mercadorias' },
    { key: '/compras/app', label: 'Aplicativo de Compras', icon: ShoppingCart, hint: 'Apoio ao comprador em campo' },
  ] },

  // ── Fiscal ─────────────────────────────────────────────────────────────
  { key: '/fiscal/emitir', label: 'Emitir Cupom (NFC-e)', grupo: 'Fiscal', icon: Receipt },
  { key: '/fiscal/monitor', label: 'Monitor Fiscal', grupo: 'Fiscal', icon: Gauge },
  { key: '/fiscal/nfe', label: 'Cupons / NF-e Emitidas', grupo: 'Fiscal', icon: Receipt, oculto: true },
  { key: '/fiscal/painel', label: 'Painel de Vendas', grupo: 'Fiscal', icon: BarChart3 },
  { key: 'grupo:gestao-fiscal', label: 'Gestão Fiscal', grupo: 'Fiscal', icon: ShieldCheck, pasta: true, submenu: [
    { key: '/fiscal/configuracao', label: 'Configuração Fiscal', icon: Settings, hint: 'Provedor, credenciais e matriz de regras' },
    { key: '/fiscal/gestao', label: 'Visão Fiscal Consolidada', icon: Receipt, hint: 'Documentos e acompanhamento fiscal' },
  ] },

  // ── Financeiro ─────────────────────────────────────────────────────────
  { key: '/financeiro/pagar', label: 'Contas a Pagar', grupo: 'Financeiro', icon: DollarSign },
  { key: '/financeiro/receber', label: 'Contas a Receber', grupo: 'Financeiro', icon: DollarSign },
  { key: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', grupo: 'Financeiro', icon: Landmark },
  { key: '/financeiro/recorrencias', label: 'Despesas Recorrentes', grupo: 'Financeiro', icon: Repeat },
  { key: 'grupo:gestao-financeira', label: 'Gestão Financeira', grupo: 'Financeiro', icon: Coins, pasta: true, submenu: [
    { key: '/financeiro/dre', label: 'DRE & Relatórios', icon: BarChart3, hint: 'Resultado e desempenho do período' },
    { key: '/financeiro/controladoria', label: 'Controladoria', icon: Landmark, hint: 'Visão gerencial consolidada' },
    { key: '/financeiro/tesouraria', label: 'Tesouraria', icon: Landmark, hint: 'Contas, caixa e conciliação' },
    { key: '/financeiro/plano-contas', label: 'Plano de Contas', icon: FileText, hint: 'Estrutura contábil e categorias' },
    { key: '/financeiro/custos', label: 'Custos & Margem', icon: Coins, hint: 'Rentabilidade e composição de custos' },
  ] },

  // ── Gerência ──────────────────────────────────────────────────────────
  { key: '/gerencial/relatorios', label: 'Relatórios Gerenciais', grupo: 'Gerência', icon: BarChart3 },
  // Pasta "Administração"
  { key: 'grupo:admin', label: 'Administração', grupo: 'Gerência', icon: ShieldCheck, pasta: true, submenu: [
    { key: '/gerencial/usuarios', label: 'Usuários & Acessos', icon: Users, hint: 'Perfis e permissões' },
    { key: '/gerencial/configuracoes', label: 'Configurações', icon: Settings, hint: 'Parâmetros do sistema' },
    { key: '/gerencial/auditoria', label: 'Logs de Auditoria', icon: ShieldCheck, hint: 'Trilha de eventos' },
  ] },
  { key: '/gerencial/usuarios', label: 'Usuários & Acessos', grupo: 'Gerência', icon: Users, oculto: true },
  { key: '/gerencial/configuracoes', label: 'Configurações', grupo: 'Gerência', icon: Settings, oculto: true },
  { key: '/gerencial/auditoria', label: 'Logs de Auditoria', grupo: 'Gerência', icon: ShieldCheck, oculto: true },
  { key: '/gerencial/assinatura', label: 'Minha Assinatura', grupo: 'Gerência', icon: Gauge },

  // ── Plataforma (DONO DO SaaS) — cross-tenant, só o super-admin enxerga.
  //     Este é o ÚNICO grupo que o dono da plataforma vê no menu: nenhuma aba
  //     de loja (PDV, Estoque, Financeiro, etc.) aparece para ele. ──
  { key: '/plataforma/visao', label: 'Visão Geral', grupo: 'Plataforma', icon: LayoutDashboard, soDono: true, highlight: true },
  { key: '/plataforma', label: 'Lojas & Clientes', grupo: 'Plataforma', icon: Store, soDono: true },
  { key: '/plataforma/assinaturas', label: 'Assinaturas & Receita', grupo: 'Plataforma', icon: Coins, soDono: true },
  // O modo de operação (Varejo/Restaurante/Híbrido) é definido POR LOJA, dentro
  // do cadastro de cada empresa em "Lojas & Clientes" — cada uma opera do seu jeito.

  // ══════════════════════════════════════════════════════════════════════
  //  RECURSOS ESPECIALIZADOS — distribuídos por Estoque, Compras, Fiscal
  //  e Financeiro para manter cada fluxo perto das funções relacionadas.
  // ══════════════════════════════════════════════════════════════════════
  // Rotas dos submenus: continuam na matriz de permissões, mas não poluem a barra.
  { key: '/wms/movimentacoes', label: 'Movimentações', grupo: 'Estoque', icon: Warehouse, oculto: true },
  { key: '/wms/transferencias', label: 'Transferências entre Filiais', grupo: 'Estoque', icon: Repeat, oculto: true },
  { key: '/wms/analise-estoque', label: 'Análise de Estoque Físico', grupo: 'Estoque', icon: BarChart3, oculto: true },
  { key: '/wms/devolucoes-compra', label: 'Devoluções ao Fornecedor', grupo: 'Compras', icon: Undo2, oculto: true },
  { key: '/compras/app', label: 'Aplicativo de Compras', grupo: 'Compras', icon: ShoppingCart, oculto: true },
  { key: '/fiscal/matriz', label: 'Matriz Fiscal', grupo: 'Fiscal', icon: FileText, oculto: true },
  { key: '/fiscal/configuracao', label: 'Central Fiscal', grupo: 'Fiscal', icon: ShieldCheck, oculto: true },
  { key: '/fiscal/gestao', label: 'Visão Fiscal Consolidada', grupo: 'Fiscal', icon: Receipt, oculto: true },
  { key: '/financeiro/dre', label: 'DRE & Relatórios', grupo: 'Financeiro', icon: BarChart3, oculto: true },
  { key: '/financeiro/controladoria', label: 'Controladoria', grupo: 'Financeiro', icon: Landmark, oculto: true },
  { key: '/financeiro/tesouraria', label: 'Tesouraria', grupo: 'Financeiro', icon: Landmark, oculto: true },
  { key: '/financeiro/plano-contas', label: 'Plano de Contas', grupo: 'Financeiro', icon: FileText, oculto: true },
  { key: '/financeiro/custos', label: 'Custos & Margem', grupo: 'Financeiro', icon: Coins, oculto: true },
];

function agrupar(lista: TelaDef[]) {
  return lista.reduce<Record<string, TelaDef[]>>((acc, t) => {
    (acc[t.grupo] ||= []).push(t);
    return acc;
  }, {});
}

/** Todas as telas reais agrupadas — usado pela matriz de permissões (Usuários & Acessos).
 *  Pastas (abridores sintéticos) não entram: não são telas. */
export const TELAS_POR_GRUPO = agrupar(TELAS.filter((t) => !t.pasta));

/** Só os itens que aparecem no menu lateral (exclui ocultos; inclui pastas). */
export const TELAS_MENU = TELAS.filter((t) => !t.oculto);

/** Telas do menu agrupadas — usado pela sidebar (AppShell). */
export const TELAS_MENU_POR_GRUPO = agrupar(TELAS_MENU);

/**
 * Telas do menu FILTRADAS pelo modo de operação (multissegmento) e agrupadas.
 * Um mercado (VAREJO) não vê Mesas/Comandas/Cozinha; um restaurante não vê
 * Perecíveis/FLV; o modo Híbrido vê tudo. Telas sem etiqueta aparecem sempre.
 */
export function telasMenuPorGrupo(segmento: Segmento) {
  return agrupar(TELAS_MENU.filter((t) => telaNoSegmento(t.segmentos, segmento)));
}

/** A tela `key` é visível no modo de operação atual? (para o guard de rotas) */
export function telaVisivelNoSegmento(key: string, segmento: Segmento): boolean {
  const def = TELAS.find((t) => t.key === key);
  return telaNoSegmento(def?.segmentos, segmento);
}

/** Telas marcadas `soDono` — acessíveis SÓ pelo dono da plataforma (super-admin). */
const TELAS_SO_DONO = new Set(TELAS.filter((t) => t.soDono).map((t) => t.key));

/**
 * Um usuário com telas ['*'] (ou role ADMIN) enxerga tudo — EXCETO as telas
 * do dono da plataforma (`soDono`), que exigem `isSuperAdmin`.
 */
export function podeVerTela(
  telas: string[] | undefined,
  role: string | undefined,
  key: string,
  isSuperAdmin?: boolean,
): boolean {
  if (TELAS_SO_DONO.has(key)) return !!isSuperAdmin; // painel da plataforma: só o dono do SaaS
  if (role === 'ADMIN') return true;
  if (!telas || telas.length === 0) return false;
  return telas.includes('*') || telas.includes(key);
}

export type AcaoTela = 'CRIAR' | 'EDITAR' | 'EXCLUIR';
export const ACOES: { key: AcaoTela; label: string }[] = [
  { key: 'CRIAR', label: 'Criar' },
  { key: 'EDITAR', label: 'Editar' },
  { key: 'EXCLUIR', label: 'Excluir' },
];

/**
 * Pode executar uma ação (criar/editar/excluir) numa tela?
 * ADMIN sempre pode. Se o perfil não tem `acoes` configurado, ou a tela não foi
 * restringida individualmente, libera (padrão). Só bloqueia quando o admin
 * desmarca explicitamente a ação daquela tela.
 */
export function podeAcao(
  role: string | undefined,
  acoes: Record<string, string[]> | undefined,
  key: string,
  acao: AcaoTela,
): boolean {
  if (role === 'ADMIN') return true;
  if (!acoes) return true;
  const lista = acoes[key];
  if (lista === undefined) return true;
  return lista.includes(acao);
}

/** Resolve a rota inicial do usuário (telaInicial, 1ª tela permitida, ou /dashboard). */
export function rotaInicial(telas: string[] | undefined, role: string | undefined, telaInicial: string | null | undefined): string {
  if (role === 'ADMIN' || telas?.includes('*')) return telaInicial || '/dashboard';
  if (telaInicial && podeVerTela(telas, role, telaInicial)) return telaInicial;
  // Busca a 1ª tela REAL permitida (ignora pastas sintéticas; considera até as ocultas).
  const primeira = TELAS.find((t) => !t.pasta && podeVerTela(telas, role, t.key));
  return primeira?.key || '/dashboard';
}
