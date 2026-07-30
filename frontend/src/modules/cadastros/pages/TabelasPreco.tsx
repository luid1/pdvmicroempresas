import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tags, RefreshCw, Plus, X, Search, Trash2, Pencil, Percent, TrendingDown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { precificacaoApi, produtosApi } from '../../../services/api';

interface PrecoTabela {
  id: string;
  produtoId: string;
  tabela: string;
  preco: number;
  promoAtiva: boolean;
  promoPreco: number | null;
  promoInicio: string | null;
  promoFim: string | null;
  ativo: boolean;
  produtoDescricao: string;
  produtoCodigo: string;
  produtoPrecoVenda: number;
  produtoPrecoCusto: number;
}

interface Produto {
  id: string;
  descricao: string;
  codigo: string;
  precoVenda?: number;
  precoCusto?: number;
}

const TABELAS = ['TABELA_A', 'TABELA_B', 'ESPECIAL'];
const rotuloTabela = (t: string) => ({ TABELA_A: 'Tabela A', TABELA_B: 'Tabela B', ESPECIAL: 'Especial' }[t] || t);
const brl = (v: any) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TabelasPreco() {
  const { pode } = useAuth();
  const podeEditar = pode('/cadastros/tabelas-preco', 'EDITAR') || pode('/cadastros/produtos', 'EDITAR');

  const [lista, setLista] = useState<PrecoTabela[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTabela, setFiltroTabela] = useState('');
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<PrecoTabela | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    precificacaoApi.listar({ tabela: filtroTabela || undefined })
      .then((r) => setLista(r.data || []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [filtroTabela]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) => p.produtoDescricao.toLowerCase().includes(q) || (p.produtoCodigo || '').toLowerCase().includes(q));
  }, [lista, busca]);

  const remover = async (p: PrecoTabela) => {
    if (!(await confirmDialog(`Remover o preço de ${p.produtoDescricao} na ${rotuloTabela(p.tabela)}?`))) return;
    try {
      await precificacaoApi.remover(p.id);
      toast('Preço removido.', 'success');
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao remover.', 'error');
    }
  };

  const margem = (preco: number, custo: number) => (custo > 0 ? ((preco - custo) / custo) * 100 : 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-2xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
            <Tags className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Tabelas de Preço</h1>
            <p className="text-[13px] text-slate-400">Preços por tabela comercial (A/B/Especial) e promoções por período. O pedido puxa o preço da tabela do cliente automaticamente.</p>
          </div>
        </div>
        {podeEditar && (
          <button onClick={() => setCriando(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-3 py-2 rounded-lg">
            <Plus className="h-4 w-4" /> Novo preço
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por produto ou código…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
        </div>
        <select value={filtroTabela} onChange={(e) => setFiltroTabela(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400">
          <option value="">Todas as tabelas</option>
          {TABELAS.map((t) => <option key={t} value={t}>{rotuloTabela(t)}</option>)}
        </select>
        <button onClick={carregar} className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Produto</th>
              <th className="text-left px-4 py-3 font-semibold">Tabela</th>
              <th className="text-right px-4 py-3 font-semibold">Preço</th>
              <th className="text-right px-4 py-3 font-semibold">Custo</th>
              <th className="text-right px-4 py-3 font-semibold">Margem</th>
              <th className="text-left px-4 py-3 font-semibold">Promoção</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhum preço cadastrado.</td></tr>
            ) : filtradas.map((p) => {
              const m = margem(p.preco, p.produtoPrecoCusto);
              const promoVigente = p.promoAtiva && p.promoPreco != null;
              return (
                <tr key={p.id} className={`border-t border-slate-800 ${p.ativo ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3">
                    <div className="text-slate-100 font-medium">{p.produtoDescricao}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.produtoCodigo}</div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-xs font-semibold">{rotuloTabela(p.tabela)}</span></td>
                  <td className="px-4 py-3 text-right text-slate-100 tabular-nums font-semibold">{brl(p.preco)}</td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{brl(p.produtoPrecoCusto)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${m < 0 ? 'text-rose-400' : m < 10 ? 'text-amber-300' : 'text-emerald-300'}`}>{m.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {promoVigente ? (
                      <span className="inline-flex items-center gap-1 text-fuchsia-300"><TrendingDown className="h-3.5 w-3.5" /> {brl(p.promoPreco)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {podeEditar && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditando(p)} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remover(p)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-400 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {criando && <ModalPreco onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
      {editando && <ModalPreco preco={editando} onClose={() => setEditando(null)} onDone={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalPreco({ preco, onClose, onDone }: { preco?: PrecoTabela; onClose: () => void; onDone: () => void }) {
  const edicao = !!preco;
  const [produtoId, setProdutoId] = useState(preco?.produtoId || '');
  const [buscaProd, setBuscaProd] = useState(preco ? `${preco.produtoCodigo} — ${preco.produtoDescricao}` : '');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tabela, setTabela] = useState(preco?.tabela || 'TABELA_A');
  const [valor, setValor] = useState(String(preco?.preco ?? ''));
  const [promoAtiva, setPromoAtiva] = useState(preco?.promoAtiva ?? false);
  const [promoPreco, setPromoPreco] = useState(preco?.promoPreco != null ? String(preco.promoPreco) : '');
  const [promoInicio, setPromoInicio] = useState(preco?.promoInicio ? preco.promoInicio.slice(0, 10) : '');
  const [promoFim, setPromoFim] = useState(preco?.promoFim ? preco.promoFim.slice(0, 10) : '');
  const [ativo, setAtivo] = useState(preco?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (edicao) return;
    const q = buscaProd.trim();
    if (q.length < 2) { setProdutos([]); return; }
    const t = setTimeout(() => {
      produtosApi.list({ search: q, take: 15 }).then((r) => setProdutos(r.data?.items || r.data || [])).catch(() => setProdutos([]));
    }, 250);
    return () => clearTimeout(t);
  }, [buscaProd, edicao]);

  const confirmar = async () => {
    if (!produtoId) { toast('Selecione o produto.', 'error'); return; }
    const p = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(p) || p < 0) { toast('Informe um preço válido.', 'error'); return; }
    let pp: number | null = null;
    if (promoAtiva) {
      pp = parseFloat(String(promoPreco).replace(',', '.'));
      if (isNaN(pp) || pp < 0) { toast('Informe um preço promocional válido.', 'error'); return; }
    }
    setSalvando(true);
    try {
      await precificacaoApi.upsert({
        produtoId,
        tabela,
        preco: p,
        promoAtiva,
        promoPreco: promoAtiva ? pp : null,
        promoInicio: promoAtiva && promoInicio ? promoInicio : null,
        promoFim: promoAtiva && promoFim ? promoFim : null,
        ativo,
      });
      toast(edicao ? 'Preço atualizado.' : 'Preço cadastrado.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao salvar.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-md bg-[#0e1729]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-white">{edicao ? 'Editar preço' : 'Novo preço de tabela'}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {!edicao && (
            <label className="block relative">
              <span className="text-xs text-slate-400">Produto</span>
              <input value={buscaProd} onChange={e => { setBuscaProd(e.target.value); setProdutoId(''); }} placeholder="Buscar produto…"
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400" />
              {!produtoId && produtos.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto bg-[#0e1729] border border-slate-700 rounded-lg shadow-xl">
                  {produtos.map((pr) => (
                    <button key={pr.id} type="button" onClick={() => { setProdutoId(pr.id); setBuscaProd(`${pr.codigo} — ${pr.descricao}`); setProdutos([]); if (!valor && pr.precoVenda) setValor(String(pr.precoVenda)); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                      <span className="font-mono text-xs text-slate-500">{pr.codigo}</span> {pr.descricao}
                    </button>
                  ))}
                </div>
              )}
            </label>
          )}
          {edicao && <div className="text-sm text-slate-300"><span className="font-mono text-xs text-slate-500">{preco!.produtoCodigo}</span> {preco!.produtoDescricao}</div>}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Tabela</span>
              <select value={tabela} onChange={e => setTabela(e.target.value)} disabled={edicao}
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400 disabled:opacity-60">
                {TABELAS.map((t) => <option key={t} value={t}>{rotuloTabela(t)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Preço (R$)</span>
              <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-emerald-400" />
            </label>
          </div>

          <div className="rounded-lg border border-slate-700/60 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={promoAtiva} onChange={e => setPromoAtiva(e.target.checked)} />
              <Percent className="h-3.5 w-3.5 text-fuchsia-300" /> Promoção por período
            </label>
            {promoAtiva && (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="text-xs text-slate-400">Preço promocional (R$)</span>
                  <input type="number" step="0.01" min="0" value={promoPreco} onChange={e => setPromoPreco(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 text-right font-mono focus:outline-none focus:border-fuchsia-400" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-400">Início</span>
                    <input type="date" value={promoInicio} onChange={e => setPromoInicio(e.target.value)}
                      className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-fuchsia-400" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Fim</span>
                    <input type="date" value={promoFim} onChange={e => setPromoFim(e.target.value)}
                      className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-fuchsia-400" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">Datas em branco = promoção sempre vigente enquanto ativa.</p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
          <Plus className="h-4 w-4" /> {edicao ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </div>
  ), document.body);
}
