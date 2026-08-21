import { useState, useEffect, useCallback } from 'react';
import {
  Store, Plus, Search, Building2, Users, Pencil, Power, X,
  ShieldCheck, Loader2, MapPin, CheckCircle2, Ban,
} from 'lucide-react';
import { plataformaApi } from '../../../services/api';
import { inp, StatusBadge, Modal, Campo, Loader, Vazio } from '../../cadastros/ui';
import { toast, confirmDialog } from '../../../components/ui/feedback';

// ── Constantes ──────────────────────────────────────────────────────────
const REGIMES = [
  { v: 'SIMPLES_NACIONAL', l: 'Simples Nacional (CRT 1)' },
  { v: 'MEI', l: 'MEI (CRT 4)' },
  { v: 'LUCRO_PRESUMIDO', l: 'Lucro Presumido (CRT 3)' },
  { v: 'LUCRO_REAL', l: 'Lucro Real (CRT 3)' },
];
const TIPOS_FILIAL = ['MATRIZ', 'FILIAL', 'DEPOSITO', 'BOX_CEASA'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const STATUS_ASSINATURA: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'Em teste', cls: 'bg-amber-500/12 text-[#a9760a] border-[#E8A317]/30' },
  ATIVA: { label: 'Ativa', cls: 'bg-emerald-500/12 text-[#0b7d4e] border-emerald-500/30' },
  SUSPENSA: { label: 'Suspensa', cls: 'bg-orange-500/12 text-[#c2590a] border-orange-500/30' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-500/12 text-[#c3352b] border-rose-500/30' },
};

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCnpj = (c?: string) => {
  const d = (c || '').replace(/\D/g, '');
  if (d.length !== 14) return c || '—';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// ══════════════════════════════════════════════════════════════════════
//  PÁGINA — Painel do dono da plataforma (SaaS)
// ══════════════════════════════════════════════════════════════════════
export default function Plataforma() {
  const [lojas, setLojas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todas');
  const [lojaAberta, setLojaAberta] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    plataformaApi
      .listarLojas({ q: q.trim() || undefined, status: status === 'todas' ? undefined : status })
      .then((r) => setLojas(r.data || []))
      .catch(() => setLojas([]))
      .finally(() => setLoading(false));
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const totalFiliais = lojas.reduce((s, l) => s + (l.filiaisCount || 0), 0);
  const totalUsuarios = lojas.reduce((s, l) => s + (l.usuariosCount || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#13A184]/12 border border-[#13A184]/25 flex items-center justify-center text-[#0F8A72]">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Painel da Plataforma</h1>
            <p className="text-xs text-[#8B8D98]">
              {lojas.length} loja(s) · {totalFiliais} filial(is) · {totalUsuarios} usuário(s)
            </p>
          </div>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 bg-[#13A184] hover:bg-[#0F8A72] text-white text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Nova Loja
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-2.5 flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8F94]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
            className={`${inp} pl-9`}
          />
        </div>
        <div className="flex gap-1 bg-[#F1F1F3] rounded-lg p-0.5">
          {[
            { v: 'todas', l: 'Todas' },
            { v: 'ativas', l: 'Ativas' },
            { v: 'inativas', l: 'Inativas' },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setStatus(o.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                status === o.v ? 'bg-white text-[#16171D] shadow-sm' : 'text-[#8B8D98] hover:text-[#16171D]'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <Loader />
        ) : lojas.length === 0 ? (
          <Vazio icon={<Store className="h-10 w-10" />} texto="Nenhuma loja encontrada" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {lojas.map((l) => (
              <LojaCard key={l.id} loja={l} onAbrir={() => setLojaAberta(l.id)} />
            ))}
          </div>
        )}
      </div>

      {criando && (
        <CriarLojaModal
          onClose={() => setCriando(false)}
          onCriado={(id) => {
            setCriando(false);
            carregar();
            setLojaAberta(id);
          }}
        />
      )}
      {lojaAberta && (
        <LojaDrawer
          id={lojaAberta}
          onClose={() => setLojaAberta(null)}
          onMudou={carregar}
        />
      )}
    </div>
  );
}

// ── Card da loja na grade ────────────────────────────────────────────────
function LojaCard({ loja, onAbrir }: { loja: any; onAbrir: () => void }) {
  const ass = loja.assinatura ? STATUS_ASSINATURA[loja.assinatura.status] : null;
  return (
    <button
      onClick={onAbrir}
      className={`text-left bg-white border rounded-xl p-4 hover:shadow-md hover:border-[#13A184]/40 transition-all group ${
        loja.ativo ? 'border-[#E7E5DF]' : 'border-rose-200 bg-rose-50/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-[#16171D] truncate group-hover:text-[#0F8A72]">
            {loja.nomeFantasia || loja.razaoSocial}
          </p>
          {loja.nomeFantasia && <p className="text-xs text-[#8B8D98] truncate">{loja.razaoSocial}</p>}
          <p className="text-xs font-mono text-[#A0A2AD] mt-0.5">{fmtCnpj(loja.cnpj)}</p>
        </div>
        <StatusBadge ativo={loja.ativo} />
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-[#5B5D69]">
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5 text-[#8E8F94]" /> {loja.filiaisCount} filial(is)
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-[#8E8F94]" /> {loja.usuariosCount} usuário(s)
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0EEE9]">
        <span className="text-xs text-[#8B8D98]">
          {loja.assinatura?.plano?.nome || loja.plano || 'Sem plano'}
        </span>
        {ass && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ass.cls}`}>{ass.label}</span>
        )}
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  DRAWER — detalhe da loja (dados, filiais, usuários)
// ══════════════════════════════════════════════════════════════════════
function LojaDrawer({ id, onClose, onMudou }: { id: string; onClose: () => void; onMudou: () => void }) {
  const [loja, setLoja] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [filialEdit, setFilialEdit] = useState<any | null>(null);
  const [novaFilial, setNovaFilial] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    plataformaApi
      .obterLoja(id)
      .then((r) => setLoja(r.data))
      .catch(() => toast('Não foi possível carregar a loja.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const recarregarTudo = () => { carregar(); onMudou(); };

  const toggleLoja = async () => {
    if (!loja) return;
    const desativar = loja.ativo;
    const ok = await confirmDialog(
      desativar
        ? `Desativar a loja "${loja.nomeFantasia || loja.razaoSocial}"? Os usuários dela perdem o acesso.`
        : `Reativar a loja "${loja.nomeFantasia || loja.razaoSocial}"?`,
      desativar ? { tone: 'danger', okLabel: 'Desativar' } : { okLabel: 'Reativar' },
    );
    if (!ok) return;
    try {
      await plataformaApi.atualizarLoja(id, { ativo: !loja.ativo });
      toast(desativar ? 'Loja desativada.' : 'Loja reativada.', 'success');
      recarregarTudo();
    } catch {
      toast('Erro ao alterar o status da loja.', 'error');
    }
  };

  const toggleFilial = async (f: any) => {
    const ok = await confirmDialog(
      f.ativo ? `Desativar a filial "${f.nome}"?` : `Reativar a filial "${f.nome}"?`,
      f.ativo ? { tone: 'danger', okLabel: 'Desativar' } : { okLabel: 'Reativar' },
    );
    if (!ok) return;
    try {
      await plataformaApi.toggleFilial(f.id, !f.ativo);
      toast('Filial atualizada.', 'success');
      recarregarTudo();
    } catch {
      toast('Erro ao atualizar a filial.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-[#F7F7F8] h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Cabeçalho */}
        <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#13A184]/12 border border-[#13A184]/25 flex items-center justify-center text-[#0F8A72] shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[#16171D] truncate">
                {loja ? loja.nomeFantasia || loja.razaoSocial : 'Carregando...'}
              </h2>
              {loja && <p className="text-xs font-mono text-[#A0A2AD]">{fmtCnpj(loja.cnpj)}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8B8D98] hover:bg-[#F1F1F3] hover:text-[#16171D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !loja ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-[#13A184] animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Dados & ações */}
            <section className="bg-white border border-[#E7E5DF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#16171D]">Dados da loja</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditando(true)}
                    className="flex items-center gap-1 text-[11px] bg-[#E8A317]/12 text-[#a9760a] border border-[#E8A317]/30 px-2 py-1 rounded font-semibold hover:bg-amber-500/20"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={toggleLoja}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded font-semibold border ${
                      loja.ativo
                        ? 'bg-rose-500/12 text-[#c3352b] border-rose-500/30 hover:bg-rose-500/20'
                        : 'bg-emerald-500/12 text-[#0b7d4e] border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Power className="h-3 w-3" /> {loja.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <Dado label="Razão social" valor={loja.razaoSocial} />
                <Dado label="Nome fantasia" valor={loja.nomeFantasia} />
                <Dado label="Regime" valor={loja.regimeTributario} />
                <Dado label="Inscrição Estadual" valor={loja.ie} />
                <Dado label="E-mail NF-e" valor={loja.emailNfe} />
                <Dado label="Plano" valor={loja.assinatura?.plano?.nome || loja.plano} />
                <div>
                  <p className="text-[#A0A2AD]">Status</p>
                  <div className="mt-0.5"><StatusBadge ativo={loja.ativo} /></div>
                </div>
                {loja.assinatura && (
                  <Dado
                    label="Assinatura"
                    valor={`${STATUS_ASSINATURA[loja.assinatura.status]?.label || loja.assinatura.status}${
                      loja.assinatura.plano?.precoMensal ? ' · ' + brl(loja.assinatura.plano.precoMensal) + '/mês' : ''
                    }`}
                  />
                )}
              </div>
            </section>

            {/* Filiais */}
            <section className="bg-white border border-[#E7E5DF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#16171D] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#8E8F94]" /> Filiais ({loja.filiais?.length || 0})
                </h3>
                <button
                  onClick={() => setNovaFilial(true)}
                  className="flex items-center gap-1 text-[11px] bg-[#13A184]/12 text-[#0F8A72] border border-[#13A184]/30 px-2 py-1 rounded font-semibold hover:bg-[#13A184]/20"
                >
                  <Plus className="h-3 w-3" /> Adicionar filial
                </button>
              </div>
              {(!loja.filiais || loja.filiais.length === 0) ? (
                <p className="text-xs text-[#8B8D98] py-2">Nenhuma filial cadastrada.</p>
              ) : (
                <div className="divide-y divide-[#F0EEE9]">
                  {loja.filiais.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#16171D] truncate">
                          <span className="font-mono text-[#A0A2AD] mr-1.5">{f.codigo}</span>
                          {f.nome}
                        </p>
                        <p className="text-xs text-[#8B8D98] flex items-center gap-2 flex-wrap">
                          <span>{f.tipo}</span>
                          {f.cnpj && <span className="font-mono">{fmtCnpj(f.cnpj)}</span>}
                          {f.endereco?.cidade && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> {f.endereco.cidade}
                              {f.endereco.uf ? '/' + f.endereco.uf : ''}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge ativo={f.ativo} />
                        <button
                          onClick={() => setFilialEdit(f)}
                          title="Editar filial"
                          className="p-1.5 rounded-lg text-[#a9760a] hover:bg-amber-500/10"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleFilial(f)}
                          title={f.ativo ? 'Desativar' : 'Reativar'}
                          className={`p-1.5 rounded-lg ${f.ativo ? 'text-[#c3352b] hover:bg-rose-500/10' : 'text-[#0b7d4e] hover:bg-emerald-500/10'}`}
                        >
                          {f.ativo ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Usuários */}
            <section className="bg-white border border-[#E7E5DF] rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#16171D] flex items-center gap-1.5 mb-3">
                <Users className="h-4 w-4 text-[#8E8F94]" /> Usuários ({loja.users?.length || 0})
              </h3>
              {(!loja.users || loja.users.length === 0) ? (
                <p className="text-xs text-[#8B8D98] py-2">Nenhum usuário cadastrado.</p>
              ) : (
                <div className="divide-y divide-[#F0EEE9]">
                  {loja.users.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#16171D] truncate flex items-center gap-1.5">
                          {u.nome}
                          {u.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 text-[#0F8A72]" />}
                        </p>
                        <p className="text-xs text-[#8B8D98] truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-[#8B8D98] bg-[#F1F1F3] px-2 py-0.5 rounded-full">
                          {u.role?.nome || '—'}
                        </span>
                        <StatusBadge ativo={u.ativo} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {editando && loja && (
        <EditarLojaModal loja={loja} onClose={() => setEditando(false)} onSalvo={() => { setEditando(false); recarregarTudo(); }} />
      )}
      {(novaFilial || filialEdit) && loja && (
        <FilialModal
          lojaId={id}
          filial={filialEdit}
          onClose={() => { setNovaFilial(false); setFilialEdit(null); }}
          onSalvo={() => { setNovaFilial(false); setFilialEdit(null); recarregarTudo(); }}
        />
      )}
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-[#A0A2AD]">{label}</p>
      <p className="text-[#16171D] font-medium truncate">{valor || '—'}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MODAL — criar loja nova
// ══════════════════════════════════════════════════════════════════════
function CriarLojaModal({ onClose, onCriado }: { onClose: () => void; onCriado: (id: string) => void }) {
  const [f, setF] = useState({
    razaoSocial: '', nomeFantasia: '', cnpj: '', regimeTributario: 'SIMPLES_NACIONAL',
    adminNome: '', adminEmail: '', password: '', filialNome: '', filialCodigo: '0001',
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.razaoSocial.trim()) return setErro('Informe a razão social.');
    if (!f.cnpj.trim()) return setErro('Informe o CNPJ.');
    if (!f.adminNome.trim()) return setErro('Informe o nome do administrador.');
    if (!f.adminEmail.trim()) return setErro('Informe o e-mail do administrador.');
    if (f.password.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.');
    setSalvando(true); setErro('');
    try {
      const { data } = await plataformaApi.criarLoja({
        razaoSocial: f.razaoSocial.trim(),
        nomeFantasia: f.nomeFantasia.trim() || undefined,
        cnpj: f.cnpj.trim(),
        regimeTributario: f.regimeTributario,
        adminNome: f.adminNome.trim(),
        adminEmail: f.adminEmail.trim(),
        password: f.password,
        filialNome: f.filialNome.trim() || undefined,
        filialCodigo: f.filialCodigo.trim() || undefined,
      });
      toast('Loja criada com sucesso.', 'success');
      onCriado(data.id);
    } catch (e: any) {
      setErro(e.response?.data?.message || e.response?.data?.error?.message || 'Erro ao criar a loja.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Nova Loja" onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel="Criar loja" wide>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-bold text-[#8B8D98] uppercase tracking-wide mb-2">Empresa</p>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Razão social *" className="col-span-4">
              <input value={f.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} className={inp} />
            </Campo>
            <Campo label="CNPJ *" className="col-span-2">
              <input value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} className={inp} placeholder="00.000.000/0000-00" />
            </Campo>
            <Campo label="Nome fantasia" className="col-span-4">
              <input value={f.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} className={inp} />
            </Campo>
            <Campo label="Regime tributário" className="col-span-2">
              <select value={f.regimeTributario} onChange={(e) => set('regimeTributario', e.target.value)} className={inp}>
                {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </Campo>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[#8B8D98] uppercase tracking-wide mb-2">Filial matriz</p>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Nome da matriz" className="col-span-4">
              <input value={f.filialNome} onChange={(e) => set('filialNome', e.target.value)} className={inp} placeholder="Padrão: nome fantasia / razão social" />
            </Campo>
            <Campo label="Código" className="col-span-2">
              <input value={f.filialCodigo} onChange={(e) => set('filialCodigo', e.target.value)} className={inp} />
            </Campo>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[#8B8D98] uppercase tracking-wide mb-2">Administrador master</p>
          <div className="grid grid-cols-6 gap-3">
            <Campo label="Nome *" className="col-span-3">
              <input value={f.adminNome} onChange={(e) => set('adminNome', e.target.value)} className={inp} />
            </Campo>
            <Campo label="E-mail *" className="col-span-3">
              <input type="email" value={f.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} className={inp} placeholder="admin@empresa.com.br" />
            </Campo>
            <Campo label="Senha *" className="col-span-3">
              <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} className={inp} placeholder="mín. 6 caracteres" />
            </Campo>
          </div>
        </div>
      </div>
      {erro && <p className="text-xs text-[#c3352b] bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MODAL — editar dados da loja
// ══════════════════════════════════════════════════════════════════════
function EditarLojaModal({ loja, onClose, onSalvo }: { loja: any; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    razaoSocial: loja.razaoSocial || '', nomeFantasia: loja.nomeFantasia || '',
    regimeTributario: loja.regimeTributario || 'SIMPLES_NACIONAL',
    ie: loja.ie || '', emailNfe: loja.emailNfe || '', plano: loja.plano || '',
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.razaoSocial.trim()) return setErro('Informe a razão social.');
    setSalvando(true); setErro('');
    try {
      await plataformaApi.atualizarLoja(loja.id, {
        razaoSocial: f.razaoSocial.trim(),
        nomeFantasia: f.nomeFantasia.trim(),
        regimeTributario: f.regimeTributario,
        ie: f.ie.trim(),
        emailNfe: f.emailNfe.trim(),
        plano: f.plano.trim() || undefined,
      });
      toast('Loja atualizada.', 'success');
      onSalvo();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Editar loja" onClose={onClose} onSalvar={salvar} salvando={salvando}>
      <div className="grid grid-cols-6 gap-3">
        <Campo label="Razão social *" className="col-span-6">
          <input value={f.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Nome fantasia" className="col-span-6">
          <input value={f.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Regime tributário" className="col-span-3">
          <select value={f.regimeTributario} onChange={(e) => set('regimeTributario', e.target.value)} className={inp}>
            {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </Campo>
        <Campo label="Plano (rótulo)" className="col-span-3">
          <input value={f.plano} onChange={(e) => set('plano', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Inscrição Estadual" className="col-span-3">
          <input value={f.ie} onChange={(e) => set('ie', e.target.value)} className={inp} />
        </Campo>
        <Campo label="E-mail NF-e" className="col-span-3">
          <input value={f.emailNfe} onChange={(e) => set('emailNfe', e.target.value)} className={inp} />
        </Campo>
      </div>
      {erro && <p className="text-xs text-[#c3352b] bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MODAL — adicionar / editar filial da loja
// ══════════════════════════════════════════════════════════════════════
function FilialModal({ lojaId, filial, onClose, onSalvo }: { lojaId: string; filial: any | null; onClose: () => void; onSalvo: () => void }) {
  const ed = filial?.endereco || {};
  const [f, setF] = useState({
    nome: filial?.nome || '', codigo: filial?.codigo || '', tipo: filial?.tipo || 'FILIAL',
    cnpj: filial?.cnpj || '', ie: filial?.ie || '', regimeTributario: filial?.regimeTributario || 'SIMPLES_NACIONAL',
    rua: ed.rua || '', cidade: ed.cidade || '', uf: ed.uf || 'SP', ativo: filial?.ativo ?? true,
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.nome.trim()) return setErro('Informe o nome da filial.');
    setSalvando(true); setErro('');
    const payload: any = {
      nome: f.nome.trim(), tipo: f.tipo, cnpj: f.cnpj.trim() || null, ie: f.ie.trim() || null,
      regimeTributario: f.regimeTributario, ativo: f.ativo,
      endereco: { rua: f.rua, cidade: f.cidade, uf: f.uf },
    };
    if (filial) payload.codigo = filial.codigo;
    else if (f.codigo.trim()) payload.codigo = f.codigo.trim();
    try {
      if (filial) await plataformaApi.atualizarFilial(filial.id, payload);
      else await plataformaApi.adicionarFilial(lojaId, payload);
      toast(filial ? 'Filial atualizada.' : 'Filial adicionada.', 'success');
      onSalvo();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar a filial.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={filial ? 'Editar filial' : 'Nova filial'} onClose={onClose} onSalvar={salvar} salvando={salvando} salvarLabel={filial ? 'Salvar' : 'Adicionar'}>
      <div className="grid grid-cols-6 gap-3">
        <Campo label="Nome *" className="col-span-4">
          <input value={f.nome} onChange={(e) => set('nome', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Código" className="col-span-2">
          <input value={f.codigo} onChange={(e) => set('codigo', e.target.value)} className={inp} placeholder="auto" disabled={!!filial} />
        </Campo>
        <Campo label="Tipo" className="col-span-2">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)} className={inp}>
            {TIPOS_FILIAL.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="CNPJ" className="col-span-2">
          <input value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Inscrição Estadual" className="col-span-2">
          <input value={f.ie} onChange={(e) => set('ie', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Regime tributário" className="col-span-6">
          <select value={f.regimeTributario} onChange={(e) => set('regimeTributario', e.target.value)} className={inp}>
            {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </Campo>
        <Campo label="Endereço" className="col-span-4">
          <input value={f.rua} onChange={(e) => set('rua', e.target.value)} className={inp} />
        </Campo>
        <Campo label="Cidade" className="col-span-1">
          <input value={f.cidade} onChange={(e) => set('cidade', e.target.value)} className={inp} />
        </Campo>
        <Campo label="UF" className="col-span-1">
          <select value={f.uf} onChange={(e) => set('uf', e.target.value)} className={inp}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Campo>
      </div>
      {erro && <p className="text-xs text-[#c3352b] bg-rose-500/10 px-3 py-2 rounded-lg mt-3">{erro}</p>}
    </Modal>
  );
}
