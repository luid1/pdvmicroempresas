import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, ArrowDownRight, ChevronRight, ArrowRight, X } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

/* ─────────────── Tipos ─────────────── */
export interface DetalheLinha {
  label: string;
  valor: string;
  cor?: string; // classe tailwind opcional p/ o valor (ex: 'text-[#E0483D]')
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

/* Paleta reaproveitada do Kpi do DashboardPage (Luz / claro) */
const tones: Record<string, string> = {
  sky: 'text-[#1f74c9] bg-[#3896f0]/10 border-[#3896f0]/20',
  emerald: 'text-[#0b7d4e] bg-[#0FA968]/10 border-[#0FA968]/22',
  rose: 'text-[#c3352b] bg-[#E0483D]/10 border-[#E0483D]/22',
  brand: 'text-[#2348C7] bg-[#2F5FE0]/12 border-[#2F5FE0]/25',
  amber: 'text-[#A15C07] bg-[#D97706]/10 border-[#D97706]/25',
  warning: 'text-[#A15C07] bg-[#D97706]/10 border-[#D97706]/25',
  violet: 'text-[#5a4fd0] bg-[#7C6BF0]/10 border-[#7C6BF0]/20',
  teal: 'text-[#0e7490] bg-[#06b6d4]/10 border-[#06b6d4]/20',
  blue: 'text-[#4f46e5] bg-[#6366f1]/10 border-[#6366f1]/20',
  indigo: 'text-[#4f46e5] bg-[#6366f1]/10 border-[#6366f1]/20',
  slate: 'text-[#5F6065] bg-[#F7F7F8] border-[#E5E7EB]',
};

const tipStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12, color: '#202123', boxShadow: '0 8px 24px rgba(22,23,29,0.12)' };
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function Delta({ v }: { v: number }) {
  if (!v) return <span className="text-[11px] text-[#8E8F94]">estável</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-[#0FA968]' : 'text-[#E0483D]'}`}>
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

  return createPortal(
    <div
      className="fixed inset-0 bg-[#202123]/40 backdrop-blur-sm flex items-center justify-center z-[210] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_24px_80px_0_rgba(22,23,29,0.28)] w-full max-w-md animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3 border-b border-[#E5E7EB]">
          <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone] || tones.slate}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#8E8F94] uppercase tracking-[0.1em] truncate">{titulo}</p>
              {delta !== undefined && <Delta v={delta} />}
            </div>
            <p className="font-num text-2xl font-extrabold text-[#202123] tracking-tight tabular-nums truncate mt-0.5">{valorPrincipal}</p>
            {subtitulo && <p className="text-[11px] text-[#8E8F94] mt-0.5 truncate">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-[#8E8F94] hover:text-[#202123] transition-colors shrink-0 -mr-1 -mt-1">
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
                    <stop offset="0%" stopColor="#0FA968" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#0FA968" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={tipStyle} formatter={(v: any) => [v, '']} labelFormatter={(_l, p: any) => p?.[0]?.payload?.label ?? ''} cursor={{ stroke: 'rgba(15,169,104,0.35)' }} />
                <Area type="monotone" dataKey="valor" stroke="#0FA968" strokeWidth={2} fill="url(#gDetalhe)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista de detalhes */}
        {linhas.length > 0 && (
          <div className="px-5 py-4 space-y-2">
            {linhas.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[#5F6065]">{l.label}</span>
                <span className={`font-semibold tabular-nums ${l.cor || 'text-[#202123]'}`}>{l.valor}</span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de registros reais (sob demanda) */}
        {carregarLista && (
          <div className="px-5 pb-2">
            {listaTitulo && (
              <p className="text-[10px] font-semibold text-[#8E8F94] uppercase tracking-[0.1em] mb-1.5">{listaTitulo}</p>
            )}
            {carregando && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[#F7F7F8] border border-[#E5E7EB] px-3 py-2 animate-pulse">
                    <div className="h-3 w-32 rounded bg-[#E5E7EB]" />
                    <div className="h-3 w-16 rounded bg-[#E5E7EB]" />
                  </div>
                ))}
              </div>
            )}
            {!carregando && erro && (
              <p className="text-xs text-[#8E8F94] py-3 text-center">Não foi possível carregar a lista.</p>
            )}
            {!carregando && !erro && registros && registros.length === 0 && (
              <p className="text-xs text-[#8E8F94] py-3 text-center">{listaVazia || 'Nenhum registro.'}</p>
            )}
            {!carregando && !erro && registros && registros.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto -mr-1 pr-1">
                {registros.map((r, i) => {
                  const clic = !!r.rota;
                  return (
                    <div
                      key={i}
                      onClick={clic ? () => irPara(r.rota!) : undefined}
                      className={`flex items-center justify-between gap-2 rounded-lg bg-[#F7F7F8] border border-[#E5E7EB] px-3 py-2 ${clic ? 'cursor-pointer hover:bg-[#EFEDE7] transition-colors' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#202123] truncate">{r.titulo}</p>
                        {r.subtitulo && <p className="text-[10px] text-[#8E8F94] truncate">{r.subtitulo}</p>}
                      </div>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${r.cor || 'text-[#202123]'}`}>{r.valor}</span>
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
            <p className="text-[10px] font-semibold text-[#8E8F94] uppercase tracking-[0.1em] mb-1.5">Atalhos</p>
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a, i) => (
                <button
                  key={i}
                  onClick={() => irPara(a.rota)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs text-[#5F6065] hover:bg-[#F7F7F8] hover:text-[#202123] transition-all active:scale-[0.98]"
                >
                  {a.label}
                  <ChevronRight className="h-3 w-3 text-[#8E8F94]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 mt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm text-[#5F6065] hover:bg-[#F7F7F8] hover:text-[#202123] transition-all duration-300 active:scale-[0.98]"
          >
            Fechar
          </button>
          {rota && (
            <button
              onClick={() => irPara(rota)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#2F5FE0] hover:bg-[#5B7BF0] active:bg-[#d69610] text-[#202123] text-sm font-bold transition-all duration-300 active:scale-[0.98]"
            >
              {verMaisLabel || 'Ver mais'}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
