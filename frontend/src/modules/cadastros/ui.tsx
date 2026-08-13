import { ReactNode, ReactElement, Children, isValidElement, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Plus, Search, X, Save, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Kit de UI "Luz" para os módulos. Área de trabalho clara (porcelana),
 * tinta #16171D, âmbar como acento. Placas brancas com borda de 1px.
 */

// Classes reutilizáveis (claro / porcelana)
export const inp = 'w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] placeholder:text-[#8B8D98] focus:outline-none focus:border-[#E8A317]/60 focus:ring-2 focus:ring-[#E8A317]/20 transition-all duration-300';
export const lbl = 'block text-[10px] font-semibold text-[#8B8D98] uppercase tracking-[0.1em] mb-1';

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Shell da página
export function CadastroShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col h-full text-[#16171D]">{children}</div>;
}

// Barra superior com título + botão "Novo Cadastro"
export function TopBar({ icon, titulo, subtitulo, onNovo, novoLabel = 'Novo Cadastro', extra }:
  { icon: ReactNode; titulo: string; subtitulo?: string; onNovo?: () => void; novoLabel?: string; extra?: ReactNode }) {
  const { pode } = useAuth();
  const rota = useLocation().pathname;
  const podeCriar = pode ? pode(rota, 'CRIAR') : true;
  return (
    <>
      <div className="border-b border-[#E7E5DF] px-5 py-2 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#E8A317] shrink-0">{icon}</span>
          <h1 className="text-sm font-bold text-[#16171D] leading-tight tracking-tight shrink-0">{titulo}</h1>
          {subtitulo && <p className="text-xs text-[#8B8D98] truncate border-l border-[#E7E5DF] pl-2.5">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-2">{extra}</div>
      </div>
      {onNovo && podeCriar && <FAB onClick={onNovo} label={novoLabel} />}
    </>
  );
}

// Botão de ação flutuante (bottom-right) — discreto, expande no hover
export function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return createPortal(
    <button onClick={onClick} title={label}
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-0 h-12 rounded-full bg-[#E8A317] hover:bg-[#F5B841] text-[#16171D] shadow-[0_10px_28px_rgba(232,163,23,0.35)] border border-[#F5B841]/50 transition-all duration-300 hover:-translate-y-[2px] active:scale-95 overflow-hidden pl-3.5 pr-3.5 hover:pr-5">
      <Plus className="h-5 w-5 shrink-0" />
      <span className="max-w-0 group-hover:max-w-[200px] overflow-hidden whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:ml-2">{label}</span>
    </button>,
    document.body
  );
}

// Classes de botão padrão — reutilizáveis fora do kit
export const btnGlass = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#E7E5DF] text-[#5B5D69] hover:bg-[#F6F5F2] hover:text-[#16171D] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';
export const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#E8A317] hover:bg-[#F5B841] text-[#16171D] shadow-[0_6px_18px_rgba(232,163,23,0.28)] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

// Header de página padrão — mesma linguagem do TopBar.
export function PageHeader({ icon, titulo, subtitulo, actions }:
  { icon: ReactNode; titulo: string; subtitulo?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border-b border-[#E7E5DF] px-5 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-white">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[#E8A317] shrink-0">{icon}</span>
        <h1 className="text-sm font-bold text-[#16171D] leading-tight tracking-tight shrink-0">{titulo}</h1>
        {subtitulo && <p className="text-xs text-[#8B8D98] truncate border-l border-[#E7E5DF] pl-2.5 hidden sm:block">{subtitulo}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// Barra de filtros (busca + filtros rápidos)
export function FilterBar({ busca, onBusca, placeholder = 'Buscar...', children }:
  { busca: string; onBusca: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-[#E7E5DF] px-5 py-2 flex flex-wrap items-center gap-3 shrink-0 bg-[#FBFAF7]">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8D98]" />
        <input value={busca} onChange={e => onBusca(e.target.value)} placeholder={placeholder}
          className="w-full bg-white border border-[#E7E5DF] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[#16171D] placeholder:text-[#8B8D98] focus:outline-none focus:border-[#E8A317]/60 transition-all duration-300" />
      </div>
      {children}
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
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 active:scale-[0.98] ${value === o.value ? 'bg-[#E8A317]/12 border-[#E8A317]/45 text-[#a9760a]' : 'bg-white border-[#E7E5DF] text-[#5B5D69] hover:text-[#16171D] hover:bg-[#F6F5F2]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Wrapper de tabela — placa branca flutuante
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden shadow-[0_1px_2px_rgba(22,23,29,0.04),0_8px_24px_rgba(22,23,29,0.05)]">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-1.5 text-left font-semibold text-[#8B8D98] text-[10px] uppercase tracking-[0.08em] bg-[#FBFAF7] ${className}`}>{children}</th>;
}

export function StatusBadge({ ativo, ativoLabel = 'ATIVO', inativoLabel = 'INATIVO' }: { ativo: boolean; ativoLabel?: string; inativoLabel?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ativo ? 'bg-[#0FA968]/12 text-[#0b7d4e]' : 'bg-[#E0483D]/12 text-[#c3352b]'}`}>
      {ativo ? ativoLabel : inativoLabel}
    </span>
  );
}

// Barra de ocupação (para Filiais/Boxes)
export function OcupacaoBar({ pct }: { pct: number }) {
  const cor = pct >= 90 ? 'bg-[#E0483D]' : pct >= 70 ? 'bg-[#E8A317]' : 'bg-[#0FA968]';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-[#F0EEE9] overflow-hidden">
        <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-mono text-[#5B5D69] w-9 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

// Modal claro com header/footer fixos
export function Modal({ titulo, onClose, onSalvar, salvando, children, salvarLabel = 'Salvar', wide }:
  { titulo: string; onClose: () => void; onSalvar?: () => void; salvando?: boolean; children: ReactNode; salvarLabel?: string; wide?: boolean }) {
  return createPortal((
    <div className="fixed inset-0 bg-[#16171D]/40 flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={onClose}>
      <div className={`relative bg-white border border-[#E7E5DF] rounded-2xl shadow-[0_24px_80px_0_rgba(22,23,29,0.28)] w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[92vh] flex flex-col overflow-hidden animate-modal`} onClick={e => e.stopPropagation()}>
        {/* Faixa de brilho âmbar no topo do pop-up */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A317]/60 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-40 w-72 rounded-full bg-[#E8A317]/8 blur-3xl" aria-hidden />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E5DF] shrink-0 relative">
          <h2 className="font-bold text-[#16171D] text-sm tracking-tight">{titulo}</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-[#8B8D98] hover:text-[#16171D] hover:bg-[#F6F5F2] transition-all duration-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {onSalvar && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E7E5DF] shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-white border border-[#E7E5DF] rounded-lg text-sm text-[#5B5D69] hover:bg-[#F6F5F2] hover:text-[#16171D] transition-all duration-300 active:scale-[0.98]">Cancelar</button>
            <button onClick={onSalvar} disabled={salvando}
              className="px-5 py-2 bg-[#E8A317] hover:bg-[#F5B841] text-[#16171D] rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-1.5 shadow-[0_6px_18px_rgba(232,163,23,0.28)] transition-all duration-300 active:scale-[0.98]">
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
  return <div className="flex items-center gap-2 text-[11px] font-bold text-[#8B8D98] uppercase tracking-wide pt-1">{icon}{titulo}</div>;
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
      <div className="sticky top-0 z-10 -mt-1 pb-2 bg-gradient-to-b from-white via-white/90 to-transparent">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 flex items-center gap-1">
            {steps.map((s, i) => {
              const doneVisible = s.props.complete && i < reveal;
              return (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-[#F0EEE9]">
                  <div className={`h-full rounded-full transition-all duration-500 ${doneVisible ? 'bg-gradient-to-r from-[#E8A317] to-[#F5B841] shadow-[0_0_8px_rgba(232,163,23,0.5)]' : i < reveal ? 'bg-[#E8A317]/30' : ''}`} style={{ width: doneVisible ? '100%' : i < reveal ? '35%' : '0%' }} />
                </div>
              );
            })}
          </div>
          <span className="text-[10px] font-mono text-[#8B8D98] tabular-nums shrink-0">{completos}/{total}</span>
        </div>
      </div>

      {steps.slice(0, reveal).map((s, i) => {
        const done = !!s.props.complete;
        const isLastRevealed = i === reveal - 1;
        const canAdvance = isLastRevealed && reveal < total;
        return (
          <div key={i} className="animate-fade-in-up">
            <div className="flex items-center gap-2 pt-1 mb-2">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${done ? 'bg-[#0FA968]/15 border-[#0FA968]/40 text-[#0b7d4e]' : 'bg-[#E8A317]/12 border-[#E8A317]/40 text-[#a9760a]'}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="text-[11px] font-bold text-[#5B5D69] uppercase tracking-[0.1em] flex items-center gap-1.5">{s.props.icon}{s.props.title}</span>
            </div>
            <div className="space-y-3">{s.props.children}</div>
            {canAdvance && (
              <button type="button" onClick={() => setManual(reveal + 1)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#a9760a] bg-[#E8A317]/[0.08] border border-[#E8A317]/25 hover:bg-[#E8A317]/[0.14] transition-all duration-300 active:scale-[0.98]">
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
    <div className="rounded-2xl border border-[#E7E5DF] overflow-hidden bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#F0EEE9]" style={{ animationDelay: `${i * 60}ms` }}>
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
  return <div className="text-center text-[#8B8D98] py-16"><div className="mx-auto mb-2 opacity-40 flex justify-center">{icon}</div><p className="text-sm">{texto}</p></div>;
}
