import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, Loader, Vazio } from '../../cadastros/ui';

// Controle compacto para a barra de filtros (evita o py-2 do `inp` padrão)
const fCtrl = 'bg-[#101216] border border-[#23262F] rounded-lg px-2.5 py-1.5 text-xs text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]/60 [color-scheme:dark]';

const num = (v: any, d = 3) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const dt = (v: any) => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const TIPOS: Record<string, { label: string; entrada: boolean; cor: string }> = {
  ENTRADA_COMPRA: { label: 'Entrada (compra)', entrada: true, cor: 'text-[#2DD4A7] bg-emerald-500/10' },
  ENTRADA_DEVOLUCAO: { label: 'Entrada (devolução)', entrada: true, cor: 'text-[#2DD4A7] bg-emerald-500/10' },
  TRANSFERENCIA_ENTRADA: { label: 'Transf. entrada', entrada: true, cor: 'text-[#22D3EE] bg-[#22D3EE]/12' },
  AJUSTE_POSITIVO: { label: 'Ajuste +', entrada: true, cor: 'text-[#2DD4A7] bg-emerald-500/10' },
  SAIDA_VENDA: { label: 'Saída (venda)', entrada: false, cor: 'text-[#FF6B7A] bg-rose-500/10' },
  SAIDA_DEVOLUCAO_FORNECEDOR: { label: 'Saída (devol. forn.)', entrada: false, cor: 'text-[#FF6B7A] bg-rose-500/10' },
  TRANSFERENCIA_SAIDA: { label: 'Transf. saída', entrada: false, cor: 'text-[#FF9F45] bg-[#FF9F45]/12' },
  AJUSTE_NEGATIVO: { label: 'Ajuste −', entrada: false, cor: 'text-[#FF6B7A] bg-rose-500/10' },
  PERDA: { label: 'Perda', entrada: false, cor: 'text-[#FF6B7A] bg-rose-500/10' },
  AVARIA: { label: 'Avaria', entrada: false, cor: 'text-[#FF6B7A] bg-rose-500/10' },
  PICKING: { label: 'Picking', entrada: false, cor: 'text-[#8A90A0] bg-[#16181F]' },
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
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-2 rounded-lg text-[#8A90A0] text-sm"><RefreshCw className="h-4 w-4 text-[#01B8FA]" /> Atualizar</button>} />

      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por produto ou código...">
        <div className="flex flex-wrap items-center gap-2">
          <select value={tipo} onChange={e => setTipo(e.target.value)} className={`${fCtrl} w-auto`}>
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">De<input type="date" value={ini} onChange={e => setIni(e.target.value)} className={`${fCtrl} w-[140px]`} /></label>
          <label className="inline-flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">Até<input type="date" value={fim} onChange={e => setFim(e.target.value)} className={`${fCtrl} w-[140px]`} /></label>
        </div>
      </FilterBar>

      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-[#16181F] border border-[#23262F] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#2DD4A7]/12 text-[#2DD4A7] flex items-center justify-center"><ArrowDownCircle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">Entradas (qtd)</p><p className="text-lg font-bold text-[#2DD4A7] font-mono tabular-nums">{num(kpis.ent)}</p></div></div>
        <div className="bg-[#16181F] border border-[#23262F] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#FF6B7A]/12 text-[#FF6B7A] flex items-center justify-center"><ArrowUpCircle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">Saídas (qtd)</p><p className="text-lg font-bold text-[#FF6B7A] font-mono tabular-nums">{num(kpis.sai)}</p></div></div>
        <div className="bg-[#16181F] border border-[#23262F] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#01B8FA]/12 text-[#01B8FA] flex items-center justify-center"><ArrowLeftRight className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">Lançamentos</p><p className="text-lg font-bold text-[#F7F8FA] font-mono tabular-nums">{kpis.total}</p></div></div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtradas.length === 0 ? <Vazio icon={<ArrowLeftRight className="h-10 w-10" />} texto="Nenhuma movimentação no período" /> : (
          <TableCard>
            <thead><tr>{['Data', 'Tipo', 'Produto', 'Lote', 'Qtd', 'Saldo (ant → fim)', 'Custo un.', 'Usuário', 'Obs.'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtradas.map(m => {
                const t = TIPOS[m.tipo] || { label: m.tipo, entrada: false, cor: 'text-[#8A90A0] bg-[#16181F]' };
                return (
                  <tr key={m.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                    <td className="px-3 py-1 text-slate-400 text-xs whitespace-nowrap">{dt(m.dataMovimento)}</td>
                    <td className="px-3 py-1"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.cor}`}>{t.label}</span></td>
                    <td className="px-3 py-1"><p className="font-semibold text-[#F7F8FA] truncate max-w-[200px]">{m.produto?.descricao}</p><p className="text-slate-500 text-xs font-mono">{m.produto?.codigo}</p></td>
                    <td className="px-3 py-1 text-slate-400 text-xs">{m.lote?.numero || '—'}</td>
                    <td className={`px-3 py-1 text-right font-mono font-bold ${t.entrada ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]'}`}>{t.entrada ? '+' : '−'}{num(m.quantidade)}</td>
                    <td className="px-3 py-1 text-right font-mono text-slate-400 text-xs">{num(m.saldoAnterior)} → <span className="text-[#F7F8FA]">{num(m.saldoFinal)}</span></td>
                    <td className="px-3 py-1 text-right font-mono text-slate-400 text-xs">{Number(m.custoUnitario) ? Number(m.custoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                    <td className="px-3 py-1 text-slate-400 text-xs">{m.usuario?.nome || '—'}</td>
                    <td className="px-3 py-1 text-slate-500 text-xs truncate max-w-[160px]">{m.observacoes || '—'}</td>
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
