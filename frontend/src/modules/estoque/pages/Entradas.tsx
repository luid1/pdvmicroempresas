import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PackagePlus, RefreshCw, Upload, Trash2, FileCode, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, Modal, Secao, Campo, Loader, Vazio, inp, R$ } from '../../cadastros/ui';

const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const UNIDADES = ['KG', 'UN', 'CX', 'MAÇO', 'SACA', 'DZ', 'LT'];
const soDigitos = (v: string) => v.replace(/\D/g, '');
const STATUS_COR: Record<string, string> = { CONFERIDA: 'bg-emerald-500/15 text-emerald-400', PENDENTE: 'bg-amber-500/15 text-amber-400', DIVERGENTE: 'bg-rose-500/15 text-rose-400', CANCELADA: 'bg-slate-600/40 text-slate-400' };

type Item = { produtoId: string; descricao: string; ncm: string; quantidade: string; unidade: string; valorUnitario: string; loteNumero: string; dataValidade: string };
const itemVazio = (): Item => ({ produtoId: '', descricao: '', ncm: '', quantidade: '', unidade: 'KG', valorUnitario: '', loteNumero: '', dataValidade: '' });

export default function Entradas() {
  const { filialAtiva } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ocId = params.get('oc') || undefined; // veio de "Receber" numa Ordem de Compra
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/entradas', { params: { search: busca || undefined } })
      .then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  }, [busca]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);

  // Se veio de uma OC, abre o modal de entrada já pré-preenchido
  useEffect(() => { if (ocId) setModal(true); }, [ocId]);
  const fecharModal = () => { setModal(false); if (ocId) { params.delete('oc'); setParams(params, { replace: true }); } };

  return (
    <CadastroShell>
      <TopBar icon={<PackagePlus className="h-5 w-5" />} titulo="Entradas (XML NF-e)" subtitulo={`${lista.length} entrada(s) — recebimento de mercadoria`}
        novoLabel="Nova Entrada" onNovo={() => setModal(true)}
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-lg text-slate-200 text-sm"><RefreshCw className="h-4 w-4 text-sky-400" /> Atualizar</button>} />
      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por NF, chave ou fornecedor..." />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<PackagePlus className="h-10 w-10" />} texto="Nenhuma entrada registrada" /> : (
          <TableCard>
            <thead><tr>{['Data', 'Fornecedor', 'NF', 'Chave', 'Itens', 'Valor', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(e => (
                <tr key={e.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-2.5 text-slate-300">{dt(e.dataEntrada)}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-100">{e.fornecedor?.nomeFantasia || e.fornecedor?.razaoSocial}</td>
                  <td className="px-3 py-2.5 text-slate-300">{e.numeroNf ? `${e.numeroNf}/${e.serieNf || '1'}` : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px] max-w-[220px] truncate">{e.chaveNfeEntrada || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-slate-300">{e._count?.itens ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-200">{R$(e.valorTotal)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[e.status] || 'bg-slate-700'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {modal && <ModalEntrada ocId={ocId} onClose={fecharModal} onSalvo={() => { fecharModal(); carregar(); navigate('/wms/entradas'); }} filialId={filialAtiva?.id} />}
    </CadastroShell>
  );
}

function ModalEntrada({ onClose, onSalvo, filialId, ocId }: { onClose: () => void; onSalvo: () => void; filialId?: string; ocId?: string }) {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedorId, setFornecedorId] = useState('');
  const [numeroNf, setNumeroNf] = useState('');
  const [serieNf, setSerieNf] = useState('1');
  const [chave, setChave] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [itens, setItens] = useState<Item[]>([itemVazio()]);
  const [gerarCP, setGerarCP] = useState(true);
  const [dataVenc, setDataVenc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ordemCompraId, setOrdemCompraId] = useState<string | undefined>(undefined);
  const [ocNumero, setOcNumero] = useState<number | null>(null);

  useEffect(() => {
    api.get('/fornecedores').then(r => setFornecedores(r.data)).catch(() => {});
    api.get('/produtos').then(async (r) => {
      setProdutos(r.data);
      // Pré-preenche a partir de uma Ordem de Compra (fluxo "Receber")
      if (ocId) {
        try {
          const { data: oc } = await api.get(`/compras/${ocId}`);
          setFornecedorId(oc.fornecedorId);
          setOrdemCompraId(oc.id);
          setOcNumero(oc.numero);
          setItens(oc.itens.map((it: any) => {
            const prod = r.data.find((p: any) => p.id === it.produtoId);
            return {
              produtoId: it.produtoId || '', descricao: it.descricao, ncm: prod?.ncm || '',
              quantidade: String(it.quantidade), unidade: it.unidade || 'KG',
              valorUnitario: String(it.precoUnitario), loteNumero: '', dataValidade: '',
            } as Item;
          }));
          setAviso(`Recebendo a OC #${oc.numero}. Confira/complete NF, lote e validade e clique em "Dar entrada".`);
        } catch { /* noop */ }
      }
    }).catch(() => {});
  }, [ocId]);

  const setItem = (i: number, k: keyof Item, v: string) => setItens(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  // Ao vincular um produto, puxa NCM / descrição / unidade do cadastro
  const escolherProduto = (i: number, produtoId: string) => {
    const prod = produtos.find(p => p.id === produtoId);
    setItens(p => p.map((it, idx) => idx !== i ? it : {
      ...it, produtoId,
      descricao: prod ? prod.descricao : it.descricao,
      ncm: prod?.ncm ? prod.ncm : it.ncm,
      unidade: prod?.unidadeMedida?.sigla || it.unidade,
      valorUnitario: it.valorUnitario || (prod?.precoCompra ? String(prod.precoCompra) : it.valorUnitario),
    }));
  };
  const addItem = () => setItens(p => [...p, itemVazio()]);
  const delItem = (i: number) => setItens(p => p.filter((_, idx) => idx !== i));

  // Parse do XML da NF-e (feito no navegador)
  const onXml = async (file: File) => {
    setErro(''); setAviso('');
    try {
      const txt = await file.text();
      const doc = new DOMParser().parseFromString(txt, 'text/xml');
      const g = (parent: Element | Document, tag: string) => parent.getElementsByTagName(tag)[0]?.textContent || '';
      // Cabeçalho
      const inf = doc.getElementsByTagName('infNFe')[0];
      if (inf) { const id = inf.getAttribute('Id') || ''; setChave(id.replace(/\D/g, '').slice(-44)); }
      setNumeroNf(g(doc, 'nNF')); setSerieNf(g(doc, 'serie') || '1');
      const dhEmi = g(doc, 'dhEmi') || g(doc, 'dEmi'); if (dhEmi) setDataEmissao(dhEmi.slice(0, 10));
      // Itens
      const dets = Array.from(doc.getElementsByTagName('det'));
      const novos: Item[] = dets.map(det => {
        const prod = det.getElementsByTagName('prod')[0];
        const xProd = g(prod, 'xProd'); const ncm = g(prod, 'NCM'); const uCom = g(prod, 'uCom') || 'UN';
        const qCom = g(prod, 'qCom'); const vUn = g(prod, 'vUnCom');
        // tenta casar produto pelo NCM ou nome
        const match = produtos.find(p => (ncm && p.ncm === ncm) || (xProd && p.descricao?.toLowerCase() === xProd.toLowerCase()));
        return { produtoId: match?.id || '', descricao: xProd, ncm, unidade: uCom, quantidade: qCom, valorUnitario: vUn, loteNumero: '', dataValidade: '' };
      });
      if (novos.length) { setItens(novos); setAviso(`XML lido: ${novos.length} item(ns). Confira o vínculo dos produtos (itens sem vínculo não movimentam estoque).`); }
      else setErro('Não encontrei itens no XML.');
    } catch { setErro('Falha ao ler o XML.'); }
  };

  const salvar = async () => {
    if (!fornecedorId) return setErro('Selecione o fornecedor.');
    const itensValidos = itens.filter(i => i.descricao.trim() && Number(i.quantidade) > 0);
    if (itensValidos.length === 0) return setErro('Informe ao menos um item com quantidade.');
    setSalvando(true); setErro('');
    const payload = {
      fornecedorId, filialId, ordemCompraId: ordemCompraId || null,
      numeroNf: numeroNf || null, serieNf, chaveNfeEntrada: chave || null,
      dataEmissao: dataEmissao || null, gerarContaPagar: gerarCP, dataVencimento: dataVenc || null,
      itens: itensValidos.map(i => ({
        produtoId: i.produtoId || null, descricao: i.descricao.trim(), ncm: i.ncm || null,
        quantidade: Number(i.quantidade), unidade: i.unidade, valorUnitario: Number(i.valorUnitario) || 0,
        valorTotal: (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0),
        loteNumero: i.loteNumero || null, dataValidade: i.dataValidade || null,
      })),
    };
    try { await api.post('/entradas', payload); onSalvo(); }
    catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar entrada.'); }
    finally { setSalvando(false); }
  };

  const totalNota = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);

  return (
    <Modal titulo={ocNumero ? `Receber OC #${ocNumero} — Entrada de Mercadoria` : 'Nova Entrada de Mercadoria'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel="Dar entrada" wide>
      {/* Upload XML */}
      <label className="flex items-center gap-3 bg-slate-800/60 border border-dashed border-slate-600 rounded-lg px-4 py-3 cursor-pointer hover:border-sky-500">
        <Upload className="h-5 w-5 text-sky-400" />
        <div className="flex-1"><p className="text-sm font-semibold text-slate-200">Importar XML da NF-e do fornecedor</p><p className="text-xs text-slate-500">Preenche os itens automaticamente (você confere o vínculo dos produtos).</p></div>
        <FileCode className="h-4 w-4 text-slate-500" />
        <input type="file" accept=".xml,text/xml" className="hidden" onChange={e => e.target.files?.[0] && onXml(e.target.files[0])} />
      </label>
      {aviso && <p className="text-xs text-sky-300 bg-sky-500/10 px-3 py-2 rounded-lg">{aviso}</p>}

      <Secao titulo="Dados da nota" />
      <div className="grid grid-cols-4 gap-3">
        <Campo label="Fornecedor *" className="col-span-2">
          <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={`${inp} ${!fornecedorId ? 'border-rose-500/50' : ''}`}>
            <option value="">— selecione —</option>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
          </select>
        </Campo>
        <Campo label="Nº NF"><input inputMode="numeric" value={numeroNf} onChange={e => setNumeroNf(soDigitos(e.target.value))} className={inp} placeholder="só números" /></Campo>
        <Campo label="Série"><input inputMode="numeric" value={serieNf} onChange={e => setSerieNf(soDigitos(e.target.value))} className={inp} /></Campo>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Campo label="Chave de acesso (opcional · 44 dígitos)" className="col-span-3">
          <input inputMode="numeric" maxLength={44} value={chave} onChange={e => setChave(soDigitos(e.target.value))} className={`${inp} font-mono text-xs`} placeholder="só números — deixe em branco se não tiver a NF-e" />
          {chave.length > 0 && <span className={`text-[10px] ${chave.length === 44 ? 'text-emerald-400' : 'text-amber-400'}`}>{chave.length}/44 dígitos</span>}
        </Campo>
        <Campo label="Emissão"><input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className={inp} /></Campo>
      </div>

      <Secao titulo="Itens" />
      <div className="space-y-2">
        {itens.map((it, i) => {
          const fld = 'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500';
          const lb = 'block text-[9px] font-bold text-slate-500 uppercase mb-0.5';
          return (
            <div key={i} className="border border-slate-700 rounded-lg p-3 bg-slate-800/30">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6 sm:col-span-5"><label className={lb}>Produto (vínculo)</label>
                  <select value={it.produtoId} onChange={e => escolherProduto(i, e.target.value)} className={fld}><option value="">— sem vínculo —</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}</select>
                </div>
                <div className="col-span-6 sm:col-span-6"><label className={lb}>Descrição *</label><input value={it.descricao} onChange={e => setItem(i, 'descricao', e.target.value)} className={`${fld} ${!it.descricao.trim() ? 'border-rose-500/40' : ''}`} placeholder="nome do item" /></div>
                <div className="col-span-12 sm:col-span-1 flex sm:justify-center sm:items-end">
                  {itens.length > 1 && <button onClick={() => delItem(i)} className="text-slate-500 hover:text-rose-400 flex items-center gap-1 text-[11px] pb-1.5"><Trash2 className="h-4 w-4" /><span className="sm:hidden">remover</span></button>}
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 mt-2">
                <div className="col-span-3 sm:col-span-2"><label className={lb}>NCM (8 díg.)</label><input inputMode="numeric" maxLength={8} value={it.ncm} onChange={e => setItem(i, 'ncm', soDigitos(e.target.value))} className={`${fld} font-mono`} placeholder="números" /></div>
                <div className="col-span-3 sm:col-span-2"><label className={lb}>Qtd *</label><input type="number" inputMode="decimal" min="0" step="0.001" value={it.quantidade} onChange={e => setItem(i, 'quantidade', e.target.value)} className={`${fld} text-right ${!(Number(it.quantidade) > 0) ? 'border-rose-500/40' : ''}`} /></div>
                <div className="col-span-3 sm:col-span-1"><label className={lb}>Un</label>
                  <select value={UNIDADES.includes((it.unidade || '').toUpperCase()) ? it.unidade.toUpperCase() : (it.unidade || 'KG')} onChange={e => setItem(i, 'unidade', e.target.value)} className={fld}>
                    {[...new Set([...(it.unidade && !UNIDADES.includes(it.unidade.toUpperCase()) ? [it.unidade] : []), ...UNIDADES])].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-2"><label className={lb}>Vl Unit (R$)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={it.valorUnitario} onChange={e => setItem(i, 'valorUnitario', e.target.value)} className={`${fld} text-right`} placeholder="0,00" /></div>
                <div className="col-span-5 sm:col-span-2"><label className={lb}>Lote</label><input value={it.loteNumero} onChange={e => setItem(i, 'loteNumero', e.target.value.toUpperCase())} className={fld} placeholder="letras/números" /></div>
                <div className="col-span-7 sm:col-span-3"><label className={lb}>Validade</label><input type="date" value={it.dataValidade} onChange={e => setItem(i, 'dataValidade', e.target.value)} className={fld} /></div>
              </div>
              <div className="text-right text-[11px] text-slate-500 mt-1.5">Subtotal: <b className="text-slate-300">{R$((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0))}</b></div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={addItem} className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 font-semibold"><Plus className="h-3.5 w-3.5" /> Adicionar item</button>
        <span className="text-sm text-slate-300">Total da nota: <b className="text-slate-100">{R$(totalNota)}</b></span>
      </div>

      <Secao titulo="Financeiro" />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={gerarCP} onChange={e => setGerarCP(e.target.checked)} className="accent-sky-500 h-4 w-4" /> Gerar Contas a Pagar</label>
        {gerarCP && <Campo label="Vencimento"><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} className={inp} /></Campo>}
      </div>
      <p className="text-[11px] text-slate-500">Itens vinculados a um produto dão entrada no estoque (com lote/validade se informados). Sem vínculo, entram só como documento.</p>

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">{erro}</p>}
    </Modal>
  );
}
