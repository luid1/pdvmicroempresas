import { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { podeVerTela, rotaInicial, TELAS_MENU_POR_GRUPO, type SubTela } from '../../config/telas';
import { FeedbackHost } from '../ui/feedback';
import NotificacoesSino from './NotificacoesSino';
import LuCommand from './LuCommand';
import {
  ChevronLeft, ChevronRight, LogOut, Building2, Menu, X, Circle,
} from 'lucide-react';

interface NavItem { to: string; icon: React.ElementType; label: string; badge?: string; badgeColor?: string; highlight?: boolean; pasta?: boolean; submenu?: SubTela[] }
interface NavGroup { group: string; items: NavItem[] }

// Menu derivado da FONTE ÚNICA (config/telas.ts) — sem lista paralela.
const navigation: NavGroup[] = Object.entries(TELAS_MENU_POR_GRUPO).map(([group, items]) => ({
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

interface FlyoutState { label: string; items: SubTela[]; top: number; left: number }

export default function AppShell() {
  const [collapsed,   setCollapsed]   = useState(() => {
    try { return localStorage.getItem('lumin_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { user, logout } = useAuth();
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
  const navVisivel = useMemo(() => navigation
    .map((g) => ({
      ...g,
      items: g.items
        // Filtra os subitens do flyout pela permissão da própria rota.
        .map((i) => ({
          ...i,
          submenu: i.submenu?.filter((s) => podeVerTela(user?.telas, user?.role, s.key)),
        }))
        // Pasta: aparece se tiver ao menos um filho visível. Página: pela permissão da rota.
        .filter((i) => i.pasta
          ? !!(i.submenu && i.submenu.length > 0)
          : podeVerTela(user?.telas, user?.role, i.to)),
    }))
    .filter((g) => g.items.length > 0), [user?.telas, user?.role]);

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
    <div className="relative flex h-screen overflow-hidden" style={{ backgroundColor: '#F7F7F8' }}>
      {mobileOpen && (
        <div className="fixed inset-0 bg-[#202123]/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — placa noturna (a "casa" da Lumin). Cores explícitas p/
          ficar imune ao remap claro global. */}
      <aside className={`fixed lg:relative z-50 h-full flex flex-col bg-[#212121] border-r border-white/[0.06] transition-all duration-300 ease-in-out shrink-0 ${sw} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Logo — passar o mouse revela o controle de abrir/fechar; ao sair, volta a ser a logo. */}
        <div className="group/logo relative flex items-center justify-center border-b border-white/[0.06] h-12 px-3 shrink-0">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Abrir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Abrir menu' : 'Recolher menu'}
            className="relative flex h-full w-full items-center justify-center focus:outline-none"
          >
            {/* Wordmark Lumin (expandida) / L (recolhida) */}
            <span className={`font-logo text-[#13A184] leading-none transition-opacity duration-200 group-hover/logo:opacity-0 ${collapsed ? 'text-2xl' : 'text-xl'}`}>
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
                    return (
                      <div key={to} onMouseEnter={(e) => abrirFlyout(e, item)} onMouseLeave={agendarFecho}>
                        <button
                          type="button"
                          title={collapsed ? label : undefined}
                          onClick={() => { const first = submenu?.[0]?.key; if (first) navigate(first); }}
                          className={`
                            w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium
                            transition-all duration-300 ease-in-out group relative active:scale-[0.98]
                            ${ativo
                              ? 'bg-gradient-to-r from-[#13A184]/[0.18] to-[#13A184]/[0.03] text-[#13A184] shadow-[inset_0_1px_0_0_rgba(19,161,132,0.12)]'
                              : 'text-[#9A9DAD] hover:bg-white/[0.05] hover:text-white'}
                            ${collapsed ? 'justify-center' : ''}
                          `}
                        >
                          {ativo && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#13A184] shadow-[0_0_8px_rgba(19,161,132,0.7)]" />}
                          <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors duration-300 ${ativo ? 'text-[#13A184]' : 'text-[#6B6E82] group-hover:text-[#C7C9D4]'}`} />
                          {!collapsed && <span className="truncate">{label}</span>}
                          {!collapsed && <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-[#5B5E70] group-hover:text-[#C7C9D4] transition-colors duration-200" />}
                          {collapsed && <span className="absolute right-0.5 top-1 h-1 w-1 rounded-full bg-[#13A184]/70" />}
                          {collapsed && (
                            <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#20232F] border border-white/[0.08] text-[#C7C9D4] text-xs rounded-lg shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200">
                              {label}
                            </span>
                          )}
                        </button>
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
                        ? 'bg-gradient-to-r from-[#13A184]/[0.18] to-[#13A184]/[0.03] text-[#13A184] shadow-[inset_0_1px_0_0_rgba(19,161,132,0.12)]'
                        : highlight
                          ? 'text-[#13A184]/90 hover:bg-white/[0.05]'
                          : 'text-[#9A9DAD] hover:bg-white/[0.05] hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Indicador cirúrgico de foco */}
                        {isActive && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#13A184] shadow-[0_0_8px_rgba(19,161,132,0.7)]" />}
                        <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors duration-300 ${isActive ? 'text-[#13A184]' : highlight && !isActive ? 'text-[#13A184]/80' : 'text-[#6B6E82] group-hover:text-[#C7C9D4]'}`} />
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
                          <span className="absolute right-0.5 top-1 h-1 w-1 rounded-full bg-[#13A184]/70" />
                        )}
                        {collapsed && (
                          <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#20232F] border border-white/[0.08] text-[#C7C9D4] text-xs rounded-lg shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200">
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
                <div className="h-6 w-6 rounded-full bg-[#13A184]/20 border border-[#13A184]/30 flex items-center justify-center text-[#13A184] text-[10px] font-bold shrink-0">
                  {user?.nome?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-[11px] font-medium truncate">{user?.nome}</p>
                  <p className="text-[#6B6E82] text-[9px]">{user?.role}</p>
                </div>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-1.5 text-[#8B8EA0] hover:text-white text-[10px] w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-300 active:scale-[0.98]">
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>
          ) : (
            <button onClick={() => { logout(); navigate('/login'); }} className="text-[#8B8EA0] hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-300" title="Sair">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 text-[#5F6065] hover:bg-[#F7F7F8] rounded-lg transition-all duration-300" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <FilialSelector />
          </div>
          <div className="flex items-center gap-3">
            <NotificacoesSino />
            <div className="h-1.5 w-1.5 rounded-full bg-[#0FA968] shadow-[0_0_8px_rgba(15,169,104,0.7)] animate-pulse" title="Online" />
            <span className="text-xs text-[#8E8F94] hidden sm:block">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
            <span className="text-xs font-num text-[#5F6065] hidden sm:block tabular-nums">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <TelaGuard><Outlet /></TelaGuard>
        </main>
      </div>
      {/* Flyout de submenu — acompanha a barra e nunca ultrapassa a janela. */}
      {flyout && createPortal(
        <div
          className="fixed z-[100] w-64 max-h-[calc(100vh-24px)] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.09] bg-[#292929] shadow-[0_24px_64px_rgba(0,0,0,0.42)] py-1.5 animate-fade-in"
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
                className={({ isActive }) => `flex items-start gap-2.5 px-3 py-2 text-[12px] transition-colors duration-150 ${isActive ? 'bg-[#13A184]/[0.16] text-[#39C5A5]' : 'text-[#C7C9D4] hover:bg-white/[0.06] hover:text-white'}`}
              >
                {({ isActive }) => (
                  <>
                    <SubIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isActive ? 'text-[#39C5A5]' : 'text-[#777A8B]'}`} />
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
  if (podeVerTela(user?.telas, user?.role, path)) return <>{children}</>;
  return <Navigate to={rotaInicial(user?.telas, user?.role, user?.telaInicial)} replace />;
}

function FilialSelector() {
  const { filiais, filialAtiva, setFilialAtiva } = useAuth();
  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="h-3.5 w-3.5 text-[#8E8F94]" />
      <select
        className="text-xs rounded-lg px-2 py-1 text-[#202123] bg-white border border-[#E5E7EB] hover:border-[#D1D5DB] focus:outline-none focus:border-[#0F8A72]/60 transition-all duration-300 cursor-pointer"
        value={filialAtiva?.id || ''}
        onChange={(e) => { const f = filiais?.find((f) => f.id === e.target.value); if (f) setFilialAtiva(f); }}
      >
        {filiais?.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}
      </select>
    </div>
  );
}
