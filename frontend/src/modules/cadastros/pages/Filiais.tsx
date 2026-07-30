import { useState, useEffect } from 'react';
import { Warehouse, Pencil, Snowflake, Building2, User } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, StatusBadge, OcupacaoBar, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, UFS } from '../ui';

const TIPOS = ['BOX_CEASA', 'MATRIZ', 'FILIAL', 'DEPOSITO'];
const TIPO_LABEL: Record<string, string> = { BOX_CEASA: 'Box Ceasa', MATRIZ: 'Matriz', FILIAL: 'Filial', DEPOSITO: 'Depósito' };

export default function Filiais() {
  const { pode } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editando, setEditando] = useState<any | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/filiais').then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const filtrados = lista.filter(f => !search.trim() || (f.nome || '').toLowerCase().includes(search.toLowerCase()) || (f.responsavel || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <CadastroShell>
      <TopBar icon={<Warehouse className="h-5 w-5" />} titulo="Filiais / Boxes" novoLabel="Novo Box"
        subtitulo={`${filtrados.length} local(is) de venda e estoque`} onNovo={() => setCriando(true)} />
      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar por box / pavilhão ou responsável..." />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtrados.length === 0 ? <Vazio icon={<Warehouse className="h-10 w-10" />} texto="Nenhum box cadastrado" /> : (
          <TableCard>
            <thead><tr>{['Box / Identificação', 'Tipo', 'CNPJ', 'Responsável', 'Câmara Fria', 'Ocupação (paletes)', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtrados.map(f => {
                const cap = Number(f.capacidadePaletes) || 0;
                const ocup = Number(f.ocupacaoPaletes) || 0;
                const pct = cap > 0 ? (ocup / cap) * 100 : 0;
                return (
                  <tr key={f.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                    <td className="px-3 py-1.5"><p className="font-semibold text-slate-100">{f.nome}</p><p className="text-slate-500 text-xs font-mono">{f.codigo}</p></td>
                    <td className="px-3 py-1.5 text-slate-300 text-xs">{TIPO_LABEL[f.tipo] || f.tipo}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-400 text-xs">{f.cnpj || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-300">{f.responsavel || '—'}</td>
                    <td className="px-3 py-1.5 text-center">{f.camaraFria ? <Snowflake className="h-4 w-4 text-cyan-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-1.5">{cap > 0 ? <OcupacaoBar pct={pct} /> : <span className="text-slate-600 text-xs">não definida</span>}</td>
                    <td className="px-3 py-1.5"><StatusBadge ativo={f.ativo} /></td>
                    <td className="px-3 py-1.5">
                      {pode('/cadastros/filiais', 'EDITAR') && <button onClick={() => setEditando(f)} className="text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-1 rounded font-semibold hover:bg-sky-500/20 flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
      </div>

      {(editando || criando) && <ModalFilial item={editando} onClose={() => { setEditando(null); setCriando(false); }} onSalvo={() => { setEditando(null); setCriando(false); carregar(); }} />}
    </CadastroShell>
  );
}

function ModalFilial({ item, onClose, onSalvo }: { item: any | null; onClose: () => void; onSalvo: () => void }) {
  const ed = item?.endereco || {};
  const [f, setF] = useState({
    nome: item?.nome || '', codigo: item?.codigo || '', tipo: item?.tipo || 'BOX_CEASA', cnpj: item?.cnpj || '',
    ie: item?.ie || '', responsavel: item?.responsavel || '', capacidadePaletes: String(item?.capacidadePaletes ?? ''),
    ocupacaoPaletes: String(item?.ocupacaoPaletes ?? '0'), camaraFria: item?.camaraFria ?? false, ativo: item?.ativo ?? true,
    rua: ed.rua || '', cidade: ed.cidade || '', uf: ed.uf || 'SP',
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.nome.trim()) return setErro('Informe a identificação do box / filial.');
    setSalvando(true); setErro('');
    const payload: any = {
      nome: f.nome.trim(), tipo: f.tipo, cnpj: f.cnpj.trim() || null, ie: f.ie.trim() || null,
      responsavel: f.responsavel.trim() || null,
      capacidadePaletes: f.capacidadePaletes === '' ? null : Number(f.capacidadePaletes),
      ocupacaoPaletes: Number(f.ocupacaoPaletes) || 0, camaraFria: f.camaraFria, ativo: f.ativo,
      endereco: { rua: f.rua, cidade: f.cidade, uf: f.uf },
    };
    if (item) payload.codigo = item.codigo; else if (f.codigo.trim()) payload.codigo = f.codigo.trim();
    try {
      if (item) await api.put(`/filiais/${item.id}`, payload); else await api.post('/filiais', payload);
      onSalvo();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal titulo={item ? 'Editar Box / Filial' : 'Novo Box / Filial'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={item ? 'Salvar' : 'Cadastrar'}>
      <SteppedForm>
        <Step title="Identificação" icon={<Building2 className="h-3.5 w-3.5" />} hint="Avançar para operação"
          complete={!!f.nome.trim()}>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Nome / Box *" className="col-span-4"><input value={f.nome} onChange={e => set('nome', e.target.value)} className={inp} placeholder="Ex: Box 12 - Pavilhão G" /></Campo>
            <Campo label="Código" className="col-span-2"><input value={f.codigo} onChange={e => set('codigo', e.target.value)} className={inp} placeholder="auto" disabled={!!item} /></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo"><select value={f.tipo} onChange={e => set('tipo', e.target.value)} className={inp}>{TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}</select></Campo>
            <Campo label="CNPJ atrelado"><input value={f.cnpj} onChange={e => set('cnpj', e.target.value)} className={inp} /></Campo>
            <Campo label="Inscrição Estadual"><input value={f.ie} onChange={e => set('ie', e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Operação & armazenagem" icon={<User className="h-3.5 w-3.5" />} hint="Avançar para localização"
          complete={!!(f.responsavel.trim() || f.capacidadePaletes)}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Responsável / Gerente"><input value={f.responsavel} onChange={e => set('responsavel', e.target.value)} className={inp} /></Campo>
            <Campo label="Capacidade (paletes)"><input type="number" min="0" value={f.capacidadePaletes} onChange={e => set('capacidadePaletes', e.target.value)} className={inp} /></Campo>
            <Campo label="Ocupação atual (paletes)"><input type="number" min="0" value={f.ocupacaoPaletes} onChange={e => set('ocupacaoPaletes', e.target.value)} className={inp} /></Campo>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={f.camaraFria} onChange={e => set('camaraFria', e.target.checked)} className="accent-cyan-500 h-4 w-4" />
            <Snowflake className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-slate-200">Possui <b>câmara fria</b> / refrigeração</span>
          </label>
        </Step>

        <Step title="Localização" icon={<Warehouse className="h-3.5 w-3.5" />} complete={false}>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Endereço" className="col-span-4"><input value={f.rua} onChange={e => set('rua', e.target.value)} className={inp} /></Campo>
            <Campo label="Cidade" className="col-span-1"><input value={f.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></Campo>
            <Campo label="UF" className="col-span-1"><select value={f.uf} onChange={e => set('uf', e.target.value)} className={inp}>{UFS.map(u => <option key={u}>{u}</option>)}</select></Campo>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => set('ativo', !f.ativo)} className={`rounded-lg px-4 py-2 text-sm font-bold border ${f.ativo ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/15 text-rose-300 border-rose-500/40'}`}>{f.ativo ? 'ATIVO' : 'INATIVO'}</button>
          </div>
        </Step>
      </SteppedForm>

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}
