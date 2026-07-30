import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, TrendingUp, TrendingDown, Scale, CalendarDays,
} from 'lucide-react';
import { fluxoCaixaApi } from '../../../services/api';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const primeiroDiaAno = () => `${new Date().getFullYear()}-01-01`;
const hojeISO = () => new Date().toISOString().slice(0, 10);

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const rotularPeriodo = (p: string, ag: 'dia' | 'mes') => {
  if (ag === 'mes') { const [a, m] = p.split('-'); return `${MESES[Number(m) - 1]}/${a}`; }
  const [a, m, d] = p.split('-'); return `${d}/${m}/${a}`;
};

interface Periodo {
  periodo: string; entradas: number; saidas: number; saldoPeriodo: number; saldoAcumulado: number;
}

export default function FluxoCaixa() {
  const [dados, setDados] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [ini, setIni] = useState(primeiroDiaAno());
  const [fim, setFim] = useState(hojeISO());
  const [agrupamento, setAgrupamento] = useState<'dia' | 'mes'>('mes');

  const carregar = useCallback(() => {
    setLoading(true);
    fluxoCaixaApi.consolidado({ dataIni: ini, dataFim: fim, agrupamento })
      .then(r => setDados(r.data)).catch(() => setDados(null)).finally(() => setLoading(false));
  }, [ini, fim, agrupamento]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = dados?.kpis;
  const periodos: Periodo[] = dados?.periodos || [];
  const maxBar = Math.max(1, ...periodos.map(p => Math.max(p.entradas, p.saidas)));

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 pt-4 pb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Landmark className="h-5 w-5 text-sky-300" /> Fluxo de Caixa
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Caixa realizado · entradas pagas − saídas pagas por competência, com saldo acumulado</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {(['mes', 'dia'] as const).map(a => (
                <button key={a} onClick={() => setAgrupamento(a)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${agrupamento === a ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}>
                  {a === 'mes' ? 'Mensal' : 'Diário'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-700">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="emerald" label="Entradas (recebidas)" valor={loading ? null : R$(k?.totalEntradas)} />
          <Kpi icon={<TrendingDown className="h-4 w-4" />} cor="rose" label="Saídas (pagas)" valor={loading ? null : R$(k?.totalSaidas)} />
          <Kpi icon={<Scale className="h-4 w-4" />} cor={Number(k?.saldoLiquido) < 0 ? 'rose' : 'sky'} label="Saldo líquido" valor={loading ? null : R$(k?.saldoLiquido)} destaque />
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
          <h3 className="font-semibold text-sm text-slate-200 px-5 py-3 border-b border-slate-700/60 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-sky-300" /> Movimento por {agrupamento === 'mes' ? 'mês' : 'dia'}
          </h3>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-slate-700/30 rounded animate-pulse" />)}
            </div>
          ) : periodos.length === 0 ? (
            <p className="text-sm text-slate-500 py-16 text-center">Sem movimentação de caixa no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-900/40 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Competência</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-2/5">Fluxo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Entradas</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saídas</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saldo período</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {periodos.map(p => (
                  <tr key={p.periodo} className="border-t border-slate-800 hover:bg-slate-700/20">
                    <td className="px-4 py-2.5 font-semibold text-slate-100">{rotularPeriodo(p.periodo, dados.agrupamento)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 rounded-full bg-emerald-400/70" style={{ width: `${(p.entradas / maxBar) * 100}%`, minWidth: p.entradas > 0 ? '4px' : '0' }} />
                        <div className="h-1.5 rounded-full bg-rose-400/70" style={{ width: `${(p.saidas / maxBar) * 100}%`, minWidth: p.saidas > 0 ? '4px' : '0' }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-300">{R$(p.entradas)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-rose-300">{R$(p.saidas)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${p.saldoPeriodo < 0 ? 'text-rose-400' : 'text-slate-100'}`}>{R$(p.saldoPeriodo)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-extrabold ${p.saldoAcumulado < 0 ? 'text-rose-400' : 'text-sky-300'}`}>{R$(p.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const CORES: Record<string, string> = {
  amber: 'bg-amber-400/10 text-amber-300',
  sky: 'bg-sky-400/10 text-sky-300',
  rose: 'bg-rose-400/10 text-rose-300',
  emerald: 'bg-emerald-400/10 text-emerald-300',
};
function Kpi({ icon, label, valor, cor, destaque }: { icon: any; label: string; valor: string | null; cor: string; destaque?: boolean }) {
  return (
    <div className={`bg-slate-800/50 rounded-2xl border p-5 ${destaque ? 'border-sky-500/30' : 'border-slate-700/60'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null
        ? <div className="h-7 w-32 bg-slate-700/40 rounded animate-pulse" />
        : <p className="text-2xl font-extrabold text-white tracking-tight truncate">{valor}</p>}
    </div>
  );
}
