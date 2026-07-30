import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect } from 'react';
import { Users, Pencil, Trash2, Building2, MapPin, Phone, QrCode } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, FilterBar, TableCard, Th, StatusBadge, Modal, SteppedForm, Step, Campo, Loader, Vazio, inp, UFS, R$ } from '../ui';

interface Cliente {
  id: string; tipo: string; razaoSocial: string; nomeFantasia: string | null; cnpjCpf: string;
  ie: string | null; email: string | null; telefone: string | null; celular: string | null;
  enderecoJson: any; contatoJson: any; limiteCredito: string; prazoMedio: number;
  observacoes: string | null; ativo: boolean; exigeRastreabilidade?: boolean;
}

export default function Clientes() {
  const { pode } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/clientes', { params: { search: search || undefined } })
      .then(r => setClientes(r.data)).catch(() => setClientes([])).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [search]);

  const excluir = async (c: Cliente) => {
    if (!await confirmDialog(`Excluir o cliente "${c.nomeFantasia || c.razaoSocial}"?`)) return;
    try { await api.delete(`/clientes/${c.id}`); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Não foi possível excluir (cliente pode ter pedidos vinculados).'); }
  };

  return (
    <CadastroShell>
      <TopBar icon={<Users className="h-5 w-5" />} titulo="Clientes" novoLabel="Novo Cadastro"
        subtitulo={`${clientes.length} comprador(es) — supermercados, sacolões e varejões`}
        onNovo={() => setCriando(true)} />
      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar por razão social, fantasia ou CNPJ/CPF..." />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : clientes.length === 0 ? <Vazio icon={<Users className="h-10 w-10" />} texto="Nenhum cliente encontrado" /> : (
          <TableCard>
            <thead><tr>
              {['Cliente', 'CNPJ/CPF', 'Cidade/UF', 'Limite', 'Prazo', 'Rastreio', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-1.5">
                    <p className="font-semibold text-slate-100 truncate max-w-[240px]">{c.nomeFantasia || c.razaoSocial}</p>
                    {c.nomeFantasia && <p className="text-slate-500 text-xs truncate max-w-[240px]">{c.razaoSocial}</p>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-400 text-xs">{c.cnpjCpf}</td>
                  <td className="px-3 py-1.5 text-slate-300">{c.enderecoJson?.cidade ? `${c.enderecoJson.cidade}/${c.enderecoJson.uf || ''}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-300">{R$(c.limiteCredito)}</td>
                  <td className="px-3 py-1.5 text-center text-slate-400">{c.prazoMedio}d</td>
                  <td className="px-3 py-1.5 text-center">{c.exigeRastreabilidade ? <QrCode className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-1.5"><StatusBadge ativo={c.ativo} inativoLabel="BLOQUEADO" /></td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1.5">
                      {pode('/cadastros/clientes', 'EDITAR') && <button onClick={() => setEditando(c)} className="text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-1 rounded font-semibold hover:bg-sky-500/20 flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar</button>}
                      {pode('/cadastros/clientes', 'EXCLUIR') && <button onClick={() => excluir(c)} className="text-slate-500 hover:text-rose-400 px-1"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {(editando || criando) && (
        <ModalCliente cliente={editando} onClose={() => { setEditando(null); setCriando(false); }}
          onSalvo={() => { setEditando(null); setCriando(false); carregar(); }} />
      )}
    </CadastroShell>
  );
}

function ModalCliente({ cliente, onClose, onSalvo }: { cliente: Cliente | null; onClose: () => void; onSalvo: () => void }) {
  const ed = cliente?.enderecoJson || {}; const ct = cliente?.contatoJson || {};
  const [f, setF] = useState({
    tipo: cliente?.tipo || 'PJ', razaoSocial: cliente?.razaoSocial || '', nomeFantasia: cliente?.nomeFantasia || '',
    cnpjCpf: cliente?.cnpjCpf || '', ie: cliente?.ie || '', email: cliente?.email || '',
    telefone: cliente?.telefone || '', celular: cliente?.celular || '',
    limiteCredito: String(cliente?.limiteCredito ?? '0'), prazoMedio: String(cliente?.prazoMedio ?? '30'),
    ativo: cliente?.ativo ?? true, exigeRastreabilidade: cliente?.exigeRastreabilidade ?? false, observacoes: cliente?.observacoes || '',
    rua: ed.rua || '', numero: ed.numero || '', bairro: ed.bairro || '', cidade: ed.cidade || '', uf: ed.uf || 'SP', cep: ed.cep || '',
    ctNome: ct.nome || '', ctCargo: ct.cargo || '', ctTel: ct.telefone || '',
  });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.razaoSocial.trim()) return setErro('Informe a razão social / nome.');
    if (!f.cnpjCpf.trim()) return setErro('Informe o CNPJ/CPF.');
    setSalvando(true); setErro('');
    const payload = {
      tipo: f.tipo, razaoSocial: f.razaoSocial.trim(), nomeFantasia: f.nomeFantasia.trim() || null,
      cnpjCpf: f.cnpjCpf.trim(), ie: f.ie.trim() || null, email: f.email.trim() || null,
      telefone: f.telefone.trim() || null, celular: f.celular.trim() || null,
      limiteCredito: parseFloat(f.limiteCredito) || 0, prazoMedio: parseInt(f.prazoMedio) || 30,
      ativo: f.ativo, exigeRastreabilidade: f.exigeRastreabilidade, observacoes: f.observacoes.trim() || null,
      enderecoJson: { rua: f.rua, numero: f.numero, bairro: f.bairro, cidade: f.cidade, uf: f.uf, cep: f.cep },
      contatoJson: { nome: f.ctNome, cargo: f.ctCargo, telefone: f.ctTel },
    };
    try {
      if (cliente) await api.put(`/clientes/${cliente.id}`, payload); else await api.post('/clientes', payload);
      onSalvo();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal titulo={cliente ? 'Editar Cliente' : 'Novo Cliente'} onClose={onClose} onSalvar={salvar} salvando={salvando}
      salvarLabel={cliente ? 'Salvar Alterações' : 'Cadastrar'}>
      <SteppedForm>
        <Step title="Identificação" icon={<Building2 className="h-3.5 w-3.5" />} hint="Avançar para contato"
          complete={!!f.cnpjCpf.trim() && !!f.razaoSocial.trim()}>
          <div className="grid grid-cols-4 gap-3">
            <Campo label="Tipo"><select value={f.tipo} onChange={e => set('tipo', e.target.value)} className={inp}><option value="PJ">PJ</option><option value="PF">PF</option></select></Campo>
            <Campo label={`${f.tipo === 'PJ' ? 'CNPJ' : 'CPF'} *`} className="col-span-3"><input value={f.cnpjCpf} onChange={e => set('cnpjCpf', e.target.value)} className={inp} /></Campo>
          </div>
          <Campo label={`${f.tipo === 'PJ' ? 'Razão Social' : 'Nome'} *`}><input value={f.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} className={inp} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome Fantasia"><input value={f.nomeFantasia} onChange={e => set('nomeFantasia', e.target.value)} className={inp} /></Campo>
            <Campo label="Inscrição Estadual"><input value={f.ie} onChange={e => set('ie', e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Contato" icon={<Phone className="h-3.5 w-3.5" />} hint="Avançar para endereço"
          complete={!!(f.telefone.trim() || f.celular.trim() || f.email.trim())}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Telefone"><input value={f.telefone} onChange={e => set('telefone', e.target.value)} className={inp} /></Campo>
            <Campo label="Celular"><input value={f.celular} onChange={e => set('celular', e.target.value)} className={inp} /></Campo>
            <Campo label="E-mail"><input value={f.email} onChange={e => set('email', e.target.value)} className={inp} /></Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Contato (nome)" className="col-span-1"><input value={f.ctNome} onChange={e => set('ctNome', e.target.value)} className={inp} /></Campo>
            <Campo label="Cargo"><input value={f.ctCargo} onChange={e => set('ctCargo', e.target.value)} className={inp} /></Campo>
            <Campo label="Tel. contato"><input value={f.ctTel} onChange={e => set('ctTel', e.target.value)} className={inp} /></Campo>
          </div>
        </Step>

        <Step title="Endereço de entrega" icon={<MapPin className="h-3.5 w-3.5" />} hint="Avançar para comercial"
          complete={!!(f.cidade.trim() && f.uf)}>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Rua" className="col-span-4"><input value={f.rua} onChange={e => set('rua', e.target.value)} className={inp} /></Campo>
            <Campo label="Nº"><input value={f.numero} onChange={e => set('numero', e.target.value)} className={inp} /></Campo>
            <Campo label="CEP"><input value={f.cep} onChange={e => set('cep', e.target.value)} className={inp} /></Campo>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Bairro" className="col-span-3"><input value={f.bairro} onChange={e => set('bairro', e.target.value)} className={inp} /></Campo>
            <Campo label="Cidade" className="col-span-2"><input value={f.cidade} onChange={e => set('cidade', e.target.value)} className={inp} /></Campo>
            <Campo label="UF"><select value={f.uf} onChange={e => set('uf', e.target.value)} className={inp}>{UFS.map(u => <option key={u} value={u}>{u}</option>)}</select></Campo>
          </div>
        </Step>

        <Step title="Comercial & FLV" complete={false}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Limite de Crédito (R$)"><input type="number" step="0.01" min="0" value={f.limiteCredito} onChange={e => set('limiteCredito', e.target.value)} className={inp} /></Campo>
            <Campo label="Prazo de Pagamento (dias)"><input type="number" min="0" value={f.prazoMedio} onChange={e => set('prazoMedio', e.target.value)} className={inp} /></Campo>
            <Campo label="Situação">
              <button type="button" onClick={() => set('ativo', !f.ativo)} className={`w-full rounded-lg px-3 py-2 text-sm font-bold border ${f.ativo ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/15 text-rose-300 border-rose-500/40'}`}>{f.ativo ? 'ATIVO' : 'BLOQUEADO'}</button>
            </Campo>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={f.exigeRastreabilidade} onChange={e => set('exigeRastreabilidade', e.target.checked)} className="accent-emerald-500 h-4 w-4" />
            <QrCode className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-200">Exige <b>rastreabilidade</b> na entrega (etiqueta QR Code / cadastro em órgãos reguladores)</span>
          </label>
          <Campo label="Observações"><textarea value={f.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className={`${inp} resize-none`} /></Campo>
        </Step>
      </SteppedForm>

      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}
