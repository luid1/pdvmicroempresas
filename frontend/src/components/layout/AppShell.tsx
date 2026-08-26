import { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { podeVerTela, rotaInicial, telasMenuPorGrupo, type SubTela } from '../../config/telas';
import { type Segmento } from '../../config/segmentos';
import { FeedbackHost } from '../ui/feedback';
import NotificacoesSino from './NotificacoesSino';
import LuCommand from './LuCommand';
import {
  ChevronLeft, ChevronRight, LogOut, Building2, Menu, Circle,
} from 'lucide-react';

interface NavItem { to: string; icon: React.ElementType; label: string; badge?: string; badgeColor?: string; highlight?: boolean; pasta?: boolean; submenu?: SubTela[] }
interface NavGroup { group: string; items: NavItem[] }

// Menu derivado da FONTE ÚNICA (config/telas.ts) — sem lista paralela.
// Filtrado pelo MODO DE OPERAÇÃO (varejo/restaurante/híbrido) da empresa.
function montarNavegacao(segmento: Segmento): NavGroup[] {
  return Object.entries(telasMenuPorGrupo(segmento)).map(([group, items]) => ({
    group,
    items: items.map((t) => ({
      to: t.key,
      icon: t.icon || Circle,
      label: t.label,
      badge: t.badge,
      badgeColor: t.badgeColor,
      highlight: t.highlight,
      pasta: t.pasta,
      submenu: t.submenu,
    })),
  }));
}

interface FlyoutState { label: string; items: SubTela[]; top: number; left: number }

export default function AppShell() {
  const [collapsed,   setCollapsed]   = useState(() => {
    try { return localStorage.getItem('lumin_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [pastasAbertas, setPastasAbertas] = useState<Set<string>>(() => new Set());
  const { user, logout, segmento } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sw = collapsed ? 'w-14' : 'w-64';

  // Alterna a barra e lembra da escolha na próxima visita.
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const nv = !c;
      try { localStorage.setItem('lumin_sidebar_collapsed', nv ? '1' : '0'); } catch { /* ignore */ }
      return nv;
    });
  }, []);

  // Filtra o menu pelas telas que o perfil do usuário pode ver.
  // Também filtra os subitens do flyout pela permissão (herdam a permissão da própria rota).
  const navVisivel = useMemo(() => montarNavegacao(segmento)
    .map((g) => ({
      ...g,
      items: g.items
        // Filtra os subitens do flyout pela permissão da própria rota.
        .map((i) => ({
          ...i,
          submenu: i.submenu?.filter((s) => podeVerTela(user?.telas, user?.role, s.key, user?.isSuperAdmin)),
        }))
        // Pasta: aparece se tiver ao menos um filho visível. Página: pela permissão da rota.
        .filter((i) => i.pasta
          ? !!(i.submenu && i.submenu.length > 0)
          : podeVerTela(user?.telas, user?.role, i.to, user?.isSuperAdmin)),
    }))
    .filter((g) => g.items.length > 0), [user?.telas, user?.role, user?.isSuperAdmin, segmento]);

  // Flyout (submenu que abre ao passar o mouse sobre o item pai)
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const fechaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abrirFlyout = useCallback((e: React.MouseEvent<HTMLElement>, item: NavItem) => {
    if (!item.submenu?.length) { setFlyout(null); return; }
    if (fechaTimer.current) clearTimeout(fechaTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    const margem = 12;
    const largura = 256;
    const alturaDisponivel = window.innerHeight - margem * 2;
    const alturaEstimada = Math.min(item.submenu.length * 52 + 44, alturaDisponivel);
    const top = Math.max(margem, Math.min(r.top, window.innerHeight - alturaEstimada - margem));
    const left = Math.max(margem, Math.min(r.right + 8, window.innerWidth - largura - margem));
    setFlyout({ label: item.label, items: item.submenu, top, left });
  }, []);

  const agendarFecho = useCallback(() => {
    if (fechaTimer.current) clearTimeout(fechaTimer.current);
    fechaTimer.current = setTimeout(() => setFlyout(null), 140);
  }, []);

  const cancelarFecho = useCallback(() => {
    if (fechaTimer.current) clearTimeout(fechaTimer.current);
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ backgroundColor: '#0C0D10' }}>
      {mobileOpen && (
        <div className="fixed inset-0 bg-[#202123]/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — placa noturna (a "casa" da Lumin). Cores explícitas p/
          ficar imune ao remap claro global. */}
      <aside className={`fixed lg:relative z-50 h-full flex flex-col bg-[#08090A] border-r border-white/[0.06] transition-all duration-300 ease-in-out shrink-0 ${sw} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Logo — passar o mouse revela o controle de abrir/fechar; ao sair, volta a ser a logo. */}
        <div className="group/logo relative flex items-center justify-center border-b border-white/[0.06] h-12 px-3 shrink-0">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Abrir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Abrir menu' : 'Recolher menu'}
            className="relative flex h-full w-full items-center justify-center focus:outline-none"
          >
            {/* Wordmark Lumin (expandida) / L (recolhida) */}
            <span className={`font-logo text-[#01B8FA] leading-none transition-opacity duration-200 group-hover/logo:opacity-0 ${collapsed ? 'text-2xl' : 'text-xl'}`}>
              {collapsed ? 'L' : 'Lumin'}
            </span>
            {/* Controle de abrir/fechar — aparece no lugar da logo ao passar o mouse */}
            <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-[#C7C9D4] opacity-0 group-hover/logo:opacity-100 transition-opacity duration-200">
              {collapsed
                ? <ChevronRight className="h-4 w-4" />
                : (<><ChevronLeft className="h-4 w-4" /><span className="text-[11px] font-medium">Recolher</span></>)}
            </span>
          </button>
        </div>

        {/* Contexto de filial (movido do topbar p/ liberar espaço vertical) */}
        <div className={`border-b border-white/[0.06] shrink-0 ${collapsed ? 'flex justify-center py-2' : 'px-2.5 py-2'}`}>
          {collapsed
            ? <Building2 className="h-4 w-4 text-[#01B8FA]" />
            : <FilialSelector />}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto py-2.5 px-1.5 space-y-3"
          onScroll={() => setFlyout(null)}
        >
          {navVisivel.map((group) => (
            <div key={group.group}>
              {!collapsed && (
                <p className="text-[9px] font-semibold text-[#5B5E70] uppercase tracking-[0.14em] px-2 mb-1">{group.group}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const { to, icon: Icon, label, badge, badgeColor, highlight, pasta, submenu } = item;
                  const temSub = !!submenu?.length;

                  // ── PASTA: abridor (não navega para si). Abre o flyout no hover
                  //     e navega para o 1º filho ao clicar. Fica ativa quando uma
                  //     das suas páginas está aberta.
                  if (pasta) {
                    const ativo = submenu?.some((s) => location.pathname === s.key) ?? false;
                    const aberta = ativo || pastasAbertas.has(to);
                    return (
                      <div key={to} onMouseEnter={(e) => collapsed && abrirFlyout(e, item)} onMouseLeave={() => collapsed && agendarFecho()}>
                        <button
                          type="button"
                          title={collapsed ? label : undefined}
                          aria-expanded={aberta}
                          onClick={() => {
                            if (collapsed) {
                              const first = submenu?.[0]?.key;
                              if (first) navigate(first);
                              return;
                            }
                            setPastasAbertas((atuais) => {
                              const proximas = new Set(atuais);
                              proximas.has(to) ? proximas.delete(to) : proximas.add(to);
                              return proximas;
                            });
                          }}
                          className={`
                            w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium
                            transition-all duration-300 ease-in-out group relative active:scale-[0.98]
                            ${ativo
                              ? 'bg-gradient-to-r from-[#01B8FA]/[0.18] to-[#01B8FA]/[0.03] text-[#01B8FA] shadow-[inset_0_1px_0_0_rgba(1,184,250,0.12)]'
                              : 'text-[#9A9DAD] hover:bg-white/[0.05] hover:text-white'}
                            ${collapsed ? 'justify-center' : ''}
                          `}
                        >
                          {ativo && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#01B8FA] shadow-[0_0_8px_rgba(1,184,250,0.7)]" />}
                          <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors duration-300 ${ativo ? 'text-[#01B8FA]' : 'text-[#6B6E82] group-hover:text-[#C7C9D4]'}`} />
                          {!collapsed && <span className="truncate">{label}</span>}
                          {!collapsed && <ChevronRight className={`ml-auto h-3 w-3 shrink-0 text-[#5B5E70] group-hover:text-[#C7C9D4] transition-transform duration-200 ${aberta ? 'rotate-90' : ''}`} />}
                          {collapsed && <span className="absolute right-0.5 top-1 h-1 w-1 rounded-full bg-[#01B8FA]/70" />}
                          {collapsed && (
                            <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#101216] border border-white/[0.08] text-[#C7C9D4] text-xs rounded-lg shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200">
                              {label}
                            </span>
                          )}
                        </button>
                        {!collapsed && aberta && (
                          <div className="ml-3.5 mt-1 mb-1 border-l border-white/[0.08] pl-2 space-y-0.5">
                            {submenu?.map((s) => {
                              const SubIcon = s.icon || Circle;
                              return (
                                <NavLink
                                  key={s.key}
                                  to={s.key}
                                  onClick={() => setMobileOpen(false)}
                                  className={({ isActive }) => `flex items-start gap-2 rounded-lg px-2 py-1.5 text-[10.5px] transition-colors ${isActive ? 'bg-[#01B8FA]/[0.14] text-[#01B8FA]' : 'text-[#8F93A3] hover:bg-white/[0.05] hover:text-white'}`}
                                >
                                  <SubIcon className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block font-medium leading-4">{s.label}</span>
                                    {s.hint && <span className="block text-[9px] leading-3 text-[#666A7B]">{s.hint}</span>}
                                  </span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                  <div key={to} onMouseEnter={(e) => abrirFlyout(e, item)} onMouseLeave={agendarFecho}>
                  <NavLink
                    to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) => `
                      flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium
                      transition-all duration-300 ease-in-out group relative active:scale-[0.98]
                      ${isActive
                        ? 'bg-gradient-to-r from-[#01B8FA]/[0.18] to-[#01B8FA]/[0.03] text-[#01B8FA] shadow-[inset_0_1px_0_0_rgba(1,184,250,0.12)]'
                        : highlight
                          ? 'text-[#01B8FA]/90 hover:bg-white/[0.05]'
                          : 'text-[#9A9DAD] hover:bg-white/[0.05] hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Indicador cirúrgico de foco */}
                        {isActive && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#01B8FA] shadow-[0_0_8px_rgba(1,184,250,0.7)]" />}
                        <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors duration-300 ${isActive ? 'text-[#01B8FA]' : highlight && !isActive ? 'text-[#01B8FA]/80' : 'text-[#6B6E82] group-hover:text-[#C7C9D4]'}`} />
                        {!collapsed && <span className="truncate">{label}</span>}
                        {badge && !collapsed && (
                          <span className={`ml-auto h-3.5 w-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${badgeColor}`}>
                            {badge}
                          </span>
                        )}
                        {/* Indicador de submenu (aparece à direita quando há sub-páginas) */}
                        {temSub && !collapsed && (
                          <ChevronRight className={`h-3 w-3 shrink-0 text-[#5B5E70] group-hover:text-[#C7C9D4] transition-colors duration-200 ${badge ? '' : 'ml-auto'}`} />
                        )}
                        {temSub && collapsed && (
                          <span className="absolute right-0.5 top-1 h-1 w-1 rounded-full bg-[#01B8FA]/70" />
                        )}
                        {collapsed && (
                          <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#101216] border border-white/[0.08] text-[#C7C9D4] text-xs rounded-lg shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200">
                            {label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className={`px-1.5 py-2 border-t border-white/[0.06] ${collapsed ? 'flex justify-center' : ''}`}>
          {!collapsed ? (
            <div>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <div className="h-6 w-6 rounded-full bg-[#01B8FA]/20 border border-[#01B8FA]/30 flex items-center justify-center text-[#01B8FA] text-[10px] font-bold shrink-0">
                  {user?.nome?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[11px] font-medium truncate">{user?.nome}</p>
                  <p className="text-[#6B6E82] text-[9px]">{user?.role}</p>
                </div>
                <NotificacoesSino />
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-1.5 text-[#8B8EA0] hover:text-white text-[10px] w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-300 active:scale-[0.98]">
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <NotificacoesSino />
              <button onClick={() => { logout(); navigate('/login'); }} className="text-[#8B8EA0] hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-300" title="Sair">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Botão flutuante p/ abrir o menu no mobile (topbar foi removido) */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed top-2 left-2 z-40 p-2 rounded-lg bg-[#101216] border border-white/[0.08] text-[#8A90A0] hover:text-white hover:border-white/20 shadow-lg transition-all duration-300 active:scale-95"
          title="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* Main — sem topbar: conteúdo ocupa toda a altura */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <TelaGuard><Outlet /></TelaGuard>
        </main>
      </div>
      {/* Flyout de submenu — acompanha a barra e nunca ultrapassa a janela. */}
      {flyout && createPortal(
        <div
          className="fixed z-[100] w-64 max-h-[calc(100vh-24px)] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.09] bg-[#101216] shadow-[0_24px_64px_rgba(0,0,0,0.42)] py-1.5 animate-fade-in"
          style={{ top: flyout.top, left: flyout.left }}
          onMouseEnter={cancelarFecho}
          onMouseLeave={agendarFecho}
        >
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#777A8B] uppercase tracking-[0.12em] border-b border-white/[0.07] mb-1">{flyout.label}</p>
          {flyout.items.map((s) => {
            const SubIcon = s.icon || Circle;
            return (
              <NavLink
                key={s.key}
                to={s.key}
                onClick={() => setFlyout(null)}
                className={({ isActive }) => `flex items-start gap-2.5 px-3 py-2 text-[12px] transition-colors duration-150 ${isActive ? 'bg-[#01B8FA]/[0.16] text-[#01B8FA]' : 'text-[#C7C9D4] hover:bg-white/[0.06] hover:text-white'}`}
              >
                {({ isActive }) => (
                  <>
                    <SubIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isActive ? 'text-[#01B8FA]' : 'text-[#777A8B]'}`} />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{s.label}</span>
                      {s.hint && <span className="block text-[10px] text-[#777A8B] truncate">{s.hint}</span>}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>,
        document.body
      )}
      <FeedbackHost />
      <LuCommand />
    </div>
  );
}

// Bloqueia acesso por URL a telas fora do perfil do usuário
function TelaGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  if (podeVerTela(user?.telas, user?.role, path, user?.isSuperAdmin)) return <>{children}</>;
  return <Navigate to={rotaInicial(user?.telas, user?.role, user?.telaInicial)} replace />;
}

function FilialSelector() {
  const { filiais, filialAtiva, setFilialAtiva } = useAuth();
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      <Building2 className="h-3.5 w-3.5 text-[#01B8FA] shrink-0" />
      <select
        className="flex-1 min-w-0 text-xs rounded-lg px-2 py-1.5 text-[#F7F8FA] bg-[#101216] border border-white/[0.08] hover:border-white/20 focus:outline-none focus:border-[#01B8FA]/60 transition-all duration-300 cursor-pointer [color-scheme:dark]"
        value={filialAtiva?.id || ''}
        onChange={(e) => { const f = filiais?.find((f) => f.id === e.target.value); if (f) setFilialAtiva(f); }}
      >
        {filiais?.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}
      </select>
    </div>
  );
}
