import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Landmark, RefreshCw, Plus, X, Wallet, Banknote, CreditCard, PiggyBank,
  ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Trash2, Pencil, Upload, Link2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { tesourariaApi, financeiroApi } from '../../../services/api';

type TipoConta = 'CAIXA' | 'BANCO' | 'CARTAO' | 'APLICACAO' | 'OUTRO';
type TipoMov = 'ENTRADA' | 'SAIDA';

interface ContaFin {
  id: string;
  nome: string;
  tipo: TipoConta;
  banco?: string | null;
  agencia?: string | null;
  numero?: string | null;
  saldoInicial: number;
  saldoAtual: number;
  ativo: boolean;
  padrao: boolean;
}
interface Movimento {
  id: string;
  contaId: string;
  tipo: TipoMov;
  origem: string;
  valor: number;
  saldoApos: number;
  data: string;
  descricao: string;
  conciliado: boolean;
}
interface Resumo {
  saldoTotal: number;
  porTipo: Record<string, number>;
  qtdContas: number;
  movimentosNaoConciliados: number;
  contas: ContaFin[];
}

const brl = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (v: string) => new Date(v).toLocaleDateString('pt-BR');

const ICONE_TIPO: Record<TipoConta, any> = {
  CAIXA: Wallet, BANCO: Banknote, CARTAO: CreditCard, APLICACAO: PiggyBank, OUTRO: Landmark,
};
const LABEL_TIPO: Record<TipoConta, string> = {
  CAIXA: 'Caixa', BANCO: 'Banco', CARTAO: 'Cartão', APLICACAO: 'Aplicação', OUTRO: 'Outro',
};

export default function Tesouraria() {
  const { pode } = useAuth();
  const podeConfigurar = pode('/financeiro/tesouraria', 'EDITAR');
  const podeOperar = pode('/financeiro/tesouraria', 'CRIAR');

  const [aba, setAba] = useState<'contas' | 'movimentos' | 'conciliacao'>('contas');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  const [criandoConta, setCriandoConta] = useState(false);
  const [editandoConta, setEditandoConta] = useState<ContaFin | null>(null);
  const [transferindo, setTransferindo] = useState(false);
  const [lancando, setLancando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    tesourariaApi.resumo()
      .then((r) => setResumo(r.data))
      .catch(() => setResumo(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const contas = resumo?.contas || [];

  const removerConta = async (c: ContaFin) => {
    if (!(await confirmDialog(`Inativar a conta "${c.nome}"?`))) return;
    try {
      await tesourariaApi.removerConta(c.id);
      toast('Conta inativada.', 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao inativar.', 'error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-2xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Tesouraria</h1>
            <p className="text-[13px] text-slate-400">Contas, saldos de caixa/banco, transferências e conciliação bancária.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {podeOperar && (
            <>
              <button onClick={() => setLancando(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-2 rounded-lg">
                <ArrowDownCircle className="h-4 w-4" /> Lançar
              </button>
              <button onClick={() => setTransferindo(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-2 rounded-lg">
                <ArrowLeftRight className="h-4 w-4" /> Transferir
              </button>
            </>
          )}
          {podeConfigurar && (
            <button onClick={() => setCriandoConta(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-3 py-2 rounded-lg">
              <Plus className="h-4 w-4" /> Nova conta
            </button>
          )}
          <button onClick={carregar} className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-300/80">Saldo consolidado</p>
          <p className="text-2xl font-bold text-emerald-200 mt-1 tabular-nums">{brl(resumo?.saldoTotal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Contas ativas</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{resumo?.qtdContas ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-amber-300/80">Não conciliados</p>
          <p className="text-2xl font-bold text-amber-200 mt-1 tabular-nums">{resumo?.movimentosNaoConciliados ?? 0}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-800">
        {([['contas', 'Contas & Saldos'], ['movimentos', 'Movimentos'], ['conciliacao', 'Conciliação']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${aba === k ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {aba === 'contas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <p className="text-slate-500 py-8">Carregando…</p>
          ) : contas.length === 0 ? (
            <p className="text-slate-500 py-8">Nenhuma conta cadastrada.</p>
          ) : contas.map((c) => {
            const Icon = ICONE_TIPO[c.tipo] || Landmark;
            return (
              <div key={c.id} className={`rounded-2xl border border-slate-700/60 bg-slate-800/30 p-4 ${c.ativo ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                    <div>
                      <p className="text-white font-semibold flex items-center gap-2">
                        {c.nome}
                        {c.padrao && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">padrão</span>}
                      </p>
                      <p className="text-xs text-slate-400">{LABEL_TIPO[c.tipo]}{c.banco ? ` · ${c.banco}` : ''}{c.numero ? ` · ${c.numero}` : ''}</p>
                    </div>
                  </div>
                  {podeConfigurar && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditandoConta(c)} className="h-8 w-8 rounded-lg hover:bg-slate-700 text-slate-400 flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
                      {c.ativo && <button onClick={() => removerConta(c)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-400 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">Saldo atual</span>
                  <span className={`text-xl font-bold tabular-nums ${Number(c.saldoAtual) < 0 ? 'text-rose-300' : 'text-emerald-200'}`}>{brl(c.saldoAtual)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aba === 'movimentos' && <AbaMovimentos contas={contas} />}
      {aba === 'conciliacao' && <AbaConciliacao contas={contas} podeOperar={podeOperar} onChange={carregar} />}

      {criandoConta && <ModalConta onClose={() => setCriandoConta(false)} onDone={() => { setCriandoConta(false); carregar(); }} />}
      {editandoConta && <ModalConta conta={editandoConta} onClose={() => setEditandoConta(null)} onDone={() => { setEditandoConta(null); carregar(); }} />}
      {transferindo && <ModalTransferencia contas={contas} onClose={() => setTransferindo(false)} onDone={() => { setTransferindo(false); carregar(); }} />}
      {lancando && <ModalAvulso contas={contas} onClose={() => setLancando(false)} onDone={() => { setLancando(false); carregar(); }} />}
    </div>
  );
}

// ─────────────── Aba Movimentos ───────────────
function AbaMovimentos({ contas }: { contas: ContaFin[] }) {
  const [contaId, setContaId] = useState('');
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    setLoading(true);
    tesourariaApi.movimentos(contaId ? { contaId } : {})
      .then((r) => setMovs(r.data || []))
      .catch(() => setMovs([]))
      .finally(() => setLoading(false));
  }, [contaId]);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome || '—';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={contaId} onChange={(e) => setContaId(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
          <option value="">Todas as contas</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Descrição</th>
              <th className="text-left px-4 py-3">Conta</th>
              <th className="text-left px-4 py-3">Origem</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-right px-4 py-3">Saldo após</th>
              <th className="text-center px-4 py-3">Conc.</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Carregando…</td></tr>
            ) : movs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhum movimento.</td></tr>
            ) : movs.map((m) => (
              <tr key={m.id} className="border-t border-slate-800">
                <td className="px-4 py-3 text-slate-400">{dataBR(m.data)}</td>
                <td className="px-4 py-3 text-slate-100">{m.descricao}</td>
                <td className="px-4 py-3 text-slate-400">{nomeConta(m.contaId)}</td>
                <td className="px-4 py-3 text-[11px] text-slate-500">{m.origem}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${m.tipo === 'ENTRADA' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {m.tipo === 'ENTRADA' ? '+' : '−'}{brl(m.valor)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{brl(m.saldoApos)}</td>
                <td className="px-4 py-3 text-center">{m.conciliado ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────── Aba Conciliação ───────────────
function AbaConciliacao({ contas, podeOperar, onChange }: { contas: ContaFin[]; podeOperar: boolean; onChange: () => void }) {
  const [importando, setImportando] = useState(false);
  const [extratos, setExtratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    setLoading(true);
    tesourariaApi.extratos()
      .then((r) => setExtratos(r.data || []))
      .catch(() => setExtratos([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome || '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">Importe o extrato bancário (OFX) e concilie com os movimentos de caixa.</p>
        {podeOperar && (
          <button onClick={() => setImportando(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-3 py-2 rounded-lg">
            <Upload className="h-4 w-4" /> Importar extrato
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Importado em</th>
              <th className="text-left px-4 py-3">Conta</th>
              <th className="text-left px-4 py-3">Arquivo</th>
              <th className="text-right px-4 py-3">Itens</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">Carregando…</td></tr>
            ) : extratos.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">Nenhum extrato importado.</td></tr>
            ) : extratos.map((e) => (
              <tr key={e.id} className="border-t border-slate-800">
                <td className="px-4 py-3 text-slate-400">{dataBR(e.importadoEm)}</td>
                <td className="px-4 py-3 text-slate-100">{nomeConta(e.contaId)}</td>
                <td className="px-4 py-3 text-slate-400">{e.arquivo || '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{e._count?.itens ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {importando && <ModalImportarOFX contas={contas} onClose={() => setImportando(false)} onDone={() => { setImportando(false); carregar(); onChange(); }} />}
    </div>
  );
}

// ─────────────── Modais ───────────────
function ModalConta({ conta, onClose, onDone }: { conta?: ContaFin; onClose: () => void; onDone: () => void }) {
  const edicao = !!conta;
  const [nome, setNome] = useState(conta?.nome || '');
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo || 'BANCO');
  const [banco, setBanco] = useState(conta?.banco || '');
  const [agencia, setAgencia] = useState(conta?.agencia || '');
  const [numero, setNumero] = useState(conta?.numero || '');
  const [saldoInicial, setSaldoInicial] = useState(String(conta?.saldoInicial ?? '0'));
  const [padrao, setPadrao] = useState(conta?.padrao ?? false);
  const [ativo, setAtivo] = useState(conta?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!nome.trim()) { toast('Informe o nome da conta.', 'error'); return; }
    setSalvando(true);
    try {
      if (edicao) {
        await tesourariaApi.atualizarConta(conta!.id, { nome: nome.trim(), tipo, banco: banco || undefined, agencia: agencia || undefined, numero: numero || undefined, padrao, ativo });
      } else {
        await tesourariaApi.criarConta({ nome: nome.trim(), tipo, banco: banco || undefined, agencia: agencia || undefined, numero: numero || undefined, saldoInicial: parseFloat(String(saldoInicial).replace(',', '.')) || 0, padrao });
      }
      toast(edicao ? 'Conta atualizada.' : 'Conta criada.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao salvar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white">{edicao ? 'Editar conta' : 'Nova conta financeira'}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Nome</span>
            <input value={nome} onChange={e => setNome(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Tipo</span>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoConta)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400">
                <option value="CAIXA">Caixa</option>
                <option value="BANCO">Banco</option>
                <option value="CARTAO">Cartão</option>
                <option value="APLICACAO">Aplicação</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Banco</span>
              <input value={banco} onChange={e => setBanco(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Agência</span>
              <input value={agencia} onChange={e => setAgencia(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Conta nº</span>
              <input value={numero} onChange={e => setNumero(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
            </label>
          </div>
          {!edicao && (
            <label className="block">
              <span className="text-xs text-slate-400">Saldo inicial</span>
              <input type="number" step="0.01" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-emerald-400" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={padrao} onChange={e => setPadrao(e.target.checked)} /> Conta padrão (pré-selecionada nas baixas)
          </label>
          {edicao && (
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativa
            </label>
          )}
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> {edicao ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  ), document.body);
}

function ModalTransferencia({ contas, onClose, onDone }: { contas: ContaFin[]; onClose: () => void; onDone: () => void }) {
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    const v = parseFloat(String(valor).replace(',', '.')) || 0;
    if (!origem || !destino) { toast('Selecione as contas.', 'error'); return; }
    if (origem === destino) { toast('Contas devem ser diferentes.', 'error'); return; }
    if (v <= 0) { toast('Valor deve ser maior que zero.', 'error'); return; }
    setSalvando(true);
    try {
      await tesourariaApi.transferir({ contaOrigemId: origem, contaDestinoId: destino, valor: v, descricao: descricao || undefined });
      toast('Transferência registrada.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha na transferência.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Transferência</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">De</span>
            <select value={origem} onChange={e => setOrigem(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
              <option value="">Selecione…</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {brl(c.saldoAtual)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Para</span>
            <select value={destino} onChange={e => setDestino(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
              <option value="">Selecione…</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {brl(c.saldoAtual)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Valor</span>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-emerald-400" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Descrição (opcional)</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <ArrowLeftRight className="h-4 w-4" /> Transferir
        </button>
      </div>
    </div>
  ), document.body);
}

function ModalAvulso({ contas, onClose, onDone }: { contas: ContaFin[]; onClose: () => void; onDone: () => void }) {
  const [contaId, setContaId] = useState(contas.find((c) => c.padrao)?.id || contas[0]?.id || '');
  const [tipo, setTipo] = useState<TipoMov>('ENTRADA');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [contasPlano, setContasPlano] = useState<{ id: string; codigo: string; descricao: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    financeiroApi.planoContas.analiticas().then((r: any) => setContasPlano(r.data || [])).catch(() => setContasPlano([]));
  }, []);

  const confirmar = async () => {
    const v = parseFloat(String(valor).replace(',', '.')) || 0;
    if (!contaId) { toast('Selecione a conta.', 'error'); return; }
    if (v <= 0) { toast('Valor deve ser maior que zero.', 'error'); return; }
    if (!descricao.trim()) { toast('Informe a descrição.', 'error'); return; }
    setSalvando(true);
    try {
      await tesourariaApi.movimentoAvulso({ contaId, tipo, valor: v, descricao: descricao.trim(), planoContasCodigo: categoria || undefined });
      toast('Lançamento registrado.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha no lançamento.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white">Lançamento avulso</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTipo('ENTRADA')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold ${tipo === 'ENTRADA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}><ArrowDownCircle className="h-4 w-4" /> Entrada</button>
            <button onClick={() => setTipo('SAIDA')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold ${tipo === 'SAIDA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}><ArrowUpCircle className="h-4 w-4" /> Saída</button>
          </div>
          <label className="block">
            <span className="text-xs text-slate-400">Conta</span>
            <select value={contaId} onChange={e => setContaId(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {brl(c.saldoAtual)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Valor</span>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-emerald-400" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Descrição</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Categoria (opcional)</span>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
              <option value="">Sem categoria</option>
              {contasPlano.map((c) => <option key={c.id} value={c.codigo}>{c.codigo} — {c.descricao}</option>)}
            </select>
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> Lançar
        </button>
      </div>
    </div>
  ), document.body);
}

function ModalImportarOFX({ contas, onClose, onDone }: { contas: ContaFin[]; onClose: () => void; onDone: () => void }) {
  const [contaId, setContaId] = useState(contas[0]?.id || '');
  const [arquivo, setArquivo] = useState('');
  const [itens, setItens] = useState<{ data: string; valor: number; descricao: string; documento?: string; fitId?: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  const parseOFX = (texto: string, nome: string) => {
    setArquivo(nome);
    // Parser OFX simples: extrai blocos <STMTTRN>…</STMTTRN>.
    const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
    const parsed = blocos.map((b) => {
      const tag = (t: string) => {
        const m = b.match(new RegExp(`<${t}>([^<\r\n]*)`, 'i'));
        return m ? m[1].trim() : '';
      };
      const dt = tag('DTPOSTED').slice(0, 8); // YYYYMMDD
      const data = dt.length >= 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : new Date().toISOString().slice(0, 10);
      return {
        data,
        valor: parseFloat(tag('TRNAMT').replace(',', '.')) || 0,
        descricao: tag('MEMO') || tag('NAME') || 'Lançamento',
        documento: tag('CHECKNUM') || undefined,
        fitId: tag('FITID') || undefined,
      };
    });
    setItens(parsed);
    if (parsed.length === 0) toast('Nenhuma transação encontrada no arquivo OFX.', 'error');
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => parseOFX(String(reader.result || ''), f.name);
    reader.readAsText(f);
  };

  const confirmar = async () => {
    if (!contaId) { toast('Selecione a conta.', 'error'); return; }
    if (itens.length === 0) { toast('Carregue um arquivo OFX com transações.', 'error'); return; }
    setSalvando(true);
    try {
      const r: any = await tesourariaApi.importarExtrato({ contaId, arquivo, itens });
      toast(`Importados ${r.data?.itensImportados ?? 0} itens · ${r.data?.conciliadosAuto ?? 0} conciliados automaticamente.`, 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao importar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-md bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white flex items-center gap-2"><Link2 className="h-4 w-4" /> Importar extrato OFX</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Conta</span>
            <select value={contaId} onChange={e => setContaId(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100">
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Arquivo OFX</span>
            <input type="file" accept=".ofx,.qfx,text/*" onChange={onFile} className="mt-1 w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200" />
          </label>
          {itens.length > 0 && (
            <div className="rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {itens.map((i, idx) => (
                    <tr key={idx} className="border-t border-slate-800 first:border-0">
                      <td className="px-2 py-1.5 text-slate-400">{i.data}</td>
                      <td className="px-2 py-1.5 text-slate-200 truncate max-w-[180px]">{i.descricao}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${i.valor >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <button onClick={confirmar} disabled={salvando || itens.length === 0} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Upload className="h-4 w-4" /> Importar {itens.length > 0 ? `(${itens.length})` : ''}
        </button>
      </div>
    </div>
  ), document.body);
}
