import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, PackagePlus, Plus, Send, Truck, X } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';

const statusLabel: Record<string, string> = {
  RASCUNHO: 'Rascunho', SOLICITADA: 'Solicitada', APROVADA: 'Aprovada', EM_TRANSITO: 'Em trânsito',
  RECEBIDA: 'Recebida', RECEBIDA_COM_DIVERGENCIA: 'Recebida com divergência', CANCELADA: 'Cancelada',
};
const statusCor: Record<string, string> = {
  SOLICITADA: 'bg-amber-50 text-amber-700 border-amber-200', APROVADA: 'bg-blue-50 text-blue-700 border-blue-200',
  EM_TRANSITO: 'bg-violet-50 text-violet-700 border-violet-200', RECEBIDA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RECEBIDA_COM_DIVERGENCIA: 'bg-rose-50 text-rose-700 border-rose-200', CANCELADA: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Transferencias() {
  const { filiais, filialAtiva, refreshFiliais } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [recebendo, setRecebendo] = useState<any | null>(null);
  const carregar = async () => {
    setLoading(true);
    try { setLista((await api.get('/estoque/transferencias', { params: { filialId: filialAtiva?.id } })).data); }
    catch { toast('Não foi possível carregar as transferências.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, [filialAtiva?.id]);
  useEffect(() => { void refreshFiliais().catch(() => toast('Usando a ultima lista de filiais disponivel.', 'info')); }, [refreshFiliais]);

  const acao = async (t: any, tipo: 'aprovar' | 'despachar') => {
    const verbo = tipo === 'aprovar' ? 'aprovar' : 'despachar';
    if (!await confirmDialog(`Deseja ${verbo} a transferência ${t.codigo}?`)) return;
    try { await api.post(`/estoque/transferencias/${t.id}/${tipo}`); toast(`Transferência ${tipo === 'aprovar' ? 'aprovada' : 'despachada'}.`); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || `Não foi possível ${verbo}.`, 'error'); }
  };

  return (
    <div className="min-h-full bg-[#F7F7F8] p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="text-xl font-semibold text-[#202123]">Transferências entre filiais</h1><p className="text-xs text-[#6B7280] mt-1">Solicitação, aprovação, estoque em trânsito, recebimento e divergências.</p></div>
          <button onClick={() => setNovo(true)} className="flex items-center gap-2 rounded-lg bg-[#0F8A72] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0C765F]"><Plus className="h-4 w-4" /> Nova transferência</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Solicitadas', lista.filter(x => x.status === 'SOLICITADA').length],
            ['Aprovadas', lista.filter(x => x.status === 'APROVADA').length],
            ['Em trânsito', lista.filter(x => x.status === 'EM_TRANSITO').length],
            ['Com divergência', lista.filter(x => x.status === 'RECEBIDA_COM_DIVERGENCIA').length],
          ].map(([l, v]) => <div key={String(l)} className="rounded-xl border border-[#E5E7EB] bg-white p-3"><p className="text-[10px] uppercase tracking-wide text-[#8B8D98]">{l}</p><p className="mt-1 text-xl font-semibold text-[#202123]">{v}</p></div>)}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Carregando...</p> : lista.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Nenhuma transferência encontrada.</p> : (
            <div className="divide-y divide-[#ECEEF1]">{lista.map(t => <div key={t.id} className="p-4 hover:bg-[#FAFAFA]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-mono text-xs font-semibold text-[#202123]">{t.codigo}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCor[t.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{statusLabel[t.status] || t.status}</span></div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#4B5563]"><b>{t.filialOrigem?.nome}</b><ArrowRight className="h-3.5 w-3.5 text-[#0F8A72]" /><b>{t.filialDestino?.nome}</b></div>
                  <p className="mt-1 text-[11px] text-[#8B8D98]">{t.itens.length} item(ns) · {new Date(t.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  {t.status === 'SOLICITADA' && <button onClick={() => acao(t, 'aprovar')} className="btn-secondary"><Check className="h-3.5 w-3.5" /> Aprovar</button>}
                  {t.status === 'APROVADA' && <button onClick={() => acao(t, 'despachar')} className="btn-secondary"><Truck className="h-3.5 w-3.5" /> Despachar</button>}
                  {t.status === 'EM_TRANSITO' && <button onClick={() => setRecebendo(t)} className="btn-secondary !border-[#0F8A72]/30 !text-[#0F8A72]"><ClipboardCheck className="h-3.5 w-3.5" /> Receber</button>}
                </div>
              </div>
              <div className="mt-3 grid gap-1 md:grid-cols-2">{t.itens.map((i: any) => <div key={i.id} className="rounded-lg bg-[#F7F7F8] px-3 py-2 text-[11px] text-[#4B5563]"><b>{i.produto.codigo}</b> — {i.produto.descricao}<span className="float-right font-mono">{Number(i.quantidadeSolicitada).toLocaleString('pt-BR')} {i.produto.unidadeMedida?.sigla}</span></div>)}</div>
            </div>)}</div>
          )}
        </div>
      </div>
      {novo && <ModalNova filiais={filiais || []} filialAtiva={filialAtiva} onClose={() => setNovo(false)} onDone={() => { setNovo(false); carregar(); }} />}
      {recebendo && <ModalReceber transferencia={recebendo} onClose={() => setRecebendo(null)} onDone={() => { setRecebendo(null); carregar(); }} />}
    </div>
  );
}

function Janela({ titulo, onClose, children }: any) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h2 className="font-semibold text-[#202123]">{titulo}</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>{children}</div></div>;
}

function ModalNova({ filiais, filialAtiva, onClose, onDone }: any) {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [origem, setOrigem] = useState(filialAtiva?.id || '');
  const [destino, setDestino] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<any[]>([{ produtoId: '', quantidade: '1' }]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { api.get('/produtos').then(r => setProdutos(r.data)).catch(() => {}); }, []);
  const destinos = useMemo(() => filiais.filter((f: any) => f.id !== origem), [filiais, origem]);
  useEffect(() => { if (!destinos.some((f: any) => f.id === destino)) setDestino(destinos[0]?.id || ''); }, [origem, filiais]);
  const salvar = async () => {
    const validos = itens.filter(i => i.produtoId && Number(i.quantidade) > 0);
    if (!origem || !destino || !validos.length) return toast('Informe origem, destino e ao menos um produto.', 'error');
    setSalvando(true);
    try { await api.post('/estoque/transferencias', { filialOrigemId: origem, filialDestinoId: destino, observacoes: observacoes || undefined, itens: validos.map(i => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade) })) }); toast('Transferência solicitada.'); onDone(); }
    catch (e: any) { toast(e.response?.data?.message || 'Não foi possível criar a transferência.', 'error'); }
    finally { setSalvando(false); }
  };
  return <Janela titulo="Nova transferência entre filiais" onClose={onClose}><div className="space-y-4 p-5">
    <div className="grid md:grid-cols-2 gap-3"><Campo label="Filial de origem"><select value={origem} onChange={e => setOrigem(e.target.value)} className="input">{filiais.map((f: any) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}</select></Campo><Campo label="Filial de destino"><select value={destino} onChange={e => setDestino(e.target.value)} className="input">{destinos.map((f: any) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}</select></Campo></div>
    <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs font-medium text-slate-600">Produtos</label><button onClick={() => setItens(x => [...x, { produtoId: '', quantidade: '1' }])} className="text-xs text-[#0F8A72] flex items-center gap-1"><Plus className="h-3 w-3" /> Adicionar item</button></div>{itens.map((i, idx) => <div key={idx} className="grid grid-cols-[1fr_120px_32px] gap-2"><select className="input" value={i.produtoId} onChange={e => setItens(x => x.map((v, n) => n === idx ? { ...v, produtoId: e.target.value } : v))}><option value="">Selecione um produto...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao} · saldo total {Number(p.estoqueKg || 0).toLocaleString('pt-BR')}</option>)}</select><input className="input" type="number" min="0.0001" step="0.001" value={i.quantidade} onChange={e => setItens(x => x.map((v, n) => n === idx ? { ...v, quantidade: e.target.value } : v))} /><button onClick={() => setItens(x => x.filter((_, n) => n !== idx))} className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button></div>)}</div>
    <Campo label="Observações / instruções logísticas"><textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="input min-h-20" placeholder="Transportador, veículo, prioridade, conferência..." /></Campo>
    <div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="btn">Cancelar</button><button disabled={salvando} onClick={salvar} className="flex items-center gap-2 rounded-lg bg-[#0F8A72] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> {salvando ? 'Enviando...' : 'Solicitar transferência'}</button></div>
  </div></Janela>;
}

function ModalReceber({ transferencia, onClose, onDone }: any) {
  const [itens, setItens] = useState(transferencia.itens.map((i: any) => ({ itemId: i.id, quantidadeRecebida: String(i.quantidadeDespachada), observacaoDivergencia: '' })));
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => { setSalvando(true); try { await api.post(`/estoque/transferencias/${transferencia.id}/receber`, { itens: itens.map((i: any) => ({ ...i, quantidadeRecebida: Number(i.quantidadeRecebida) })) }); toast('Recebimento registrado.'); onDone(); } catch (e: any) { toast(e.response?.data?.message || 'Falha no recebimento.', 'error'); } finally { setSalvando(false); } };
  return <Janela titulo={`Receber ${transferencia.codigo}`} onClose={onClose}><div className="space-y-3 p-5"><p className="text-xs text-slate-500">Confira fisicamente cada item. Diferenças ficam registradas e sinalizadas para auditoria.</p>{transferencia.itens.map((item: any, idx: number) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between text-xs"><b>{item.produto.codigo} — {item.produto.descricao}</b><span>Despachado: {Number(item.quantidadeDespachada).toLocaleString('pt-BR')}</span></div><div className="mt-2 grid md:grid-cols-[160px_1fr] gap-2"><Campo label="Quantidade recebida"><input className="input" type="number" min="0" max={Number(item.quantidadeDespachada)} step="0.001" value={itens[idx].quantidadeRecebida} onChange={e => setItens((x: any[]) => x.map((v, n) => n === idx ? { ...v, quantidadeRecebida: e.target.value } : v))} /></Campo><Campo label="Observação da divergência"><input className="input" value={itens[idx].observacaoDivergencia} onChange={e => setItens((x: any[]) => x.map((v, n) => n === idx ? { ...v, observacaoDivergencia: e.target.value } : v))} placeholder="Ex.: 2 unidades avariadas" /></Campo></div></div>)}<div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="btn">Cancelar</button><button disabled={salvando} onClick={salvar} className="flex items-center gap-2 rounded-lg bg-[#0F8A72] px-4 py-2 text-xs font-semibold text-white"><PackagePlus className="h-4 w-4" /> Confirmar recebimento</button></div></div></Janela>;
}

function Campo({ label, children }: any) { return <label className="block"><span className="mb-1 block text-[11px] font-medium text-slate-600">{label}</span>{children}</label>; }
