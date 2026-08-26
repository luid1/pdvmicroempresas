import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { nfeApi, financeiroApi, comprasApi, estoqueApi, pedidosApi } from '../services/api';
import DetalheModal, { DetalheCard, DetalheRegistro } from '../components/dashboard/DetalheModal';
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, Receipt, Activity, RefreshCw,
  PackageCheck, Wallet, Scale, Users, Boxes, ArrowUpRight, ArrowDownRight, ChevronRight,
  CircleDollarSign, Landmark, Percent, ShoppingCart, CalendarRange, LayoutDashboard,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';

/* ─────────────── Formatação ─────────────── */
const R$ = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const R$c = (v: number) => {
  const a = Math.abs(v || 0);
  if (a >= 1_000_000) return `${v < 0 ? '-' : ''}R$ ${(a / 1e6).toFixed(2)} mi`;
  if (a >= 1_000) return `${v < 0 ? '-' : ''}R$ ${(a / 1e3).toFixed(1)} mil`;
  return R$(v);
};
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const num = (v: number) => (v || 0).toLocaleString('pt-BR');
const kg = (v: number) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
const dataBR = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

/* ─────────────── Tipos ─────────────── */
interface Aging { vencido: number; ate7: number; ate30: number; mais30: number; total: number; qtd: number }
interface Dash {
  periodo: string; periodoLabel: string;
  kpis: Record<string, number>;
  financeiro: {
    faturamento: number; faturamentoAnterior: number; faturamentoDelta: number;
    devolucoes?: number; faturamentoLiquido?: number;
    nfes: number; vendas?: number; ticketMedio: number; margemBruta: number; cmv: number; resultadoOperacional: number;
    receber: Aging; pagar: Aging; inadimplenciaPct: number; saldoProjetado: number;
  };
  estoque: { itensComSaldo: number; valorEstoque: number; validade: { vencido: number; ate3: number; ate7: number }; perdaValor: number; perdaQtd: number; rupturas: number; produtosAtivos: number };
  topClientes: { clienteId: string; nome: string; valor: number; pedidos: number }[];
  topProdutos: { produtoId: string; codigo: string; descricao: string; qtd: number; custo: number }[];
  pedidosPorStatus: Record<string, number>;
  serieFaturamento: { dia: string; label: string; valor: number }[];
  fluxoDia: { entradas: number; faturados: number; romaneios: number; entregues: number };
}

type PeriodoKey = 'hoje' | 'semana' | 'mes' | 'ano' | 'custom';
const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' }, { key: 'semana', label: '7 dias' },
  { key: 'mes', label: 'Mês' }, { key: 'ano', label: 'Ano' },
];

/* Lembra a última escolha do usuário (período e datas do modo personalizado).
 * A preferência SEGUE A CONTA (persistida no perfil do usuário no backend);
 * o localStorage serve só de cache p/ restaurar na hora, sem "piscar" ao abrir. */
const PERIODOS_VALIDOS: PeriodoKey[] = ['hoje', 'semana', 'mes', 'ano', 'custom'];
// Chaves das preferências que seguem a conta (namespace do dashboard).
const PREF = {
  periodo: 'dashboard.periodo',
  dataInicio: 'dashboard.dataInicio',
  dataFim: 'dashboard.dataFim',
};
// Cache local (evita flash antes de o perfil da conta ser lido).
const LS = {
  periodo: 'lumin.dashboard.periodo',
  dataInicio: 'lumin.dashboard.dataInicio',
  dataFim: 'lumin.dashboard.dataFim',
};
const lsGet = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* storage indisponível: ignora */ }
};

const STATUS_INFO: Record<string, { label: string; cor: string; rota: string }> = {
  RASCUNHO: { label: 'Rascunho', cor: '#8A90A0', rota: '/logistica/pedidos' },
  CONFIRMADO: { label: 'Pendente', cor: '#FF9F45', rota: '/logistica/pedidos' },
  EM_SEPARACAO: { label: 'Separando', cor: '#01B8FA', rota: '/logistica/operacional' },
  SEPARADO: { label: 'Liberado', cor: '#3B9EFF', rota: '/logistica/carga' },
  FATURADO: { label: 'Faturado', cor: '#A78BFA', rota: '/fiscal/gestao' },
  ENTREGUE: { label: 'Entregue', cor: '#2DD4A7', rota: '/logistica/torre' },
  CANCELADO: { label: 'Cancelado', cor: '#5E6472', rota: '/logistica/pedidos' },
};

/* ─────────────── Componentes base ─────────────── */
function Delta({ v }: { v: number }) {
  if (!v) return <span className="text-[11px] text-[#5E6472]">estável</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-[#34D9A6]' : 'text-[#FF6B7A]'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{pct(Math.abs(v))}
    </span>
  );
}

/* Paleta de destaque (chip do ícone) — cada tom vira um trio fg/soft/line */
type Tone = { fg: string; soft: string; line: string };
const mkTone = (fg: string): Tone => ({ fg, soft: `${fg}1f`, line: `${fg}45` });
const KPI_TONES: Record<string, Tone> = {
  accent: mkTone('#01B8FA'),
  cyan:   mkTone('#22D3EE'),
  blue:   mkTone('#3B9EFF'),
  violet: mkTone('#A78BFA'),
  green:  mkTone('#2DD4A7'),
  rose:   mkTone('#FF6B7A'),
  amber:  mkTone('#FF9F45'),
  slate:  { fg: '#8A90A0', soft: 'rgba(255,255,255,0.05)', line: 'rgba(255,255,255,0.09)' },
};
/* Nomes de tom usados nas telas → paleta do tema site */
const TONE_ALIAS: Record<string, string> = {
  brand: 'accent', emerald: 'green', sky: 'cyan', teal: 'cyan', indigo: 'blue',
  warning: 'amber', amber: 'amber', rose: 'rose', violet: 'violet', slate: 'slate',
};

function Kpi({ icon: Icon, label, value, sub, tone = 'slate', delta, onClick }: {
  icon: any; label: string; value: string; sub?: React.ReactNode; tone?: string; delta?: number; onClick?: () => void;
}) {
  const t = KPI_TONES[TONE_ALIAS[tone] || tone] || KPI_TONES.slate;
  const vars = { '--kpi-fg': t.fg, '--kpi-soft': t.soft, '--kpi-line': t.line } as React.CSSProperties;
  return (
    <button
      onClick={onClick} disabled={!onClick}
      style={vars}
      className={`kpi group ${onClick ? 'kpi-int' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className="kpi-chip">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        {delta !== undefined && <Delta v={delta} />}
      </div>
      <p className="eyebrow mut kpi-label truncate">{label}</p>
      <p className="num kpi-value truncate">{value}</p>
      {sub && <div className="kpi-sub truncate">{sub}</div>}
      {onClick && <ChevronRight className="kpi-arrow" />}
    </button>
  );
}

function Secao({ icon: Icon, titulo, cor, children, acao }: { icon: any; titulo: string; cor: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" style={{ color: cor }} /> {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/* Tooltip escuro reutilizável p/ Recharts (tema site) */
const tipStyle = { background: '#16181F', border: '1px solid #23262F', borderRadius: 10, fontSize: 12, color: '#F7F8FA', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' };

/* ─────────────── Página ─────────────── */
export default function DashboardPage() {
  const { filialAtiva, preferencias, savePreferencias } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const hojeISO = new Date().toISOString().slice(0, 10);
  // Preferência da conta tem prioridade; depois o cache local; por fim o default.
  const [periodo, setPeriodo] = useState<PeriodoKey>(() => {
    const v = (preferencias[PREF.periodo] as PeriodoKey | undefined)
      ?? (lsGet(LS.periodo) as PeriodoKey | null) ?? 'hoje';
    return PERIODOS_VALIDOS.includes(v as PeriodoKey) ? (v as PeriodoKey) : 'hoje';
  });
  const [ordProduto, setOrdProduto] = useState<'custo' | 'qtd'>('custo');
  const [dataInicio, setDataInicio] = useState(
    () => (preferencias[PREF.dataInicio] as string) || lsGet(LS.dataInicio) || hojeISO,
  );
  const [dataFim, setDataFim] = useState(
    () => (preferencias[PREF.dataFim] as string) || lsGet(LS.dataFim) || hojeISO,
  );
  const [detalhe, setDetalhe] = useState<DetalheCard | null>(null);
  const fid = filialAtiva?.id;

  // Persiste a escolha: cache local na hora + perfil da conta (segue o usuário
  // em qualquer máquina). Pula a 1ª render p/ não regravar o valor recém-lido.
  const primeiraRender = useRef(true);
  useEffect(() => {
    lsSet(LS.periodo, periodo);
    lsSet(LS.dataInicio, dataInicio);
    lsSet(LS.dataFim, dataFim);
    if (primeiraRender.current) { primeiraRender.current = false; return; }
    savePreferencias({
      [PREF.periodo]: periodo,
      [PREF.dataInicio]: dataInicio,
      [PREF.dataFim]: dataFim,
    });
    // savePreferencias é estável para o efeito (best-effort); não incluir nas deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, dataInicio, dataFim]);

  const carregar = useCallback(() => {
    setLoading(true);
    const params: any = { filialId: filialAtiva?.id, periodo };
    if (periodo === 'custom') { params.dataInicio = dataInicio; params.dataFim = dataFim; }
    api.get('/dashboard', { params })
      .then(r => setD(r.data)).catch(() => setD(null)).finally(() => setLoading(false));
  }, [filialAtiva?.id, periodo, dataInicio, dataFim]);
  useEffect(() => { carregar(); }, [carregar]);

  const f = d?.financeiro;
  const e = d?.estoque;

  const produtosOrdenados = useMemo(() => {
    if (!d?.topProdutos) return [];
    return [...d.topProdutos].sort((a, b) => ordProduto === 'custo' ? b.custo - a.custo : b.qtd - a.qtd);
  }, [d?.topProdutos, ordProduto]);

  const statusData = useMemo(() =>
    Object.entries(d?.pedidosPorStatus || {}).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ status: k, label: STATUS_INFO[k]?.label || k, valor: v, cor: STATUS_INFO[k]?.cor || '#8A90A0' })),
    [d?.pedidosPorStatus]);

  const maxCliente = Math.max(1, ...(d?.topClientes || []).map(c => c.valor));

  /* ─────────── Construtores dos modais de detalhe ─────────── */
  const agingLinhas = (ag?: Aging) => ag ? [
    { label: 'Vencido', valor: R$c(ag.vencido), cor: ag.vencido ? 'text-[#E0483D]' : undefined },
    { label: '0–7 dias', valor: R$c(ag.ate7) },
    { label: '8–30 dias', valor: R$c(ag.ate30) },
    { label: '+30 dias', valor: R$c(ag.mais30) },
    { label: 'Total', valor: R$c(ag.total) },
    { label: 'Títulos', valor: num(ag.qtd) },
  ] : [];

  const abrir = (key: string): DetalheCard | null => {
    switch (key) {
      case 'faturamento': return {
        icon: TrendingUp, tone: 'brand', titulo: 'Faturamento',
        valorPrincipal: R$c((f?.devolucoes ?? 0) > 0 ? (f?.faturamentoLiquido ?? f?.faturamento ?? 0) : (f?.faturamento ?? 0)),
        subtitulo: (f?.devolucoes ?? 0) > 0 ? `${d?.periodoLabel} · líquido de devoluções` : d?.periodoLabel,
        delta: f?.faturamentoDelta,
        serie: d?.serieFaturamento,
        linhas: [
          ...((f?.devolucoes ?? 0) > 0 ? [
            { label: 'Faturamento bruto', valor: R$c(f?.faturamento ?? 0) },
            { label: '(−) Devoluções', valor: R$c(f?.devolucoes ?? 0), cor: 'text-[#E0483D]' },
            { label: '= Faturamento líquido', valor: R$c(f?.faturamentoLiquido ?? 0), cor: 'text-[#0FA968]' },
          ] : []),
          { label: 'Vendas', valor: num(f?.vendas ?? 0) },
          { label: 'Ticket médio', valor: R$c(f?.ticketMedio ?? 0) },
          { label: 'NF-e emitidas', valor: num(f?.nfes ?? 0) },
          { label: 'Período anterior', valor: R$c(f?.faturamentoAnterior ?? 0) },
        ],
        rota: '/fiscal/gestao', verMaisLabel: 'Ver gestão fiscal',
        atalhos: [{ label: 'Emitir NF-e', rota: '/fiscal/emitir' }, { label: 'Notas emitidas', rota: '/fiscal/nfe' }],
        listaTitulo: 'Últimas NF-e emitidas', listaVazia: 'Nenhuma NF-e emitida no período.',
        carregarLista: async (): Promise<DetalheRegistro[]> => {
          if (!fid) return [];
          const { data } = await nfeApi.list(fid, { status: 'EMITIDO' });
          return (Array.isArray(data) ? data : []).slice(0, 20).map((n: any): DetalheRegistro => ({
            titulo: `NF-e ${n.numero || '—'}${n.serie ? `/${n.serie}` : ''}`,
            subtitulo: `${n.cliente?.razaoSocial || n.destRazaoSocial || 'Cliente'} · ${dataBR(n.dataEmissao)}`,
            valor: R$c(Number(n.valorNfe) || 0),
          }));
        },
      };
      case 'ticket': return {
        icon: Receipt, tone: 'brand', titulo: 'Ticket Médio', valorPrincipal: R$c(f?.ticketMedio ?? 0), subtitulo: 'valor médio por venda',
        linhas: [
          { label: 'Faturamento', valor: R$c(f?.faturamento ?? 0) },
          { label: 'Vendas', valor: num(f?.vendas ?? 0) },
          { label: 'NF-e emitidas', valor: num(f?.nfes ?? 0) },
        ],
        rota: '/fiscal/gestao', verMaisLabel: 'Ver gestão fiscal',
      };
      case 'margem': return {
        icon: Percent, tone: (f?.margemBruta ?? 0) >= 0 ? 'emerald' : 'rose', titulo: 'Margem Bruta', valorPrincipal: pct(f?.margemBruta ?? 0), subtitulo: 'do DRE realizado',
        linhas: [
          { label: 'CMV', valor: R$c(f?.cmv ?? 0) },
          { label: 'Resultado operacional', valor: R$c(f?.resultadoOperacional ?? 0), cor: (f?.resultadoOperacional ?? 0) >= 0 ? 'text-[#0FA968]' : 'text-[#E0483D]' },
          { label: 'Faturamento', valor: R$c(f?.faturamento ?? 0) },
        ],
        rota: '/financeiro/dre', verMaisLabel: 'Ver DRE',
      };
      case 'receber': return {
        icon: Wallet, tone: 'brand', titulo: 'A Receber', valorPrincipal: R$c(f?.receber.total ?? 0), subtitulo: `${num(f?.receber.qtd ?? 0)} títulos`,
        linhas: [...agingLinhas(f?.receber), { label: 'Inadimplência', valor: pct(f?.inadimplenciaPct ?? 0), cor: (f?.inadimplenciaPct ?? 0) > 0 ? 'text-[#E0483D]' : 'text-[#0FA968]' }],
        rota: '/financeiro/receber', verMaisLabel: 'Ver contas a receber',
        atalhos: [{ label: 'Fluxo de caixa', rota: '/financeiro/fluxo-caixa' }],
        listaTitulo: 'Títulos vencidos', listaVazia: 'Nenhum título vencido.',
        carregarLista: async (): Promise<DetalheRegistro[]> => {
          const { data } = await financeiroApi.receber({ status: 'VENCIDO' });
          return (Array.isArray(data) ? data : []).slice(0, 20).map((t: any): DetalheRegistro => ({
            titulo: t.cliente?.razaoSocial || t.cliente?.nomeFantasia || t.descricao || 'Título',
            subtitulo: `${t.numero ? `#${t.numero} · ` : ''}venc. ${dataBR(t.dataVencimento)}`,
            valor: R$c(Number(t.valorAberto) || 0), cor: 'text-[#E0483D]',
          }));
        },
      };
      case 'pagar': return {
        icon: Landmark, tone: 'brand', titulo: 'A Pagar', valorPrincipal: R$c(f?.pagar.total ?? 0), subtitulo: `${num(f?.pagar.qtd ?? 0)} títulos`,
        linhas: agingLinhas(f?.pagar),
        rota: '/financeiro/pagar', verMaisLabel: 'Ver contas a pagar',
        atalhos: [{ label: 'Fluxo de caixa', rota: '/financeiro/fluxo-caixa' }],
        listaTitulo: 'Títulos vencidos', listaVazia: 'Nenhum título vencido.',
        carregarLista: async (): Promise<DetalheRegistro[]> => {
          const { data } = await financeiroApi.pagar({ status: 'VENCIDO' });
          return (Array.isArray(data) ? data : []).slice(0, 20).map((t: any): DetalheRegistro => ({
            titulo: t.fornecedor?.razaoSocial || t.fornecedor?.nomeFantasia || t.descricao || 'Título',
            subtitulo: `${t.numero ? `#${t.numero} · ` : ''}venc. ${dataBR(t.dataVencimento)}`,
            valor: R$c(Number(t.valorAberto) || 0), cor: 'text-[#0E86D4]',
          }));
        },
      };
      case 'saldo': return {
        icon: Scale, tone: (f?.saldoProjetado ?? 0) >= 0 ? 'emerald' : 'rose', titulo: 'Saldo Projetado', valorPrincipal: R$c(f?.saldoProjetado ?? 0), subtitulo: 'receber − pagar',
        linhas: [
          { label: 'A receber', valor: R$c(f?.receber.total ?? 0), cor: 'text-[#0FA968]' },
          { label: 'A pagar', valor: R$c(f?.pagar.total ?? 0), cor: 'text-[#E0483D]' },
        ],
        rota: '/financeiro/fluxo-caixa', verMaisLabel: 'Ver fluxo de caixa',
      };
      case 'itens': return {
        icon: Package, tone: 'brand', titulo: 'Itens c/ Saldo', valorPrincipal: num(e?.itensComSaldo ?? 0), subtitulo: `de ${num(e?.produtosAtivos ?? 0)} ativos`,
        linhas: [
          { label: 'Produtos ativos', valor: num(e?.produtosAtivos ?? 0) },
          { label: 'Valor do estoque', valor: R$c(e?.valorEstoque ?? 0) },
        ],
        rota: '/wms/posicao', verMaisLabel: 'Ver posição de estoque',
      };
      case 'valorEstoque': return {
        icon: CircleDollarSign, tone: 'brand', titulo: 'Valor do Estoque', valorPrincipal: R$c(e?.valorEstoque ?? 0), subtitulo: 'a custo médio',
        linhas: [
          { label: 'Itens c/ saldo', valor: num(e?.itensComSaldo ?? 0) },
          { label: 'Produtos ativos', valor: num(e?.produtosAtivos ?? 0) },
        ],
        rota: '/wms/posicao', verMaisLabel: 'Ver posição de estoque',
      };
      case 'validade': return {
        icon: AlertTriangle, tone: (e?.validade.vencido ?? 0) ? 'rose' : 'warning', titulo: 'Validade', valorPrincipal: num((e?.validade.vencido ?? 0) + (e?.validade.ate3 ?? 0) + (e?.validade.ate7 ?? 0)), subtitulo: 'itens em atenção',
        linhas: [
          { label: 'Vencidos', valor: num(e?.validade.vencido ?? 0), cor: (e?.validade.vencido ?? 0) ? 'text-[#E0483D]' : undefined },
          { label: 'Vencem em 3 dias', valor: num(e?.validade.ate3 ?? 0), cor: 'text-[#0E86D4]' },
          { label: 'Vencem em 7 dias', valor: num(e?.validade.ate7 ?? 0) },
        ],
        rota: '/wms/pereciveis', verMaisLabel: 'Ver perecíveis',
        listaTitulo: 'Itens vencendo', listaVazia: 'Nenhum item em atenção.',
        carregarLista: async (): Promise<DetalheRegistro[]> => {
          if (!fid) return [];
          const { data } = await estoqueApi.alertasValidade(fid);
          return (Array.isArray(data) ? data : []).slice(0, 20).map((s: any): DetalheRegistro => {
            const venc = s.lote?.dataValidade;
            const vencido = venc ? new Date(venc) < new Date() : false;
            return {
              titulo: `${s.produto?.codigo ? `${s.produto.codigo} · ` : ''}${s.produto?.descricao || 'Produto'}`,
              subtitulo: `${s.lote?.numero ? `Lote ${s.lote.numero} · ` : ''}val. ${dataBR(venc)}`,
              valor: kg(Number(s.quantidadeDisponivel) || 0), cor: vencido ? 'text-[#E0483D]' : 'text-[#0E86D4]',
            };
          });
        },
      };
      case 'perdas': return {
        icon: TrendingDown, tone: (e?.perdaValor ?? 0) ? 'rose' : 'slate', titulo: 'Perdas/Quebras', valorPrincipal: R$c(e?.perdaValor ?? 0), subtitulo: 'no período',
        linhas: [{ label: 'Quantidade', valor: kg(e?.perdaQtd ?? 0) }],
        rota: '/wms/movimentacoes', verMaisLabel: 'Ver movimentações',
      };
      case 'ruptura': return {
        icon: ShoppingCart, tone: (e?.rupturas ?? 0) ? 'warning' : 'slate', titulo: 'Ruptura', valorPrincipal: num(e?.rupturas ?? 0), subtitulo: 'produtos zerados',
        linhas: [
          { label: 'Produtos ativos', valor: num(e?.produtosAtivos ?? 0) },
          { label: 'Itens c/ saldo', valor: num(e?.itensComSaldo ?? 0) },
        ],
        rota: '/wms/analise-estoque', verMaisLabel: 'Ver análise de estoque',
        listaTitulo: 'Produtos a comprar', listaVazia: 'Nenhum produto em ruptura.',
        carregarLista: async (): Promise<DetalheRegistro[]> => {
          if (!fid) return [];
          const { data } = await comprasApi.aComprar(fid);
          return (Array.isArray(data) ? data : []).slice(0, 20).map((p: any): DetalheRegistro => ({
            titulo: `${p.codigo ? `${p.codigo} · ` : ''}${p.descricao || 'Produto'}`,
            subtitulo: `disp. ${num(Number(p.disponivel) || 0)} · mín. ${num(Number(p.estoqueMinimo) || 0)}`,
            valor: `+${num(Number(p.sugestaoCompra) || 0)}`, cor: p.negativo ? 'text-[#E0483D]' : 'text-[#0E86D4]',
          }));
        },
      };
      case 'movimentacoes': return {
        icon: Activity, tone: 'brand', titulo: 'Movimentações', valorPrincipal: num(d?.kpis.movimentacoesHoje ?? 0), subtitulo: 'no período',
        linhas: [
          { label: 'Perdas/quebras', valor: R$c(e?.perdaValor ?? 0), cor: (e?.perdaValor ?? 0) ? 'text-[#E0483D]' : undefined },
        ],
        rota: '/wms/movimentacoes', verMaisLabel: 'Ver movimentações',
      };
      default: return null;
    }
  };

  const abrirCliente = (c: { clienteId: string; nome: string; valor: number; pedidos: number }): DetalheCard => ({
    icon: Users, tone: 'brand', titulo: c.nome, valorPrincipal: R$c(c.valor), subtitulo: 'faturamento no período',
    linhas: [{ label: 'Pedidos', valor: num(c.pedidos) }, { label: 'Ticket médio', valor: R$c(c.pedidos ? c.valor / c.pedidos : 0) }],
    rota: '/fiscal/gestao', verMaisLabel: 'Ver gestão fiscal',
  });

  const abrirProduto = (p: { codigo: string; descricao: string; qtd: number; custo: number }): DetalheCard => ({
    icon: Boxes, tone: 'brand', titulo: p.descricao, valorPrincipal: R$c(p.custo), subtitulo: `Código ${p.codigo}`,
    linhas: [{ label: 'Quantidade (saída)', valor: kg(p.qtd) }, { label: 'Valor (custo)', valor: R$c(p.custo) }],
    rota: '/wms/posicao', verMaisLabel: 'Ver posição de estoque',
  });

  const abrirStatus = (s: { status: string; label: string; valor: number }): DetalheCard => ({
    icon: PackageCheck, tone: 'brand', titulo: `Pedidos — ${s.label}`, valorPrincipal: num(s.valor), subtitulo: 'pedidos neste status',
    linhas: Object.entries(d?.pedidosPorStatus || {}).filter(([, v]) => v > 0).map(([k, v]) => ({ label: STATUS_INFO[k]?.label || k, valor: num(v), cor: k === s.status ? 'text-[#0E86D4]' : undefined })),
    rota: STATUS_INFO[s.status]?.rota || '/logistica/pedidos', verMaisLabel: 'Ver pedidos',
    listaTitulo: `Pedidos — ${s.label}`, listaVazia: 'Nenhum pedido neste status.',
    carregarLista: async (): Promise<DetalheRegistro[]> => {
      if (!fid) return [];
      const { data } = await pedidosApi.list(fid, { status: s.status });
      return (Array.isArray(data) ? data : []).slice(0, 20).map((p: any): DetalheRegistro => ({
        titulo: `#${p.numero || '—'} · ${p.cliente?.razaoSocial || p.cliente?.nomeFantasia || 'Cliente'}`,
        subtitulo: dataBR(p.dataEmissao),
        valor: R$c(Number(p.valorTotal) || 0),
      }));
    },
  });

  const abrirFluxo = (item: { titulo: string; valor: string; rota: string }): DetalheCard => ({
    icon: Activity, tone: 'brand', titulo: item.titulo, valorPrincipal: item.valor, subtitulo: 'fluxo do dia',
    linhas: [
      { label: 'Entradas recebidas', valor: num(d?.fluxoDia.entradas ?? 0) },
      { label: 'Pedidos faturados', valor: num(d?.fluxoDia.faturados ?? 0) },
      { label: 'Pedidos em rota', valor: num(d?.fluxoDia.romaneios ?? 0) },
      { label: 'Entregas concluídas', valor: num(d?.fluxoDia.entregues ?? 0) },
    ],
    rota: item.rota, verMaisLabel: 'Ver mais',
  });

  return (
    <div className="theme-site flex flex-col h-full">
      {/* Header — barra integrada: chip com brilho + título Bricolage + controles */}
      <header className="dash-head shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="head-badge">
            <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-[19px] font-bold leading-none">Dashboard</h1>
            <p className="text-[11px] text-[#8A90A0] truncate">
              {filialAtiva ? `${filialAtiva.codigo} — ${filialAtiva.nome}` : 'Todas as filiais'} · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {PERIODOS.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)} className={periodo === p.key ? 'on' : ''}>{p.label}</button>
            ))}
            <button onClick={() => setPeriodo('custom')} className={`flex items-center gap-1 ${periodo === 'custom' ? 'on' : ''}`}>
              <CalendarRange className="h-3.5 w-3.5" /> Personalizado
            </button>
          </div>
          {periodo === 'custom' && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#23262F] bg-[#0C0D10] px-2 py-1.5">
              <span className="text-[10px] text-[#5E6472] uppercase">De</span>
              <input type="date" value={dataInicio} max={dataFim} onChange={e => setDataInicio(e.target.value)}
                className="bg-transparent text-xs text-[#F7F8FA] outline-none [color-scheme:dark] border-0" />
              <span className="text-[10px] text-[#5E6472] uppercase">Até</span>
              <input type="date" value={dataFim} min={dataInicio} onChange={e => setDataFim(e.target.value)}
                className="bg-transparent text-xs text-[#F7F8FA] outline-none [color-scheme:dark] border-0" />
            </div>
          )}
          <button onClick={carregar} className="btn-accent">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-7">
      {/* ═══ FINANCEIRO ═══ */}
      <Secao icon={CircleDollarSign} titulo={`Financeiro · ${d?.periodoLabel || ''}`} cor="#34d399">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Kpi icon={TrendingUp} label="Faturamento"
            value={R$c((f?.devolucoes ?? 0) > 0 ? (f?.faturamentoLiquido ?? f?.faturamento ?? 0) : (f?.faturamento ?? 0))}
            tone="brand" delta={f?.faturamentoDelta}
            sub={(f?.devolucoes ?? 0) > 0
              ? <span>{num(f?.vendas ?? 0)} vendas · <span className="text-[#E0483D]">−{R$c(f?.devolucoes ?? 0)} dev.</span></span>
              : `${num(f?.vendas ?? 0)} vendas`}
            onClick={() => setDetalhe(abrir('faturamento'))} />
          <Kpi icon={Receipt} label="Ticket Médio" value={R$c(f?.ticketMedio ?? 0)} tone="brand" sub="por venda" onClick={() => setDetalhe(abrir('ticket'))} />
          <Kpi icon={Percent} label="Margem Bruta" value={pct(f?.margemBruta ?? 0)} tone={(f?.margemBruta ?? 0) >= 0 ? 'emerald' : 'rose'}
            sub="do DRE realizado" onClick={() => setDetalhe(abrir('margem'))} />
          <Kpi icon={Wallet} label="A Receber" value={R$c(f?.receber.total ?? 0)} tone="brand"
            sub={<span className={f?.receber.vencido ? 'text-[#E0483D]' : ''}>{f?.receber.vencido ? `${R$c(f.receber.vencido)} vencido` : `${num(f?.receber.qtd ?? 0)} títulos`}</span>}
            onClick={() => setDetalhe(abrir('receber'))} />
          <Kpi icon={Landmark} label="A Pagar" value={R$c(f?.pagar.total ?? 0)} tone="brand"
            sub={<span className={f?.pagar.vencido ? 'text-[#E0483D]' : ''}>{f?.pagar.vencido ? `${R$c(f.pagar.vencido)} vencido` : `${num(f?.pagar.qtd ?? 0)} títulos`}</span>}
            onClick={() => setDetalhe(abrir('pagar'))} />
          <Kpi icon={Scale} label="Saldo Projetado" value={R$c(f?.saldoProjetado ?? 0)} tone={(f?.saldoProjetado ?? 0) >= 0 ? 'emerald' : 'rose'}
            sub="receber − pagar" onClick={() => setDetalhe(abrir('saldo'))} />
        </div>

        {/* Faturamento + aging */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="panelx xl:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="eyebrow">FATURAMENTO · SÉRIE DIÁRIA</div>
                <div className="flex items-end gap-2.5 mt-1.5">
                  <span className="headline">{R$c((f?.devolucoes ?? 0) > 0 ? (f?.faturamentoLiquido ?? f?.faturamento ?? 0) : (f?.faturamento ?? 0))}</span>
                  {f?.faturamentoDelta !== undefined && <span className="mb-1"><Delta v={f.faturamentoDelta} /></span>}
                </div>
                {(f?.devolucoes ?? 0) > 0
                  ? <p className="text-[11px] text-[#8A90A0] mt-1">{num(f?.vendas ?? 0)} vendas · bruto {R$c(f?.faturamento ?? 0)} <span className="text-[#E0483D]">(−) {R$c(f?.devolucoes ?? 0)} devoluções</span></p>
                  : <p className="text-[11px] text-[#8A90A0] mt-1">{num(f?.vendas ?? 0)} vendas no período</p>}
              </div>
              <span className="pill">{d?.serieFaturamento.length ?? 0} dias</span>
            </div>
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={d?.serieFaturamento || []} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#01B8FA" stopOpacity={0.42} />
                    <stop offset="55%" stopColor="#01B8FA" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#01B8FA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.055)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#5E6472', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} dy={4} />
                <YAxis tick={{ fill: '#5E6472', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => R$c(v).replace('R$ ', '')} width={54} />
                <Tooltip contentStyle={tipStyle} formatter={(v: any) => [R$(v), 'Faturado']} labelStyle={{ color: '#8A90A0' }} cursor={{ stroke: 'rgba(1,184,250,0.45)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="valor" stroke="#01B8FA" strokeWidth={2.5} fill="url(#gFat)"
                  dot={false} activeDot={{ r: 4, fill: '#01B8FA', stroke: '#08090A', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Aging a receber/pagar */}
          <div className="panelx">
            <div className="eyebrow mb-4">VENCIMENTOS · AGING</div>
            {(['receber', 'pagar'] as const).map((tipo) => {
              const ag = f?.[tipo]; if (!ag) return null;
              const faixas = [
                { k: 'vencido', label: 'Vencido', v: ag.vencido, cor: '#FF6B7A' },
                { k: 'ate7', label: '0–7 dias', v: ag.ate7, cor: '#01B8FA' },
                { k: 'ate30', label: '8–30 dias', v: ag.ate30, cor: '#22D3EE' },
                { k: 'mais30', label: '+30 dias', v: ag.mais30, cor: '#3B9EFF' },
              ];
              return (
                <div key={tipo} className="mb-4 last:mb-0 cursor-pointer" onClick={() => setDetalhe(abrir(tipo === 'receber' ? 'receber' : 'pagar'))}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="eyebrow mut">{tipo === 'receber' ? 'A Receber' : 'A Pagar'}</span>
                    <span className="num text-xs font-bold text-[#F7F8FA]">{R$c(ag.total)}</span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden track">
                    {faixas.map(fx => (ag.total > 0 && fx.v > 0) ? (
                      <div key={fx.k} title={`${fx.label}: ${R$(fx.v)}`} style={{ width: `${(fx.v / ag.total) * 100}%`, background: fx.cor }} />
                    ) : null)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {faixas.filter(fx => fx.v > 0).map(fx => (
                      <span key={fx.k} className="text-[10px] text-[#8A90A0] flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: fx.cor }} />{fx.label} {R$c(fx.v)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-[#23262F] flex items-center justify-between text-[11px]">
              <span className="text-[#8A90A0]">Inadimplência</span>
              <span className={`font-bold ${(f?.inadimplenciaPct ?? 0) > 0 ? 'text-[#FF6B7A]' : 'text-[#34D9A6]'}`}>{pct(f?.inadimplenciaPct ?? 0)}</span>
            </div>
          </div>
        </div>
      </Secao>

      {/* ═══ ESTOQUE / WMS ═══ */}
      <Secao icon={Boxes} titulo="Estoque & WMS" cor="#01B8FA">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Kpi icon={Package} label="Itens c/ Saldo" value={num(e?.itensComSaldo ?? 0)} tone="brand" sub={`de ${num(e?.produtosAtivos ?? 0)} ativos`} onClick={() => setDetalhe(abrir('itens'))} />
          <Kpi icon={CircleDollarSign} label="Valor do Estoque" value={R$c(e?.valorEstoque ?? 0)} tone="brand" sub="a custo médio" onClick={() => setDetalhe(abrir('valorEstoque'))} />
          <Kpi icon={AlertTriangle} label="Validade" value={num((e?.validade.vencido ?? 0) + (e?.validade.ate3 ?? 0) + (e?.validade.ate7 ?? 0))} tone={(e?.validade.vencido ?? 0) ? 'rose' : 'warning'}
            sub={`${e?.validade.vencido ?? 0} venc · ${e?.validade.ate3 ?? 0} em 3d`} onClick={() => setDetalhe(abrir('validade'))} />
          <Kpi icon={TrendingDown} label="Perdas/Quebras" value={R$c(e?.perdaValor ?? 0)} tone={(e?.perdaValor ?? 0) ? 'rose' : 'slate'} sub={kg(e?.perdaQtd ?? 0)} onClick={() => setDetalhe(abrir('perdas'))} />
          <Kpi icon={ShoppingCart} label="Ruptura" value={num(e?.rupturas ?? 0)} tone={(e?.rupturas ?? 0) ? 'warning' : 'slate'} sub="produtos zerados" onClick={() => setDetalhe(abrir('ruptura'))} />
          <Kpi icon={Activity} label="Movimentações" value={num(d?.kpis.movimentacoesHoje ?? 0)} tone="brand" sub="no período" onClick={() => setDetalhe(abrir('movimentacoes'))} />
        </div>
      </Secao>

      {/* ═══ VENDAS: pedidos + top ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Pedidos por status */}
        <div className="panelx">
          <h3 className="font-semibold text-[#FFFFFF] text-sm mb-4 flex items-center gap-2"><PackageCheck className="h-4 w-4 text-[#01B8FA]" /> Pedidos por status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" tick={{ fill: '#8A90A0', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: any) => [v, 'pedidos']} />
              <Bar dataKey="valor" radius={[0, 5, 5, 0]} cursor="pointer" onClick={(p: any) => setDetalhe(abrirStatus({ status: p.status, label: p.label, valor: p.valor }))}>
                {statusData.map((s) => <Cell key={s.status} fill={s.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top clientes */}
        <div className="panelx">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#FFFFFF] text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#01B8FA]" /> Top clientes</h3>
            <span className="text-[10px] text-[#8A90A0]">por faturamento</span>
          </div>
          <div className="space-y-2.5">
            {(d?.topClientes || []).filter(c => c.valor > 0).slice(0, 6).map((c, i) => (
              <button key={c.clienteId} onClick={() => setDetalhe(abrirCliente(c))} className="w-full text-left group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#F7F8FA] truncate flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#5E6472] w-3">{i + 1}</span>{c.nome}
                  </span>
                  <span className="num font-bold text-[#F7F8FA] shrink-0 ml-2">{R$c(c.valor)}</span>
                </div>
                <div className="h-1.5 rounded-full track overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#0E86D4] to-[#01B8FA] rounded-full group-hover:brightness-110" style={{ width: `${(c.valor / maxCliente) * 100}%` }} />
                </div>
              </button>
            ))}
            {!(d?.topClientes || []).some(c => c.valor > 0) && <p className="text-xs text-[#8A90A0] py-6 text-center">Sem faturamento no período.</p>}
          </div>
        </div>

        {/* Top produtos */}
        <div className="panelx">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#FFFFFF] text-sm flex items-center gap-2"><Boxes className="h-4 w-4 text-[#01B8FA]" /> Top produtos (saída)</h3>
            <div className="seg text-[10px]">
              <button onClick={() => setOrdProduto('custo')} className={ordProduto === 'custo' ? 'on' : ''}>R$</button>
              <button onClick={() => setOrdProduto('qtd')} className={ordProduto === 'qtd' ? 'on' : ''}>kg</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {produtosOrdenados.slice(0, 6).map((p) => (
              <button key={p.produtoId} onClick={() => setDetalhe(abrirProduto(p))} className="w-full flex items-center justify-between text-xs py-1 hover:bg-white/[0.04] rounded px-1.5 -mx-1.5">
                <span className="text-[#F7F8FA] truncate flex items-center gap-1.5">
                  <span className="text-[9px] num text-[#5E6472]">{p.codigo}</span>{p.descricao}
                </span>
                <span className="num font-bold text-[#F7F8FA] shrink-0 ml-2">{ordProduto === 'custo' ? R$c(p.custo) : kg(p.qtd)}</span>
              </button>
            ))}
            {produtosOrdenados.length === 0 && <p className="text-xs text-[#8A90A0] py-6 text-center">Sem saídas no período.</p>}
          </div>
        </div>
      </div>

      {/* ═══ FLUXO OPERACIONAL ═══ */}
      <Secao icon={Activity} titulo="Fluxo operacional do dia" cor="#01B8FA">
        <div className="panelx">
          <div className="grid grid-cols-4 gap-0">
            {[
              { label: 'Entradas\nrecebidas', value: `${d?.fluxoDia.entradas ?? 0}`, cor: '#01B8FA', rota: '/wms/entradas', step: 1 },
              { label: 'Pedidos\nfaturados', value: `${d?.fluxoDia.faturados ?? 0} NF-e`, cor: '#22D3EE', rota: '/fiscal/gestao', step: 2 },
              { label: 'Pedidos\nem rota', value: `${d?.fluxoDia.romaneios ?? 0}`, cor: '#2DD4A7', rota: '/logistica/torre', step: 3 },
              { label: 'Entregas\nconcluídas', value: `${d?.fluxoDia.entregues ?? 0}`, cor: '#A78BFA', rota: '/logistica/torre', step: 4 },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center">
                <button onClick={() => setDetalhe(abrirFluxo({ titulo: item.label.replace('\n', ' '), valor: item.value, rota: item.rota }))} className="flex flex-col items-center flex-1 group">
                  <div className="h-11 w-11 rounded-full flex items-center justify-center text-[#08090A] text-sm font-bold ring-4 ring-white/[0.06] group-hover:scale-105 transition-transform" style={{ background: item.cor, boxShadow: `0 0 22px -6px ${item.cor}` }}>{item.step}</div>
                  <p className="text-[11px] font-medium text-[#8A90A0] mt-2.5 text-center whitespace-pre-line">{item.label}</p>
                  <p className="num text-sm font-bold text-[#F7F8FA] mt-1">{item.value}</p>
                </button>
                {i < arr.length - 1 && <div className="h-px w-full bg-[#23262F] mx-1 mb-9" />}
              </div>
            ))}
          </div>
        </div>
      </Secao>

        <DetalheModal detalhe={detalhe} onClose={() => setDetalhe(null)} navigate={navigate} />
      </div>
    </div>
  );
}
