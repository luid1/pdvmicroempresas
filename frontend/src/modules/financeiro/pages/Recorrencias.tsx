import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Repeat, RefreshCw, Plus, X, Pencil, Trash2, Play, CalendarClock, Power, Eye,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { recorrenciasApi, financeiroApi, fornecedoresApi } from '../../../services/api';

type Periodicidade =
  | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

interface Recorrencia {
  id: string;
  descricao: string;
  fornecedorId?: string | null;
  filialId?: string | null;
  valor: number;
  valorVariavel: boolean;
  planoContasCodigo?: string | null;
  diaVencimento: number;
  periodicidade: Periodicidade;
  ativo: boolean;
  proximaGeracao: string;
  ultimaGeracao?: string | null;
  ultimoPeriodoGerado?: string | null;
  observacoes?: string | null;
}
interface ContaPlano { id: string; codigo: string; descricao: string; }
interface Fornecedor { id: string; razaoSocial?: string; nomeFantasia?: string; nome?: string; }

const brl = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

const LABEL_PERIODO: Record<Periodicidade, string> = {
  SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual',
};
const PERIODOS = Object.keys(LABEL_PERIODO) as Periodicidade[];

export default function Recorrencias() {
  const { pode } = useAuth();
  const podeConfigurar = pode('/financeiro/recorrencias', 'EDITAR');
  const podeOperar = pode('/financeiro/recorrencias', 'CRIAR');

  const [lista, setLista] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);
  const [previewDe, setPreviewDe] = useState<Recorrencia | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    recorrenciasApi.listar()
      .then((r) => setLista(r.data))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const gerarAgora = async () => {
    const ok = await confirmDialog('Gerar agora todas as recorrências vencidas? Serão criadas Contas a Pagar.');
    if (!ok) return;
    setGerando(true);
    try {
      const r = await recorrenciasApi.gerar();
      toast(`${r.data?.geradas ?? 0} conta(s) a pagar gerada(s).`, 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao gerar.', 'error');
    } finally { setGerando(false); }
  };

  const alternarAtivo = async (rec: Recorrencia) => {
    try {
      await recorrenciasApi.atualizar(rec.id, { ativo: !rec.ativo });
      toast(rec.ativo ? 'Recorrência pausada.' : 'Recorrência reativada.', 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao atualizar.', 'error');
    }
  };

  const remover = async (rec: Recorrencia) => {
    const ok = await confirmDialog(`Excluir a recorrência "${rec.descricao}"?`);
    if (!ok) return;
    try {
      await recorrenciasApi.remover(rec.id);
      toast('Recorrência excluída.', 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao excluir.', 'error');
    }
  };

  const ativas = lista.filter((r) => r.ativo);
  const totalMensalEstimado = ativas
    .filter((r) => !r.valorVariavel)
    .reduce((acc, r) => acc + Number(r.valor || 0), 0);
  const vencidas = ativas.filter((r) => new Date(r.proximaGeracao).getTime() <= Date.now());

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <Repeat className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Despesas Recorrentes</h1>
            <p className="text-sm text-slate-400">Aluguéis, assinaturas e contratos que geram Contas a Pagar automaticamente.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center" title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {podeOperar && (
            <button onClick={gerarAgora} disabled={gerando} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-40">
              <Play className={`h-4 w-4 ${gerando ? 'animate-pulse' : ''}`} /> Gerar agora
            </button>
          )}
          {podeConfigurar && (
            <button onClick={() => setCriando(true)} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold px-3 py-2 rounded-lg">
              <Plus className="h-4 w-4" /> Nova recorrência
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0e1729]/70 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Recorrências ativas</p>
          <p className="text-2xl font-bold text-white mt-1">{ativas.length}</p>
        </div>
        <div className="bg-[#0e1729]/70 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Estimativa mensal (valor fixo)</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{brl(totalMensalEstimado)}</p>
        </div>
        <div className="bg-[#0e1729]/70 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Vencidas (aguardando geração)</p>
          <p className={`text-2xl font-bold mt-1 ${vencidas.length ? 'text-amber-300' : 'text-white'}`}>{vencidas.length}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[#0e1729]/70 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhuma despesa recorrente cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Periodicidade</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Próxima geração</th>
                <th className="px-4 py-3 font-medium">Última</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const venceu = r.ativo && new Date(r.proximaGeracao).getTime() <= Date.now();
                return (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="text-slate-100 font-medium">{r.descricao}</div>
                      {r.planoContasCodigo && <div className="text-xs text-slate-500">Categoria {r.planoContasCodigo}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{LABEL_PERIODO[r.periodicidade]} · dia {r.diaVencimento}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.valorVariavel
                        ? <span className="text-amber-300 text-xs">variável (rascunho)</span>
                        : <span className="text-slate-100">{brl(r.valor)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={venceu ? 'text-amber-300 font-medium' : 'text-slate-300'}>{dataBR(r.proximaGeracao)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dataBR(r.ultimaGeracao)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.ativo
                        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300">Ativa</span>
                        : <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-500/15 text-slate-400">Pausada</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewDe(r)} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center" title="Prever próximas">
                          <Eye className="h-4 w-4" />
                        </button>
                        {podeConfigurar && (
                          <>
                            <button onClick={() => alternarAtivo(r)} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center" title={r.ativo ? 'Pausar' : 'Reativar'}>
                              <Power className={`h-4 w-4 ${r.ativo ? 'text-emerald-400' : 'text-slate-500'}`} />
                            </button>
                            <button onClick={() => setEditando(r)} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center" title="Editar">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => remover(r)} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-rose-400 flex items-center justify-center" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {criando && <ModalRecorrencia onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
      {editando && <ModalRecorrencia rec={editando} onClose={() => setEditando(null)} onDone={() => { setEditando(null); carregar(); }} />}
      {previewDe && <ModalPreview rec={previewDe} onClose={() => setPreviewDe(null)} />}
    </div>
  );
}

const inputCls = 'mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-400';

function ModalRecorrencia({ rec, onClose, onDone }: { rec?: Recorrencia; onClose: () => void; onDone: () => void }) {
  const edicao = !!rec;
  const [descricao, setDescricao] = useState(rec?.descricao || '');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(rec?.periodicidade || 'MENSAL');
  const [diaVencimento, setDiaVencimento] = useState(String(rec?.diaVencimento ?? 5));
  const [valorVariavel, setValorVariavel] = useState(rec?.valorVariavel ?? false);
  const [valor, setValor] = useState(String(rec?.valor ?? '0'));
  const [planoContasCodigo, setPlanoContasCodigo] = useState(rec?.planoContasCodigo || '');
  const [fornecedorId, setFornecedorId] = useState(rec?.fornecedorId || '');
  const [proximaGeracao, setProximaGeracao] = useState(
    rec?.proximaGeracao ? rec.proximaGeracao.slice(0, 10) : '',
  );
  const [observacoes, setObservacoes] = useState(rec?.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  const [contasPlano, setContasPlano] = useState<ContaPlano[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    financeiroApi.planoContas.analiticas().then((r) => setContasPlano(r.data || [])).catch(() => {});
    fornecedoresApi.list().then((r) => setFornecedores(r.data || [])).catch(() => {});
  }, []);

  const nomeForn = (f: Fornecedor) => f.nomeFantasia || f.razaoSocial || f.nome || f.id;

  const confirmar = async () => {
    if (!descricao.trim()) { toast('Informe a descrição.', 'error'); return; }
    const dia = Math.min(31, Math.max(1, parseInt(diaVencimento, 10) || 1));
    const valorNum = parseFloat(String(valor).replace(',', '.')) || 0;
    if (!valorVariavel && valorNum <= 0) { toast('Informe um valor maior que zero (ou marque valor variável).', 'error'); return; }

    const payload: any = {
      descricao: descricao.trim(),
      periodicidade,
      diaVencimento: dia,
      valorVariavel,
      valor: valorVariavel ? 0 : valorNum,
      planoContasCodigo: planoContasCodigo || undefined,
      fornecedorId: fornecedorId || undefined,
      proximaGeracao: proximaGeracao ? new Date(proximaGeracao).toISOString() : undefined,
      observacoes: observacoes || undefined,
    };

    setSalvando(true);
    try {
      if (edicao) await recorrenciasApi.atualizar(rec!.id, payload);
      else await recorrenciasApi.criar(payload);
      toast(edicao ? 'Recorrência atualizada.' : 'Recorrência criada.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao salvar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop p-4" onClick={onClose}>
      <div className="relative w-full max-w-md bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white">{edicao ? 'Editar recorrência' : 'Nova despesa recorrente'}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Descrição</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Aluguel do galpão" className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Periodicidade</span>
              <select value={periodicidade} onChange={e => setPeriodicidade(e.target.value as Periodicidade)} className={inputCls}>
                {PERIODOS.map((p) => <option key={p} value={p}>{LABEL_PERIODO[p]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Dia de vencimento</span>
              <input type="number" min={1} max={31} value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={valorVariavel} onChange={e => setValorVariavel(e.target.checked)} />
            Valor variável (gera Conta a Pagar em rascunho para ajuste)
          </label>
          {!valorVariavel && (
            <label className="block">
              <span className="text-xs text-slate-400">Valor</span>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={`${inputCls} text-right font-mono`} />
            </label>
          )}
          <label className="block">
            <span className="text-xs text-slate-400">Categoria (plano de contas)</span>
            <select value={planoContasCodigo} onChange={e => setPlanoContasCodigo(e.target.value)} className={inputCls}>
              <option value="">— Sem categoria —</option>
              {contasPlano.map((c) => <option key={c.id} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Fornecedor (opcional)</span>
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={inputCls}>
              <option value="">— Nenhum —</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{nomeForn(f)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Próxima geração {edicao ? '' : '(deixe vazio p/ calcular pelo dia)'}</span>
            <input type="date" value={proximaGeracao} onChange={e => setProximaGeracao(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Observações</span>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={inputCls} />
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> {edicao ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  ), document.body);
}

function ModalPreview({ rec, onClose }: { rec: Recorrencia; onClose: () => void }) {
  const [itens, setItens] = useState<{ data: string; periodo: string; valor: number; rascunho: boolean }[] | null>(null);

  useEffect(() => {
    recorrenciasApi.preview(rec.id, 6).then((r) => setItens(r.data)).catch(() => setItens([]));
  }, [rec.id]);

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-indigo-300" />
            <h2 className="font-bold text-white">Próximas ocorrências</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">{rec.descricao}</p>
        {itens === null ? (
          <div className="py-6 text-center text-slate-400 text-sm">Carregando…</div>
        ) : itens.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">Sem previsões.</div>
        ) : (
          <ul className="space-y-2">
            {itens.map((it, i) => (
              <li key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                <span className="text-slate-200">{new Date(it.data).toLocaleDateString('pt-BR')}</span>
                <span className="font-mono text-slate-300">
                  {it.rascunho ? <span className="text-amber-300 text-xs">rascunho</span> : brl(it.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ), document.body);
}
