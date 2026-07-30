import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardCheck,
  PackageSearch,
  Search,
  Plus,
  Check,
  X,
  TrendingDown,
  Package,
  BadgeCheck,
  AlertTriangle,
  User,
  Wallet,
  ClipboardList,
  RefreshCw,
  Loader2,
  Truck,
  Trash2,
  Ban,
  History,
  ChevronRight,
  CalendarDays,
  Store,
  Pencil,
} from 'lucide-react';
import { comprasApi, produtosApi, fornecedoresApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/* ══════════════════════════════════════════════════════════════════════════════
   App de Compras & Abastecimento (Compradores) — Mercado PDV
   CONECTADO AO BACKEND: lê e grava Ordens de Compra reais (/compras), produtos reais
   (/produtos, FLV) e a lista de reposição (/estoque/:filial/a-comprar).
   O comprador APROVA/REPROVA e CRIA ordens de compra. NÃO dá entrada em estoque
   (isso é feito pela equipe de Recebimento). Duas abas: Aprovações · Reposição.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── Tipos ─────────────────────────────────────── */
type Aba = 'aprovacoes' | 'reposicao';

type StatusOC = 'PENDENTE' | 'APROVADA' | 'PARCIAL' | 'ENTREGUE' | 'CANCELADA';

interface Fornecedor {
  id: string;
  razaoSocial?: string;
  nomeFantasia?: string;
}

interface OrdemCompra {
  id: string;
  numero: number | string;
  status: StatusOC;
  valorTotal: number | string;
  condicaoPagamento?: string | null;
  dataEmissao?: string | null;
  dataEntregaPrevista?: string | null;
  observacoes?: string | null;
  fornecedor?: Fornecedor | null;
  _count?: { itens?: number } | null;
}

interface Produto {
  id: string;
  codigo?: string | null;
  descricao: string;
  categoria?: string | null;
  grupo?: string | null;
  precoCompra?: number | string | null;
  estoqueKg?: number | null;
  estoqueMinimo?: number | string | null;
  unidadeMedida?: { sigla?: string } | null;
}

interface ItemAComprar {
  produtoId: string;
  codigo?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  reservada?: number;
  disponivel: number;
  estoqueMinimo: number;
}

interface HistoricoCompra {
  ordemId: string;
  numero: number;
  status: StatusOC;
  data: string | null;
  fornecedor: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;
}

const STATUS_CI: Record<StatusOC, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  PARCIAL: { label: 'Parcial', cls: 'bg-sky-100 text-sky-700' },
  ENTREGUE: { label: 'Entregue', cls: 'bg-neutral-200 text-neutral-600' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700' },
};

/* Meta mensal de compras (teto orçamentário do comprador). O comprometido é
   derivado das OCs reais aprovadas no mês corrente. */
const META_MENSAL = 45000;

const COND_LABEL: Record<string, string> = {
  A_VISTA: 'À vista',
  '7_DIAS': '7 dias',
  '15_DIAS': '15 dias',
  '30_DIAS': '30 dias',
  '30_60': '30/60',
  '30_60_90': '30/60/90',
};

/* Categorias/grupos considerados FLV (frutas, legumes e verduras). */
const FLV_TERMOS = ['flv', 'fruta', 'legume', 'verdura', 'hortifruti', 'horti'];
const ehFLV = (p: Produto) => {
  const alvo = `${p.categoria ?? ''} ${p.grupo ?? ''}`.toLowerCase();
  return FLV_TERMOS.some((t) => alvo.includes(t));
};

/* ───────────────────────────── Helpers ───────────────────────────────────── */
const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const n = (v: unknown) => {
  const x = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
};
const nomeForn = (f?: Fornecedor | null) => f?.nomeFantasia || f?.razaoSocial || 'Fornecedor';
const mesmoMes = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const hoje = new Date();
  return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
};
const dataCurta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
/** 0..1 — quanto menor, mais crítico (disponível vs. mínimo). */
const nivelEstoque = (atual: number, minimo: number) =>
  minimo <= 0 ? 1 : Math.max(0, Math.min(1, atual / minimo));

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
export default function AppComprador() {
  const { filialAtiva } = useAuth();
  const [aba, setAba] = useState<Aba>('aprovacoes');

  const [ocs, setOcs] = useState<OrdemCompra[]>([]);
  const [carregandoOcs, setCarregandoOcs] = useState(true);
  const [erroOcs, setErroOcs] = useState('');

  const [aComprar, setAComprar] = useState<ItemAComprar[]>([]);
  const [carregandoRep, setCarregandoRep] = useState(true);

  const [modalNovaOC, setModalNovaOC] = useState(false);
  const [prefillRep, setPrefillRep] = useState<ItemAComprar | null>(null);
  const [editandoOcId, setEditandoOcId] = useState<string | null>(null);
  const [produtoSel, setProdutoSel] = useState<ItemAComprar | null>(null);

  const fecharModal = useCallback(() => {
    setModalNovaOC(false);
    setPrefillRep(null);
    setEditandoOcId(null);
  }, []);

  // Toast interno
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'erro' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificar = useCallback((msg: string, tone: 'ok' | 'erro' | 'info' = 'info') => {
    setToast({ msg, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  /* ── Carga de dados reais ── */
  const carregarOcs = useCallback(() => {
    setCarregandoOcs(true);
    setErroOcs('');
    comprasApi
      .list()
      .then((r) => setOcs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setErroOcs('Não foi possível carregar as ordens de compra do sistema.'))
      .finally(() => setCarregandoOcs(false));
  }, []);

  const carregarReposicao = useCallback(() => {
    if (!filialAtiva?.id) {
      setAComprar([]);
      setCarregandoRep(false);
      return;
    }
    setCarregandoRep(true);
    comprasApi
      .aComprar(filialAtiva.id)
      .then((r) => setAComprar(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAComprar([]))
      .finally(() => setCarregandoRep(false));
  }, [filialAtiva?.id]);

  useEffect(() => { carregarOcs(); }, [carregarOcs]);
  useEffect(() => { carregarReposicao(); }, [carregarReposicao]);

  /* ── Regras de negócio (reais) ── */
  const alterarStatus = useCallback(
    async (oc: OrdemCompra, novo: 'APROVADA' | 'CANCELADA', rotulo?: string) => {
      try {
        await comprasApi.updateStatus(oc.id, novo);
        setOcs((prev) => prev.map((o) => (o.id === oc.id ? { ...o, status: novo } : o)));
        notificar(
          novo === 'APROVADA'
            ? `CI #${oc.numero} aprovada · ${brl(n(oc.valorTotal))}`
            : `CI #${oc.numero} ${rotulo ?? 'reprovada'}`,
          novo === 'APROVADA' ? 'ok' : 'info',
        );
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        notificar(msg || 'Erro ao atualizar a CI.', 'erro');
      }
    },
    [notificar],
  );

  const criarOC = useCallback(
    async (payload: {
      fornecedorId: string;
      condicaoPagamento: string;
      dataEntregaPrevista: string | null;
      observacoes: string | null;
      itens: { produtoId: string | null; descricao: string; unidade: string; quantidade: number; precoUnitario: number }[];
    }) => {
      try {
        await comprasApi.create({ ...payload, filialId: filialAtiva?.id });
        setModalNovaOC(false);
        setPrefillRep(null);
        setAba('aprovacoes');
        notificar('Ordem de compra criada no sistema.', 'ok');
        carregarOcs();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        notificar(msg || 'Erro ao criar a ordem de compra.', 'erro');
      }
    },
    [filialAtiva?.id, notificar, carregarOcs],
  );

  const editarOC = useCallback(
    async (payload: {
      fornecedorId: string;
      condicaoPagamento: string;
      dataEntregaPrevista: string | null;
      observacoes: string | null;
      itens: { produtoId: string | null; descricao: string; unidade: string; quantidade: number; precoUnitario: number }[];
    }) => {
      if (!editandoOcId) return;
      try {
        await comprasApi.update(editandoOcId, { ...payload, filialId: filialAtiva?.id });
        fecharModal();
        notificar('CI atualizada no sistema.', 'ok');
        carregarOcs();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        notificar(msg || 'Erro ao atualizar a CI.', 'erro');
      }
    },
    [editandoOcId, filialAtiva?.id, notificar, carregarOcs, fecharModal],
  );

  const abrirNovaOCPara = useCallback((item: ItemAComprar) => {
    setPrefillRep(item);
    setEditandoOcId(null);
    setModalNovaOC(true);
  }, []);

  const abrirEdicao = useCallback((oc: OrdemCompra) => {
    setPrefillRep(null);
    setEditandoOcId(oc.id);
    setModalNovaOC(true);
  }, []);

  /* ── Derivados ── */
  const pendentes = useMemo(() => ocs.filter((o) => o.status === 'PENDENTE'), [ocs]);
  const resolvidas = useMemo(
    () => ocs.filter((o) => o.status === 'APROVADA' || o.status === 'CANCELADA').slice(0, 8),
    [ocs],
  );
  const comprometido = useMemo(
    () =>
      ocs
        .filter((o) => (o.status === 'APROVADA' || o.status === 'PARCIAL' || o.status === 'ENTREGUE') && mesmoMes(o.dataEmissao))
        .reduce((s, o) => s + n(o.valorTotal), 0),
    [ocs],
  );
  const disponivel = Math.max(0, META_MENSAL - comprometido);
  const pctDisp = Math.max(0, Math.min(100, (disponivel / META_MENSAL) * 100));

  return (
    <div className="hetros-comprador min-h-full w-full flex items-center justify-center bg-neutral-200/60 py-6 px-4">
      {/* Escapa do tema dark global: dentro do celular o app é claro (iOS-like) */}
      <style>{`
        .hetros-comprador .bg-white { background-color: #ffffff !important; }
        .hetros-comprador input:not([type="checkbox"]):not([type="radio"]),
        .hetros-comprador select,
        .hetros-comprador textarea { background-color: #ffffff !important; color: #262626 !important; }
        .hetros-comprador input::placeholder,
        .hetros-comprador textarea::placeholder { color: #9ca3af !important; }
      `}</style>
      <div className="relative w-full max-w-[400px] h-[820px] bg-[#FAFAFA] rounded-[2.75rem] shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-30 pointer-events-none">
          <div className="mt-2 h-5 w-32 bg-black rounded-full" />
        </div>

        {/* Status bar */}
        <div className="shrink-0 pt-3 pb-1 px-6 flex items-center justify-between text-[11px] font-medium text-neutral-500">
          <span>9:41</span>
          <span className="tracking-widest">HETROS · SUPRIMENTOS</span>
          <span>100%</span>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {aba === 'aprovacoes' && (
            <AprovacoesTab
              disponivel={disponivel}
              pctDisp={pctDisp}
              comprometido={comprometido}
              pendentes={pendentes}
              resolvidas={resolvidas}
              carregando={carregandoOcs}
              erro={erroOcs}
              onAprovar={(oc) => alterarStatus(oc, 'APROVADA')}
              onReprovar={(oc) => alterarStatus(oc, 'CANCELADA')}
              onCancelar={(oc) => alterarStatus(oc, 'CANCELADA', 'cancelada')}
              onEditar={abrirEdicao}
              onAtualizar={carregarOcs}
            />
          )}
          {aba === 'reposicao' && (
            <ReposicaoTab
              itens={aComprar}
              cis={ocs}
              carregando={carregandoRep}
              temFilial={!!filialAtiva?.id}
              onNovaOC={() => setModalNovaOC(true)}
              onAbrirProduto={setProdutoSel}
              onAtualizar={carregarReposicao}
            />
          )}
        </div>

        {/* Bottom tabs */}
        <nav className="shrink-0 bg-white/90 backdrop-blur border-t border-neutral-200 px-3 pt-2 pb-5 grid grid-cols-2 gap-1">
          <TabButton ativo={aba === 'aprovacoes'} icon={ClipboardCheck} label="Aprovações" onClick={() => setAba('aprovacoes')} badge={pendentes.length} />
          <TabButton ativo={aba === 'reposicao'} icon={PackageSearch} label="Reposição" onClick={() => setAba('reposicao')} badge={aComprar.length} />
        </nav>

        {/* Toast */}
        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-40 w-[86%]">
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-lg flex items-center gap-2 ${
                toast.tone === 'ok'
                  ? 'bg-emerald-900 text-emerald-50'
                  : toast.tone === 'erro'
                    ? 'bg-rose-900 text-rose-50'
                    : 'bg-neutral-900 text-neutral-50'
              }`}
            >
              {toast.tone === 'ok' ? (
                <BadgeCheck className="h-4 w-4 shrink-0" />
              ) : toast.tone === 'erro' ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <ClipboardList className="h-4 w-4 shrink-0" />
              )}
              <span>{toast.msg}</span>
            </div>
          </div>
        )}

        {/* Painel do produto (histórico de compras + quem está pedindo) */}
        {produtoSel && (
          <ProdutoSheet
            item={produtoSel}
            onClose={() => setProdutoSel(null)}
            onNovaCI={() => {
              setProdutoSel(null);
              setModalNovaOC(true);
            }}
            onComprar={() => {
              const item = produtoSel;
              setProdutoSel(null);
              abrirNovaOCPara(item);
            }}
          />
        )}

        {/* Modal Nova/Editar CI */}
        {modalNovaOC && (
          <NovaOCModal
            prefill={prefillRep}
            ordemId={editandoOcId}
            onClose={fecharModal}
            onSubmit={editandoOcId ? editarOC : criarOC}
            notificar={notificar}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 1 — APROVAÇÕES DE ORDENS DE COMPRA
   ════════════════════════════════════════════════════════════════════════════ */
function AprovacoesTab({
  disponivel,
  pctDisp,
  comprometido,
  pendentes,
  resolvidas,
  carregando,
  erro,
  onAprovar,
  onReprovar,
  onCancelar,
  onEditar,
  onAtualizar,
}: {
  disponivel: number;
  pctDisp: number;
  comprometido: number;
  pendentes: OrdemCompra[];
  resolvidas: OrdemCompra[];
  carregando: boolean;
  erro: string;
  onAprovar: (oc: OrdemCompra) => void;
  onReprovar: (oc: OrdemCompra) => void;
  onCancelar: (oc: OrdemCompra) => void;
  onEditar: (oc: OrdemCompra) => void;
  onAtualizar: () => void;
}) {
  return (
    <div className="pb-6">
      {/* Orçamento (oversized) */}
      <header className="px-6 pt-4 pb-6 bg-gradient-to-b from-[#EFEBE4] to-[#FAFAFA]">
        <div className="flex items-center gap-2 text-neutral-500">
          <Wallet className="h-4 w-4" />
          <p className="text-[13px] uppercase tracking-[0.18em] font-semibold">Orçamento disponível</p>
        </div>
        <p className="mt-2 text-[46px] leading-none font-semibold tracking-tight text-neutral-900 tabular-nums">
          {brl(disponivel)}
        </p>
        <div className="mt-4 h-2 rounded-full bg-neutral-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pctDisp < 20 ? 'bg-rose-500' : pctDisp < 50 ? 'bg-amber-500' : 'bg-neutral-800'
            }`}
            style={{ width: `${pctDisp}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Comprometido no mês · {brl(comprometido)}</span>
          <span>Meta · {brl(META_MENSAL)}</span>
        </div>
      </header>

      {/* Pendentes */}
      <section className="px-4">
        <div className="flex items-center justify-between px-2 mb-3">
          <h2 className="text-[15px] font-semibold text-neutral-900">OCs aguardando aprovação</h2>
          <button
            onClick={onAtualizar}
            className="text-[11px] font-medium text-neutral-500 bg-neutral-200/70 rounded-full px-2.5 py-1 flex items-center gap-1 hover:bg-neutral-200 active:scale-95 transition"
          >
            <RefreshCw className={`h-3 w-3 ${carregando ? 'animate-spin' : ''}`} /> {pendentes.length}
          </button>
        </div>

        {carregando ? (
          <div className="py-14 text-center text-neutral-400">
            <Loader2 className="h-7 w-7 mx-auto animate-spin mb-2" />
            <p className="text-sm">Carregando ordens do sistema…</p>
          </div>
        ) : erro ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 py-8 px-5 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-rose-500 mb-2" />
            <p className="text-rose-700 text-sm font-medium">{erro}</p>
            <button onClick={onAtualizar} className="mt-3 text-[13px] font-semibold text-rose-700 underline">
              Tentar novamente
            </button>
          </div>
        ) : pendentes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/60 py-14 text-center">
            <BadgeCheck className="h-9 w-9 mx-auto text-emerald-500 mb-2" />
            <p className="text-neutral-700 font-medium">Tudo em dia</p>
            <p className="text-[13px] text-neutral-400 mt-1">Nenhuma OC aguardando aprovação.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((oc) => (
              <OCCard key={oc.id} oc={oc} onAprovar={() => onAprovar(oc)} onReprovar={() => onReprovar(oc)} onEditar={() => onEditar(oc)} />
            ))}
          </div>
        )}
      </section>

      {/* Resolvidas */}
      {resolvidas.length > 0 && (
        <section className="px-4 mt-7">
          <h3 className="px-2 mb-2 text-[12px] uppercase tracking-widest font-semibold text-neutral-400">
            Movimentadas recentemente
          </h3>
          <div className="space-y-2">
            {resolvidas.map((oc) => (
              <div key={oc.id} className="flex items-center gap-3 rounded-2xl bg-white border border-neutral-200 px-4 py-3">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    oc.status === 'CANCELADA' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {oc.status === 'CANCELADA' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-neutral-800 truncate">
                    CI #{oc.numero} · {nomeForn(oc.fornecedor)}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {oc.status === 'CANCELADA' ? 'Cancelada' : 'Aprovada'} · {dataCurta(oc.dataEmissao)}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-neutral-500 tabular-nums">{brl(n(oc.valorTotal))}</p>
                {oc.status === 'APROVADA' && (
                  <button
                    onClick={() => onEditar(oc)}
                    title="Editar CI"
                    className="shrink-0 h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-900 hover:text-white active:scale-95 transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {oc.status === 'APROVADA' && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Cancelar a CI #${oc.numero}?`)) onCancelar(oc);
                    }}
                    title="Cancelar CI"
                    className="shrink-0 h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-rose-50 hover:text-rose-600 active:scale-95 transition"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Card de OC com swipe (arrastar) + botões ── */
function OCCard({ oc, onAprovar, onReprovar, onEditar }: { oc: OrdemCompra; onAprovar: () => void; onReprovar: () => void; onEditar: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saindo, setSaindo] = useState<null | 'ok' | 'no'>(null);
  const startX = useRef(0);
  const LIMIAR = 96;

  const onDown = (clientX: number) => {
    setDragging(true);
    startX.current = clientX;
  };
  const onMove = (clientX: number) => {
    if (!dragging) return;
    setDx(clientX - startX.current);
  };
  const finalizar = () => {
    if (!dragging) return;
    setDragging(false);
    if (dx > LIMIAR) {
      setSaindo('ok');
      setTimeout(onAprovar, 220);
    } else if (dx < -LIMIAR) {
      setSaindo('no');
      setTimeout(onReprovar, 220);
    } else {
      setDx(0);
    }
  };

  const progresso = Math.max(-1, Math.min(1, dx / LIMIAR));
  const revelaAprovar = dx > 8;
  const revelaReprovar = dx < -8;

  return (
    <div className="relative select-none">
      {/* Fundos revelados */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden flex">
        <div className={`flex-1 bg-emerald-600 flex items-center pl-6 transition-opacity ${revelaAprovar ? 'opacity-100' : 'opacity-0'}`}>
          <Check className="h-6 w-6 text-white" />
          <span className="ml-2 text-white font-semibold text-sm">Aprovar</span>
        </div>
        <div className={`flex-1 bg-rose-600 flex items-center justify-end pr-6 transition-opacity ${revelaReprovar ? 'opacity-100' : 'opacity-0'}`}>
          <span className="mr-2 text-white font-semibold text-sm">Reprovar</span>
          <X className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Card */}
      <div
        className={`relative rounded-3xl bg-white border border-neutral-200 p-4 shadow-sm cursor-grab active:cursor-grabbing ${
          dragging ? '' : 'transition-transform duration-200'
        }`}
        style={{
          transform: saindo
            ? `translateX(${saindo === 'ok' ? 460 : -460}px) rotate(${saindo === 'ok' ? 6 : -6}deg)`
            : `translateX(${dx}px) rotate(${progresso * 2}deg)`,
          opacity: saindo ? 0 : 1,
        }}
        onMouseDown={(e) => onDown(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={finalizar}
        onMouseLeave={finalizar}
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={finalizar}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-neutral-900 leading-snug truncate">{nomeForn(oc.fornecedor)}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              OC #{oc.numero} · {oc._count?.itens ?? 0} {(oc._count?.itens ?? 0) === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-neutral-400">Total</p>
            <p className="text-xl font-semibold text-neutral-900 tabular-nums leading-tight">{brl(n(oc.valorTotal))}</p>
          </div>
        </div>

        {/* Metadados */}
        <div className="mt-3 flex items-center gap-2 text-[12px] text-neutral-500">
          <span className="h-6 w-6 rounded-full bg-neutral-200 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-neutral-500" />
          </span>
          <span className="font-medium text-neutral-700">{COND_LABEL[oc.condicaoPagamento ?? ''] || oc.condicaoPagamento || 'À combinar'}</span>
          {oc.dataEntregaPrevista && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {dataCurta(oc.dataEntregaPrevista)}</span>
            </>
          )}
          <span className="ml-auto text-neutral-300">{dataCurta(oc.dataEmissao)}</span>
        </div>

        {/* Ações */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onReprovar}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-700 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-neutral-100 active:scale-[0.98] transition"
          >
            <X className="h-4 w-4" /> Reprovar
          </button>
          <button
            onClick={onAprovar}
            className="rounded-2xl bg-neutral-900 text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-black active:scale-[0.98] transition shadow-sm"
          >
            <Check className="h-4 w-4" /> Aprovar
          </button>
        </div>
        <button
          onClick={onEditar}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 active:scale-[0.98] transition py-1"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar CI
        </button>
        <p className="mt-1 text-center text-[10px] text-neutral-300">arraste para aprovar → ou ← reprovar</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 2 — REPOSIÇÃO (produtos em estado crítico, compacto) + Nova OC
   ════════════════════════════════════════════════════════════════════════════ */
function ReposicaoTab({
  itens,
  cis,
  carregando,
  temFilial,
  onNovaOC,
  onAbrirProduto,
  onAtualizar,
}: {
  itens: ItemAComprar[];
  cis: OrdemCompra[];
  carregando: boolean;
  temFilial: boolean;
  onNovaOC: () => void;
  onAbrirProduto: (item: ItemAComprar) => void;
  onAtualizar: () => void;
}) {
  const [sub, setSub] = useState<'repor' | 'cis'>('repor');
  const [busca, setBusca] = useState('');
  const [buscaCI, setBuscaCI] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? itens.filter((p) => p.descricao.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q))
      : itens;
    // Ordena do mais crítico (menor nível) para o menos crítico.
    return [...base].sort((a, b) => nivelEstoque(a.disponivel, a.estoqueMinimo) - nivelEstoque(b.disponivel, b.estoqueMinimo));
  }, [busca, itens]);

  const cisFiltradas = useMemo(() => {
    const q = buscaCI.trim().toLowerCase();
    const base = q
      ? cis.filter((o) => String(o.numero).includes(q) || nomeForn(o.fornecedor).toLowerCase().includes(q))
      : cis;
    return [...base].sort((a, b) => Number(b.numero) - Number(a.numero)).slice(0, 40);
  }, [buscaCI, cis]);

  const zerados = itens.filter((p) => p.disponivel <= 0).length;

  return (
    <div className="relative pb-28">
      <header className="px-6 pt-4 pb-3 bg-gradient-to-b from-[#EFEBE4] to-[#FAFAFA]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Reposição</h1>
          <button onClick={onAtualizar} className="h-9 w-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center active:scale-95 transition">
            <RefreshCw className={`h-4 w-4 text-neutral-600 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          {itens.length} abaixo do mínimo
          {zerados > 0 && <> · <span className="text-rose-600 font-medium">{zerados} sem estoque</span></>}
        </p>

        {/* Segmento: A repor · Últimas CIs */}
        <div className="mt-4 grid grid-cols-2 gap-1 bg-neutral-200/70 rounded-2xl p-1">
          <button
            onClick={() => setSub('repor')}
            className={`py-2 rounded-xl text-[13px] font-semibold transition ${sub === 'repor' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
          >
            A repor · {itens.length}
          </button>
          <button
            onClick={() => setSub('cis')}
            className={`py-2 rounded-xl text-[13px] font-semibold transition ${sub === 'cis' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
          >
            Últimas CIs · {cis.length}
          </button>
        </div>

        {/* Busca (muda conforme o segmento) */}
        <div className="mt-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          {sub === 'repor' ? (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou código…"
              className="w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
            />
          ) : (
            <input
              value={buscaCI}
              onChange={(e) => setBuscaCI(e.target.value)}
              placeholder="Buscar por nº da CI ou fornecedor…"
              className="w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
            />
          )}
        </div>
      </header>

      {sub === 'repor' ? (
        /* Lista bem compacta de itens críticos (toque abre o painel do produto) */
        <section className="px-4 mt-2 space-y-1.5">
          {carregando ? (
            <div className="py-14 text-center text-neutral-400">
              <Loader2 className="h-7 w-7 mx-auto animate-spin mb-2" />
              <p className="text-sm">Consultando o estoque…</p>
            </div>
          ) : !temFilial ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 py-12 text-center text-neutral-400 text-sm px-6">
              Selecione uma filial ativa para ver os itens a repor.
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 py-12 text-center">
              <Package className="h-9 w-9 mx-auto text-neutral-300 mb-2" />
              <p className="text-neutral-500 text-sm font-medium">
                {busca ? 'Nenhum item encontrado.' : 'Estoque em dia — nada a repor.'}
              </p>
            </div>
          ) : (
            filtrados.map((p) => {
              const nivel = nivelEstoque(p.disponivel, p.estoqueMinimo);
              const zerado = p.disponivel <= 0;
              const critico = nivel < 0.35;
              const cor = zerado ? 'text-rose-600' : critico ? 'text-rose-500' : 'text-amber-600';
              return (
                <button
                  key={p.produtoId}
                  onClick={() => onAbrirProduto(p)}
                  className="w-full text-left rounded-xl bg-white border border-neutral-200 pl-3 pr-2 py-2 flex items-center gap-2.5 active:scale-[0.99] hover:border-neutral-300 transition"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${zerado ? 'bg-rose-500' : critico ? 'bg-rose-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-800 truncate leading-tight">{p.descricao}</p>
                    <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                      <TrendingDown className="h-3 w-3" /> mín. {num(p.estoqueMinimo)}{p.codigo ? ` · ${p.codigo}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 leading-none">
                    <p className={`text-[15px] font-semibold tabular-nums ${cor}`}>{num(p.disponivel)}</p>
                    <p className="text-[9px] text-neutral-400 uppercase tracking-wide">{p.unidade || 'un'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-300 shrink-0" />
                </button>
              );
            })
          )}
        </section>
      ) : (
        /* Últimas CIs feitas (com data) */
        <section className="px-4 mt-2 space-y-1.5">
          {cisFiltradas.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 py-12 text-center">
              <ClipboardList className="h-9 w-9 mx-auto text-neutral-300 mb-2" />
              <p className="text-neutral-500 text-sm font-medium">
                {buscaCI ? 'Nenhuma CI encontrada.' : 'Nenhuma CI registrada ainda.'}
              </p>
            </div>
          ) : (
            cisFiltradas.map((oc) => {
              const st = STATUS_CI[oc.status] ?? STATUS_CI.PENDENTE;
              return (
                <div key={oc.id} className="rounded-xl bg-white border border-neutral-200 px-3 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-800 truncate leading-tight">
                      CI #{oc.numero} · {nomeForn(oc.fornecedor)}
                    </p>
                    <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                      <CalendarDays className="h-3 w-3" /> {dataCurta(oc.dataEmissao)} · {oc._count?.itens ?? 0} {(oc._count?.itens ?? 0) === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  <p className="text-[12.5px] font-semibold text-neutral-600 tabular-nums shrink-0">{brl(n(oc.valorTotal))}</p>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Nova OC — discreto, no rodapé do conteúdo */}
      <div className="px-4 mt-5">
        <button
          onClick={onNovaOC}
          className="w-full rounded-2xl border border-dashed border-neutral-300 bg-white/60 text-neutral-700 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white active:scale-[0.99] transition"
        >
          <Plus className="h-4 w-4" /> Nova CI / Ordem de compra
        </button>
      </div>
    </div>
  );
}

/* ── Painel deslizante do produto (histórico de compras + pedidos) ── */
function ProdutoSheet({
  item,
  onComprar,
  onNovaCI,
  onClose,
}: {
  item: ItemAComprar;
  onComprar: () => void;
  onNovaCI: () => void;
  onClose: () => void;
}) {
  const [hist, setHist] = useState<HistoricoCompra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [show, setShow] = useState(false);
  const zerado = item.disponivel <= 0;

  // Anima a entrada no próximo frame (desliza de baixo)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fecha com transição: desliza pra baixo + some o fundo e só então executa a ação
  const sairPara = (cb: () => void) => {
    setShow(false);
    setTimeout(cb, 280);
  };

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    comprasApi
      .historicoProduto(item.produtoId)
      .then((r) => { if (vivo) setHist(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (vivo) setHist([]); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [item.produtoId]);

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => sairPara(onClose)}
      />
      <div
        className="relative w-full bg-[#FAFAFA] rounded-t-[2rem] max-h-[92%] overflow-y-auto transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: show ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="sticky top-0 bg-[#FAFAFA] px-6 pt-3 pb-4 z-10">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-300 mb-4" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-900 leading-snug">{item.descricao}</h2>
              <p className="text-[12px] text-neutral-400 mt-0.5">{item.codigo ? `Cód. ${item.codigo} · ` : ''}unidade {item.unidade || 'un'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => sairPara(onNovaCI)}
                className="h-9 pl-2.5 pr-3 rounded-full bg-neutral-900 text-white flex items-center gap-1 text-[12px] font-semibold hover:bg-black active:scale-95 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Nova CI
              </button>
              <button onClick={() => sairPara(onClose)} className="h-9 w-9 rounded-full bg-neutral-200 flex items-center justify-center active:scale-95 transition">
                <X className="h-4 w-4 text-neutral-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {/* Situação de estoque */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white border border-neutral-200 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-semibold">Disponível</p>
              <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${zerado ? 'text-rose-600' : 'text-neutral-900'}`}>
                {num(item.disponivel)} <span className="text-sm text-neutral-400">{item.unidade || 'un'}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-200 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-semibold">Estoque mínimo</p>
              <p className="text-2xl font-semibold tabular-nums mt-0.5 text-neutral-900">
                {num(item.estoqueMinimo)} <span className="text-sm text-neutral-400">{item.unidade || 'un'}</span>
              </p>
            </div>
          </div>

          {/* Histórico de compras — quem pediu das últimas vezes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4 text-neutral-500" />
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide">Últimas compras</span>
            </div>
            {carregando ? (
              <div className="py-6 text-center text-neutral-400">
                <Loader2 className="h-6 w-6 mx-auto animate-spin" />
              </div>
            ) : hist.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 py-6 text-center text-[13px] text-neutral-400">
                Nenhuma compra anterior deste produto.
              </div>
            ) : (
              <div className="space-y-1.5">
                {hist.map((h) => {
                  const st = STATUS_CI[h.status] ?? STATUS_CI.PENDENTE;
                  return (
                    <div key={h.ordemId} className="rounded-2xl bg-white border border-neutral-200 px-3.5 py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-neutral-800 truncate leading-tight">{h.fornecedor}</p>
                        <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                          <CalendarDays className="h-3 w-3" /> {dataCurta(h.data)} · CI #{h.numero}
                          <span className={`ml-1 px-1.5 py-px rounded-full font-bold uppercase ${st.cls}`}>{st.label}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 leading-tight">
                        <p className="text-[13px] font-semibold text-neutral-800 tabular-nums">{num(h.quantidade)} {h.unidade}</p>
                        <p className="text-[10px] text-neutral-400">{brl(h.precoUnitario)}/{h.unidade}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quem está pedindo — pedidos internos (etapa futura) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-neutral-500" />
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide">Quem está pedindo</span>
            </div>
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 py-5 px-4 text-center">
              <p className="text-[13px] text-neutral-500 font-medium">Pedidos internos das lojas/setores</p>
              <p className="text-[11.5px] text-neutral-400 mt-1">Cadastro ainda não disponível — será a próxima etapa.</p>
            </div>
          </div>

          <button
            onClick={() => sairPara(onComprar)}
            className="w-full rounded-2xl bg-neutral-900 text-white py-4 text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-black active:scale-[0.99] transition shadow-lg"
          >
            <Plus className="h-5 w-5" /> Criar CI deste produto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL — Nova Ordem de Compra (grava no ERP)
   ════════════════════════════════════════════════════════════════════════════ */
type ItemForm = { produtoId: string; descricao: string; unidade: string; quantidade: string; precoUnitario: string };
const UNIDADES = ['KG', 'CX', 'UN', 'MAÇO', 'SACA', 'DZ'];
const CONDICOES = ['A_VISTA', '7_DIAS', '15_DIAS', '30_DIAS', '30_60', '30_60_90'];
const itemVazio = (): ItemForm => ({ produtoId: '', descricao: '', unidade: 'KG', quantidade: '', precoUnitario: '' });

function NovaOCModal({
  prefill,
  ordemId,
  onClose,
  onSubmit,
  notificar,
}: {
  prefill: ItemAComprar | null;
  ordemId?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    fornecedorId: string;
    condicaoPagamento: string;
    dataEntregaPrevista: string | null;
    observacoes: string | null;
    itens: { produtoId: string | null; descricao: string; unidade: string; quantidade: number; precoUnitario: number }[];
  }) => void;
  notificar: (msg: string, tone?: 'ok' | 'erro' | 'info') => void;
}) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [fornecedorId, setFornecedorId] = useState('');
  const [condicao, setCondicao] = useState('30_DIAS');
  const [entrega, setEntrega] = useState('');
  const [obs, setObs] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([
    prefill
      ? {
          produtoId: prefill.produtoId,
          descricao: prefill.descricao,
          unidade: prefill.unidade || 'KG',
          quantidade: String(Math.max(1, Math.ceil(prefill.estoqueMinimo - prefill.disponivel))),
          precoUnitario: '',
        }
      : itemVazio(),
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [numeroEdicao, setNumeroEdicao] = useState<number | string>('');
  const editando = !!ordemId;

  useEffect(() => {
    Promise.all([
      fornecedoresApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      produtosApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      ordemId ? comprasApi.get(ordemId).then((r) => r.data).catch(() => null) : Promise.resolve(null),
    ])
      .then(([forn, prods, ordem]) => {
        setFornecedores(forn);
        // Prioriza FLV; se o cadastro não tiver categoria marcada, cai para todos.
        const flv = (prods as Produto[]).filter(ehFLV);
        setProdutos(flv.length ? flv : (prods as Produto[]));

        // Modo edição: preenche o formulário com a CI existente.
        if (ordem) {
          setNumeroEdicao(ordem.numero);
          setFornecedorId(ordem.fornecedorId || ordem.fornecedor?.id || '');
          setCondicao(ordem.condicaoPagamento || '30_DIAS');
          setEntrega(ordem.dataEntregaPrevista ? String(ordem.dataEntregaPrevista).slice(0, 10) : '');
          setObs(ordem.observacoes || '');
          if (Array.isArray(ordem.itens) && ordem.itens.length) {
            setItens(
              ordem.itens.map((it: any) => ({
                produtoId: it.produtoId || '',
                descricao: it.descricao || it.produto?.descricao || '',
                unidade: it.unidade || 'KG',
                quantidade: String(n(it.quantidade)),
                precoUnitario: String(n(it.precoUnitario)),
              })),
            );
          }
          return;
        }

        // Modo criação: preenche preço do prefill a partir do cadastro.
        if (prefill) {
          const prod = (prods as Produto[]).find((p) => p.id === prefill.produtoId);
          if (prod?.precoCompra != null) {
            setItens((prev) => prev.map((it, i) => (i === 0 && !it.precoUnitario ? { ...it, precoUnitario: String(n(prod.precoCompra)) } : it)));
          }
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setItem = (i: number, k: keyof ItemForm, v: string) => setItens((p) => p.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const escolherProduto = (i: number, produtoId: string) => {
    const prod = produtos.find((p) => p.id === produtoId);
    setItens((p) =>
      p.map((it, idx) =>
        idx !== i
          ? it
          : {
              ...it,
              produtoId,
              descricao: prod ? prod.descricao : it.descricao,
              unidade: prod?.unidadeMedida?.sigla || it.unidade,
              precoUnitario: it.precoUnitario || (prod?.precoCompra != null ? String(n(prod.precoCompra)) : it.precoUnitario),
            },
      ),
    );
  };
  const addItem = () => setItens((p) => [...p, itemVazio()]);
  const delItem = (i: number) => setItens((p) => p.filter((_, idx) => idx !== i));

  const total = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.precoUnitario) || 0), 0);

  const submeter = () => {
    if (!fornecedorId) {
      setErro('Selecione o fornecedor.');
      return;
    }
    const validos = itens.filter((i) => i.descricao.trim() && Number(i.quantidade) > 0);
    if (validos.length === 0) {
      setErro('Informe ao menos um item com quantidade.');
      return;
    }
    setSalvando(true);
    setErro('');
    onSubmit({
      fornecedorId,
      condicaoPagamento: condicao,
      dataEntregaPrevista: entrega || null,
      observacoes: obs || null,
      itens: validos.map((i) => ({
        produtoId: i.produtoId || null,
        descricao: i.descricao.trim(),
        unidade: i.unidade,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.precoUnitario) || 0,
      })),
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#FAFAFA] rounded-t-[2rem] max-h-[94%] overflow-y-auto animate-[slideUp_.25s_ease-out]">
        <div className="sticky top-0 bg-[#FAFAFA] px-6 pt-3 pb-4 z-10">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-300 mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">{editando ? `Editar CI #${numeroEdicao}` : 'Nova Ordem de Compra'}</h2>
              <p className="text-[12px] text-neutral-400">{editando ? 'Altere itens, quantidades ou fornecedor' : 'Enviada ao sistema como OC pendente'}</p>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-full bg-neutral-200 flex items-center justify-center">
              <X className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        </div>

        {carregando ? (
          <div className="py-16 text-center text-neutral-400">
            <Loader2 className="h-7 w-7 mx-auto animate-spin mb-2" />
            <p className="text-sm">Carregando fornecedores e produtos…</p>
          </div>
        ) : (
          <div className="px-6 pb-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fornecedor *">
                <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="campo">
                  <option value="">— selecione —</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{nomeForn(f)}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Pagamento">
                <select value={condicao} onChange={(e) => setCondicao(e.target.value)} className="campo">
                  {CONDICOES.map((c) => (
                    <option key={c} value={c}>{COND_LABEL[c]}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo label="Entrega prevista">
              <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className="campo" />
            </Campo>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide">Itens (FLV)</span>
                <button onClick={addItem} className="flex items-center gap-1 text-[12px] text-neutral-900 font-semibold">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <div className="space-y-3">
                {itens.map((it, i) => (
                  <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <select value={it.produtoId} onChange={(e) => escolherProduto(i, e.target.value)} className="campo flex-1">
                        <option value="">— produto —</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>{p.descricao}</option>
                        ))}
                      </select>
                      {itens.length > 1 && (
                        <button onClick={() => delItem(i)} className="h-9 w-9 shrink-0 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {!it.produtoId && (
                      <input
                        value={it.descricao}
                        onChange={(e) => setItem(i, 'descricao', e.target.value)}
                        placeholder="Descrição do item"
                        className="campo mt-2"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <span className="text-[10px] text-neutral-400 ml-1">Qtd</span>
                        <input
                          inputMode="decimal"
                          value={it.quantidade}
                          onChange={(e) => setItem(i, 'quantidade', e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                          placeholder="0"
                          className="campo text-right"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 ml-1">Un</span>
                        <select value={it.unidade} onChange={(e) => setItem(i, 'unidade', e.target.value)} className="campo">
                          {[...new Set([it.unidade, ...UNIDADES])].map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 ml-1">Preço</span>
                        <input
                          inputMode="decimal"
                          value={it.precoUnitario}
                          onChange={(e) => setItem(i, 'precoUnitario', e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                          placeholder="0,00"
                          className="campo text-right"
                        />
                      </div>
                    </div>
                    <p className="text-right text-[11px] text-neutral-400 mt-1.5">
                      Subtotal <b className="text-neutral-600">{brl((Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0))}</b>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="rounded-3xl bg-[#EFEBE4] p-5">
              <p className="text-[12px] uppercase tracking-widest text-neutral-500 font-semibold">Total da OC</p>
              <p className="text-[38px] leading-none font-semibold text-neutral-900 tabular-nums mt-1">{brl(total)}</p>
            </div>

            <Campo label="Observações">
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="campo resize-none" />
            </Campo>

            {erro && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{erro}</p>}

            <button
              disabled={salvando}
              onClick={submeter}
              className="w-full rounded-2xl bg-neutral-900 text-white py-4 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-black active:scale-[0.99] transition shadow-lg"
            >
              {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : editando ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar OC no sistema'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .campo {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #e5e5e5;
          background: #fff;
          padding: 0.7rem 0.9rem;
          font-size: 0.92rem;
          color: #262626;
          outline: none;
        }
        .campo:focus { border-color: #a3a3a3; box-shadow: 0 0 0 3px rgba(0,0,0,0.05); }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-neutral-500 mb-1.5 ml-1">{label}</span>
      {children}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Bottom Tab Button
   ════════════════════════════════════════════════════════════════════════════ */
function TabButton({
  ativo,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  ativo: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 py-2 rounded-2xl transition ${
        ativo ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
      }`}
    >
      <span className={`relative flex items-center justify-center h-9 w-9 rounded-xl transition ${ativo ? 'bg-neutral-900 text-white' : 'bg-transparent'}`}>
        <Icon className="h-[18px] w-[18px]" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
