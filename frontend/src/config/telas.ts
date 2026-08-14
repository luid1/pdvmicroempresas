// Catálogo central das telas do ERP — FONTE ÚNICA usada pelo menu (AppShell),
// pelo guard de rotas e pela tela de Perfis (Usuários & Acessos).
// A "key" é a própria rota. O menu deriva 100% desta lista.

import {
  LayoutDashboard, Users, Package, Warehouse, FileText,
  DollarSign, ClipboardList, BarChart3, Settings,
  Building2, AlertTriangle, Receipt, ShieldCheck,
  ShoppingCart, Coins, Landmark, Repeat,
  Tags, Undo2, Gauge,
} from 'lucide-react';
import type { ElementType } from 'react';

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
   * Item "pasta": NÃO é uma página (o `key` é sintético, não uma rota).
   * Serve só de abridor — ao passar o mouse, o submenu lista as páginas
   * reais de conteúdo. Cada página do submenu existe também como TelaDef
   * própria (marcada `oculto`) para herdar rota/permissão.
   */
  pasta?: boolean;
  /** Sub-páginas exibidas num flyout ao passar o mouse (hover) sobre este item. */
  submenu?: SubTela[];
}

export const TELAS: TelaDef[] = [
  // ══════════════════════════════════════════════════════════════════════
  //  MODO MERCADO — só o que um mercado usa no dia a dia (telas funcionais).
  //  O que é de atacado/contabilidade fica preservado no grupo "Avançado"
  //  no fim do menu (nada é removido; todas as rotas continuam ativas).
  // ══════════════════════════════════════════════════════════════════════

  // ── Operação ──────────────────────────────────────────────────────────
  { key: '/pdv', label: 'Caixa (PDV)', grupo: 'Operação', icon: ShoppingCart, highlight: true },
  { key: '/dashboard', label: 'Dashboard', grupo: 'Operação', icon: LayoutDashboard },

  // ── Cadastros ─────────────────────────────────────────────────────────
  { key: '/cadastros/produtos', label: 'Produtos & Código de Barras', grupo: 'Cadastros', icon: Package },
  { key: '/cadastros/tabelas-preco', label: 'Preços & Ofertas', grupo: 'Cadastros', icon: Tags },
  { key: '/cadastros/fornecedores', label: 'Fornecedores', grupo: 'Cadastros', icon: Building2 },
  { key: '/cadastros/clientes', label: 'Clientes (fiado)', grupo: 'Cadastros', icon: Users },
  { key: '/cadastros/filiais', label: 'Lojas', grupo: 'Cadastros', icon: Warehouse },

  // ── Estoque & Compras ─────────────────────────────────────────────────
  { key: '/wms/posicao', label: 'Posição de Estoque', grupo: 'Estoque & Compras', icon: Warehouse },
  { key: '/wms/inventario', label: 'Inventário', grupo: 'Estoque & Compras', icon: ClipboardList },
  { key: '/wms/pereciveis', label: 'Perecíveis / FLV', grupo: 'Estoque & Compras', icon: AlertTriangle, badge: '!', badgeColor: 'bg-red-500' },
  { key: '/wms/compras', label: 'Ordens de Compra', grupo: 'Estoque & Compras', icon: ShoppingCart },
  { key: '/wms/entradas', label: 'Entradas (XML NF-e)', grupo: 'Estoque & Compras', icon: ClipboardList },

  // ── Fiscal & Financeiro ───────────────────────────────────────────────
  { key: '/fiscal/emitir', label: 'Emitir Cupom (NFC-e)', grupo: 'Fiscal & Financeiro', icon: Receipt },
  { key: '/fiscal/nfe', label: 'Cupons / NF-e Emitidas', grupo: 'Fiscal & Financeiro', icon: Receipt },
  { key: '/fiscal/painel', label: 'Painel de Vendas', grupo: 'Fiscal & Financeiro', icon: BarChart3 },
  { key: '/financeiro/pagar', label: 'Contas a Pagar', grupo: 'Fiscal & Financeiro', icon: DollarSign },
  { key: '/financeiro/receber', label: 'Contas a Receber', grupo: 'Fiscal & Financeiro', icon: DollarSign },
  { key: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', grupo: 'Fiscal & Financeiro', icon: Landmark },
  { key: '/financeiro/recorrencias', label: 'Despesas Recorrentes', grupo: 'Fiscal & Financeiro', icon: Repeat },

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

  // ══════════════════════════════════════════════════════════════════════
  //  AVANÇADO (ERP) — recursos de atacado/distribuição e contabilidade.
  //  Agrupados num único abridor no FIM do menu. Continuam 100% acessíveis;
  //  só saíram da primeira dobra para não poluir o dia a dia do mercado.
  //  Alguns recursos avançados ainda estão em migração; cada tela deve
  //  sinalizar claramente quando uma integração real não estiver disponível.
  // ══════════════════════════════════════════════════════════════════════
  { key: 'grupo:avancado', label: 'Avançado (ERP)', grupo: 'Avançado', icon: Gauge, pasta: true, submenu: [
    { key: '/wms/movimentacoes', label: 'Movimentações', icon: BarChart3, hint: 'Entradas e saídas detalhadas' },
    { key: '/wms/analise-estoque', label: 'Análise Estoque Físico', icon: BarChart3, hint: 'Físico vs. sistema' },
    { key: '/wms/devolucoes-compra', label: 'Devoluções ao Fornecedor', icon: Undo2, hint: 'Devolver mercadoria' },
    { key: '/compras/app', label: 'App de Compras', icon: ShoppingCart, hint: 'Comprador em campo' },
    { key: '/fiscal/matriz', label: 'Matriz Fiscal', icon: FileText, hint: 'Regras de tributação' },
    { key: '/fiscal/gestao', label: 'Gestão Fiscal', icon: Receipt, hint: 'NF-e + painel de vendas' },
    { key: '/financeiro/dre', label: 'DRE & Relatórios', icon: BarChart3, hint: 'Resultado do período' },
    { key: '/financeiro/controladoria', label: 'Controladoria', icon: Landmark, hint: 'Visão consolidada' },
    { key: '/financeiro/tesouraria', label: 'Tesouraria', icon: Landmark, hint: 'Contas, caixa e conciliação' },
    { key: '/financeiro/plano-contas', label: 'Plano de Contas', icon: Landmark, hint: 'Categorias do DRE' },
    { key: '/financeiro/custos', label: 'Custos & Margem', icon: Coins, hint: 'Margem, rentabilidade e composição real' },
  ] },
  // Rotas reais (ocultas) dos itens do Avançado — herdam rota/permissão.
  { key: '/wms/movimentacoes', label: 'Movimentações', grupo: 'Avançado', icon: BarChart3, oculto: true },
  { key: '/wms/analise-estoque', label: 'Análise Estoque Físico', grupo: 'Avançado', icon: BarChart3, oculto: true },
  { key: '/wms/devolucoes-compra', label: 'Devoluções ao Fornecedor', grupo: 'Avançado', icon: Undo2, oculto: true },
  { key: '/compras/app', label: 'App de Compras', grupo: 'Avançado', icon: ShoppingCart, oculto: true },
  { key: '/fiscal/matriz', label: 'Matriz Fiscal', grupo: 'Avançado', icon: FileText, oculto: true },
  { key: '/fiscal/gestao', label: 'Gestão Fiscal', grupo: 'Avançado', icon: Receipt, oculto: true },
  { key: '/financeiro/dre', label: 'DRE & Relatórios', grupo: 'Avançado', icon: BarChart3, oculto: true },
  { key: '/financeiro/controladoria', label: 'Controladoria', grupo: 'Avançado', icon: Landmark, oculto: true },
  { key: '/financeiro/tesouraria', label: 'Tesouraria', grupo: 'Avançado', icon: Landmark, oculto: true },
  { key: '/financeiro/plano-contas', label: 'Plano de Contas', grupo: 'Avançado', icon: Landmark, oculto: true },
  { key: '/financeiro/custos', label: 'Custos & Margem', grupo: 'Avançado', icon: Coins, oculto: true },
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

/** Um usuário com telas ['*'] (ou role ADMIN) enxerga tudo. */
export function podeVerTela(telas: string[] | undefined, role: string | undefined, key: string): boolean {
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
