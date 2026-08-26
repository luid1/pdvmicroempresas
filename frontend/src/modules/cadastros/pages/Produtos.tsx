import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Package, Box, Tag, Copy, Barcode, ShieldCheck, Ruler, Layers3 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, StatusBadge, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, R$ } from '../ui';
import Menu from '../../../components/ui/Menu';

const CATEGORIAS = ['FRUTA', 'LEGUME', 'VERDURA'];
const CLASSIFICACOES = ['Extra', 'Tipo 1', 'Tipo 2', 'Graúdo', 'Médio', 'Miúdo'];
const CAIXARIAS = ['Caixa Madeira 20kg', 'Caixa Madeira 18kg', 'Caixa Plástica H (reutilizável)', 'Saca 50kg', 'Maço', 'Engradado'];
const UNIDADES = ['KG', 'CX', 'MAÇO', 'SACA', 'UN', 'DZ'];

export default function Produtos() {
  const { pode } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [editando, setEditando] = useState<any | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/produtos', { params: { q: search || undefined } })
      .then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [search]);

  const filtrados = cat ? lista.filter(p => p.categoria === cat) : lista;

  // Taxonomia real: os chips saem das categorias que existem nos dados
  // (Mercearia, Bebidas, Higiene, Açougue, Limpeza…), não de uma lista fixa.
  const categorias = useMemo(
    () => Array.from(new Set(lista.map(p => (p.categoria || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lista],
  );

  const copiar = (texto: string, msg: string) => {
    navigator.clipboard?.writeText(String(texto ?? '')).then(() => toast(msg)).catch(() => toast('Não foi possível copiar.'));
  };

  const excluir = async (p: any) => {
    if (!await confirmDialog(`Inativar o produto "${p.descricao}"?`)) return;
    try { await api.delete(`/produtos/${p.id}`); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Não foi possível inativar.'); }
  };

  return (
    <CadastroShell>
      <TopBar icon={<Package className="h-5 w-5" />} titulo="Produtos & NCM" novoLabel="Novo Cadastro"
        subtitulo={`${filtrados.length} item(ns) — classificação, caixaria e NCM`} onNovo={() => setCriando(true)} />
      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar por nome, código ou código de barras...">
        <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'Todos' }, ...categorias.map(c => ({ value: c, label: c }))]} />
      </FilterBar>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtrados.length === 0 ? <Vazio icon={<Package className="h-10 w-10" />} texto="Nenhum produto encontrado" /> : (
          <TableCard>
            <thead><tr>{['Produto', 'NCM', 'Categoria', 'Classificação', 'Caixaria', 'Estoque', 'Preço', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                  <td className="px-3 py-1">
                    <p className="font-semibold text-[12.5px] leading-tight text-[#F7F8FA] truncate max-w-[240px]">{p.descricao}</p>
                    <p className="text-slate-500 text-[10.5px] font-mono leading-tight">{p.codigo}</p>
                  </td>
                  <td className="px-3 py-1 font-mono text-slate-400 text-xs">{p.ncm}</td>
                  <td className="px-3 py-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16181F] border border-[#23262F] text-[#8A90A0]">{p.categoria || '—'}</span></td>
                  <td className="px-3 py-1 text-[#8B8D98] text-xs">{p.classificacao || '—'}</td>
                  <td className="px-3 py-1 text-slate-400 text-xs truncate max-w-[140px]">{p.tipoCaixaria || '—'}</td>
                  <td className="px-3 py-1 text-xs">
                    <span className="font-mono text-[#8A90A0]">{(Number(p.estoqueKg) || 0).toLocaleString('pt-BR')} kg</span>
                    {p.estoqueCaixas != null && <span className="text-slate-500 ml-1">· {Math.floor(p.estoqueCaixas)} cx</span>}
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-[#8B8D98]">{R$(p.precoVenda)}</td>
                  <td className="px-3 py-1"><StatusBadge ativo={p.ativo} /></td>
                  <td className="px-3 py-1 text-right"><div className="flex justify-end">
                    <Menu items={[
                      { titulo: true, label: p.descricao },
                      ...(pode('/cadastros/produtos', 'EDITAR') ? [{ label: 'Editar', icon: <Pencil />, onClick: () => setEditando(p) }] : []),
                      { label: 'Copiar', icon: <Copy />, submenu: [
                        { label: 'Código', icon: <Tag />, atalho: p.codigo, onClick: () => copiar(p.codigo, 'Código copiado') },
                        { label: 'NCM', atalho: p.ncm, onClick: () => copiar(p.ncm, 'NCM copiado') },
                        ...(p.codigoBarras ? [{ label: 'Cód. de barras', icon: <Barcode />, onClick: () => copiar(p.codigoBarras, 'Código de barras copiado') }] : []),
                      ] },
                      ...(pode('/cadastros/produtos', 'EXCLUIR') ? [{ separador: true }, { label: 'Inativar', icon: <Trash2 />, perigo: true, onClick: () => excluir(p) }] : []),
                    ]} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {(editando || criando) && <ModalProdutoCompleto item={editando} onClose={() => { setEditando(null); setCriando(false); }} onSalvo={() => { setEditando(null); setCriando(false); carregar(); }} />}
    </CadastroShell>
  );
}

function ModalProduto({ item, onClose, onSalvo }: { item: any | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    descricao: item?.descricao || '', codigo: item?.codigo || '', codigoBarras: item?.codigoBarras || '',
    ncm: item?.ncm || '', categoria: item?.categoria || 'FRUTA', classificacao: item?.classificacao || '',
    unidadeSigla: item?.unidadeMedida?.sigla || 'KG', tipoCaixaria: item?.tipoCaixaria || '',
    pesoCaixaria: String(item?.pesoCaixaria ?? ''), pesoLiquido: String(item?.pesoLiquido ?? ''),
    precoVenda: String(item?.precoVenda ?? '0'),
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.descricao.trim()) return setErro('Informe o nome do produto.');
    setSalvando(true); setErro('');
    const payload = {
      descricao: f.descricao.trim(), codigo: f.codigo.trim() || undefined, codigoBarras: f.codigoBarras.trim() || null,
      ncm: f.ncm.trim() || '00000000', categoria: f.categoria, classificacao: f.classificacao || null,
      unidadeSigla: f.unidadeSigla, tipoCaixaria: f.tipoCaixaria || null,
      pesoCaixaria: f.pesoCaixaria === '' ? null : Number(f.pesoCaixaria),
      pesoLiquido: f.pesoLiquido === '' ? null : Number(f.pesoLiquido),
      precoVenda: Number(f.precoVenda) || 0,
    };
    try {
      if (item) await api.put(`/produtos/${item.id}`, payload); else await api.post('/produtos', payload);
      onSalvo();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal titulo={item ? 'Editar Produto' : 'Novo Produto'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={item ? 'Salvar' : 'Cadastrar'}>
      <SteppedForm>
        <Step title="Identificação" icon={<Tag className="h-3.5 w-3.5" />} hint="Avançar para classificação"
          complete={!!f.descricao.trim()}>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Nome do Produto *" className="col-span-4"><input value={f.descricao} onChange={e => set('descricao', e.target.value)} className={inp} placeholder="Ex: Tomate Italiano, Banana Nanica" /></Campo>
            <Campo label="Código" className="col-span-1"><input value={f.codigo} onChange={e => set('codigo', e.target.value)} className={inp} placeholder="auto" /></Campo>
            <Campo label="Cód. Barras" className="col-span-1"><input value={f.codigoBarras} onChange={e => set('codigoBarras', e.target.value)} className={inp} /></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="NCM"><input value={f.ncm} onChange={e => set('ncm', e.target.value)} className={inp} placeholder="0702.00.00" /></Campo>
            <Campo label="Categoria"><select value={f.categoria} onChange={e => set('categoria', e.target.value)} className={inp}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></Campo>
            <Campo label="Unidade Comercial"><select value={f.unidadeSigla} onChange={e => set('unidadeSigla', e.target.value)} className={inp}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></Campo>
          </div>
        </Step>

        <Step title="Classificação, caixaria & preço (FLV)" icon={<Box className="h-3.5 w-3.5" />} complete={false}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Classificação / Calibre">
              <input list="classes" value={f.classificacao} onChange={e => set('classificacao', e.target.value)} className={inp} placeholder="Tipo 1, Graúdo..." />
              <datalist id="classes">{CLASSIFICACOES.map(c => <option key={c} value={c} />)}</datalist>
            </Campo>
            <Campo label="Tipo de Caixaria">
              <input list="caixas" value={f.tipoCaixaria} onChange={e => set('tipoCaixaria', e.target.value)} className={inp} placeholder="Caixa Madeira 20kg..." />
              <datalist id="caixas">{CAIXARIAS.map(c => <option key={c} value={c} />)}</datalist>
            </Campo>
            <Campo label="Peso Líq. Médio/Caixa (kg)"><input type="number" step="0.001" value={f.pesoCaixaria} onChange={e => set('pesoCaixaria', e.target.value)} className={inp} placeholder="20" /></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Peso Unitário (kg)"><input type="number" step="0.001" value={f.pesoLiquido} onChange={e => set('pesoLiquido', e.target.value)} className={inp} /></Campo>
            <Campo label="Preço de Venda (R$)"><input type="number" step="0.01" value={f.precoVenda} onChange={e => set('precoVenda', e.target.value)} className={inp} /></Campo>
          </div>
          <p className="text-[11px] text-slate-500">O estoque (kg/caixas) vem das movimentações de entrada/saída — não é editado aqui.</p>
        </Step>
      </SteppedForm>

      {erro && <p className="text-xs text-[#FF6B7A] bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}

const vazio = (v: any) => v === null || v === undefined ? '' : String(v);
const numeroOuNull = (v: string) => v.trim() === '' ? null : Number(v);

/** Cadastro organizado por identificação, fiscal, comercial e logística. */
function ModalProdutoCompleto({ item, onClose, onSalvo }: { item: any | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Record<string, any>>({
    descricao: item?.descricao || '', descricaoCompleta: item?.descricaoCompleta || '', descricaoFiscal: item?.descricaoFiscal || '',
    codigo: item?.codigo || '', codigoBarras: item?.codigoBarras || '', codigoBarrasSecun: item?.codigoBarrasSecun || '',
    codigoBarrasCaixa: item?.codigoBarrasCaixa || '', gtinTributavel: item?.gtinTributavel || '', skuFornecedor: item?.skuFornecedor || '',
    referencia: item?.referencia || '', fabricante: item?.fabricante || '', marca: item?.marca || '',
    categoria: item?.categoria || 'FRUTA', grupo: item?.grupo || '', subgrupo: item?.subgrupo || '', classificacao: item?.classificacao || '',
    unidadeSigla: item?.unidadeMedida?.sigla || 'KG', ncm: item?.ncm || '', cest: item?.cest || '', cfop: item?.cfop || '',
    exTipi: item?.exTipi || '', codigoBeneficioFiscal: item?.codigoBeneficioFiscal || '', generoItem: item?.generoItem || '',
    cstIcms: item?.cstIcms || '', cstPis: item?.cstPis || '', cstCofins: item?.cstCofins || '',
    aliquotaIcms: vazio(item?.aliquotaIcms), aliquotaPis: vazio(item?.aliquotaPis), aliquotaCofins: vazio(item?.aliquotaCofins),
    cstIbsCbs: item?.cstIbsCbs || '', classTribIbsCbs: item?.classTribIbsCbs || '', aliquotaIbsUf: vazio(item?.aliquotaIbsUf), aliquotaIbsMun: vazio(item?.aliquotaIbsMun), aliquotaCbs: vazio(item?.aliquotaCbs),
    precoCompra: vazio(item?.precoCompra), precoVenda: vazio(item?.precoVenda), pesoLiquido: vazio(item?.pesoLiquido), pesoBruto: vazio(item?.pesoBruto),
    tipoCaixaria: item?.tipoCaixaria || '', pesoCaixaria: vazio(item?.pesoCaixaria), quantidadeEmbalagem: vazio(item?.quantidadeEmbalagem ?? 1),
    multiploCompra: vazio(item?.multiploCompra ?? 1), alturaCm: vazio(item?.alturaCm), larguraCm: vazio(item?.larguraCm), comprimentoCm: vazio(item?.comprimentoCm),
    estoqueMinimo: vazio(item?.estoqueMinimo), estoqueMaximo: vazio(item?.estoqueMaximo), estoqueSeguranca: vazio(item?.estoqueSeguranca),
    pontoReposicao: vazio(item?.pontoReposicao), leadTimeDias: vazio(item?.leadTimeDias ?? 0), localizacaoPadrao: item?.localizacaoPadrao || '',
    requerLote: !!item?.requerLote, requerValidade: !!item?.requerValidade, vendidoPorPeso: !!item?.vendidoPorPeso,
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const text = ['codigoBarras', 'codigoBarrasSecun', 'codigoBarrasCaixa', 'gtinTributavel', 'skuFornecedor', 'referencia', 'fabricante', 'marca', 'grupo', 'subgrupo', 'classificacao', 'descricaoCompleta', 'descricaoFiscal', 'cest', 'cfop', 'exTipi', 'codigoBeneficioFiscal', 'generoItem', 'cstIcms', 'cstPis', 'cstCofins', 'cstIbsCbs', 'classTribIbsCbs', 'tipoCaixaria', 'localizacaoPadrao'];
  const nums = ['aliquotaIcms', 'aliquotaPis', 'aliquotaCofins', 'aliquotaIbsUf', 'aliquotaIbsMun', 'aliquotaCbs', 'precoCompra', 'precoVenda', 'pesoLiquido', 'pesoBruto', 'pesoCaixaria', 'quantidadeEmbalagem', 'multiploCompra', 'alturaCm', 'larguraCm', 'comprimentoCm', 'estoqueMinimo', 'estoqueMaximo', 'estoqueSeguranca', 'pontoReposicao'];
  const salvar = async () => {
    if (!String(f.descricao).trim()) return setErro('Informe o nome do produto.');
    if (!String(f.ncm).replace(/\D/g, '').match(/^\d{8}$/)) return setErro('O NCM deve ter 8 dígitos.');
    const payload: any = { descricao: String(f.descricao).trim(), codigo: String(f.codigo).trim() || undefined, ncm: String(f.ncm).replace(/\D/g, ''), categoria: f.categoria, unidadeSigla: f.unidadeSigla, requerLote: f.requerLote, requerValidade: f.requerValidade, vendidoPorPeso: f.vendidoPorPeso, leadTimeDias: Number(f.leadTimeDias || 0) };
    text.forEach(k => payload[k] = String(f[k] || '').trim() || null);
    nums.forEach(k => payload[k] = numeroOuNull(String(f[k] ?? '')));
    setSalvando(true); setErro('');
    try { item ? await api.put(`/produtos/${item.id}`, payload) : await api.post('/produtos', payload); onSalvo(); }
    catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar o produto.'); }
    finally { setSalvando(false); }
  };
  const I = ({ k, type = 'text', placeholder = '' }: { k: string; type?: string; placeholder?: string }) => <input type={type} step={type === 'number' ? '0.001' : undefined} value={f[k]} onChange={e => set(k, e.target.value)} className={inp} placeholder={placeholder} />;

  return <Modal titulo={item ? 'Editar Produto' : 'Novo Produto'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={item ? 'Salvar alterações' : 'Cadastrar produto'}>
    <SteppedForm>
      <Step title="Identificação e códigos" icon={<Barcode className="h-3.5 w-3.5" />} hint="SKU, GTIN e descrição" complete={!!f.descricao && !!f.ncm}>
        <div className="grid grid-cols-6 gap-3"><Campo label="Descrição *" className="col-span-4"><I k="descricao" placeholder="Nome comercial do produto" /></Campo><Campo label="SKU / Código interno" className="col-span-2"><I k="codigo" placeholder="Gerado automaticamente" /></Campo></div>
        <div className="grid grid-cols-2 gap-3"><Campo label="Descrição completa"><I k="descricaoCompleta" /></Campo><Campo label="Descrição fiscal"><I k="descricaoFiscal" placeholder="Texto que aparece na NF-e" /></Campo></div>
        <div className="grid grid-cols-4 gap-3"><Campo label="GTIN/EAN principal"><I k="codigoBarras" /></Campo><Campo label="GTIN secundário"><I k="codigoBarrasSecun" /></Campo><Campo label="GTIN tributável"><I k="gtinTributavel" /></Campo><Campo label="Caixa / DUN-14"><I k="codigoBarrasCaixa" /></Campo></div>
        <div className="grid grid-cols-4 gap-3"><Campo label="SKU fornecedor"><I k="skuFornecedor" /></Campo><Campo label="Referência"><I k="referencia" /></Campo><Campo label="Fabricante"><I k="fabricante" /></Campo><Campo label="Marca"><I k="marca" /></Campo></div>
        <div className="grid grid-cols-4 gap-3"><Campo label="Categoria"><I k="categoria" /></Campo><Campo label="Grupo"><I k="grupo" /></Campo><Campo label="Subgrupo"><I k="subgrupo" /></Campo><Campo label="Classificação"><I k="classificacao" /></Campo></div>
      </Step>

      <Step title="Fiscal e tributário" icon={<ShieldCheck className="h-3.5 w-3.5" />} hint="Classificação usada no motor fiscal" complete={String(f.ncm).replace(/\D/g, '').length === 8}>
        <div className="grid grid-cols-6 gap-3"><Campo label="NCM *"><I k="ncm" placeholder="8 dígitos" /></Campo><Campo label="CEST"><I k="cest" /></Campo><Campo label="CFOP padrão"><I k="cfop" /></Campo><Campo label="EX TIPI"><I k="exTipi" /></Campo><Campo label="cBenef"><I k="codigoBeneficioFiscal" /></Campo><Campo label="Gênero"><I k="generoItem" /></Campo></div>
        <div className="grid grid-cols-6 gap-3"><Campo label="CST/CSOSN ICMS"><I k="cstIcms" /></Campo><Campo label="Alíquota ICMS %"><I k="aliquotaIcms" type="number" /></Campo><Campo label="CST PIS"><I k="cstPis" /></Campo><Campo label="Alíquota PIS %"><I k="aliquotaPis" type="number" /></Campo><Campo label="CST COFINS"><I k="cstCofins" /></Campo><Campo label="Alíquota COFINS %"><I k="aliquotaCofins" type="number" /></Campo></div>
        <div className="grid grid-cols-5 gap-3"><Campo label="CST IBS/CBS"><I k="cstIbsCbs" placeholder="000" /></Campo><Campo label="cClassTrib"><I k="classTribIbsCbs" placeholder="000001" /></Campo><Campo label="IBS UF %"><I k="aliquotaIbsUf" type="number" /></Campo><Campo label="IBS Município %"><I k="aliquotaIbsMun" type="number" /></Campo><Campo label="CBS %"><I k="aliquotaCbs" type="number" /></Campo></div>
        <p className="rounded-lg bg-[#FF9F45]/12 px-3 py-2 text-[10px] text-[#FF9F45]">Esses campos classificam o produto. A alíquota final deve vir da Matriz Fiscal conforme UF, operação, regime e destinatário.</p>
      </Step>

      <Step title="Comercial e estoque" icon={<Layers3 className="h-3.5 w-3.5" />} hint="Preço, unidade e política de reposição" complete={Number(f.precoVenda) >= 0}>
        <div className="grid grid-cols-4 gap-3"><Campo label="Unidade comercial"><select value={f.unidadeSigla} onChange={e => set('unidadeSigla', e.target.value)} className={inp}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></Campo><Campo label="Preço de compra"><I k="precoCompra" type="number" /></Campo><Campo label="Preço de venda"><I k="precoVenda" type="number" /></Campo><Campo label="Múltiplo de compra"><I k="multiploCompra" type="number" /></Campo></div>
        <div className="grid grid-cols-5 gap-3"><Campo label="Estoque mínimo"><I k="estoqueMinimo" type="number" /></Campo><Campo label="Estoque máximo"><I k="estoqueMaximo" type="number" /></Campo><Campo label="Estoque de segurança"><I k="estoqueSeguranca" type="number" /></Campo><Campo label="Ponto de reposição"><I k="pontoReposicao" type="number" /></Campo><Campo label="Lead time (dias)"><I k="leadTimeDias" type="number" /></Campo></div>
        <div className="flex flex-wrap gap-4">{[['requerLote', 'Controla lote'], ['requerValidade', 'Controla validade'], ['vendidoPorPeso', 'Vendido por peso/balança']].map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} /> {l}</label>)}</div>
      </Step>

      <Step title="Embalagem e logística" icon={<Ruler className="h-3.5 w-3.5" />} complete={false}>
        <div className="grid grid-cols-4 gap-3"><Campo label="Tipo de embalagem/caixaria"><I k="tipoCaixaria" /></Campo><Campo label="Qtd. por embalagem"><I k="quantidadeEmbalagem" type="number" /></Campo><Campo label="Peso líquido (kg)"><I k="pesoLiquido" type="number" /></Campo><Campo label="Peso bruto (kg)"><I k="pesoBruto" type="number" /></Campo></div>
        <div className="grid grid-cols-4 gap-3"><Campo label="Altura (cm)"><I k="alturaCm" type="number" /></Campo><Campo label="Largura (cm)"><I k="larguraCm" type="number" /></Campo><Campo label="Comprimento (cm)"><I k="comprimentoCm" type="number" /></Campo><Campo label="Localização padrão"><I k="localizacaoPadrao" placeholder="Rua A · Prateleira 03" /></Campo></div>
        <p className="text-[11px] text-slate-500">O saldo não é digitado no cadastro: entradas, inventários, vendas e transferências entre filiais atualizam o estoque com histórico.</p>
      </Step>
    </SteppedForm>
    {erro && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-[#FF6B7A]">{erro}</p>}
  </Modal>;
}
