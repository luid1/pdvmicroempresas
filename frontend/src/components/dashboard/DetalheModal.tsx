import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight, ArrowRight, X } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

/* ─────────────── Tipos ─────────────── */
export interface DetalheLinha {
  label: string;
  valor: string;
  cor?: string; // classe tailwind opcional p/ o valor (ex: 'text-rose-400')
}
export interface DetalheRegistro {
  titulo: string;
  subtitulo?: string;
  valor: string;
  cor?: string; // classe tailwind opcional p/ o valor
  rota?: string; // navega ao clicar na linha
}
export interface DetalheCard {
  icon: any; // lucide icon
  tone: string; // paleta igual ao Kpi (emerald, blue, amber, sky...)
  titulo: string;
  valorPrincipal: string;
  subtitulo?: string;
  delta?: number; // % vs período anterior
  linhas: DetalheLinha[];
  serie?: { label: string; valor: number }[]; // sparkline
  rota?: string; // destino do "Ver mais"
  verMaisLabel?: string;
  atalhos?: { label: string; rota: string }[];
  carregarLista?: () => Promise<DetalheRegistro[]>; // lista de registros reais (sob demanda)
  listaTitulo?: string; // ex: 'Últimas NF-e'
  listaVazia?: string; // ex: 'Nenhum título vencido'
}

/* Paleta reaproveitada do Kpi do DashboardPage */
const tones: Record<string, string> = {
  sky: 'text-sky-300 bg-sky-500/10 border-sky-400/20',
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-400/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-400/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-400/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-400/20',
  blue: 'text-blue-300 bg-blue-500/10 border-blue-400/20',
  indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-400/20',
  slate: 'text-slate-400 bg-white/[0.04] border-white/[0.08]',
};

const tipStyle = { background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12, color: '#e2e8f0' };
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function Delta({ v }: { v: number }) {
  if (!v) return <span className="text-[11px] text-slate-500">estável</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {pct(Math.abs(v))}
    </span>
  );
}

/* ─────────────── Modal ─────────────── */
export default function DetalheModal({
  detalhe,
  onClose,
  navigate,
}: {
  detalhe: DetalheCard | null;
  onClose: () => void;
  navigate: (rota: string) => void;
}) {
  const [registros, setRegistros] = useState<DetalheRegistro[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!detalhe) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detalhe, onClose]);

  useEffect(() => {
    setRegistros(null);
    setErro(false);
    if (!detalhe?.carregarLista) { setCarregando(false); return; }
    let ativo = true;
    setCarregando(true);
    detalhe.carregarLista()
      .then((regs) => { if (ativo) setRegistros(regs); })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [detalhe]);

  if (!detalhe) return null;
  const { icon: Icon, tone, titulo, valorPrincipal, subtitulo, delta, linhas, serie, rota, verMaisLabel, atalhos, carregarLista, listaTitulo, listaVazia } = detalhe;

  const irPara = (r: string) => {
    onClose();
    navigate(r);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[210] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_0_rgba(0,0,0,0.6)] w-full max-w-md animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3 border-b border-white/[0.06]">
          <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone] || tones.slate}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] truncate">{titulo}</p>
              {delta !== undefined && <Delta v={delta} />}
            </div>
            <p className="text-2xl font-extrabold text-white tracking-tight tabular-nums truncate mt-0.5">{valorPrincipal}</p>
            {subtitulo && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors shrink-0 -mr-1 -mt-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sparkline */}
        {serie && serie.length > 1 && (
          <div className="px-5 pt-4">
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDetalhe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={tipStyle} formatter={(v: any) => [v, '']} labelFormatter={(_l, p: any) => p?.[0]?.payload?.label ?? ''} cursor={{ stroke: 'rgba(52,211,153,0.3)' }} />
                <Area type="monotone" dataKey="valor" stroke="#34d399" strokeWidth={2} fill="url(#gDetalhe)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista de detalhes */}
        {linhas.length > 0 && (
          <div className="px-5 py-4 space-y-2">
            {linhas.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l.label}</span>
                <span className={`font-semibold tabular-nums ${l.cor || 'text-slate-100'}`}>{l.valor}</span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de registros reais (sob demanda) */}
        {carregarLista && (
          <div className="px-5 pb-2">
            {listaTitulo && (
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-1.5">{listaTitulo}</p>
            )}
            {carregando && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 animate-pulse">
                    <div className="h-3 w-32 rounded bg-white/[0.08]" />
                    <div className="h-3 w-16 rounded bg-white/[0.08]" />
                  </div>
                ))}
              </div>
            )}
            {!carregando && erro && (
              <p className="text-xs text-slate-500 py-3 text-center">Não foi possível carregar a lista.</p>
            )}
            {!carregando && !erro && registros && registros.length === 0 && (
              <p className="text-xs text-slate-500 py-3 text-center">{listaVazia || 'Nenhum registro.'}</p>
            )}
            {!carregando && !erro && registros && registros.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto -mr-1 pr-1">
                {registros.map((r, i) => {
                  const clic = !!r.rota;
                  return (
                    <div
                      key={i}
                      onClick={clic ? () => irPara(r.rota!) : undefined}
                      className={`flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 ${clic ? 'cursor-pointer hover:bg-white/[0.06] transition-colors' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{r.titulo}</p>
                        {r.subtitulo && <p className="text-[10px] text-slate-500 truncate">{r.subtitulo}</p>}
                      </div>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${r.cor || 'text-slate-100'}`}>{r.valor}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Atalhos rápidos */}
        {atalhos && atalhos.length > 0 && (
          <div className="px-5 pb-1">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-1.5">Atalhos</p>
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a, i) => (
                <button
                  key={i}
                  onClick={() => irPara(a.rota)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.98]"
                >
                  {a.label}
                  <ChevronRight className="h-3 w-3 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 mt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.08] transition-all duration-300 active:scale-[0.98]"
          >
            Fechar
          </button>
          {rota && (
            <button
              onClick={() => irPara(rota)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-all duration-300 active:scale-[0.98]"
            >
              {verMaisLabel || 'Ver mais'}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
