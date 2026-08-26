import { ReactNode, ReactElement, Children, isValidElement, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Plus, Search, X, Save, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Kit de UI "Luz" para os módulos. Área de trabalho clara (porcelana),
 * tinta #F7F8FA, âmbar como acento. Placas brancas com borda de 1px.
 */

// Classes reutilizáveis (claro / porcelana)
export const inp = 'w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] placeholder:text-[#8A90A0] focus:outline-none focus:border-[#01B8FA]/60 focus:ring-2 focus:ring-[#01B8FA]/20 transition-all duration-300';
export const lbl = 'block text-[10px] font-semibold text-[#8A90A0] uppercase tracking-[0.1em] mb-1';

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Shell da página
export function CadastroShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col h-full text-[#F7F8FA]">{children}</div>;
}

// Cabeçalho de página — mesma linguagem do Dashboard: chip de ícone com brilho
// do accent, título branco, hairline sutil e um filete de accent na base.
function HeaderBar({ icon, titulo, subtitulo, right }:
  { icon: ReactNode; titulo: string; subtitulo?: ReactNode; right?: ReactNode }) {
  return (
    <div
      className="relative flex items-center justify-between gap-3 shrink-0 border-b border-[#191B21] px-4 py-2.5 sm:px-5"
      style={{ background: 'radial-gradient(140% 120% at 0% -20%, rgba(1,184,250,0.07), rgba(1,184,250,0) 42%), #08090A' }}
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-[#01B8FA]/35 to-transparent" />
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-[#01B8FA]/30 text-[#01B8FA]"
          style={{ background: 'radial-gradient(120% 120% at 30% 20%, rgba(1,184,250,0.22), rgba(1,184,250,0.06))', boxShadow: '0 0 18px -6px rgba(1,184,250,0.55), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          {icon}
        </span>
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="shrink-0 text-[15px] font-bold leading-none tracking-tight text-[#F7F8FA]">{titulo}</h1>
          {subtitulo && <p className="hidden truncate text-[11px] text-[#8A90A0] sm:block">{subtitulo}</p>}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

// Barra superior com título + botão "Novo Cadastro"
export function TopBar({ icon, titulo, subtitulo, onNovo, novoLabel = 'Novo Cadastro', extra }:
  { icon: ReactNode; titulo: string; subtitulo?: string; onNovo?: () => void; novoLabel?: string; extra?: ReactNode }) {
  const { pode } = useAuth();
  const rota = useLocation().pathname;
  const podeCriar = pode ? pode(rota, 'CRIAR') : true;
  return (
    <>
      <HeaderBar icon={icon} titulo={titulo} subtitulo={subtitulo} right={extra} />
      {onNovo && podeCriar && <FAB onClick={onNovo} label={novoLabel} />}
    </>
  );
}

// Botão de ação flutuante — fica ACIMA do gatilho da Lu (que mora no canto),
// pílula de accent que expande no hover. Cores no padrão do tema escuro.
export function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return createPortal(
    <button onClick={onClick} title={label} aria-label={label}
      className="group fixed bottom-24 right-5 z-[55] flex h-11 items-center gap-0 overflow-hidden rounded-full border border-[#22D3EE]/40 bg-[#01B8FA] pl-3 pr-3 text-[#04121A] shadow-[0_10px_28px_rgba(1,184,250,0.32)] transition-all duration-300 hover:-translate-y-[2px] hover:bg-[#22D3EE] hover:pr-5 hover:shadow-[0_14px_34px_rgba(1,184,250,0.45)] active:scale-95 sm:right-6">
      <Plus className="h-5 w-5 shrink-0" strokeWidth={2.4} />
      <span className="max-w-0 group-hover:max-w-[200px] overflow-hidden whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:ml-1.5">{label}</span>
    </button>,
    document.body
  );
}

// Classes de botão padrão — reutilizáveis fora do kit
export const btnGlass = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:bg-[#0C0D10] hover:text-[#F7F8FA] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';
export const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

// Header de página padrão — mesma linguagem do TopBar (chip + hairline accent).
export function PageHeader({ icon, titulo, subtitulo, actions }:
  { icon: ReactNode; titulo: string; subtitulo?: ReactNode; actions?: ReactNode }) {
  return <HeaderBar icon={icon} titulo={titulo} subtitulo={subtitulo} right={actions} />;
}

// Campo de pesquisa compartilhado entre cadastros, estoque e demais módulos.
export function SearchField({ busca, onBusca, placeholder = 'Buscar...', className = '' }:
  { busca: string; onBusca: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`group relative w-full min-w-0 ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A90A0] transition-colors group-focus-within:text-[#01B8FA]" />
      <input type="search" aria-label={placeholder} value={busca} onChange={e => onBusca(e.target.value)} placeholder={placeholder}
        className="h-10 w-full rounded-full border border-[#23262F] bg-[#101216] pl-10 pr-10 text-[13px] text-[#F7F8FA] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none transition-all placeholder:text-[#8A90A0] focus:border-[#01B8FA]/60 focus:ring-4 focus:ring-[#01B8FA]/10" />
      {busca && <button type="button" onClick={() => onBusca('')} aria-label="Limpar pesquisa" title="Limpar pesquisa" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#8A90A0] transition-colors hover:bg-[#23262F] hover:text-[#F7F8FA]"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

// Barra de filtros (busca + filtros rápidos)
export function FilterBar({ busca, onBusca, placeholder = 'Buscar...', children }:
  { busca: string; onBusca: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-b border-[#23262F] bg-[#0C0D10] px-4 py-2.5 sm:flex-row sm:items-center sm:px-5">
      <SearchField busca={busca} onBusca={onBusca} placeholder={placeholder} className="sm:max-w-[440px] sm:flex-1" />
      {children && <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin] sm:overflow-visible">{children}</div>}
    </div>
  );
}

// Chips de filtro rápido
export function Chips({ value, onChange, options }:
  { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 active:scale-[0.98] ${value === o.value ? 'bg-[#01B8FA]/12 border-[#01B8FA]/45 text-[#0E86D4]' : 'bg-[#101216] border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Wrapper de tabela — placa branca flutuante
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#101216] rounded-2xl border border-[#23262F] overflow-hidden shadow-[0_1px_2px_rgba(22,23,29,0.04),0_8px_24px_rgba(22,23,29,0.05)]">
      <table className="w-full text-[12px]">{children}</table>
    </div>
  );
}
export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] bg-[#0C0D10] border-b border-[#23262F] ${className}`}>{children}</th>;
}

export function StatusBadge({ ativo, ativoLabel = 'ATIVO', inativoLabel = 'INATIVO' }: { ativo: boolean; ativoLabel?: string; inativoLabel?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ativo ? 'bg-[#2DD4A7]/12 text-[#2DD4A7]' : 'bg-[#FF6B7A]/12 text-[#FF6B7A]'}`}>
      {ativo ? ativoLabel : inativoLabel}
    </span>
  );
}

// Barra de ocupação (para Filiais/Boxes)
export function OcupacaoBar({ pct }: { pct: number }) {
  const cor = pct >= 90 ? 'bg-[#FF6B7A]' : pct >= 70 ? 'bg-[#D97706]' : 'bg-[#2DD4A7]';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-[#23262F] overflow-hidden">
        <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-mono text-[#8A90A0] w-9 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

// Modal claro com header/footer fixos
export function Modal({ titulo, onClose, onSalvar, salvando, children, salvarLabel = 'Salvar', wide }:
  { titulo: string; onClose: () => void; onSalvar?: () => void; salvando?: boolean; children: ReactNode; salvarLabel?: string; wide?: boolean }) {
  return createPortal((
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={onClose}>
      <div className={`relative bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_0_rgba(22,23,29,0.28)] w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[92vh] flex flex-col overflow-hidden animate-modal`} onClick={e => e.stopPropagation()}>
        {/* Faixa de brilho âmbar no topo do pop-up */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#01B8FA]/60 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-40 w-72 rounded-full bg-[#01B8FA]/8 blur-3xl" aria-hidden />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#23262F] shrink-0 relative">
          <h2 className="font-bold text-[#F7F8FA] text-sm tracking-tight">{titulo}</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10] transition-all duration-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {onSalvar && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#23262F] shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-[#101216] border border-[#23262F] rounded-lg text-sm text-[#8A90A0] hover:bg-[#0C0D10] hover:text-[#F7F8FA] transition-all duration-300 active:scale-[0.98]">Cancelar</button>
            <button onClick={onSalvar} disabled={salvando}
              className="px-5 py-2 bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-1.5 shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all duration-300 active:scale-[0.98]">
              {salvando ? 'Salvando…' : <><Save className="h-4 w-4" /> {salvarLabel}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  ), document.body);
}

// Cabeçalho de seção dentro do modal
export function Secao({ icon, titulo }: { icon?: ReactNode; titulo: string }) {
  return <div className="flex items-center gap-2 text-[11px] font-bold text-[#8A90A0] uppercase tracking-wide pt-1">{icon}{titulo}</div>;
}

/* ============================================================
   FORMULÁRIO PROGRESSIVO — as seções revelam a próxima conforme
   você preenche. Barra de progresso no topo + transição spring.
   ============================================================ */
interface StepProps { title: string; icon?: ReactNode; complete?: boolean; hint?: string; children: ReactNode }
// Marcador declarativo — o SteppedForm é quem renderiza.
export function Step(_: StepProps) { return null; }

export function SteppedForm({ children }: { children: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement) as ReactElement<StepProps>[];
  const total = steps.length;
  const firstIncomplete = steps.findIndex(s => !s.props.complete);
  const autoReveal = firstIncomplete === -1 ? total : firstIncomplete + 1;
  const [manual, setManual] = useState(1); // quantos passos o usuário destravou manualmente
  const reveal = Math.min(total, Math.max(autoReveal, manual));
  const completos = steps.filter((s, i) => s.props.complete && i < reveal).length;

  return (
    <div className="space-y-4">
      {/* Barra de progresso segmentada — trilha de energia */}
      <div className="sticky top-0 z-10 -mt-1 pb-2 bg-gradient-to-b from-[#101216] via-[#101216]/90 to-transparent">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 flex items-center gap-1">
            {steps.map((s, i) => {
              const doneVisible = s.props.complete && i < reveal;
              return (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-[#23262F]">
                  <div className={`h-full rounded-full transition-all duration-500 ${doneVisible ? 'bg-gradient-to-r from-[#01B8FA] to-[#22D3EE] shadow-[0_0_8px_rgba(1,184,250,0.5)]' : i < reveal ? 'bg-[#01B8FA]/30' : ''}`} style={{ width: doneVisible ? '100%' : i < reveal ? '35%' : '0%' }} />
                </div>
              );
            })}
          </div>
          <span className="text-[10px] font-mono text-[#8A90A0] tabular-nums shrink-0">{completos}/{total}</span>
        </div>
      </div>

      {steps.slice(0, reveal).map((s, i) => {
        const done = !!s.props.complete;
        const isLastRevealed = i === reveal - 1;
        const canAdvance = isLastRevealed && reveal < total;
        return (
          <div key={i} className="animate-fade-in-up">
            <div className="flex items-center gap-2 pt-1 mb-2">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${done ? 'bg-[#2DD4A7]/15 border-[#2DD4A7]/40 text-[#2DD4A7]' : 'bg-[#01B8FA]/12 border-[#01B8FA]/40 text-[#0E86D4]'}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="text-[11px] font-bold text-[#8A90A0] uppercase tracking-[0.1em] flex items-center gap-1.5">{s.props.icon}{s.props.title}</span>
            </div>
            <div className="space-y-3">{s.props.children}</div>
            {canAdvance && (
              <button type="button" onClick={() => setManual(reveal + 1)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#0E86D4] bg-[#01B8FA]/[0.08] border border-[#01B8FA]/25 hover:bg-[#01B8FA]/[0.14] transition-all duration-300 active:scale-[0.98]">
                {s.props.hint || 'Continuar'} <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Campo rotulado
export function Campo({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className}><label className={lbl}>{label}</label>{children}</div>;
}

// Estado de carregamento / vazio
export function Loader({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-[#23262F] overflow-hidden bg-[#101216]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#23262F]" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="skeleton h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 rounded" style={{ width: `${45 + (i % 4) * 12}%` }} />
            <div className="skeleton h-2.5 rounded" style={{ width: `${25 + (i % 3) * 10}%` }} />
          </div>
          <div className="skeleton h-3 w-20 rounded shrink-0" />
          <div className="skeleton h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}
export function Vazio({ icon, texto }: { icon: ReactNode; texto: string }) {
  return <div className="text-center text-[#8A90A0] py-16"><div className="mx-auto mb-2 opacity-40 flex justify-center">{icon}</div><p className="text-sm">{texto}</p></div>;
}
