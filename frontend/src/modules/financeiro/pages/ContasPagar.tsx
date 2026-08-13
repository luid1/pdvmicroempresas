import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpCircle, RefreshCw, Plus, X, CheckCircle2, Ban, Search,
  Wallet, Clock, AlertTriangle, CircleDollarSign,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { financeiroApi, tesourariaApi } from '../../../services/api';
import { PageHeader } from '../../cadastros/ui';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const numBR = (v: string) => v === '' ? 0 : parseFloat(String(v).replace(',', '.')) || 0;
const dataBR = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ABERTO: { label: 'Pendente', cls: 'bg-slate-400/10 text-[#8B8D98] border-slate-400/20' },
  PARCIAL: { label: 'Parcial', cls: 'bg-[#E8A317]/12 text-[#a9760a] border-[#E8A317]/40' },
  PAGO: { label: 'Pago', cls: 'bg-emerald-400/10 text-[#0b7d4e] border-emerald-400/20' },
  VENCIDO: { label: 'Atrasado', cls: 'bg-rose-400/10 text-[#c3352b] border-rose-400/20' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

interface Conta {
  id: string; descricao: string; numero?: string; status: string;
  valorOriginal: number; valorPago: number; valorAberto: number;
  dataEmissao: string; dataVencimento: string; dataPagamento?: string;
  fornecedor?: { razaoSocial?: string; nomeFantasia?: string };
}

export default function ContasPagar() {
  const { pode } = useAuth();
  const podeOperar = pode('/financeiro/pagar', 'EDITAR');

  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());
  const [status, setStatus] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState<Conta | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    const params = { dataIni: ini, dataFim: fim, ...(status && { status }) };
    Promise.all([
      financeiroApi.pagar(params),
      financeiroApi.pagarResumo(params),
    ])
      .then(([r, res]) => { setContas(r.data || []); setResumo(res.data || null); })
      .catch(() => { setContas([]); setResumo(null); })
      .finally(() => setLoading(false));
  }, [ini, fim, status]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contas;
    return contas.filter(c =>
      c.descricao?.toLowerCase().includes(q) ||
      c.numero?.toLowerCase().includes(q) ||
      c.fornecedor?.razaoSocial?.toLowerCase().includes(q) ||
      c.fornecedor?.nomeFantasia?.toLowerCase().includes(q),
    );
  }, [contas, busca]);

  const cancelar = async (c: Conta) => {
    if (!(await confirmDialog(`Cancelar o título "${c.descricao}"?`, { tone: 'danger', okLabel: 'Cancelar título' }))) return;
    try {
      await financeiroApi.cancelarPagar(c.id, 'Cancelado pela tela de Contas a Pagar.');
      toast('Título cancelado.', 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao cancelar.', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#16171D]">
      <PageHeader
        icon={<ArrowUpCircle className="h-4 w-4" />}
        titulo="Contas a Pagar"
        subtitulo="Despesas e compras de fornecedores · status, parcelamento e baixa com trilha de auditoria"
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-white hover:bg-[#EFEDE7] text-[#5B5D69] text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#E7E5DF]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            {podeOperar && (
              <button onClick={() => setCriando(true)} className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-amber-500/20">
                <Plus className="h-4 w-4" /> Nova despesa
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<CircleDollarSign className="h-4 w-4" />} cor="sky" label="Total no período" valor={loading ? null : R$(resumo?.valorOriginalTotal)} />
          <Kpi icon={<Wallet className="h-4 w-4" />} cor="emerald" label="Pago" valor={loading ? null : R$(resumo?.valorPago)} />
          <Kpi icon={<Clock className="h-4 w-4" />} cor="amber" label="Em aberto" valor={loading ? null : R$(resumo?.valorEmAberto)} />
          <Kpi icon={<AlertTriangle className="h-4 w-4" />} cor="rose" label="Atrasado" valor={loading ? null : R$(resumo?.valorVencido)} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por fornecedor, descrição ou nº..." className="bg-white border border-[#E7E5DF] rounded-lg pl-8 pr-3 py-2 text-sm text-[#16171D] w-80 focus:outline-none focus:border-[#E8A317]" />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {['', 'ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO'].map(s => (
              <button key={s || 'todos'} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${status === s ? 'bg-amber-500/15 text-[#a9760a] border-[#E8A317]/40' : 'bg-white text-slate-400 border-[#E7E5DF] hover:text-[#5B5D69]'}`}>
                {s === '' ? 'Todos' : STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white text-xs text-slate-400">
              <tr>
                {['Fornecedor / Descrição', 'Nº', 'Vencimento', 'Valor', 'Pago', 'Em aberto', 'Status', ''].map((h, i) => (
                  <th key={h || i} className={`px-4 py-2.5 font-semibold ${i >= 3 && i <= 5 ? 'text-right' : i === 6 || i === 7 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-t border-[#E7E5DF]">
                    <td colSpan={8} className="px-4 py-3"><div className="h-5 bg-[#F0EEE9] rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-slate-500 py-16">Nenhum título no período.</td></tr>
              ) : (
                filtradas.map(c => {
                  const meta = STATUS_META[c.status] || STATUS_META.ABERTO;
                  const quitavel = c.status !== 'PAGO' && c.status !== 'CANCELADO';
                  return (
                    <tr key={c.id} className="border-t border-[#E7E5DF] hover:bg-[#EFEDE7]">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#16171D]">{c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial || c.descricao}</div>
                        {(c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial) && <div className="text-xs text-slate-500">{c.descricao}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.numero || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8B8D98]">{dataBR(c.dataVencimento)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#5B5D69]">{R$(c.valorOriginal)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#0b7d4e]">{R$(c.valorPago)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16171D]">{R$(c.valorAberto)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {podeOperar && quitavel && (
                          <>
                            <button onClick={() => setBaixando(c)} title="Dar baixa" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#a9760a] hover:bg-amber-500/15">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => cancelar(c)} title="Cancelar" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#c3352b] hover:bg-rose-500/15">
                              <Ban className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {baixando && <ModalBaixa conta={baixando} onClose={() => setBaixando(null)} onDone={() => { setBaixando(null); carregar(); }} />}
      {criando && <ModalNovo onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
    </div>
  );
}

function ModalBaixa({ conta, onClose, onDone }: { conta: Conta; onClose: () => void; onDone: () => void }) {
  const [valor, setValor] = useState(String(conta.valorAberto));
  const [forma, setForma] = useState('');
  const [contaId, setContaId] = useState('');
  const [contasFin, setContasFin] = useState<{ id: string; nome: string; padrao: boolean }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    tesourariaApi.contas().then((r: any) => {
      const lista = r.data || [];
      setContasFin(lista);
      const padrao = lista.find((c: any) => c.padrao);
      if (padrao) setContaId(padrao.id);
    }).catch(() => setContasFin([]));
  }, []);

  const confirmar = async () => {
    const v = numBR(valor);
    if (v <= 0) { toast('Informe um valor positivo.', 'error'); return; }
    setSalvando(true);
    try {
      await financeiroApi.baixarPagar(conta.id, { valor: v, formaPagamento: forma || undefined, contaId: contaId || undefined });
      toast('Pagamento registrado.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha na baixa.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#16171D]/40 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-white backdrop-blur-2xl border border-[#E7E5DF] rounded-2xl shadow-[0_24px_80px_-12px_rgba(22,23,29,0.18)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-[#16171D]">Baixar pagamento</h2>
            <p className="text-xs text-slate-500 mt-0.5">{conta.descricao} · em aberto {R$(conta.valorAberto)}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#F6F5F2] text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <label className="block mb-3">
          <span className="text-xs text-slate-400">Valor pago</span>
          <div className="mt-1 flex items-center bg-white border border-[#E7E5DF] rounded-lg overflow-hidden focus-within:border-emerald-400">
            <span className="px-2 text-slate-500 text-sm">R$</span>
            <input type="number" step="0.01" autoFocus value={valor} onChange={e => setValor(e.target.value)} className="flex-1 bg-transparent px-2 py-2.5 text-lg text-[#16171D] text-right font-mono focus:outline-none" />
          </div>
        </label>
        <label className="block mb-3">
          <span className="text-xs text-slate-400">Forma de pagamento (opcional)</span>
          <input value={forma} onChange={e => setForma(e.target.value)} placeholder="PIX, Dinheiro, Boleto..." className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] focus:outline-none focus:border-[#E8A317]" />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-slate-400">Conta de origem (tesouraria)</span>
          <select value={contaId} onChange={e => setContaId(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] focus:outline-none focus:border-[#E8A317]">
            <option value="">Não movimentar caixa</option>
            {contasFin.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <button onClick={confirmar} disabled={salvando} className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-900 font-bold py-2.5 rounded-lg">
          <CheckCircle2 className="h-4 w-4" /> Confirmar baixa
        </button>
      </div>
    </div>
  ), document.body);
}

interface ContaAnalitica { id: string; codigo: string; descricao: string }

function ModalNovo({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(hojeISO());
  const [parcelas, setParcelas] = useState('1');
  const [categoria, setCategoria] = useState('');
  const [contas, setContas] = useState<ContaAnalitica[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    financeiroApi.planoContas.analiticas()
      .then((r) => setContas(r.data || []))
      .catch(() => setContas([]));
  }, []);

  const confirmar = async () => {
    const v = numBR(valor);
    if (!descricao.trim()) { toast('Informe a descrição.', 'error'); return; }
    if (v <= 0) { toast('Informe um valor positivo.', 'error'); return; }
    setSalvando(true);
    try {
      await financeiroApi.criarPagar({
        descricao, valorTotal: v, dataVencimento: vencimento,
        parcelas: Math.max(1, parseInt(parcelas) || 1),
        ...(categoria ? { planoContasCodigo: categoria } : {}),
      });
      toast('Título criado.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao criar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#16171D]/40 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-white backdrop-blur-2xl border border-[#E7E5DF] rounded-2xl shadow-[0_24px_80px_-12px_rgba(22,23,29,0.18)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-[#16171D]">Nova despesa a pagar</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#F6F5F2] text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Descrição</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] focus:outline-none focus:border-[#E8A317]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Valor total</span>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] text-right font-mono focus:outline-none focus:border-[#E8A317]" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Parcelas</span>
              <input type="number" min="1" value={parcelas} onChange={e => setParcelas(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] text-right font-mono focus:outline-none focus:border-[#E8A317]" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-400">1º vencimento</span>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] focus:outline-none focus:border-[#E8A317]" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Categoria (Plano de Contas)</span>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="mt-1 w-full bg-white border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#16171D] focus:outline-none focus:border-[#E8A317]">
              <option value="">Sem categoria (não classificar no DRE)</option>
              {contas.map((c) => (
                <option key={c.id} value={c.codigo}>{c.codigo} · {c.descricao}</option>
              ))}
            </select>
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>
    </div>
  ), document.body);
}

const CORES: Record<string, string> = {
  amber: 'bg-[#E8A317]/12 text-[#a9760a]',
  sky: 'bg-[#E8A317]/12 text-[#a9760a]',
  rose: 'bg-rose-400/10 text-[#c3352b]',
  emerald: 'bg-emerald-400/10 text-[#0b7d4e]',
};
function Kpi({ icon, label, valor, cor }: { icon: any; label: string; valor: string | null; cor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E5DF] p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null
        ? <div className="h-7 w-28 bg-[#F0EEE9] rounded animate-pulse" />
        : <p className="text-2xl font-extrabold text-[#16171D] tracking-tight truncate">{valor}</p>}
    </div>
  );
}
