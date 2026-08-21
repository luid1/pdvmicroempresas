import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PackagePlus, RefreshCw, Upload, Trash2, FileCode, Plus, Check, Link2, PlusCircle, Sparkles, FileText, Boxes, Wallet } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, R$ } from '../../cadastros/ui';

const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const UNIDADES = ['KG', 'UN', 'CX', 'MAÇO', 'SACA', 'DZ', 'LT'];
const soDigitos = (v: string) => v.replace(/\D/g, '');
const STATUS_COR: Record<string, string> = { CONFERIDA: 'bg-emerald-500/15 text-[#0b7d4e]', PENDENTE: 'bg-amber-500/15 text-[#a9760a]', DIVERGENTE: 'bg-rose-500/15 text-[#c3352b]', CANCELADA: 'bg-[#F0EEE9] text-slate-400' };

type Item = { produtoId: string; descricao: string; ncm: string; quantidade: string; unidade: string; valorUnitario: string; loteNumero: string; dataValidade: string; novo?: boolean; criarNovo?: boolean };
const itemVazio = (): Item => ({ produtoId: '', descricao: '', ncm: '', quantidade: '', unidade: 'KG', valorUnitario: '', loteNumero: '', dataValidade: '' });

// Campos densos do card de item — legíveis (text-sm) e alinhados ao kit "Luz".
const fld = 'w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-2 text-sm text-[#202123] placeholder:text-[#B4B5BA] focus:outline-none focus:border-[#0F8A72]/60 focus:ring-2 focus:ring-[#0F8A72]/20 transition-all';
const lb = 'block text-[10px] font-semibold text-[#8E8F94] uppercase tracking-[0.08em] mb-1';

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
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F7F7F8] px-3 py-2 rounded-lg text-[#5F6065] text-sm"><RefreshCw className="h-4 w-4 text-[#0F8A72]" /> Atualizar</button>} />
      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por NF, chave ou fornecedor..." />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<PackagePlus className="h-10 w-10" />} texto="Nenhuma entrada registrada" /> : (
          <TableCard>
            <thead><tr>{['Data', 'Fornecedor', 'NF', 'Chave', 'Itens', 'Valor', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(e => (
                <tr key={e.id} className="border-t border-[#E7E5DF] hover:bg-amber-500/5">
                  <td className="px-3 py-2.5 text-[#8B8D98]">{dt(e.dataEntrada)}</td>
                  <td className="px-3 py-2.5 font-semibold text-[#16171D]">{e.fornecedor?.nomeFantasia || e.fornecedor?.razaoSocial}</td>
                  <td className="px-3 py-2.5 text-[#8B8D98]">{e.numeroNf ? `${e.numeroNf}/${e.serieNf || '1'}` : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px] max-w-[220px] truncate">{e.chaveNfeEntrada || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-[#8B8D98]">{e._count?.itens ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#5B5D69]">{R$(e.valorTotal)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[e.status] || 'bg-[#F0EEE9]'}`}>{e.status}</span></td>
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
  const [dragOver, setDragOver] = useState(false);
  const inputXmlRef = useRef<HTMLInputElement>(null);

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
      ...it, produtoId, novo: false, criarNovo: false,
      descricao: prod ? prod.descricao : it.descricao,
      ncm: prod?.ncm ? prod.ncm : it.ncm,
      unidade: prod?.unidadeMedida?.sigla || it.unidade,
      valorUnitario: it.valorUnitario || (prod?.precoCompra ? String(prod.precoCompra) : it.valorUnitario),
    }));
  };
  // Quando o produto é cadastrado "na hora": entra no catálogo e já fica vinculado ao item.
  const onProdutoCriado = (i: number, prod: any) => {
    setProdutos(p => [...p, prod].sort((a, b) => String(a.descricao).localeCompare(String(b.descricao))));
    setItens(p => p.map((it, idx) => idx !== i ? it : { ...it, produtoId: prod.id, novo: true, ncm: prod.ncm || it.ncm }));
  };
  const setCriarNovo = (i: number, v: boolean) => setItens(p => p.map((it, idx) => idx === i ? { ...it, criarNovo: v } : it));
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
      let casados = 0;
      const novos: Item[] = dets.map(det => {
        const prod = det.getElementsByTagName('prod')[0];
        const xProd = g(prod, 'xProd'); const ncm = g(prod, 'NCM'); const uCom = g(prod, 'uCom') || 'UN';
        const qCom = g(prod, 'qCom'); const vUn = g(prod, 'vUnCom');
        // tenta casar produto pelo NCM ou nome
        const match = produtos.find(p => (ncm && p.ncm === ncm) || (xProd && p.descricao?.toLowerCase() === xProd.toLowerCase()));
        if (match) casados++;
        return { produtoId: match?.id || '', descricao: xProd, ncm, unidade: uCom, quantidade: qCom, valorUnitario: vUn, loteNumero: '', dataValidade: '', criarNovo: !match };
      });
      if (novos.length) {
        setItens(novos);
        const semVinculo = novos.length - casados;
        setAviso(semVinculo === 0
          ? `XML lido: ${novos.length} item(ns), todos já vinculados ao seu catálogo. É só conferir e dar entrada.`
          : `XML lido: ${novos.length} item(ns) — ${casados} já vinculado(s) e ${semVinculo} sem vínculo. Nos itens sem vínculo o cadastro rápido já abriu: confira o preço e cadastre — eles entram vinculados na hora.`);
      }
      else setErro('Não encontrei itens no XML.');
    } catch { setErro('Falha ao ler o XML.'); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onXml(f);
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
  const semVinculo = itens.filter(i => i.descricao.trim() && !i.produtoId).length;
  const temItemValido = itens.some(i => i.descricao.trim() && Number(i.quantidade) > 0);

  return (
    <Modal titulo={ocNumero ? `Receber OC #${ocNumero} — Entrada de Mercadoria` : 'Nova Entrada de Mercadoria'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel="Dar entrada" wide>
      <SteppedForm>
        <Step title="Nota fiscal" icon={<FileText className="h-3.5 w-3.5" />} hint="Ir para os itens" complete={!!fornecedorId}>
          {/* Importar XML — dropzone moderno */}
          <div
            onClick={() => inputXmlRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role="button"
            className={`group flex items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-5 cursor-pointer transition-all ${dragOver ? 'border-[#0F8A72] bg-[#0F8A72]/[0.06]' : 'border-[#D7DBDF] bg-[#F7F7F8] hover:border-[#0F8A72]/60 hover:bg-[#0F8A72]/[0.04]'}`}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0F8A72]/10 text-[#0F8A72] group-hover:scale-105 transition-transform">
              <Upload className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#202123]">Importar XML da NF-e do fornecedor</p>
              <p className="text-[13px] text-[#5F6065] mt-0.5">Arraste o arquivo aqui ou <span className="text-[#0F8A72] font-semibold underline decoration-dotted">clique para selecionar</span>. Ao adicionar, os itens são preenchidos <b>na hora</b> e casados com o seu catálogo automaticamente.</p>
            </div>
            <FileCode className="h-6 w-6 text-[#B4B5BA] shrink-0 hidden sm:block" />
            <input ref={inputXmlRef} type="file" accept=".xml,text/xml" className="hidden" onChange={e => e.target.files?.[0] && onXml(e.target.files[0])} />
          </div>
          {aviso && <p className="flex items-start gap-2 text-[13px] text-[#0B6F5C] bg-[#0F8A72]/[0.08] border border-[#0F8A72]/20 px-3.5 py-2.5 rounded-xl"><Sparkles className="h-4 w-4 mt-0.5 shrink-0" />{aviso}</p>}

          <div className="grid grid-cols-4 gap-3">
            <Campo label="Fornecedor *" className="col-span-2">
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={`${inp} ${!fornecedorId ? 'border-rose-500/50' : ''}`}>
                <option value="">Selecione</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
              </select>
            </Campo>
            <Campo label="Nº NF"><input inputMode="numeric" value={numeroNf} onChange={e => setNumeroNf(soDigitos(e.target.value))} className={inp} placeholder="só números" /></Campo>
            <Campo label="Série"><input inputMode="numeric" value={serieNf} onChange={e => setSerieNf(soDigitos(e.target.value))} className={inp} /></Campo>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Campo label="Chave de acesso (opcional · 44 dígitos)" className="col-span-3">
              <input inputMode="numeric" maxLength={44} value={chave} onChange={e => setChave(soDigitos(e.target.value))} className={`${inp} font-mono text-xs`} placeholder="só números — deixe em branco se não tiver a NF-e" />
              {chave.length > 0 && <span className={`text-[10px] ${chave.length === 44 ? 'text-[#0b7d4e]' : 'text-[#a9760a]'}`}>{chave.length}/44 dígitos</span>}
            </Campo>
            <Campo label="Emissão"><input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Itens da entrada" icon={<Boxes className="h-3.5 w-3.5" />} hint="Ir para o financeiro" complete={temItemValido}>
          {semVinculo > 0 && <p className="flex items-center gap-2 text-[12px] text-[#a9760a] bg-amber-500/10 px-3 py-2 rounded-lg"><span className="font-bold">{semVinculo} item(ns) sem vínculo.</span> O cadastro rápido já está aberto neles: confira o preço e cadastre — o produto entra vinculado e no estoque na hora.</p>}
          <div className="space-y-2.5">
            {itens.map((it, i) => (
              <ItemEntrada
                key={i} it={it} i={i} produtos={produtos} podeRemover={itens.length > 1}
                onSet={(k, v) => setItem(i, k, v)}
                onEscolher={pid => escolherProduto(i, pid)}
                onToggleNovo={v => setCriarNovo(i, v)}
                onRemover={() => delItem(i)}
                onCriado={prod => onProdutoCriado(i, prod)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <button onClick={addItem} className="flex items-center gap-1.5 text-[13px] text-[#0F8A72] hover:text-[#0B6F5C] font-semibold"><Plus className="h-4 w-4" /> Adicionar item manualmente</button>
            <span className="text-sm text-[#5F6065]">Total da nota: <b className="text-[#202123]">{R$(totalNota)}</b></span>
          </div>
        </Step>

        <Step title="Financeiro" icon={<Wallet className="h-3.5 w-3.5" />} complete>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[#5F6065]"><input type="checkbox" checked={gerarCP} onChange={e => setGerarCP(e.target.checked)} className="accent-[#0F8A72] h-4 w-4" /> Gerar Contas a Pagar</label>
            {gerarCP && <Campo label="Vencimento"><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} className={inp} /></Campo>}
          </div>
          <p className="text-[12px] text-[#8E8F94]">Itens vinculados a um produto dão entrada no estoque (com lote/validade se informados). Sem vínculo, entram só como documento e não movimentam estoque.</p>
        </Step>
      </SteppedForm>

      {erro && <p className="mt-3 text-xs text-[#c3352b] bg-rose-500/10 px-3 py-2 rounded-lg">{erro}</p>}
    </Modal>
  );
}

/* Card de um item da nota — vínculo, cadastro "na hora" e dados fiscais/quantidade. */
function ItemEntrada({ it, i, produtos, podeRemover, onSet, onEscolher, onToggleNovo, onRemover, onCriado }: {
  it: Item; i: number; produtos: any[]; podeRemover: boolean;
  onSet: (k: keyof Item, v: string) => void; onEscolher: (produtoId: string) => void;
  onToggleNovo: (v: boolean) => void; onRemover: () => void; onCriado: (prod: any) => void;
}) {
  const vinculado = !!it.produtoId;
  const subtotal = (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0);
  const mostrarNovo = !!it.criarNovo && !vinculado;

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(22,23,29,0.04)] transition-colors ${vinculado ? 'border-[#0F8A72]/35' : 'border-[#E5E7EB]'}`}>
      {/* Cabeçalho do card: nº + status + remover */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F3F4F6] text-[11px] font-bold text-[#8E8F94]">{i + 1}</span>
          {vinculado
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0FA968]/12 px-2.5 py-1 text-[11px] font-bold text-[#0b7d4e]">{it.novo ? <><Sparkles className="h-3.5 w-3.5" /> Produto novo criado · entra no estoque</> : <><Link2 className="h-3.5 w-3.5" /> Vinculado · entra no estoque</>}</span>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-[#a9760a]">Sem vínculo · não movimenta estoque</span>}
        </div>
        {podeRemover && <button onClick={onRemover} className="flex items-center gap-1 text-[#8E8F94] hover:text-[#c3352b] text-[12px] transition-colors"><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">remover</span></button>}
      </div>

      {/* Vínculo com o catálogo */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-8">
          <label className={lb}>Produto no seu catálogo</label>
          <select value={it.produtoId} onChange={e => onEscolher(e.target.value)} className={fld}>
            <option value="">Selecione um produto</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
          </select>
        </div>
        <div className="sm:col-span-4 flex sm:items-end">
          {!vinculado && !mostrarNovo && (
            <button onClick={() => onToggleNovo(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold text-[#0B6F5C] bg-[#0F8A72]/[0.08] border border-[#0F8A72]/30 hover:bg-[#0F8A72]/[0.14] transition-all active:scale-[0.98]">
              <PlusCircle className="h-4 w-4" /> Cadastrar como novo produto
            </button>
          )}
          {vinculado && it.novo && (
            <span className="w-full flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-[#0b7d4e]"><Check className="h-4 w-4" /> Cadastrado e já vendável</span>
          )}
        </div>
      </div>

      {/* Painel "cadastrar na hora" — abre sozinho nos itens sem vínculo; ao cadastrar, já vincula */}
      {mostrarNovo && (
        <QuickAddProduto it={it} onCancelar={() => onToggleNovo(false)} onCriado={onCriado} />
      )}

      {/* Descrição */}
      <div className="mt-2.5">
        <label className={lb}>Descrição *</label>
        <input value={it.descricao} onChange={e => onSet('descricao', e.target.value)} className={`${fld} ${!it.descricao.trim() ? 'border-rose-500/40' : ''}`} placeholder="nome do item na nota" />
      </div>

      {/* Fiscal / quantidade */}
      <div className="grid grid-cols-12 gap-2.5 mt-2.5">
        <div className="col-span-6 sm:col-span-2"><label className={lb}>NCM (8 díg.)</label><input inputMode="numeric" maxLength={8} value={it.ncm} onChange={e => onSet('ncm', soDigitos(e.target.value))} className={`${fld} font-mono`} placeholder="números" /></div>
        <div className="col-span-6 sm:col-span-2"><label className={lb}>Qtd *</label><input type="number" inputMode="decimal" min="0" step="0.001" value={it.quantidade} onChange={e => onSet('quantidade', e.target.value)} className={`${fld} text-right ${!(Number(it.quantidade) > 0) ? 'border-rose-500/40' : ''}`} /></div>
        <div className="col-span-4 sm:col-span-2"><label className={lb}>Un</label>
          <select value={UNIDADES.includes((it.unidade || '').toUpperCase()) ? it.unidade.toUpperCase() : (it.unidade || 'KG')} onChange={e => onSet('unidade', e.target.value)} className={fld}>
            {[...new Set([...(it.unidade && !UNIDADES.includes(it.unidade.toUpperCase()) ? [it.unidade] : []), ...UNIDADES])].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="col-span-8 sm:col-span-2"><label className={lb}>Vl Unit (R$)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={it.valorUnitario} onChange={e => onSet('valorUnitario', e.target.value)} className={`${fld} text-right`} placeholder="0,00" /></div>
        <div className="col-span-5 sm:col-span-2"><label className={lb}>Lote</label><input value={it.loteNumero} onChange={e => onSet('loteNumero', e.target.value.toUpperCase())} className={fld} placeholder="opcional" /></div>
        <div className="col-span-7 sm:col-span-2"><label className={lb}>Validade</label><input type="date" value={it.dataValidade} onChange={e => onSet('dataValidade', e.target.value)} className={fld} /></div>
      </div>
      <div className="text-right text-[12px] text-[#8E8F94] mt-2">Subtotal: <b className="text-[#5F6065]">{R$(subtotal)}</b></div>
    </div>
  );
}

/* Mini-formulário de cadastro imediato: cria o produto (fica vendável na hora) e vincula ao item. */
function QuickAddProduto({ it, onCancelar, onCriado }: { it: Item; onCancelar: () => void; onCriado: (prod: any) => void }) {
  const [codigoBarras, setCodigoBarras] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [vendidoPorPeso, setVendidoPorPeso] = useState((it.unidade || '').toUpperCase() === 'KG');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const cadastrar = async () => {
    if (!it.descricao.trim()) { setErro('Preencha a descrição do item antes de cadastrar.'); return; }
    setSalvando(true); setErro('');
    const payload = {
      descricao: it.descricao.trim(),
      codigoBarras: codigoBarras.trim() || null,
      ncm: soDigitos(it.ncm || '') || undefined,
      unidadeSigla: (it.unidade || 'KG').toUpperCase(),
      precoCompra: Number(it.valorUnitario) || undefined,
      precoVenda: Number(precoVenda) || 0,
      vendidoPorPeso,
    };
    try { const { data } = await api.post('/produtos', payload); onCriado(data); }
    catch (e: any) { setErro(e.response?.data?.message || 'Não foi possível cadastrar o produto.'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="mt-2.5 rounded-xl border border-[#0F8A72]/30 bg-[#0F8A72]/[0.05] p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-bold text-[#0B6F5C] uppercase tracking-wide"><PlusCircle className="h-3.5 w-3.5" /> Cadastrar produto na hora</div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-5"><label className={lb}>Código de barras (para bipar no caixa)</label><input inputMode="numeric" value={codigoBarras} onChange={e => setCodigoBarras(soDigitos(e.target.value))} className={`${fld} font-mono`} placeholder="opcional — bipe o produto" /></div>
        <div className="sm:col-span-3"><label className={lb}>Preço de venda (R$) *</label><input type="number" inputMode="decimal" min="0" step="0.01" value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} className={`${fld} text-right`} placeholder="0,00" /></div>
        <div className="sm:col-span-4 flex items-end">
          <label className="flex items-center gap-2 text-[13px] text-[#5F6065] pb-2"><input type="checkbox" checked={vendidoPorPeso} onChange={e => setVendidoPorPeso(e.target.checked)} className="accent-[#0F8A72] h-4 w-4" /> Vendido por peso (balança)</label>
        </div>
      </div>
      <p className="text-[11px] text-[#8E8F94] mt-2">Usa a descrição, NCM e unidade do item. Sem preço, o produto é criado a R$ 0,00 (você ajusta depois em Produtos).</p>
      {erro && <p className="text-[12px] text-[#c3352b] bg-rose-500/10 px-3 py-2 rounded-lg mt-2">{erro}</p>}
      <div className="flex justify-end gap-2 mt-2.5">
        <button onClick={onCancelar} className="px-3.5 py-2 rounded-lg text-[13px] text-[#5F6065] bg-white border border-[#E5E7EB] hover:bg-[#F7F7F8] transition-all">Cancelar</button>
        <button onClick={cadastrar} disabled={salvando} className="px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#0F8A72] hover:bg-[#13A184] disabled:opacity-40 flex items-center gap-1.5 shadow-[0_6px_18px_rgba(15,138,114,0.28)] transition-all active:scale-[0.98]">
          {salvando ? 'Cadastrando…' : <><Check className="h-4 w-4" /> Cadastrar e vincular</>}
        </button>
      </div>
    </div>
  );
}
