import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect } from 'react';
import { Apple, Pencil, Trash2, Package, Box, Tag, Copy, Barcode } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, StatusBadge, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, R$ } from '../ui';
import Menu from '../../../components/ui/Menu';

const CATEGORIAS = ['FRUTA', 'LEGUME', 'VERDURA'];
const CLASSIFICACOES = ['Extra', 'Tipo 1', 'Tipo 2', 'Graúdo', 'Médio', 'Miúdo'];
const CAIXARIAS = ['Caixa Madeira 20kg', 'Caixa Madeira 18kg', 'Caixa Plástica H (reutilizável)', 'Saca 50kg', 'Maço', 'Engradado'];
const UNIDADES = ['KG', 'CX', 'MAÇO', 'SACA', 'UN', 'DZ'];

// Ícone ilustrativo simples por nome/categoria
const emojiDe = (nome: string, cat?: string) => {
  const n = (nome || '').toLowerCase();
  if (n.includes('banana')) return '🍌'; if (n.includes('tomate')) return '🍅'; if (n.includes('maç') || n.includes('maca')) return '🍎';
  if (n.includes('laranja')) return '🍊'; if (n.includes('cebola')) return '🧅'; if (n.includes('batata')) return '🥔';
  if (n.includes('cenoura')) return '🥕'; if (n.includes('alface') || n.includes('verdura')) return '🥬'; if (n.includes('melancia')) return '🍉';
  if (n.includes('mamão') || n.includes('mamao')) return '🥭'; if (n.includes('uva')) return '🍇'; if (n.includes('milho')) return '🌽';
  if (n.includes('piment')) return '🫑'; if (n.includes('ovo')) return '🥚'; if (n.includes('abacaxi')) return '🍍'; if (n.includes('limão') || n.includes('limao')) return '🍋';
  return cat === 'LEGUME' ? '🥔' : cat === 'VERDURA' ? '🥬' : '🍏';
};

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
      <TopBar icon={<Apple className="h-5 w-5" />} titulo="Produtos & NCM" novoLabel="Novo Cadastro"
        subtitulo={`${filtrados.length} item(ns) — classificação, caixaria e NCM`} onNovo={() => setCriando(true)} />
      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar por nome, código ou código de barras...">
        <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'Todos' }, ...CATEGORIAS.map(c => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() }))]} />
      </FilterBar>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtrados.length === 0 ? <Vazio icon={<Package className="h-10 w-10" />} texto="Nenhum produto encontrado" /> : (
          <TableCard>
            <thead><tr>{['Produto', 'NCM', 'Categoria', 'Classificação', 'Caixaria', 'Estoque', 'Preço', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl w-7 text-center">{emojiDe(p.descricao, p.categoria)}</span>
                      <div><p className="font-semibold text-slate-100 truncate max-w-[200px]">{p.descricao}</p><p className="text-slate-500 text-xs font-mono">{p.codigo}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-400 text-xs">{p.ncm}</td>
                  <td className="px-3 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/60 text-slate-300">{p.categoria || '—'}</span></td>
                  <td className="px-3 py-1.5 text-slate-300 text-xs">{p.classificacao || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[140px]">{p.tipoCaixaria || '—'}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <span className="font-mono text-slate-200">{(Number(p.estoqueKg) || 0).toLocaleString('pt-BR')} kg</span>
                    {p.estoqueCaixas != null && <span className="text-slate-500 ml-1">· {Math.floor(p.estoqueCaixas)} cx</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-300">{R$(p.precoVenda)}</td>
                  <td className="px-3 py-1.5"><StatusBadge ativo={p.ativo} /></td>
                  <td className="px-3 py-1.5 text-right"><div className="flex justify-end">
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

      {(editando || criando) && <ModalProduto item={editando} onClose={() => { setEditando(null); setCriando(false); }} onSalvo={() => { setEditando(null); setCriando(false); carregar(); }} />}
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

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}
