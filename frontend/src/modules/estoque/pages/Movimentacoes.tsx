import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, Loader, Vazio, inp } from '../../cadastros/ui';

const num = (v: any, d = 3) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const dt = (v: any) => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const TIPOS: Record<string, { label: string; entrada: boolean; cor: string }> = {
  ENTRADA_COMPRA: { label: 'Entrada (compra)', entrada: true, cor: 'text-[#0b7d4e] bg-emerald-500/10' },
  ENTRADA_DEVOLUCAO: { label: 'Entrada (devolução)', entrada: true, cor: 'text-[#0b7d4e] bg-emerald-500/10' },
  TRANSFERENCIA_ENTRADA: { label: 'Transf. entrada', entrada: true, cor: 'text-[#0e7490] bg-cyan-500/10' },
  AJUSTE_POSITIVO: { label: 'Ajuste +', entrada: true, cor: 'text-[#0b7d4e] bg-emerald-500/10' },
  SAIDA_VENDA: { label: 'Saída (venda)', entrada: false, cor: 'text-[#c3352b] bg-rose-500/10' },
  SAIDA_DEVOLUCAO_FORNECEDOR: { label: 'Saída (devol. forn.)', entrada: false, cor: 'text-[#c3352b] bg-rose-500/10' },
  TRANSFERENCIA_SAIDA: { label: 'Transf. saída', entrada: false, cor: 'text-[#a9760a] bg-[#E8A317]/12' },
  AJUSTE_NEGATIVO: { label: 'Ajuste −', entrada: false, cor: 'text-[#c3352b] bg-rose-500/10' },
  PERDA: { label: 'Perda', entrada: false, cor: 'text-[#c3352b] bg-rose-500/10' },
  AVARIA: { label: 'Avaria', entrada: false, cor: 'text-[#c3352b] bg-rose-500/10' },
  PICKING: { label: 'Picking', entrada: false, cor: 'text-[#8B8D98] bg-slate-500/10' },
};

export default function Movimentacoes() {
  const { filialAtiva } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    const params: any = {};
    if (tipo) params.tipo = tipo;
    if (ini) params.dataInicio = ini;
    if (fim) params.dataFim = fim + 'T23:59:59';
    api.get(`/estoque/${filialAtiva.id}/movimentacoes`, { params })
      .then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  }, [filialAtiva?.id, tipo, ini, fim]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = lista.filter(m => !busca.trim() || (m.produto?.descricao || '').toLowerCase().includes(busca.toLowerCase()) || (m.produto?.codigo || '').toLowerCase().includes(busca.toLowerCase()));

  const kpis = useMemo(() => {
    let ent = 0, sai = 0;
    for (const m of filtradas) { if (TIPOS[m.tipo]?.entrada) ent += Number(m.quantidade); else sai += Number(m.quantidade); }
    return { ent, sai, total: filtradas.length };
  }, [filtradas]);

  return (
    <CadastroShell>
      <TopBar icon={<ArrowLeftRight className="h-5 w-5" />} titulo="Movimentações" subtitulo={`${filtradas.length} lançamento(s) — extrato de estoque`}
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-white border border-[#E7E5DF] hover:bg-[#EFEDE7] px-3 py-2 rounded-lg text-[#5B5D69] text-sm"><RefreshCw className="h-4 w-4 text-[#a9760a]" /> Atualizar</button>} />

      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por produto ou código...">
        <select value={tipo} onChange={e => setTipo(e.target.value)} className={`${inp} w-auto`}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De<input type="date" value={ini} onChange={e => setIni(e.target.value)} className={`${inp} w-auto`} /></label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até<input type="date" value={fim} onChange={e => setFim(e.target.value)} className={`${inp} w-auto`} /></label>
      </FilterBar>

      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#E7E5DF] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-[#0b7d4e] flex items-center justify-center"><ArrowDownCircle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">Entradas (qtd)</p><p className="text-lg font-bold text-[#0b7d4e]">{num(kpis.ent)}</p></div></div>
        <div className="bg-white border border-[#E7E5DF] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-rose-500/10 text-[#c3352b] flex items-center justify-center"><ArrowUpCircle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">Saídas (qtd)</p><p className="text-lg font-bold text-[#c3352b]">{num(kpis.sai)}</p></div></div>
        <div className="bg-white border border-[#E7E5DF] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#E8A317]/12 text-[#a9760a] flex items-center justify-center"><ArrowLeftRight className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">Lançamentos</p><p className="text-lg font-bold text-[#16171D]">{kpis.total}</p></div></div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtradas.length === 0 ? <Vazio icon={<ArrowLeftRight className="h-10 w-10" />} texto="Nenhuma movimentação no período" /> : (
          <TableCard>
            <thead><tr>{['Data', 'Tipo', 'Produto', 'Lote', 'Qtd', 'Saldo (ant → fim)', 'Custo un.', 'Usuário', 'Obs.'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtradas.map(m => {
                const t = TIPOS[m.tipo] || { label: m.tipo, entrada: false, cor: 'text-[#8B8D98] bg-slate-500/10' };
                return (
                  <tr key={m.id} className="border-t border-[#E7E5DF] hover:bg-amber-500/5">
                    <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{dt(m.dataMovimento)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.cor}`}>{t.label}</span></td>
                    <td className="px-3 py-2"><p className="font-semibold text-[#16171D] truncate max-w-[200px]">{m.produto?.descricao}</p><p className="text-slate-500 text-xs font-mono">{m.produto?.codigo}</p></td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{m.lote?.numero || '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${t.entrada ? 'text-[#0b7d4e]' : 'text-[#c3352b]'}`}>{t.entrada ? '+' : '−'}{num(m.quantidade)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{num(m.saldoAnterior)} → <span className="text-[#5B5D69]">{num(m.saldoFinal)}</span></td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{Number(m.custoUnitario) ? Number(m.custoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{m.usuario?.nome || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[160px]">{m.observacoes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
      </div>
    </CadastroShell>
  );
}
