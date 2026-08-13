import { toast, promptDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShieldAlert, CalendarClock, Plus, X, Check, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, Loader, Vazio } from '../../cadastros/ui';

const num = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const diasAte = (v: any) => { if (!v) return null; const d = Math.ceil((new Date(new Date(v).toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000); return d; };

export default function Pereciveis() {
  const { filialAtiva } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<'vencendo' | 'todos'>('vencendo');
  const [dias, setDias] = useState('7');
  const [busca, setBusca] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    const req = modo === 'todos'
      ? api.get(`/estoque/${filialAtiva.id}/lotes`)
      : api.get(`/estoque/${filialAtiva.id}/alertas-validade`, { params: { dias } });
    req.then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  }, [filialAtiva?.id, dias, modo]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = lista.filter(x => !busca.trim() || (x.produto?.descricao || '').toLowerCase().includes(busca.toLowerCase()));

  const kpis = useMemo(() => {
    let venc = 0, vencendo = 0;
    for (const x of filtradas) { const d = diasAte(x.lote?.dataValidade); if (d != null && d < 0) venc++; else if (d != null && d <= 2) vencendo++; }
    return { venc, vencendo, total: filtradas.length };
  }, [filtradas]);

  const baixar = async (item: any, tipo: 'PERDA' | 'AVARIA') => {
    const qtd = await promptDialog(`Quantidade a baixar como ${tipo} de "${item.produto?.descricao}" (lote ${item.lote?.numero || '—'})?`, String(item.quantidade));
    if (!qtd) return;
    try {
      await api.post('/estoque/ajuste', { filialId: filialAtiva!.id, produtoId: item.produtoId, loteId: item.loteId || undefined, tipo, quantidade: Number(qtd), observacoes: `Baixa ${tipo} por validade` });
      carregar();
    } catch (e: any) { toast(e.response?.data?.message || 'Erro ao baixar.'); }
  };

  const corDias = (d: number | null) => d == null ? 'text-slate-400' : d < 0 ? 'text-[#c3352b]' : d <= 2 ? 'text-[#b45309]' : d <= Number(dias) ? 'text-[#a9760a]' : 'text-[#0b7d4e]';

  return (
    <CadastroShell>
      <TopBar icon={<AlertTriangle className="h-5 w-5" />} titulo="Perecíveis / FLV" subtitulo="Controle FEFO — cadastre validades e acompanhe o vencimento"
        extra={
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 px-3 py-2 rounded-lg text-slate-900 text-sm font-semibold"><Plus className="h-4 w-4" /> Adicionar validade</button>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-white border border-[#E7E5DF] hover:bg-[#EFEDE7] px-3 py-2 rounded-lg text-[#5B5D69] text-sm"><RefreshCw className="h-4 w-4 text-[#a9760a]" /> Atualizar</button>
          </div>
        } />

      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar produto...">
        <span className="text-xs text-slate-400 font-semibold">Exibir:</span>
        <Chips value={modo} onChange={(v) => setModo(v as any)} options={[{ value: 'vencendo', label: 'Vencendo' }, { value: 'todos', label: 'Todos os lotes' }]} />
        {modo === 'vencendo' && (
          <>
            <span className="text-xs text-slate-400 font-semibold ml-2">em até:</span>
            <Chips value={dias} onChange={setDias} options={[{ value: '3', label: '3 dias' }, { value: '7', label: '7 dias' }, { value: '15', label: '15 dias' }, { value: '30', label: '30 dias' }]} />
          </>
        )}
      </FilterBar>

      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-white border border-rose-500/30 rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-rose-500/10 text-[#c3352b] flex items-center justify-center"><ShieldAlert className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">Vencidos</p><p className="text-lg font-bold text-[#c3352b]">{kpis.venc}</p></div></div>
        <div className="bg-white border border-orange-500/30 rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-orange-500/10 text-[#b45309] flex items-center justify-center"><CalendarClock className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">Vencendo (≤2 dias)</p><p className="text-lg font-bold text-[#b45309]">{kpis.vencendo}</p></div></div>
        <div className="bg-white border border-[#E7E5DF] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#E8A317]/12 text-[#a9760a] flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-slate-500 font-semibold">{modo === 'todos' ? 'Lotes cadastrados' : 'Lotes em alerta'}</p><p className="text-lg font-bold text-[#16171D]">{kpis.total}</p></div></div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtradas.length === 0 ? (
          <Vazio icon={<AlertTriangle className="h-10 w-10" />} texto={modo === 'todos' ? 'Nenhum lote cadastrado ainda. Use “Adicionar validade”.' : 'Nenhum lote vencendo nesse período. 🎉'} />
        ) : (
          <TableCard>
            <thead><tr>{['Produto', 'Lote', 'Validade', 'Dias restantes', 'Qtd', 'Localização', 'Ações'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtradas.map(x => {
                const d = diasAte(x.lote?.dataValidade);
                return (
                  <tr key={x.id} className="border-t border-[#E7E5DF] hover:bg-amber-500/5">
                    <td className="px-3 py-2.5"><p className="font-semibold text-[#16171D]">{x.produto?.descricao}</p><p className="text-slate-500 text-xs font-mono">{x.produto?.codigo}</p></td>
                    <td className="px-3 py-2.5 font-mono text-[#8B8D98] text-xs">{x.lote?.numero || '—'}</td>
                    <td className="px-3 py-2.5 text-[#8B8D98]">{dt(x.lote?.dataValidade)}</td>
                    <td className={`px-3 py-2.5 font-bold ${corDias(d)}`}>{d == null ? '—' : d < 0 ? `vencido há ${Math.abs(d)}d` : d === 0 ? 'vence hoje' : `${d} dia(s)`}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#5B5D69]">{num(x.quantidade)}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{x.localizacao ? `${x.localizacao.rua}-${x.localizacao.prateleira}` : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <button onClick={() => baixar(x, 'PERDA')} className="text-[11px] bg-rose-500/10 text-[#c3352b] border border-rose-500/30 px-2 py-1 rounded font-semibold hover:bg-rose-500/20 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Perda</button>
                        <button onClick={() => baixar(x, 'AVARIA')} className="text-[11px] bg-[#E8A317]/12 text-[#a9760a] border border-[#E8A317]/30 px-2 py-1 rounded font-semibold hover:bg-amber-500/20">Avaria</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
      </div>

      {addOpen && filialAtiva && (
        <ModalValidade
          filialId={filialAtiva.id}
          onFechar={() => setAddOpen(false)}
          onSalvou={() => { setAddOpen(false); if (modo !== 'todos') setModo('todos'); else carregar(); }}
        />
      )}
    </CadastroShell>
  );
}

/** Modal de cadastro de validade: busca o produto, informa quantidade e data. */
function ModalValidade({ filialId, onFechar, onSalvou }: { filialId: string; onFechar: () => void; onSalvou: () => void }) {
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [prod, setProd] = useState<any | null>(null);
  const [qtd, setQtd] = useState('');
  const [validade, setValidade] = useState('');
  const [fabricacao, setFabricacao] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const debounce = useRef<any>(null);

  useEffect(() => {
    if (prod || !termo.trim()) { setOpcoes([]); return; }
    setBuscando(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.get('/produtos/search', { params: { q: termo, filialId } })
        .then(r => setOpcoes(r.data || [])).catch(() => setOpcoes([])).finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [termo, prod, filialId]);

  const podeSalvar = !!prod && Number(qtd) > 0 && !!validade && !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await api.post(`/estoque/${filialId}/lote`, {
        produtoId: prod.id,
        quantidade: Number(qtd),
        dataValidade: validade,
        dataFabricacao: fabricacao || undefined,
        numero: numeroLote.trim() || undefined,
      });
      toast('Validade cadastrada e estoque atualizado.', 'success');
      onSalvou();
    } catch (e: any) {
      toast(e.response?.data?.message || 'Erro ao cadastrar validade.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16171D]/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#E7E5DF] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E7E5DF] px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#16171D]"><CalendarClock className="h-5 w-5 text-[#a9760a]" /> Adicionar validade</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-[#8B8D98]"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Produto */}
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Produto</label>
            {prod ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-[#E8A317]/40 bg-amber-500/5 px-3 py-2">
                <div><p className="font-semibold text-[#16171D] text-sm">{prod.descricao}</p><p className="text-xs font-mono text-slate-500">{prod.codigo} · {prod.unidade}</p></div>
                <button onClick={() => { setProd(null); setTermo(''); }} className="text-slate-400 hover:text-[#c3352b] text-xs">trocar</button>
              </div>
            ) : (
              <div className="relative mt-1">
                <div className="flex items-center gap-2 rounded-lg border border-[#E7E5DF] bg-white px-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input autoFocus value={termo} onChange={e => setTermo(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full bg-transparent py-2.5 text-sm outline-none text-[#16171D]" />
                  {buscando && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                </div>
                {opcoes.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#E7E5DF] bg-white shadow-xl">
                    {opcoes.map(o => (
                      <button key={o.id} onClick={() => { setProd(o); setOpcoes([]); }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#E8A317]/12">
                        <span className="text-sm text-[#16171D]">{o.descricao}</span>
                        <span className="text-xs font-mono text-slate-500">{o.codigo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantidade + Validade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Quantidade</label>
              <input value={qtd} onChange={e => setQtd(e.target.value)} inputMode="decimal" placeholder="0" className="mt-1 w-full rounded-lg border border-[#E7E5DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8A317] text-[#16171D]" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Validade</label>
              <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E7E5DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8A317] text-[#16171D]" />
            </div>
          </div>

          {/* Fabricação + Nº lote (opcionais) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Fabricação <span className="text-slate-600">(opcional)</span></label>
              <input type="date" value={fabricacao} onChange={e => setFabricacao(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E7E5DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8A317] text-[#16171D]" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Nº do lote <span className="text-slate-600">(opcional)</span></label>
              <input value={numeroLote} onChange={e => setNumeroLote(e.target.value)} placeholder="auto pela validade" className="mt-1 w-full rounded-lg border border-[#E7E5DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8A317] text-[#16171D]" />
            </div>
          </div>

          <button onClick={salvar} disabled={!podeSalvar} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-600">
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {salvando ? 'Salvando...' : 'Cadastrar validade'}
          </button>
        </div>
      </div>
    </div>
  );
}
