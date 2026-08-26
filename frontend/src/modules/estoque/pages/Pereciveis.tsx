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

  const corDias = (d: number | null) => d == null ? 'text-slate-400' : d < 0 ? 'text-[#FF6B7A]' : d <= 2 ? 'text-[#FF9F45]' : d <= Number(dias) ? 'text-[#FF9F45]' : 'text-[#2DD4A7]';

  return (
    <CadastroShell>
      <TopBar icon={<AlertTriangle className="h-5 w-5" />} titulo="Perecíveis / FLV" subtitulo="Controle FEFO — cadastre validades e acompanhe o vencimento"
        extra={
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-[#01B8FA] hover:bg-[#22D3EE] px-3 py-2 rounded-lg text-[#04121A] text-sm font-semibold shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all active:scale-[0.98]"><Plus className="h-4 w-4" /> Adicionar validade</button>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-2 rounded-lg text-[#8A90A0] text-sm"><RefreshCw className="h-4 w-4 text-[#01B8FA]" /> Atualizar</button>
          </div>
        } />

      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar produto...">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#8A90A0] font-semibold">Exibir:</span>
          <Chips value={modo} onChange={(v) => setModo(v as any)} options={[{ value: 'vencendo', label: 'Vencendo' }, { value: 'todos', label: 'Todos os lotes' }]} />
          {modo === 'vencendo' && (
            <>
              <span className="text-xs text-[#8A90A0] font-semibold ml-1">em até:</span>
              <Chips value={dias} onChange={setDias} options={[{ value: '3', label: '3 dias' }, { value: '7', label: '7 dias' }, { value: '15', label: '15 dias' }, { value: '30', label: '30 dias' }]} />
            </>
          )}
        </div>
      </FilterBar>

      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-[#16181F] border border-[#FF6B7A]/30 rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#FF6B7A]/12 text-[#FF6B7A] flex items-center justify-center"><ShieldAlert className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">Vencidos</p><p className="text-lg font-bold text-[#FF6B7A] font-mono tabular-nums">{kpis.venc}</p></div></div>
        <div className="bg-[#16181F] border border-[#FF9F45]/30 rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#FF9F45]/12 text-[#FF9F45] flex items-center justify-center"><CalendarClock className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">Vencendo (≤2 dias)</p><p className="text-lg font-bold text-[#FF9F45] font-mono tabular-nums">{kpis.vencendo}</p></div></div>
        <div className="bg-[#16181F] border border-[#23262F] rounded-xl p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-[#01B8FA]/12 text-[#01B8FA] flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-[10px] uppercase text-[#8A90A0] font-semibold">{modo === 'todos' ? 'Lotes cadastrados' : 'Lotes em alerta'}</p><p className="text-lg font-bold text-[#F7F8FA] font-mono tabular-nums">{kpis.total}</p></div></div>
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
                  <tr key={x.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                    <td className="px-3 py-1"><p className="font-semibold text-[#F7F8FA]">{x.produto?.descricao}</p><p className="text-slate-500 text-xs font-mono">{x.produto?.codigo}</p></td>
                    <td className="px-3 py-1 font-mono text-[#8A90A0] text-xs">{x.lote?.numero || '—'}</td>
                    <td className="px-3 py-1 text-[#8A90A0]">{dt(x.lote?.dataValidade)}</td>
                    <td className={`px-3 py-1 font-bold ${corDias(d)}`}>{d == null ? '—' : d < 0 ? `vencido há ${Math.abs(d)}d` : d === 0 ? 'vence hoje' : `${d} dia(s)`}</td>
                    <td className="px-3 py-1 text-right font-mono text-[#F7F8FA]">{num(x.quantidade)}</td>
                    <td className="px-3 py-1 text-slate-400 text-xs">{x.localizacao ? `${x.localizacao.rua}-${x.localizacao.prateleira}` : '—'}</td>
                    <td className="px-3 py-1">
                      <div className="flex gap-1.5">
                        <button onClick={() => baixar(x, 'PERDA')} className="text-[11px] bg-[#FF6B7A]/10 text-[#FF6B7A] border border-[#FF6B7A]/30 px-2 py-1 rounded font-semibold hover:bg-[#FF6B7A]/20 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Perda</button>
                        <button onClick={() => baixar(x, 'AVARIA')} className="text-[11px] bg-[#FF9F45]/12 text-[#FF9F45] border border-[#FF9F45]/30 px-2 py-1 rounded font-semibold hover:bg-[#FF9F45]/20">Avaria</button>
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

  const campoInp = 'mt-1 w-full rounded-lg border border-[#23262F] bg-[#101216] px-3 py-2.5 text-sm outline-none focus:border-[#01B8FA]/60 focus:ring-2 focus:ring-[#01B8FA]/20 text-[#F7F8FA] placeholder:text-[#8A90A0] transition-all';
  const lblCls = 'text-xs uppercase tracking-wide text-[#8A90A0] font-semibold';

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-backdrop">
      <div className="relative w-full max-w-md rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] animate-modal">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#01B8FA]/60 to-transparent" aria-hidden />
        <div className="flex items-center justify-between border-b border-[#23262F] px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#F7F8FA]"><CalendarClock className="h-5 w-5 text-[#01B8FA]" /> Adicionar validade</h2>
          <button onClick={onFechar} className="text-[#8A90A0] hover:text-[#F7F8FA] transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Produto */}
          <div>
            <label className={lblCls}>Produto</label>
            {prod ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-[#01B8FA]/40 bg-[#01B8FA]/5 px-3 py-2">
                <div><p className="font-semibold text-[#F7F8FA] text-sm">{prod.descricao}</p><p className="text-xs font-mono text-slate-500">{prod.codigo} · {prod.unidade}</p></div>
                <button onClick={() => { setProd(null); setTermo(''); }} className="text-slate-400 hover:text-[#FF6B7A] text-xs">trocar</button>
              </div>
            ) : (
              <div className="relative mt-1">
                <div className="flex items-center gap-2 rounded-lg border border-[#23262F] bg-[#101216] px-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input autoFocus value={termo} onChange={e => setTermo(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full bg-transparent py-2.5 text-sm outline-none text-[#F7F8FA] placeholder:text-[#8A90A0]" />
                  {buscando && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                </div>
                {opcoes.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#23262F] bg-[#101216] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
                    {opcoes.map(o => (
                      <button key={o.id} onClick={() => { setProd(o); setOpcoes([]); }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#0C0D10]">
                        <span className="text-sm text-[#F7F8FA]">{o.descricao}</span>
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
              <label className={lblCls}>Quantidade</label>
              <input value={qtd} onChange={e => setQtd(e.target.value)} inputMode="decimal" placeholder="0" className={`${campoInp} text-right font-mono`} />
            </div>
            <div>
              <label className={lblCls}>Validade</label>
              <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={`${campoInp} [color-scheme:dark]`} />
            </div>
          </div>

          {/* Fabricação + Nº lote (opcionais) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lblCls}>Fabricação <span className="text-slate-600">(opcional)</span></label>
              <input type="date" value={fabricacao} onChange={e => setFabricacao(e.target.value)} className={`${campoInp} [color-scheme:dark]`} />
            </div>
            <div>
              <label className={lblCls}>Nº do lote <span className="text-slate-600">(opcional)</span></label>
              <input value={numeroLote} onChange={e => setNumeroLote(e.target.value)} placeholder="auto pela validade" className={campoInp} />
            </div>
          </div>

          <button onClick={salvar} disabled={!podeSalvar} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#01B8FA] py-3 font-bold text-[#04121A] hover:bg-[#22D3EE] shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {salvando ? 'Salvando...' : 'Cadastrar validade'}
          </button>
        </div>
      </div>
    </div>
  );
}
