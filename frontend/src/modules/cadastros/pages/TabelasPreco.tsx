import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tags, RefreshCw, Plus, X, Trash2, Pencil, Percent, TrendingDown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { precificacaoApi, produtosApi } from '../../../services/api';
import { CadastroShell, PageHeader, FAB, FilterBar, Chips, TableCard, Th, Loader, Vazio, inp, lbl, btnGlass } from '../ui';

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

  const chipTabelas = [{ value: '', label: 'Todas' }, ...TABELAS.map((t) => ({ value: t, label: rotuloTabela(t) }))];

  return (
    <CadastroShell>
      <PageHeader
        icon={<Tags className="h-5 w-5" />}
        titulo="Tabelas de Preço"
        subtitulo={`${filtradas.length} preço(s) por tabela comercial (A/B/Especial) e promoções`}
        actions={
          <button onClick={carregar} className={btnGlass}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        }
      />

      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por produto ou código…">
        <Chips value={filtroTabela} onChange={setFiltroTabela} options={chipTabelas} />
      </FilterBar>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : filtradas.length === 0 ? (
          <Vazio icon={<Tags className="h-10 w-10" />} texto="Nenhum preço cadastrado" />
        ) : (
          <TableCard>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Tabela</Th>
                <Th className="text-right">Preço</Th>
                <Th className="text-right">Custo</Th>
                <Th className="text-right">Margem</Th>
                <Th>Promoção</Th>
                <Th className="text-right"> </Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => {
                const m = margem(p.preco, p.produtoPrecoCusto);
                const promoVigente = p.promoAtiva && p.promoPreco != null;
                return (
                  <tr key={p.id} className={`border-t border-[#23262F] hover:bg-white/[0.03] ${p.ativo ? '' : 'opacity-50'}`}>
                    <td className="px-3 py-1">
                      <p className="font-semibold text-[12.5px] leading-tight text-[#F7F8FA] truncate max-w-[240px]">{p.produtoDescricao}</p>
                      <p className="text-slate-500 text-[10.5px] font-mono leading-tight">{p.produtoCodigo}</p>
                    </td>
                    <td className="px-3 py-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#01B8FA]/12 text-[#0E86D4]">{rotuloTabela(p.tabela)}</span></td>
                    <td className="px-3 py-1 text-right text-[#F7F8FA] tabular-nums font-semibold">{brl(p.preco)}</td>
                    <td className="px-3 py-1 text-right text-[#8A90A0] tabular-nums">{brl(p.produtoPrecoCusto)}</td>
                    <td className={`px-3 py-1 text-right tabular-nums font-medium ${m < 0 ? 'text-[#FF6B7A]' : m < 10 ? 'text-[#0E86D4]' : 'text-[#2DD4A7]'}`}>{m.toFixed(1)}%</td>
                    <td className="px-3 py-1 text-[#8A90A0] text-xs">
                      {promoVigente ? (
                        <span className="inline-flex items-center gap-1 text-[#0E86D4]"><TrendingDown className="h-3.5 w-3.5" /> {brl(p.promoPreco)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-1 text-right">
                      {podeEditar && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditando(p)} className="h-8 w-8 rounded-lg hover:bg-[#0C0D10] text-slate-400 hover:text-[#01B8FA] flex items-center justify-center"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remover(p)} className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-[#FF6B7A] flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
      </div>

      {podeEditar && <FAB onClick={() => setCriando(true)} label="Novo preço" />}

      {criando && <ModalPreco onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
      {editando && <ModalPreco preco={editando} onClose={() => setEditando(null)} onDone={() => { setEditando(null); carregar(); }} />}
    </CadastroShell>
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-backdrop" onClick={onClose}>
      <div className="relative w-full max-w-md bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        {/* Faixa de brilho ciano no topo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#01B8FA]/60 to-transparent" aria-hidden />
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-[#F7F8FA] text-sm tracking-tight">{edicao ? 'Editar preço' : 'Novo preço de tabela'}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-[#0C0D10] text-[#8A90A0] hover:text-[#F7F8FA] flex items-center justify-center transition-all duration-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {!edicao && (
            <label className="block relative">
              <span className={lbl}>Produto</span>
              <input value={buscaProd} onChange={e => { setBuscaProd(e.target.value); setProdutoId(''); }} placeholder="Buscar produto…" className={inp} />
              {!produtoId && produtos.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto bg-[#101216] border border-[#23262F] rounded-lg shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
                  {produtos.map((pr) => (
                    <button key={pr.id} type="button" onClick={() => { setProdutoId(pr.id); setBuscaProd(`${pr.codigo} — ${pr.descricao}`); setProdutos([]); if (!valor && pr.precoVenda) setValor(String(pr.precoVenda)); }}
                      className="w-full text-left px-3 py-2 text-sm text-[#F7F8FA] hover:bg-[#0C0D10]">
                      <span className="font-mono text-xs text-slate-500">{pr.codigo}</span> {pr.descricao}
                    </button>
                  ))}
                </div>
              )}
            </label>
          )}
          {edicao && <div className="text-sm text-[#8A90A0]"><span className="font-mono text-xs text-slate-500">{preco!.produtoCodigo}</span> {preco!.produtoDescricao}</div>}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={lbl}>Tabela</span>
              <select value={tabela} onChange={e => setTabela(e.target.value)} disabled={edicao} className={`${inp} disabled:opacity-60`}>
                {TABELAS.map((t) => <option key={t} value={t}>{rotuloTabela(t)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>Preço (R$)</span>
              <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} className={`${inp} text-right font-mono`} />
            </label>
          </div>

          <div className="rounded-lg border border-[#23262F] p-3">
            <label className="flex items-center gap-2 text-sm text-[#8A90A0] cursor-pointer">
              <input type="checkbox" checked={promoAtiva} onChange={e => setPromoAtiva(e.target.checked)} className="accent-[#01B8FA]" />
              <Percent className="h-3.5 w-3.5 text-[#0E86D4]" /> Promoção por período
            </label>
            {promoAtiva && (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className={lbl}>Preço promocional (R$)</span>
                  <input type="number" step="0.01" min="0" value={promoPreco} onChange={e => setPromoPreco(e.target.value)} className={`${inp} text-right font-mono`} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={lbl}>Início</span>
                    <input type="date" value={promoInicio} onChange={e => setPromoInicio(e.target.value)} className={`${inp} [color-scheme:dark]`} />
                  </label>
                  <label className="block">
                    <span className={lbl}>Fim</span>
                    <input type="date" value={promoFim} onChange={e => setPromoFim(e.target.value)} className={`${inp} [color-scheme:dark]`} />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">Datas em branco = promoção sempre vigente enquanto ativa.</p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-[#8A90A0] cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="accent-[#01B8FA]" /> Ativo
          </label>
        </div>
        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] font-bold py-2.5 rounded-lg shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all duration-300 active:scale-[0.98] disabled:opacity-40">
          <Plus className="h-4 w-4" /> {salvando ? 'Salvando…' : edicao ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </div>
  ), document.body);
}
