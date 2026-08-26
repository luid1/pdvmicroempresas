import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Landmark, RefreshCw, Plus, X, Search, Sprout, Trash2, Pencil, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { financeiroApi } from '../../../services/api';

interface Conta {
  id: string;
  codigo: string;
  descricao: string;
  tipo: 'DEBITO' | 'CREDITO';
  nivel: number;
  pai?: string | null;
  analitica: boolean;
  ativo: boolean;
}

const TIPO_META: Record<string, { label: string; cls: string }> = {
  DEBITO: { label: 'Débito', cls: 'bg-[#FF6B7A]/12 text-[#FF6B7A] border-[#FF6B7A]/30' },
  CREDITO: { label: 'Crédito', cls: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/30' },
};

export default function PlanoContas() {
  const { pode } = useAuth();
  const podeConfigurar = pode('/financeiro/plano-contas', 'EDITAR');

  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [incluirInativas, setIncluirInativas] = useState(false);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [semeando, setSemeando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    financeiroApi.planoContas.list(incluirInativas)
      .then((r) => setContas(r.data || []))
      .catch(() => setContas([]))
      .finally(() => setLoading(false));
  }, [incluirInativas]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contas;
    return contas.filter((c) => c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q));
  }, [contas, busca]);

  const semear = async () => {
    if (!(await confirmDialog('Popular o plano de contas padrão? Contas existentes não são alteradas.'))) return;
    setSemeando(true);
    try {
      const r = await financeiroApi.planoContas.semear();
      toast(`Plano semeado (${r.data?.criadas ?? 0} contas criadas).`, 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao semear.', 'error');
    } finally { setSemeando(false); }
  };

  const remover = async (c: Conta) => {
    if (!(await confirmDialog(`Inativar a conta ${c.codigo} · ${c.descricao}?`))) return;
    try {
      await financeiroApi.planoContas.remover(c.id);
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
          <span className="h-11 w-11 rounded-2xl bg-[#01B8FA]/12 text-[#01B8FA] flex items-center justify-center">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#F7F8FA]">Plano de Contas</h1>
            <p className="text-[13px] text-[#8A90A0]">Categorias contábeis que classificam despesas e receitas no DRE.</p>
          </div>
        </div>
        {podeConfigurar && (
          <div className="flex items-center gap-2">
            <button onClick={semear} disabled={semeando} className="flex items-center gap-2 bg-[#101216] border border-[#23262F] hover:bg-[#16181F] text-[#8A90A0] hover:text-[#F7F8FA] text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-40">
              <Sprout className="h-4 w-4" /> Semear padrão
            </button>
            <button onClick={() => setCriando(true)} className="flex items-center gap-2 bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] text-sm font-bold px-3 py-2 rounded-lg shadow-[0_6px_18px_rgba(1,184,250,0.28)]">
              <Plus className="h-4 w-4" /> Nova conta
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E6472]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou descrição…"
            className="w-full bg-[#101216] border border-[#23262F] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]/60" />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#8A90A0] cursor-pointer">
          <input type="checkbox" checked={incluirInativas} onChange={(e) => setIncluirInativas(e.target.checked)} />
          Incluir inativas
        </label>
        <button onClick={carregar} className="h-9 w-9 rounded-lg bg-[#101216] hover:bg-[#16181F] text-[#8A90A0] flex items-center justify-center">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-2xl border border-[#23262F] bg-[#101216] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0C0D10] text-[11px] uppercase tracking-wider text-[#8A90A0] border-b border-[#23262F]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Descrição</th>
              <th className="text-left px-4 py-3 font-semibold">Natureza</th>
              <th className="text-center px-4 py-3 font-semibold">Analítica</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#5E6472]">Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#5E6472]">Nenhuma conta. Use “Semear padrão” para começar.</td></tr>
            ) : filtradas.map((c) => (
              <tr key={c.id} className={`border-t border-[#23262F] ${c.ativo ? '' : 'opacity-50'}`}>
                <td className="px-4 py-3 font-num text-[#8A90A0]" style={{ paddingLeft: `${16 + (c.nivel - 1) * 16}px` }}>
                  {!c.analitica && <ChevronRight className="inline h-3 w-3 text-[#5E6472] mr-1" />}
                  {c.codigo}
                </td>
                <td className={`px-4 py-3 ${c.analitica ? 'text-[#8A90A0]' : 'text-[#F7F8FA] font-semibold'}`}>{c.descricao}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${TIPO_META[c.tipo].cls}`}>{TIPO_META[c.tipo].label}</span>
                </td>
                <td className="px-4 py-3 text-center text-[#8A90A0]">{c.analitica ? 'Sim' : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {podeConfigurar && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditando(c)} className="h-8 w-8 rounded-lg hover:bg-[#16181F] text-[#8A90A0] flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
                      {c.ativo && <button onClick={() => remover(c)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-[#FF6B7A] flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {criando && <ModalConta onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
      {editando && <ModalConta conta={editando} onClose={() => setEditando(null)} onDone={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalConta({ conta, onClose, onDone }: { conta?: Conta; onClose: () => void; onDone: () => void }) {
  const edicao = !!conta;
  const [codigo, setCodigo] = useState(conta?.codigo || '');
  const [descricao, setDescricao] = useState(conta?.descricao || '');
  const [tipo, setTipo] = useState<'DEBITO' | 'CREDITO'>(conta?.tipo || 'DEBITO');
  const [analitica, setAnalitica] = useState(conta?.analitica ?? true);
  const [ativo, setAtivo] = useState(conta?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!descricao.trim()) { toast('Informe a descrição.', 'error'); return; }
    if (!edicao && !codigo.trim()) { toast('Informe o código.', 'error'); return; }
    setSalvando(true);
    try {
      if (edicao) {
        await financeiroApi.planoContas.atualizar(conta!.id, { descricao, tipo, analitica, ativo });
      } else {
        await financeiroApi.planoContas.criar({ codigo: codigo.trim(), descricao, tipo, analitica });
      }
      toast(edicao ? 'Conta atualizada.' : 'Conta criada.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao salvar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-[#F7F8FA]">{edicao ? 'Editar conta' : 'Nova conta'}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#16181F] text-[#8A90A0] flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[#8A90A0]">Código {edicao && <span className="text-[#5E6472]">(não editável)</span>}</span>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} disabled={edicao} placeholder="ex.: 3.4.08"
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] font-num disabled:opacity-50 focus:outline-none focus:border-[#01B8FA]/60" />
          </label>
          <label className="block">
            <span className="text-xs text-[#8A90A0]">Descrição</span>
            <input value={descricao} onChange={e => setDescricao(e.target.value)}
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]/60" />
          </label>
          <label className="block">
            <span className="text-xs text-[#8A90A0]">Natureza</span>
            <select value={tipo} onChange={e => setTipo(e.target.value as 'DEBITO' | 'CREDITO')}
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]/60">
              <option value="DEBITO">Débito (despesa/custo)</option>
              <option value="CREDITO">Crédito (receita)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[#8A90A0] cursor-pointer">
            <input type="checkbox" checked={analitica} onChange={e => setAnalitica(e.target.checked)} />
            Analítica (recebe lançamentos)
          </label>
          {edicao && (
            <label className="flex items-center gap-2 text-sm text-[#8A90A0] cursor-pointer">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              Ativa
            </label>
          )}
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> {edicao ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  ), document.body);
}
