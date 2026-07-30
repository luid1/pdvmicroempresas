import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, ChevronRight } from 'lucide-react';

/**
 * Menu de contexto reutilizável (dark / glass) — padrão do ERP.
 *
 * - Abre ao clicar no gatilho (⋮ por padrão, ou um `trigger` customizado).
 * - Suporta submenus que abrem ao passar o mouse (hover) — igual ao menu do anexo.
 * - Posicionado via portal (document.body), reposiciona sozinho perto das bordas.
 * - Fecha ao clicar fora, apertar ESC ou selecionar um item.
 *
 * Uso:
 *   <Menu items={[
 *     { label: 'Editar', icon: <Pencil/>, onClick: () => ... },
 *     { separador: true },
 *     { label: 'Mais ações', icon: <Layers/>, submenu: [
 *        { label: 'Duplicar', onClick: () => ... },
 *        { label: 'Exportar', onClick: () => ... },
 *     ]},
 *     { label: 'Excluir', icon: <Trash2/>, perigo: true, onClick: () => ... },
 *   ]} />
 */

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  atalho?: string;                 // texto à direita (ex: "Ctrl⇧F")
  onClick?: () => void;
  href?: string;                   // navega abrindo em nova aba, se preferir
  perigo?: boolean;                // estilo destrutivo (vermelho)
  desabilitado?: boolean;
  separador?: boolean;             // linha divisória (ignora os demais campos)
  titulo?: boolean;                // rótulo de seção (não clicável)
  submenu?: MenuItem[];            // abre ao hover
}

interface MenuProps {
  items: MenuItem[];
  trigger?: ReactNode;             // conteúdo do botão gatilho (default: ⋮)
  align?: 'start' | 'end';         // alinhamento horizontal ao gatilho (default: end)
  className?: string;              // classes extras no gatilho
  title?: string;                  // title/tooltip do gatilho
  width?: number;                  // largura do painel (default 208)
}

const panelCls =
  'rounded-xl border border-white/[0.09] bg-[#0E141F]/95 backdrop-blur-2xl shadow-[0_16px_48px_0_rgba(0,0,0,0.55)] py-1.5 animate-fade-in-up';

export default function Menu({ items, trigger, align = 'end', className = '', title = 'Ações', width = 208 }: MenuProps) {
  const [aberto, setAberto] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const recalcular = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // horizontal: alinhado ao fim (menu cresce para a esquerda) ou ao início
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    // vertical: abre para baixo; se não couber, abre para cima
    const estimado = Math.min(items.length * 38 + 16, vh * 0.7);
    let top = r.bottom + 6;
    if (top + estimado > vh - 8) top = Math.max(8, r.top - estimado - 6);
    setPos({ top, left });
  }, [align, width, items.length]);

  useLayoutEffect(() => {
    if (aberto) recalcular();
  }, [aberto, recalcular]);

  useEffect(() => {
    if (!aberto) return;
    const onScroll = () => recalcular();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [aberto, recalcular]);

  const fechar = () => setAberto(false);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
        className={
          className ||
          `h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-all duration-200 active:scale-95 ${aberto ? 'bg-white/[0.08] text-slate-100' : ''}`
        }
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </button>

      {aberto && pos &&
        createPortal(
          <>
            {/* Camada para fechar ao clicar fora */}
            <div className="fixed inset-0 z-[220]" onClick={fechar} onContextMenu={(e) => { e.preventDefault(); fechar(); }} />
            <div
              className={`fixed z-[221] ${panelCls}`}
              style={{ top: pos.top, left: pos.left, width }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((it, i) => (
                <Linha key={i} item={it} onFechar={fechar} width={width} />
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

/* ─────────────── Linha do menu (com suporte a submenu no hover) ─────────────── */
function Linha({ item, onFechar, width }: { item: MenuItem; onFechar: () => void; width: number }) {
  const [subAberto, setSubAberto] = useState(false);
  const [subLeft, setSubLeft] = useState<'right' | 'left'>('right');
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (item.separador) return <div className="my-1 h-px bg-white/[0.07]" />;
  if (item.titulo)
    return <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">{item.label}</div>;

  const temSub = !!item.submenu?.length;

  const abrirSub = () => {
    if (!temSub) return;
    if (timer.current) clearTimeout(timer.current);
    const r = ref.current?.getBoundingClientRect();
    if (r) setSubLeft(r.right + width + 8 > window.innerWidth ? 'left' : 'right');
    setSubAberto(true);
  };
  const fecharSubComDelay = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSubAberto(false), 120);
  };

  const clicar = () => {
    if (item.desabilitado || temSub) return;
    item.onClick?.();
    onFechar();
  };

  const base =
    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors duration-150 cursor-pointer select-none';
  const cor = item.desabilitado
    ? 'text-slate-600 cursor-not-allowed'
    : item.perigo
      ? 'text-rose-400 hover:bg-rose-500/10'
      : 'text-slate-200 hover:bg-white/[0.06]';

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={abrirSub}
      onMouseLeave={fecharSubComDelay}
    >
      <div className={`${base} ${cor}`} onClick={clicar}>
        {item.icon && <span className={`shrink-0 ${item.perigo ? 'text-rose-400' : 'text-slate-400'} [&>svg]:h-4 [&>svg]:w-4`}>{item.icon}</span>}
        <span className="flex-1 truncate">{item.label}</span>
        {item.atalho && <span className="text-[10px] text-slate-600 font-mono shrink-0">{item.atalho}</span>}
        {temSub && <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
      </div>

      {temSub && subAberto && (
        <div
          className={`absolute top-0 z-[222] ${panelCls}`}
          style={{ width, [subLeft === 'right' ? 'left' : 'right']: '100%', marginLeft: subLeft === 'right' ? 6 : 0, marginRight: subLeft === 'left' ? 6 : 0 }}
          onMouseEnter={abrirSub}
          onMouseLeave={fecharSubComDelay}
        >
          {item.submenu!.map((s, i) => (
            <Linha key={i} item={s} onFechar={onFechar} width={width} />
          ))}
        </div>
      )}
    </div>
  );
}
