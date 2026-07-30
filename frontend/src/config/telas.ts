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
  /** Sub-páginas exibidas num flyout ao passar o mouse (hover) sobre este item. */
  submenu?: SubTela[];
}

export const TELAS: TelaDef[] = [
  // Operação de loja
  { key: '/pdv', label: 'Caixa (PDV)', grupo: 'Operação', icon: ShoppingCart, highlight: true },
  { key: '/dashboard', label: 'Dashboard', grupo: 'Operação', icon: LayoutDashboard },

  // A · Cadastros
  { key: '/cadastros/produtos', label: 'Produtos & Código de Barras', grupo: 'A · Cadastros', icon: Package },
  { key: '/cadastros/tabelas-preco', label: 'Preços & Ofertas', grupo: 'A · Cadastros', icon: Tags },
  { key: '/cadastros/fornecedores', label: 'Fornecedores', grupo: 'A · Cadastros', icon: Building2 },
  { key: '/cadastros/clientes', label: 'Clientes (fiado)', grupo: 'A · Cadastros', icon: Users },
  { key: '/cadastros/filiais', label: 'Lojas', grupo: 'A · Cadastros', icon: Warehouse },

  // B · Estoque / WMS
  { key: '/wms/posicao', label: 'Posição de Estoque', grupo: 'B · Estoque / WMS', icon: Warehouse, submenu: [
    { key: '/wms/movimentacoes', label: 'Movimentações', icon: BarChart3, hint: 'Entradas e saídas' },
    { key: '/wms/inventario', label: 'Inventário', icon: ClipboardList, hint: 'Contagem e ajustes' },
    { key: '/wms/analise-estoque', label: 'Análise Estoque Físico', icon: BarChart3, hint: 'Físico vs. sistema' },
  ] },
  { key: '/wms/pereciveis', label: 'Perecíveis / FLV', grupo: 'B · Estoque / WMS', icon: AlertTriangle, badge: '!', badgeColor: 'bg-red-500' },
  { key: '/wms/compras', label: 'Ordens de Compra', grupo: 'B · Estoque / WMS', icon: ShoppingCart },
  { key: '/compras/app', label: 'App de Compras', grupo: 'B · Estoque / WMS', icon: ShoppingCart, highlight: true },
  { key: '/wms/entradas', label: 'Entradas (XML NF-e)', grupo: 'B · Estoque / WMS', icon: ClipboardList },
  { key: '/wms/devolucoes-compra', label: 'Devoluções ao Fornecedor', grupo: 'B · Estoque / WMS', icon: Undo2 },
  { key: '/wms/movimentacoes', label: 'Movimentações', grupo: 'B · Estoque / WMS', icon: BarChart3 },
  { key: '/wms/inventario', label: 'Inventário', grupo: 'B · Estoque / WMS', icon: ClipboardList },
  { key: '/wms/analise-estoque', label: 'Análise Estoque Físico', grupo: 'B · Estoque / WMS', icon: BarChart3, highlight: true },

  // D · Fiscal / DFe
  { key: '/fiscal/emitir', label: 'Emitir Cupom (NFC-e)', grupo: 'D · Fiscal', icon: Receipt, highlight: true, submenu: [
    { key: '/fiscal/matriz', label: 'Matriz Fiscal', icon: FileText, hint: 'Regras de tributação' },
  ] },
  { key: '/fiscal/gestao', label: 'Gestão Fiscal', grupo: 'D · Fiscal', icon: Receipt, submenu: [
    { key: '/fiscal/nfe', label: 'Cupons / NF-e Emitidas', icon: Receipt, hint: 'Documentos autorizados' },
    { key: '/fiscal/painel', label: 'Painel de Vendas', icon: BarChart3, hint: 'Gráficos e indicadores' },
  ] },
  { key: '/fiscal/matriz', label: 'Matriz Fiscal', grupo: 'D · Fiscal', icon: FileText },
  // Painel de Faturamento (dashboard de gráficos) fundido na Gestão Fiscal — fora do menu, acessível por rota.
  { key: '/fiscal/painel', label: 'Painel de Faturamento', grupo: 'D · Fiscal / DFe', icon: BarChart3, oculto: true },
  // NF-e Emitidas: fundida na Gestão Fiscal — fora do menu, mas acessível.
  { key: '/fiscal/nfe', label: 'NF-e Emitidas', grupo: 'D · Fiscal / DFe', icon: Receipt, oculto: true },

  // E · Financeiro
  { key: '/financeiro/dre', label: 'DRE & Relatórios', grupo: 'E · Financeiro', icon: BarChart3, highlight: true, submenu: [
    { key: '/financeiro/controladoria', label: 'Controladoria', icon: Landmark, hint: 'Visão consolidada' },
    { key: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', icon: Landmark, hint: 'Entradas e saídas' },
    { key: '/financeiro/tesouraria', label: 'Tesouraria', icon: Landmark, hint: 'Contas, caixa e conciliação' },
    { key: '/financeiro/receber', label: 'Contas a Receber', icon: DollarSign, hint: 'Títulos de clientes' },
    { key: '/financeiro/pagar', label: 'Contas a Pagar', icon: DollarSign, hint: 'Títulos a fornecedores' },
    { key: '/financeiro/recorrencias', label: 'Despesas Recorrentes', icon: Repeat, hint: 'Aluguéis e assinaturas automáticas' },
    { key: '/financeiro/plano-contas', label: 'Plano de Contas', icon: Landmark, hint: 'Categorias do DRE' },
  ] },
  { key: '/financeiro/custos', label: 'Custos & Margem', grupo: 'E · Financeiro', icon: Coins },
  { key: '/financeiro/plano-contas', label: 'Plano de Contas', grupo: 'E · Financeiro', icon: Landmark, oculto: true },
  // Unificados dentro do hub DRE — fora do menu, mas acessíveis por rota.
  { key: '/financeiro/controladoria', label: 'Controladoria (Financeiro)', grupo: 'E · Financeiro', icon: Landmark, oculto: true },
  { key: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa', grupo: 'E · Financeiro', icon: Landmark, oculto: true },
  { key: '/financeiro/tesouraria', label: 'Tesouraria', grupo: 'E · Financeiro', icon: Landmark, oculto: true },
  { key: '/financeiro/recorrencias', label: 'Despesas Recorrentes', grupo: 'E · Financeiro', icon: Repeat, oculto: true },
  { key: '/financeiro/receber', label: 'Contas a Receber', grupo: 'E · Financeiro', icon: DollarSign, oculto: true },
  { key: '/financeiro/pagar', label: 'Contas a Pagar', grupo: 'E · Financeiro', icon: DollarSign, oculto: true },

  // F · Gerencial
  { key: '/gerencial/relatorios', label: 'Relatórios Gerenciais', grupo: 'F · Gerencial', icon: BarChart3 },
  { key: '/gerencial/auditoria', label: 'Logs de Auditoria', grupo: 'F · Gerencial', icon: ShieldCheck },
  { key: '/gerencial/usuarios', label: 'Usuários & Acessos', grupo: 'F · Gerencial', icon: Users, submenu: [
    { key: '/gerencial/configuracoes', label: 'Configurações', icon: Settings, hint: 'Parâmetros do sistema' },
    { key: '/gerencial/auditoria', label: 'Logs de Auditoria', icon: ShieldCheck, hint: 'Trilha de eventos' },
  ] },
  { key: '/gerencial/configuracoes', label: 'Configurações', grupo: 'F · Gerencial', icon: Settings },
  { key: '/gerencial/assinatura', label: 'Minha Assinatura', grupo: 'F · Gerencial', icon: Gauge },
];

function agrupar(lista: TelaDef[]) {
  return lista.reduce<Record<string, TelaDef[]>>((acc, t) => {
    (acc[t.grupo] ||= []).push(t);
    return acc;
  }, {});
}

/** Todas as telas agrupadas — usado pela matriz de permissões (Usuários & Acessos). */
export const TELAS_POR_GRUPO = agrupar(TELAS);

/** Só os itens que aparecem no menu lateral (exclui ocultos). */
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
  const primeira = TELAS_MENU.find((t) => podeVerTela(telas, role, t.key));
  return primeira?.key || '/dashboard';
}
