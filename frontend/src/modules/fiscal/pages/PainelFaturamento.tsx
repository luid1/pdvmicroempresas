import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, RefreshCw, FileText, Landmark, TrendingUp, Users, TrendingDown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nkg = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const diaLabel = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export default function PainelFaturamento() {
  const { filialAtiva } = useAuth();
  const [notas, setNotas] = useState<any[]>([]);
  const [perdas, setPerdas] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    const params = { dataInicio: ini, dataFim: fim + 'T23:59:59' };
    api.get(`/estoque/${filialAtiva.id}/perdas`, { params }).then(r => setPerdas(r.data)).catch(() => setPerdas(null));
    api.get(`/nfe/${filialAtiva.id}`, { params })
      .then(r => setNotas(r.data)).catch(() => setNotas([])).finally(() => setLoading(false));
  }, [filialAtiva?.id, ini, fim]);
  useEffect(() => { carregar(); }, [carregar]);

  // Considera apenas NF-e de venda emitidas (ignora devolução e canceladas)
  const validas = useMemo(() => notas.filter(n => n.status === 'EMITIDO' && n.finalidade !== '4'), [notas]);

  const kpis = useMemo(() => {
    const total = validas.reduce((s, n) => s + Number(n.valorNfe || 0), 0);
    const impostos = validas.reduce((s, n) => s + Number(n.valorIcms || 0) + Number(n.valorIcmsSt || 0) + Number(n.valorIpi || 0) + Number(n.valorPis || 0) + Number(n.valorCofins || 0), 0);
    const qtd = validas.length;
    return { total, impostos, qtd, ticket: qtd ? total / qtd : 0 };
  }, [validas]);

  // % de perda sobre o faturamento — insight gerencial rápido
  const perdaValor = Number(perdas?.total?.valor || 0);
  const perdaPct = kpis.total > 0 ? (perdaValor / kpis.total) * 100 : 0;

  // Faturamento por dia (gráfico)
  const porDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of validas) {
      const iso = (n.dataEmissao || '').slice(0, 10);
      if (!iso) continue;
      map.set(iso, (map.get(iso) || 0) + Number(n.valorNfe || 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([dia, valor]) => ({ dia, valor }));
  }, [validas]);
  const maxDia = Math.max(1, ...porDia.map(d => d.valor));

  // Faturamento por cliente
  const porCliente = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; qtd: number }>();
    for (const n of validas) {
      const nome = n.cliente?.razaoSocial || '—';
      const cur = map.get(nome) || { nome, valor: 0, qtd: 0 };
      cur.valor += Number(n.valorNfe || 0); cur.qtd += 1;
      map.set(nome, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [validas]);
  const maxCliente = Math.max(1, ...porCliente.map(c => c.valor));
  const topProdutosPerda: any[] = perdas?.porProduto?.slice(0, 6) || [];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* ── Cabeçalho ── */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-300" /> Painel de Faturamento
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Visão gerencial do período · vendas × prejuízo de mercadoria</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
            <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:border-emerald-500 outline-none" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:border-emerald-500 outline-none" />
          </label>
          <button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-2 rounded-lg text-slate-200 font-medium text-sm">
            <RefreshCw className={`h-4 w-4 text-emerald-300 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-7 w-7 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {/* ── KPIs — número marcante, apoio discreto ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="emerald" label="Faturamento" valor={R$(kpis.total)} />
              <Kpi icon={<Landmark className="h-4 w-4" />} cor="amber" label="Impostos (simulado)" valor={R$(kpis.impostos)} />
              <Kpi icon={<FileText className="h-4 w-4" />} cor="sky" label="Notas emitidas" valor={String(kpis.qtd)} />
              <Kpi icon={<Users className="h-4 w-4" />} cor="violet" label="Ticket médio" valor={R$(kpis.ticket)} />
            </div>

            {/* ── Gráfico de faturamento — barras finas centralizadas + insight de % perda ── */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-300" /> Faturamento por dia
                </h3>
                {/* Insight gerencial: % de perda sobre o faturamento */}
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/60 rounded-full pl-2.5 pr-3 py-1">
                  <TrendingDown className={`h-3.5 w-3.5 ${perdaPct > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
                  <span className="text-[11px] text-slate-400">Perda s/ faturamento</span>
                  <span className={`text-sm font-bold ${perdaPct > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{perdaPct.toFixed(1)}%</span>
                </div>
              </div>
              {porDia.length === 0 ? (
                <p className="text-sm text-slate-500 py-12 text-center">Sem faturamento no período.</p>
              ) : (
                <div className="flex items-end justify-center gap-6 h-48 pt-6">
                  {porDia.map(d => (
                    <div key={d.dia} className="flex flex-col items-center gap-2 w-12" title={`${diaLabel(d.dia)} — ${R$(d.valor)}`}>
                      <span className="text-[10px] text-slate-400 font-mono">{d.valor > 0 ? (d.valor / 1000).toFixed(1) + 'k' : ''}</span>
                      {/* barra fina em pill, verde menta pastel */}
                      <div className="w-2.5 rounded-full bg-emerald-300/70 hover:bg-emerald-300 transition-all"
                        style={{ height: `${Math.max(6, (d.valor / maxDia) * 150)}px` }} />
                      <span className="text-[10px] text-slate-500">{diaLabel(d.dia)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Linha 50/50: Maiores clientes  ×  Perdas por produto ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Esquerda: maiores clientes faturados */}
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-5">
                <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-sky-300" /> Maiores clientes faturados
                </h3>
                {porCliente.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">Nenhum cliente faturado.</p>
                ) : (
                  <div className="space-y-3">
                    {porCliente.slice(0, 5).map(c => (
                      <div key={c.nome}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300 font-medium truncate pr-2">{c.nome}</span>
                          <span className="font-bold text-white font-mono shrink-0">{R$(c.valor)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                          <div className="h-full bg-emerald-300/70 rounded-full" style={{ width: `${(c.valor / maxCliente) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direita: perdas por produto — fundo azul-escuro, vermelho só nos números */}
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-rose-400" /> Perdas &amp; quebras por produto
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total perdido</p>
                    <p className="text-base font-bold text-rose-400 font-mono leading-tight">{R$(perdaValor)}</p>
                  </div>
                </div>
                {/* resumo compacto perda × quebra */}
                <div className="flex gap-4 mb-3 text-xs">
                  <span className="text-slate-400">Perdas <b className="text-rose-400 font-mono">{R$(perdas?.perda?.valor || 0)}</b></span>
                  <span className="text-slate-400">Quebras <b className="text-rose-400 font-mono">{R$(perdas?.quebra?.valor || 0)}</b></span>
                </div>
                {topProdutosPerda.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">Sem perdas no período. 🎉</p>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {topProdutosPerda.map((p) => (
                        <tr key={p.codigo + p.descricao} className="border-t border-slate-700/40">
                          <td className="py-1.5 text-slate-300 font-medium truncate max-w-0">{p.descricao}</td>
                          <td className="py-1.5 text-right text-slate-500 font-mono px-2">{nkg(p.qtd)}</td>
                          <td className="py-1.5 text-right font-mono font-bold text-rose-400">{R$(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CORES: Record<string, string> = {
  emerald: 'bg-emerald-400/10 text-emerald-300',
  amber: 'bg-amber-400/10 text-amber-300',
  sky: 'bg-sky-400/10 text-sky-300',
  violet: 'bg-violet-400/10 text-violet-300',
};
function Kpi({ icon, label, valor, cor }: { icon: any; label: string; valor: string; cor: string }) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-white tracking-tight truncate">{valor}</p>
    </div>
  );
}
