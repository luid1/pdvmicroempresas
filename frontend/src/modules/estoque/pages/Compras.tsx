import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, RefreshCw, Trash2, Plus, Check, PackageCheck, Ban, Pencil } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, Modal, Secao, Campo, Loader, Vazio, inp, R$ } from '../../cadastros/ui';

const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const STATUS: Record<string, { label: string; cor: string }> = {
  PENDENTE: { label: 'Pendente', cor: 'bg-amber-500/15 text-amber-400' },
  APROVADA: { label: 'Aprovada', cor: 'bg-sky-500/15 text-sky-400' },
  PARCIAL: { label: 'Parcial', cor: 'bg-violet-500/15 text-violet-400' },
  ENTREGUE: { label: 'Entregue', cor: 'bg-emerald-500/15 text-emerald-400' },
  CANCELADA: { label: 'Cancelada', cor: 'bg-rose-500/15 text-rose-400' },
};
const CONDICOES = ['A_VISTA', '7_DIAS', '15_DIAS', '30_DIAS', '30_60', '30_60_90'];
const CONatoLabel: Record<string, string> = { A_VISTA: 'À vista', '7_DIAS': '7 dias', '15_DIAS': '15 dias', '30_DIAS': '30 dias', '30_60': '30/60', '30_60_90': '30/60/90' };

export default function Compras() {
  const { filialAtiva } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [editar, setEditar] = useState<any | null>(null);
  const [criar, setCriar] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/compras', { params: { status: status || undefined, search: busca || undefined } })
      .then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  }, [status, busca]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);

  const acao = async (oc: any, novo: string, msg?: string) => {
    if (msg && !await confirmDialog(msg)) return;
    try { await api.patch(`/compras/${oc.id}/status`, { status: novo }); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro.'); }
  };
  const excluir = async (oc: any) => {
    if (!await confirmDialog(`Excluir a OC #${oc.numero}?`)) return;
    try { await api.delete(`/compras/${oc.id}`); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro ao excluir.'); }
  };
  const abrirEditar = async (oc: any) => { const { data } = await api.get(`/compras/${oc.id}`); setEditar(data); };

  return (
    <CadastroShell>
      <TopBar icon={<ShoppingCart className="h-5 w-5" />} titulo="Ordens de Compra" subtitulo={`${lista.length} OC(s) — compras e suprimentos`}
        novoLabel="Nova OC" onNovo={() => setCriar(true)}
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-lg text-slate-200 text-sm"><RefreshCw className="h-4 w-4 text-sky-400" /> Atualizar</button>} />
      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por nº ou fornecedor...">
        <Chips value={status} onChange={setStatus} options={[{ value: '', label: 'Todas' }, ...Object.keys(STATUS).map(s => ({ value: s, label: STATUS[s].label }))]} />
      </FilterBar>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<ShoppingCart className="h-10 w-10" />} texto="Nenhuma ordem de compra" /> : (
          <TableCard>
            <thead><tr>{['OC', 'Fornecedor', 'Emissão', 'Entrega prev.', 'Pagamento', 'Itens', 'Total', 'Status', 'Ações'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(oc => (
                <tr key={oc.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-2.5 font-bold text-slate-100">#{oc.numero}</td>
                  <td className="px-3 py-2.5 text-slate-200">{oc.fornecedor?.nomeFantasia || oc.fornecedor?.razaoSocial}</td>
                  <td className="px-3 py-2.5 text-slate-400">{dt(oc.dataEmissao)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{dt(oc.dataEntregaPrevista)}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{CONatoLabel[oc.condicaoPagamento] || oc.condicaoPagamento || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-slate-300">{oc._count?.itens ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-200">{R$(oc.valorTotal)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS[oc.status]?.cor}`}>{STATUS[oc.status]?.label || oc.status}</span></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {oc.status === 'PENDENTE' && <button onClick={() => acao(oc, 'APROVADA')} className="text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-1 rounded font-semibold hover:bg-sky-500/20 flex items-center gap-1"><Check className="h-3 w-3" /> Aprovar</button>}
                      {(oc.status === 'PENDENTE' || oc.status === 'APROVADA' || oc.status === 'PARCIAL') && <button onClick={() => navigate(`/wms/entradas?oc=${oc.id}`)} className="text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded font-semibold hover:bg-emerald-500/20 flex items-center gap-1" title="Receber via Entrada de mercadoria"><PackageCheck className="h-3 w-3" /> Receber</button>}
                      {(oc.status === 'PENDENTE' || oc.status === 'APROVADA') && <button onClick={() => abrirEditar(oc)} className="text-slate-400 hover:text-sky-300 p-1" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>}
                      {oc.status !== 'ENTREGUE' && oc.status !== 'CANCELADA' && <button onClick={() => acao(oc, 'CANCELADA', `Cancelar a OC #${oc.numero}?`)} className="text-slate-400 hover:text-rose-400 p-1" title="Cancelar"><Ban className="h-3.5 w-3.5" /></button>}
                      {oc.status === 'PENDENTE' && <button onClick={() => excluir(oc)} className="text-slate-400 hover:text-rose-400 p-1" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {(criar || editar) && <ModalOC oc={editar} filialId={filialAtiva?.id} onClose={() => { setCriar(false); setEditar(null); }} onSalvo={() => { setCriar(false); setEditar(null); carregar(); }} />}
    </CadastroShell>
  );
}

type ItemOC = { produtoId: string; descricao: string; unidade: string; quantidade: string; precoUnitario: string };
const UNIDADES = ['KG', 'UN', 'CX', 'MAÇO', 'SACA', 'DZ', 'LT'];
const itemVazio = (): ItemOC => ({ produtoId: '', descricao: '', unidade: 'KG', quantidade: '', precoUnitario: '' });

function ModalOC({ oc, filialId, onClose, onSalvo }: { oc: any | null; filialId?: string; onClose: () => void; onSalvo: () => void }) {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedorId, setFornecedorId] = useState(oc?.fornecedorId || '');
  const [condicao, setCondicao] = useState(oc?.condicaoPagamento || '30_DIAS');
  const [entrega, setEntrega] = useState(oc?.dataEntregaPrevista ? oc.dataEntregaPrevista.slice(0, 10) : '');
  const [obs, setObs] = useState(oc?.observacoes || '');
  const [itens, setItens] = useState<ItemOC[]>(oc?.itens?.length ? oc.itens.map((i: any) => ({ produtoId: i.produtoId || '', descricao: i.descricao, unidade: i.unidade, quantidade: String(i.quantidade), precoUnitario: String(i.precoUnitario) })) : [itemVazio()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/fornecedores').then(r => setFornecedores(r.data)).catch(() => {});
    api.get('/produtos').then(r => setProdutos(r.data)).catch(() => {});
  }, []);

  const setItem = (i: number, k: keyof ItemOC, v: string) => setItens(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const escolherProduto = (i: number, produtoId: string) => {
    const prod = produtos.find(p => p.id === produtoId);
    setItens(p => p.map((it, idx) => idx !== i ? it : {
      ...it, produtoId,
      descricao: prod ? prod.descricao : it.descricao,
      unidade: prod?.unidadeMedida?.sigla || it.unidade,
      precoUnitario: it.precoUnitario || (prod?.precoCompra ? String(prod.precoCompra) : it.precoUnitario),
    }));
  };
  const addItem = () => setItens(p => [...p, itemVazio()]);
  const delItem = (i: number) => setItens(p => p.filter((_, idx) => idx !== i));

  const total = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.precoUnitario) || 0), 0);

  const salvar = async () => {
    if (!fornecedorId) return setErro('Selecione o fornecedor.');
    const validos = itens.filter(i => i.descricao.trim() && Number(i.quantidade) > 0);
    if (validos.length === 0) return setErro('Informe ao menos um item com quantidade.');
    setSalvando(true); setErro('');
    const payload = {
      fornecedorId, filialId, condicaoPagamento: condicao, dataEntregaPrevista: entrega || null, observacoes: obs || null,
      itens: validos.map(i => ({ produtoId: i.produtoId || null, descricao: i.descricao.trim(), unidade: i.unidade, quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario) || 0 })),
    };
    try {
      if (oc) await api.put(`/compras/${oc.id}`, payload); else await api.post('/compras', payload);
      onSalvo();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  const fld = 'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500';
  const lb = 'block text-[9px] font-bold text-slate-500 uppercase mb-0.5';

  return (
    <Modal titulo={oc ? `Editar OC #${oc.numero}` : 'Nova Ordem de Compra'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={oc ? 'Salvar' : 'Criar OC'} wide>
      <Secao titulo="Dados da compra" />
      <div className="grid grid-cols-4 gap-3">
        <Campo label="Fornecedor *" className="col-span-2">
          <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={`${inp} ${!fornecedorId ? 'border-rose-500/50' : ''}`}>
            <option value="">— selecione —</option>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
          </select>
        </Campo>
        <Campo label="Condição de pagamento"><select value={condicao} onChange={e => setCondicao(e.target.value)} className={inp}>{CONDICOES.map(c => <option key={c} value={c}>{CONatoLabel[c]}</option>)}</select></Campo>
        <Campo label="Entrega prevista"><input type="date" value={entrega} onChange={e => setEntrega(e.target.value)} className={inp} /></Campo>
      </div>

      <Secao titulo="Itens" />
      <div className="space-y-2">
        {itens.map((it, i) => (
          <div key={i} className="border border-slate-700 rounded-lg p-3 bg-slate-800/30">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6 sm:col-span-5"><label className={lb}>Produto (vínculo)</label>
                <select value={it.produtoId} onChange={e => escolherProduto(i, e.target.value)} className={fld}><option value="">— sem vínculo —</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}</select>
              </div>
              <div className="col-span-6"><label className={lb}>Descrição *</label><input value={it.descricao} onChange={e => setItem(i, 'descricao', e.target.value)} className={`${fld} ${!it.descricao.trim() ? 'border-rose-500/40' : ''}`} placeholder="nome do item" /></div>
              <div className="col-span-12 sm:col-span-1 flex sm:justify-center sm:items-end">
                {itens.length > 1 && <button onClick={() => delItem(i)} className="text-slate-500 hover:text-rose-400 flex items-center gap-1 text-[11px] pb-1.5"><Trash2 className="h-4 w-4" /><span className="sm:hidden">remover</span></button>}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 mt-2">
              <div className="col-span-4 sm:col-span-3"><label className={lb}>Qtd *</label><input type="number" inputMode="decimal" min="0" step="0.001" value={it.quantidade} onChange={e => setItem(i, 'quantidade', e.target.value)} className={`${fld} text-right ${!(Number(it.quantidade) > 0) ? 'border-rose-500/40' : ''}`} /></div>
              <div className="col-span-3 sm:col-span-2"><label className={lb}>Un</label><select value={it.unidade} onChange={e => setItem(i, 'unidade', e.target.value)} className={fld}>{[...new Set([it.unidade, ...UNIDADES])].map(u => <option key={u}>{u}</option>)}</select></div>
              <div className="col-span-5 sm:col-span-3"><label className={lb}>Preço Unit. (R$)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={it.precoUnitario} onChange={e => setItem(i, 'precoUnitario', e.target.value)} className={`${fld} text-right`} placeholder="0,00" /></div>
              <div className="col-span-12 sm:col-span-4 flex items-end justify-end"><span className="text-[11px] text-slate-500">Subtotal: <b className="text-slate-300">{R$((Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0))}</b></span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={addItem} className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 font-semibold"><Plus className="h-3.5 w-3.5" /> Adicionar item</button>
        <span className="text-sm text-slate-300">Total da OC: <b className="text-slate-100 text-base">{R$(total)}</b></span>
      </div>

      <Campo label="Observações"><textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={`${inp} resize-none`} /></Campo>
      <p className="text-[11px] text-slate-500">Ao <b>Receber</b>, os itens vinculados a um produto dão entrada no estoque e é gerado o Contas a Pagar pela condição de pagamento.</p>

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">{erro}</p>}
    </Modal>
  );
}
