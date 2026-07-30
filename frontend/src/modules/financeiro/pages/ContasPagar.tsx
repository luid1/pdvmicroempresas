import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpCircle, RefreshCw, Plus, X, CheckCircle2, Ban, Search,
  Wallet, Clock, AlertTriangle, CircleDollarSign,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { financeiroApi, tesourariaApi } from '../../../services/api';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const numBR = (v: string) => v === '' ? 0 : parseFloat(String(v).replace(',', '.')) || 0;
const dataBR = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ABERTO: { label: 'Pendente', cls: 'bg-sky-400/10 text-sky-300 border-sky-400/20' },
  PARCIAL: { label: 'Parcial', cls: 'bg-amber-400/10 text-amber-300 border-amber-400/20' },
  PAGO: { label: 'Pago', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
  VENCIDO: { label: 'Atrasado', cls: 'bg-rose-400/10 text-rose-300 border-rose-400/20' },
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
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 pt-4 pb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-rose-300" /> Contas a Pagar
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Despesas e compras de fornecedores · status, parcelamento e baixa com trilha de auditoria</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100" />
            </label>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-700">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            {podeOperar && (
              <button onClick={() => setCriando(true)} className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-rose-500/20">
                <Plus className="h-4 w-4" /> Nova despesa
              </button>
            )}
          </div>
        </div>
      </div>

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
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por fornecedor, descrição ou nº..." className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 w-80 focus:outline-none focus:border-rose-400" />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {['', 'ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO'].map(s => (
              <button key={s || 'todos'} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${status === s ? 'bg-rose-500/15 text-rose-300 border-rose-400/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
                {s === '' ? 'Todos' : STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/40 text-xs text-slate-400">
              <tr>
                {['Fornecedor / Descrição', 'Nº', 'Vencimento', 'Valor', 'Pago', 'Em aberto', 'Status', ''].map((h, i) => (
                  <th key={h || i} className={`px-4 py-2.5 font-semibold ${i >= 3 && i <= 5 ? 'text-right' : i === 6 || i === 7 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td colSpan={8} className="px-4 py-3"><div className="h-5 bg-slate-700/40 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-slate-500 py-16">Nenhum título no período.</td></tr>
              ) : (
                filtradas.map(c => {
                  const meta = STATUS_META[c.status] || STATUS_META.ABERTO;
                  const quitavel = c.status !== 'PAGO' && c.status !== 'CANCELADO';
                  return (
                    <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-700/20">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-100">{c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial || c.descricao}</div>
                        {(c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial) && <div className="text-xs text-slate-500">{c.descricao}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.numero || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{dataBR(c.dataVencimento)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">{R$(c.valorOriginal)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-300">{R$(c.valorPago)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-100">{R$(c.valorAberto)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {podeOperar && quitavel && (
                          <>
                            <button onClick={() => setBaixando(c)} title="Dar baixa" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-300 hover:bg-emerald-500/15">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => cancelar(c)} title="Cancelar" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/15">
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-white">Baixar pagamento</h2>
            <p className="text-xs text-slate-500 mt-0.5">{conta.descricao} · em aberto {R$(conta.valorAberto)}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <label className="block mb-3">
          <span className="text-xs text-slate-400">Valor pago</span>
          <div className="mt-1 flex items-center bg-slate-800 border border-slate-600 rounded-lg overflow-hidden focus-within:border-emerald-400">
            <span className="px-2 text-slate-500 text-sm">R$</span>
            <input type="number" step="0.01" autoFocus value={valor} onChange={e => setValor(e.target.value)} className="flex-1 bg-transparent px-2 py-2.5 text-lg text-slate-100 text-right font-mono focus:outline-none" />
          </div>
        </label>
        <label className="block mb-3">
          <span className="text-xs text-slate-400">Forma de pagamento (opcional)</span>
          <input value={forma} onChange={e => setForma(e.target.value)} placeholder="PIX, Dinheiro, Boleto..." className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-slate-400">Conta de origem (tesouraria)</span>
          <select value={contaId} onChange={e => setContaId(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400">
            <option value="">Não movimentar caixa</option>
            {contasFin.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <button onClick={confirmar} disabled={salvando} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold py-2.5 rounded-lg">
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white">Nova despesa a pagar</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Descrição</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-400" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Valor total</span>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-rose-400" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Parcelas</span>
              <input type="number" min="1" value={parcelas} onChange={e => setParcelas(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-rose-400" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-400">1º vencimento</span>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-400" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Categoria (Plano de Contas)</span>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-400">
              <option value="">Sem categoria (não classificar no DRE)</option>
              {contas.map((c) => (
                <option key={c.id} value={c.codigo}>{c.codigo} · {c.descricao}</option>
              ))}
            </select>
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>
    </div>
  ), document.body);
}

const CORES: Record<string, string> = {
  amber: 'bg-amber-400/10 text-amber-300',
  sky: 'bg-sky-400/10 text-sky-300',
  rose: 'bg-rose-400/10 text-rose-300',
  emerald: 'bg-emerald-400/10 text-emerald-300',
};
function Kpi({ icon, label, valor, cor }: { icon: any; label: string; valor: string | null; cor: string }) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/60 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null
        ? <div className="h-7 w-28 bg-slate-700/40 rounded animate-pulse" />
        : <p className="text-2xl font-extrabold text-white tracking-tight truncate">{valor}</p>}
    </div>
  );
}
