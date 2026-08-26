import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, TrendingUp, TrendingDown, Scale, CalendarDays,
} from 'lucide-react';
import { fluxoCaixaApi } from '../../../services/api';
import { PageHeader } from '../../cadastros/ui';

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
    <div className="flex flex-col h-full bg-[#0C0D10] text-[#F7F8FA]">
      <PageHeader
        icon={<Landmark className="h-4 w-4" />}
        titulo="Fluxo de Caixa"
        subtitulo="Caixa realizado · entradas pagas − saídas pagas por competência, com saldo acumulado"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#0C0D10] border border-[#23262F] rounded-lg overflow-hidden">
              {(['mes', 'dia'] as const).map(a => (
                <button key={a} onClick={() => setAgrupamento(a)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${agrupamento === a ? 'bg-[#01B8FA]/16 text-[#01B8FA]' : 'text-[#8A90A0] hover:text-[#F7F8FA]'}`}>
                  {a === 'mes' ? 'Mensal' : 'Diário'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-[#0C0D10] border border-[#23262F] rounded-lg px-2.5 py-1.5 text-sm text-[#F7F8FA] outline-none [color-scheme:dark] focus:border-[#01B8FA]/60" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-[#0C0D10] border border-[#23262F] rounded-lg px-2.5 py-1.5 text-sm text-[#F7F8FA] outline-none [color-scheme:dark] focus:border-[#01B8FA]/60" />
            </label>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] hover:bg-[#16181F] text-[#8A90A0] hover:text-[#F7F8FA] text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#23262F]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="emerald" label="Entradas (recebidas)" valor={loading ? null : R$(k?.totalEntradas)} />
          <Kpi icon={<TrendingDown className="h-4 w-4" />} cor="rose" label="Saídas (pagas)" valor={loading ? null : R$(k?.totalSaidas)} />
          <Kpi icon={<Scale className="h-4 w-4" />} cor={Number(k?.saldoLiquido) < 0 ? 'rose' : 'sky'} label="Saldo líquido" valor={loading ? null : R$(k?.saldoLiquido)} destaque />
        </div>

        <div className="bg-[#101216] rounded-2xl border border-[#23262F] overflow-hidden">
          <h3 className="font-semibold text-sm text-[#F7F8FA] px-5 py-3 border-b border-[#23262F] flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#01B8FA]" /> Movimento por {agrupamento === 'mes' ? 'mês' : 'dia'}
          </h3>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-[#16181F] rounded animate-pulse" />)}
            </div>
          ) : periodos.length === 0 ? (
            <p className="text-sm text-[#5E6472] py-16 text-center">Sem movimentação de caixa no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#0C0D10] text-xs text-[#8A90A0] border-b border-[#23262F]">
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
                  <tr key={p.periodo} className="border-t border-[#23262F] hover:bg-[#16181F]">
                    <td className="px-4 py-2.5 font-semibold text-[#F7F8FA]">{rotularPeriodo(p.periodo, dados.agrupamento)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 rounded-full bg-[#2DD4A7]/70" style={{ width: `${(p.entradas / maxBar) * 100}%`, minWidth: p.entradas > 0 ? '4px' : '0' }} />
                        <div className="h-1.5 rounded-full bg-[#FF6B7A]/70" style={{ width: `${(p.saidas / maxBar) * 100}%`, minWidth: p.saidas > 0 ? '4px' : '0' }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-num text-[#2DD4A7]">{R$(p.entradas)}</td>
                    <td className="px-4 py-2.5 text-right font-num text-[#FF6B7A]">{R$(p.saidas)}</td>
                    <td className={`px-4 py-2.5 text-right font-num font-bold ${p.saldoPeriodo < 0 ? 'text-[#FF6B7A]' : 'text-[#F7F8FA]'}`}>{R$(p.saldoPeriodo)}</td>
                    <td className={`px-4 py-2.5 text-right font-num font-extrabold ${p.saldoAcumulado < 0 ? 'text-[#FF6B7A]' : 'text-[#2DD4A7]'}`}>{R$(p.saldoAcumulado)}</td>
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
  amber: 'bg-[#FF9F45]/12 text-[#FF9F45]',
  sky: 'bg-[#01B8FA]/12 text-[#01B8FA]',
  rose: 'bg-[#FF6B7A]/12 text-[#FF6B7A]',
  emerald: 'bg-[#2DD4A7]/12 text-[#2DD4A7]',
};
function Kpi({ icon, label, valor, cor, destaque }: { icon: any; label: string; valor: string | null; cor: string; destaque?: boolean }) {
  return (
    <div className={`bg-[#101216] rounded-2xl border p-5 ${destaque ? 'border-[#01B8FA]/30' : 'border-[#23262F]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-[#8A90A0] font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null
        ? <div className="h-7 w-32 bg-[#16181F] rounded animate-pulse" />
        : <p className="font-num text-2xl font-extrabold text-[#F7F8FA] tracking-tight truncate">{valor}</p>}
    </div>
  );
}
