import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, PackagePlus, Plus, RefreshCw, Send, Truck, X } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { inp, btnPrimary, CadastroShell, TopBar, FAB } from '../../cadastros/ui';

const btnSec = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:bg-[#0C0D10] hover:text-[#F7F8FA] transition-all duration-300 active:scale-[0.98]';

const statusLabel: Record<string, string> = {
  RASCUNHO: 'Rascunho', SOLICITADA: 'Solicitada', APROVADA: 'Aprovada', EM_TRANSITO: 'Em trânsito',
  RECEBIDA: 'Recebida', RECEBIDA_COM_DIVERGENCIA: 'Recebida com divergência', CANCELADA: 'Cancelada',
};
const statusCor: Record<string, string> = {
  SOLICITADA: 'bg-[#FF9F45]/12 text-[#FF9F45] border-[#FF9F45]/30', APROVADA: 'bg-[#3B9EFF]/12 text-[#3B9EFF] border-[#3B9EFF]/30',
  EM_TRANSITO: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30', RECEBIDA: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/30',
  RECEBIDA_COM_DIVERGENCIA: 'bg-[#FF6B7A]/12 text-[#FF6B7A] border-[#FF6B7A]/30', CANCELADA: 'bg-[#16181F] text-[#8A90A0] border-[#23262F]',
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
    <CadastroShell>
      <TopBar icon={<Truck className="h-5 w-5" />} titulo="Transferências entre filiais"
        subtitulo="Solicitação, aprovação, estoque em trânsito, recebimento e divergências."
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-1.5 rounded-lg text-[#8A90A0] text-sm"><RefreshCw className={`h-4 w-4 text-[#01B8FA] ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>} />
      <FAB onClick={() => setNovo(true)} label="Nova transferência" />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Solicitadas', lista.filter(x => x.status === 'SOLICITADA').length],
            ['Aprovadas', lista.filter(x => x.status === 'APROVADA').length],
            ['Em trânsito', lista.filter(x => x.status === 'EM_TRANSITO').length],
            ['Com divergência', lista.filter(x => x.status === 'RECEBIDA_COM_DIVERGENCIA').length],
          ].map(([l, v]) => <div key={String(l)} className="rounded-xl border border-[#23262F] bg-[#16181F] p-3"><p className="text-[10px] uppercase tracking-wide text-[#8A90A0]">{l}</p><p className="mt-1 text-xl font-semibold text-[#F7F8FA] font-mono tabular-nums">{v}</p></div>)}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#23262F] bg-[#101216]">
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Carregando...</p> : lista.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Nenhuma transferência encontrada.</p> : (
            <div className="divide-y divide-[#23262F]">{lista.map(t => <div key={t.id} className="p-4 hover:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-mono text-xs font-semibold text-[#F7F8FA]">{t.codigo}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCor[t.status] || 'bg-[#16181F] text-[#8A90A0] border-[#23262F]'}`}>{statusLabel[t.status] || t.status}</span></div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#8A90A0]"><b className="text-[#F7F8FA]">{t.filialOrigem?.nome}</b><ArrowRight className="h-3.5 w-3.5 text-[#01B8FA]" /><b className="text-[#F7F8FA]">{t.filialDestino?.nome}</b></div>
                  <p className="mt-1 text-[11px] text-[#8A90A0]">{t.itens.length} item(ns) · {new Date(t.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  {t.status === 'SOLICITADA' && <button onClick={() => acao(t, 'aprovar')} className={btnSec}><Check className="h-3.5 w-3.5" /> Aprovar</button>}
                  {t.status === 'APROVADA' && <button onClick={() => acao(t, 'despachar')} className={btnSec}><Truck className="h-3.5 w-3.5" /> Despachar</button>}
                  {t.status === 'EM_TRANSITO' && <button onClick={() => setRecebendo(t)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#01B8FA]/12 border border-[#01B8FA]/30 text-[#01B8FA] hover:bg-[#01B8FA]/20 transition-all duration-300 active:scale-[0.98]"><ClipboardCheck className="h-3.5 w-3.5" /> Receber</button>}
                </div>
              </div>
              <div className="mt-3 grid gap-1 md:grid-cols-2">{t.itens.map((i: any) => <div key={i.id} className="rounded-lg bg-[#0C0D10] border border-[#191B21] px-3 py-2 text-[11px] text-[#8A90A0]"><b className="text-[#F7F8FA]">{i.produto.codigo}</b> — {i.produto.descricao}<span className="float-right font-mono text-[#F7F8FA]">{Number(i.quantidadeSolicitada).toLocaleString('pt-BR')} {i.produto.unidadeMedida?.sigla}</span></div>)}</div>
            </div>)}</div>
          )}
        </div>
      </div>
      {novo && <ModalNova filiais={filiais || []} filialAtiva={filialAtiva} onClose={() => setNovo(false)} onDone={() => { setNovo(false); carregar(); }} />}
      {recebendo && <ModalReceber transferencia={recebendo} onClose={() => setRecebendo(null)} onDone={() => { setRecebendo(null); carregar(); }} />}
    </CadastroShell>
  );
}

function Janela({ titulo, onClose, children }: any) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#101216] border border-[#23262F] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#23262F] bg-[#101216] px-5 py-4"><h2 className="font-semibold text-[#F7F8FA]">{titulo}</h2><button onClick={onClose} className="text-slate-500 hover:text-[#F7F8FA] transition-colors"><X className="h-5 w-5" /></button></div>{children}</div></div>;
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
    <div className="grid md:grid-cols-2 gap-3"><Campo label="Filial de origem"><select value={origem} onChange={e => setOrigem(e.target.value)} className={inp}>{filiais.map((f: any) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}</select></Campo><Campo label="Filial de destino"><select value={destino} onChange={e => setDestino(e.target.value)} className={inp}>{destinos.map((f: any) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}</select></Campo></div>
    <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs font-medium text-[#8A90A0]">Produtos</label><button onClick={() => setItens(x => [...x, { produtoId: '', quantidade: '1' }])} className="text-xs text-[#01B8FA] flex items-center gap-1 hover:text-[#22D3EE] transition-colors"><Plus className="h-3 w-3" /> Adicionar item</button></div>{itens.map((i, idx) => <div key={idx} className="grid grid-cols-[1fr_120px_32px] gap-2"><select className={inp} value={i.produtoId} onChange={e => setItens(x => x.map((v, n) => n === idx ? { ...v, produtoId: e.target.value } : v))}><option value="">Selecione um produto...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao} · saldo total {Number(p.estoqueKg || 0).toLocaleString('pt-BR')}</option>)}</select><input className={inp} type="number" min="0.0001" step="0.001" value={i.quantidade} onChange={e => setItens(x => x.map((v, n) => n === idx ? { ...v, quantidade: e.target.value } : v))} /><button onClick={() => setItens(x => x.filter((_, n) => n !== idx))} className="text-slate-400 hover:text-[#FF6B7A] transition-colors"><X className="h-4 w-4" /></button></div>)}</div>
    <Campo label="Observações / instruções logísticas"><textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className={`${inp} min-h-20`} placeholder="Transportador, veículo, prioridade, conferência..." /></Campo>
    <div className="flex justify-end gap-2 border-t border-[#23262F] pt-4"><button onClick={onClose} className={btnSec}>Cancelar</button><button disabled={salvando} onClick={salvar} className={btnPrimary}><Send className="h-4 w-4" /> {salvando ? 'Enviando...' : 'Solicitar transferência'}</button></div>
  </div></Janela>;
}

function ModalReceber({ transferencia, onClose, onDone }: any) {
  const [itens, setItens] = useState(transferencia.itens.map((i: any) => ({ itemId: i.id, quantidadeRecebida: String(i.quantidadeDespachada), observacaoDivergencia: '' })));
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => { setSalvando(true); try { await api.post(`/estoque/transferencias/${transferencia.id}/receber`, { itens: itens.map((i: any) => ({ ...i, quantidadeRecebida: Number(i.quantidadeRecebida) })) }); toast('Recebimento registrado.'); onDone(); } catch (e: any) { toast(e.response?.data?.message || 'Falha no recebimento.', 'error'); } finally { setSalvando(false); } };
  return <Janela titulo={`Receber ${transferencia.codigo}`} onClose={onClose}><div className="space-y-3 p-5"><p className="text-xs text-[#8A90A0]">Confira fisicamente cada item. Diferenças ficam registradas e sinalizadas para auditoria.</p>{transferencia.itens.map((item: any, idx: number) => <div key={item.id} className="rounded-xl border border-[#23262F] bg-[#0C0D10] p-3"><div className="flex justify-between text-xs text-[#F7F8FA]"><b>{item.produto.codigo} — {item.produto.descricao}</b><span className="text-[#8A90A0]">Despachado: {Number(item.quantidadeDespachada).toLocaleString('pt-BR')}</span></div><div className="mt-2 grid md:grid-cols-[160px_1fr] gap-2"><Campo label="Quantidade recebida"><input className={inp} type="number" min="0" max={Number(item.quantidadeDespachada)} step="0.001" value={itens[idx].quantidadeRecebida} onChange={e => setItens((x: any[]) => x.map((v, n) => n === idx ? { ...v, quantidadeRecebida: e.target.value } : v))} /></Campo><Campo label="Observação da divergência"><input className={inp} value={itens[idx].observacaoDivergencia} onChange={e => setItens((x: any[]) => x.map((v, n) => n === idx ? { ...v, observacaoDivergencia: e.target.value } : v))} placeholder="Ex.: 2 unidades avariadas" /></Campo></div></div>)}<div className="flex justify-end gap-2 border-t border-[#23262F] pt-4"><button onClick={onClose} className={btnSec}>Cancelar</button><button disabled={salvando} onClick={salvar} className={btnPrimary}><PackagePlus className="h-4 w-4" /> Confirmar recebimento</button></div></div></Janela>;
}

function Campo({ label, children }: any) { return <label className="block"><span className="mb-1 block text-[11px] font-medium text-[#8A90A0]">{label}</span>{children}</label>; }
