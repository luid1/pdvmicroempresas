import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect } from 'react';
import { Sprout, Pencil, Trash2, Building2, MapPin, Landmark, Handshake } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, StatusBadge, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, UFS } from '../ui';

const PARCERIA: Record<string, { label: string; cor: string }> = {
  COMPRA_DIRETA: { label: 'Compra Direta', cor: 'bg-sky-500/15 text-sky-300' },
  CONSIGNACAO: { label: 'Consignação', cor: 'bg-violet-500/15 text-violet-300' },
};

export default function Fornecedores() {
  const { pode } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('');
  const [editando, setEditando] = useState<any | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/fornecedores', { params: { search: search || undefined, tipoParceria: tipo || undefined } })
      .then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [search, tipo]);

  const excluir = async (f: any) => {
    if (!await confirmDialog(`Excluir o fornecedor "${f.razaoSocial}"?`)) return;
    try { await api.delete(`/fornecedores/${f.id}`); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Não foi possível excluir.'); }
  };

  return (
    <CadastroShell>
      <TopBar icon={<Sprout className="h-5 w-5" />} titulo="Fornecedores" novoLabel="Novo Cadastro"
        subtitulo={`${lista.length} produtor(es) rural(is) e parceiros`} onNovo={() => setCriando(true)} />
      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar por nome, CPF/CNPJ ou propriedade...">
        <Chips value={tipo} onChange={setTipo} options={[
          { value: '', label: 'Todos' },
          { value: 'COMPRA_DIRETA', label: 'Compra Direta' },
          { value: 'CONSIGNACAO', label: 'Consignação' },
        ]} />
      </FilterBar>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<Sprout className="h-10 w-10" />} texto="Nenhum fornecedor cadastrado" /> : (
          <TableCard>
            <thead><tr>{['Produtor / Razão Social', 'CPF/CNPJ', 'Insc. Rural', 'Propriedade', 'Parceria', 'PIX', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(f => (
                <tr key={f.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-1.5"><p className="font-semibold text-slate-100 truncate max-w-[220px]">{f.razaoSocial}</p>{f.nomeFantasia && <p className="text-slate-500 text-xs">{f.nomeFantasia}</p>}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-400 text-xs">{f.cnpj}</td>
                  <td className="px-3 py-1.5 text-slate-400 text-xs">{f.inscricaoRural || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-300">{f.localizacaoPropriedade || '—'}</td>
                  <td className="px-3 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PARCERIA[f.tipoParceria]?.cor || 'bg-slate-700 text-slate-300'}`}>{PARCERIA[f.tipoParceria]?.label || f.tipoParceria}</span></td>
                  <td className="px-3 py-1.5 font-mono text-slate-400 text-xs truncate max-w-[120px]">{f.pix || '—'}</td>
                  <td className="px-3 py-1.5"><StatusBadge ativo={f.ativo} /></td>
                  <td className="px-3 py-1.5"><div className="flex gap-1.5">
                    {pode('/cadastros/fornecedores', 'EDITAR') && <button onClick={() => setEditando(f)} className="text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-1 rounded font-semibold hover:bg-sky-500/20 flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar</button>}
                    {pode('/cadastros/fornecedores', 'EXCLUIR') && <button onClick={() => excluir(f)} className="text-slate-500 hover:text-rose-400 px-1"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {(editando || criando) && <ModalFornecedor item={editando} onClose={() => { setEditando(null); setCriando(false); }} onSalvo={() => { setEditando(null); setCriando(false); carregar(); }} />}
    </CadastroShell>
  );
}

function ModalFornecedor({ item, onClose, onSalvo }: { item: any | null; onClose: () => void; onSalvo: () => void }) {
  const ed = item?.enderecoJson || {}; const db = item?.dadosBancarios || {};
  const [f, setF] = useState({
    razaoSocial: item?.razaoSocial || '', nomeFantasia: item?.nomeFantasia || '', cnpj: item?.cnpj || '',
    ie: item?.ie || '', inscricaoRural: item?.inscricaoRural || '', localizacaoPropriedade: item?.localizacaoPropriedade || '',
    tipoParceria: item?.tipoParceria || 'COMPRA_DIRETA', telefone: item?.telefone || '', email: item?.email || '',
    prazoEntrega: String(item?.prazoEntrega ?? '1'), pix: item?.pix || '', ativo: item?.ativo ?? true,
    banco: db.banco || '', agencia: db.agencia || '', conta: db.conta || '',
    cidade: ed.cidade || '', uf: ed.uf || 'SP',
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.razaoSocial.trim()) return setErro('Informe o nome do produtor / razão social.');
    if (!f.cnpj.trim()) return setErro('Informe o CPF/CNPJ.');
    setSalvando(true); setErro('');
    const payload = {
      razaoSocial: f.razaoSocial.trim(), nomeFantasia: f.nomeFantasia.trim() || null, cnpj: f.cnpj.trim(),
      ie: f.ie.trim() || null, inscricaoRural: f.inscricaoRural.trim() || null,
      localizacaoPropriedade: f.localizacaoPropriedade.trim() || null, tipoParceria: f.tipoParceria,
      telefone: f.telefone.trim() || null, email: f.email.trim() || null, prazoEntrega: parseInt(f.prazoEntrega) || 1,
      pix: f.pix.trim() || null, ativo: f.ativo,
      dadosBancarios: { banco: f.banco, agencia: f.agencia, conta: f.conta },
      enderecoJson: { cidade: f.cidade, uf: f.uf },
    };
    try {
      if (item) await api.put(`/fornecedores/${item.id}`, payload); else await api.post('/fornecedores', payload);
      onSalvo();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal titulo={item ? 'Editar Fornecedor' : 'Novo Fornecedor'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={item ? 'Salvar' : 'Cadastrar'}>
      <SteppedForm>
        <Step title="Produtor rural / parceiro" icon={<Building2 className="h-3.5 w-3.5" />} hint="Avançar para localização"
          complete={!!f.razaoSocial.trim() && !!f.cnpj.trim()}>
          <Campo label="Nome do Produtor / Razão Social *"><input value={f.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} className={inp} /></Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="CPF / CNPJ *"><input value={f.cnpj} onChange={e => set('cnpj', e.target.value)} className={inp} /></Campo>
            <Campo label="Inscrição Estadual"><input value={f.ie} onChange={e => set('ie', e.target.value)} className={inp} /></Campo>
            <Campo label="Inscrição de Produtor Rural"><input value={f.inscricaoRural} onChange={e => set('inscricaoRural', e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Localização" icon={<MapPin className="h-3.5 w-3.5" />} hint="Avançar para parceria"
          complete={!!(f.localizacaoPropriedade.trim() || f.cidade.trim())}>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Propriedade / Sítio / Município" className="col-span-4"><input value={f.localizacaoPropriedade} onChange={e => set('localizacaoPropriedade', e.target.value)} className={inp} placeholder="Ex: Sítio Boa Esperança — Mogi das Cruzes" /></Campo>
            <Campo label="Cidade"><input value={f.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></Campo>
            <Campo label="UF"><select value={f.uf} onChange={e => set('uf', e.target.value)} className={inp}>{UFS.map(u => <option key={u}>{u}</option>)}</select></Campo>
          </div>
        </Step>

        <Step title="Parceria" icon={<Handshake className="h-3.5 w-3.5" />} hint="Avançar para dados de acerto"
          complete={!!f.tipoParceria}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo de Parceria">
              <select value={f.tipoParceria} onChange={e => set('tipoParceria', e.target.value)} className={inp}>
                <option value="COMPRA_DIRETA">Compra Direta</option>
                <option value="CONSIGNACAO">Consignação / Comissão</option>
              </select>
            </Campo>
            <Campo label="Prazo de Entrega (dias)"><input type="number" min="0" value={f.prazoEntrega} onChange={e => set('prazoEntrega', e.target.value)} className={inp} /></Campo>
            <Campo label="Telefone"><input value={f.telefone} onChange={e => set('telefone', e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Dados para acerto (Pix / conta)" icon={<Landmark className="h-3.5 w-3.5" />} complete={false}>
          <div className="grid grid-cols-4 gap-3">
            <Campo label="Chave PIX" className="col-span-2"><input value={f.pix} onChange={e => set('pix', e.target.value)} className={inp} placeholder="CPF/CNPJ, e-mail, telefone..." /></Campo>
            <Campo label="Banco"><input value={f.banco} onChange={e => set('banco', e.target.value)} className={inp} /></Campo>
            <Campo label="E-mail"><input value={f.email} onChange={e => set('email', e.target.value)} className={inp} /></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Agência"><input value={f.agencia} onChange={e => set('agencia', e.target.value)} className={inp} /></Campo>
            <Campo label="Conta"><input value={f.conta} onChange={e => set('conta', e.target.value)} className={inp} /></Campo>
            <Campo label="Situação">
              <button type="button" onClick={() => set('ativo', !f.ativo)} className={`w-full rounded-lg px-3 py-2 text-sm font-bold border ${f.ativo ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/15 text-rose-300 border-rose-500/40'}`}>{f.ativo ? 'ATIVO' : 'INATIVO'}</button>
            </Campo>
          </div>
        </Step>
      </SteppedForm>

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}
