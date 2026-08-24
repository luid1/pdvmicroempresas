import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { financeiroApi, custosApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Boxes,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Eye,
  Scale,
  Percent,
  DollarSign,
  ChevronRight,
  Ban,
  RefreshCw,
} from 'lucide-react';
import { PageHeader, btnGlass } from '../../cadastros/ui';
import { toast, confirmDialog } from '../../../components/ui/feedback';

/* ══════════════════════════════════════════════════════════════════════════════
   MÓDULO FINANCEIRO & CONTROLADORIA — DRE & Rentabilidade · Mercado PDV
   FinancialHub: master-view com 4 abas (Dashboard DRE, Rentabilidade por Cliente,
   Rentabilidade por Produto, Contas a Pagar/Receber). Branding corporativo premium:
   off-white #FAFAFA, cards brancos border-neutral-200, KPIs oversized, data grids
   de alta densidade com sticky headers e cores semânticas sutis.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── Formatação ────────────────────────────────── */
const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const brlCompact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (abs >= 1_000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  return brl(v);
};
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
const num = (v: number) => v.toLocaleString('pt-BR');
const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesAtualLabel = () => { const s = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const primeiroDiaMesISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

/* Classe semântica sutil para margem. */
function corMargem(margem: number): string {
  if (margem >= 20) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  if (margem >= 10) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
}
function corResultado(v: number): string {
  return v >= 0 ? 'text-emerald-700' : 'text-rose-700';
}

/* ═══════════════════════════ Tipos & Mocks ═══════════════════════════════════ */
type AbaFin = 'dashboard' | 'clientes' | 'produtos' | 'titulos';

interface DreLinha {
  chave: string;
  label: string;
  valor: number;
  tipo: 'receita' | 'deducao' | 'resultado' | 'custo' | 'despesa';
  destaque?: boolean;
  detalhe?: { codigo: string; descricao: string; valor: number }[];
}

interface DreKpis {
  receitaBruta: number; deducoes: number; receitaLiquida: number;
  cmv: number; lucroBruto: number; perdas: number; resultado: number; margemBruta: number;
  despesasOperacionais: number; despesasFinanceiras: number; outrasReceitas: number;
  resultadoLiquido: number; margemLiquida: number;
}
interface DreCompleto {
  periodo: { inicio: string; fim: string; label: string };
  linhas: DreLinha[];
  kpis: DreKpis;
  cobertura: { nfesEmitidas: number; vendasSemNota?: number; movimentacoesVenda: number; observacao: string };
}

/* ── Títulos reais (Contas a Pagar/Receber, vindas da API) ──
   Status do backend: ABERTO · PARCIAL · PAGO · VENCIDO · CANCELADO. */
type StatusConta = 'ABERTO' | 'PARCIAL' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
type NatTitulo = 'RECEITA' | 'DESPESA';

interface ContaApi {
  id: string; descricao: string; numero?: string; status: StatusConta;
  valorOriginal: number | string; valorPago: number | string; valorAberto: number | string;
  dataVencimento: string; dataEmissao?: string; dataPagamento?: string;
  cliente?: { razaoSocial?: string; nomeFantasia?: string };
  fornecedor?: { razaoSocial?: string; nomeFantasia?: string };
}

interface ResumoConta {
  valorOriginalTotal: number; valorEmAberto: number; valorVencido: number;
  valorPago?: number; valorRecebido?: number;
}

interface TituloReal {
  id: string; natureza: NatTitulo; parte: string; descricao: string; numero?: string;
  status: StatusConta; valorOriginal: number; valorAberto: number; dataVencimento: string;
}

const nomeParte = (c: ContaApi, nat: NatTitulo): string => {
  const p = nat === 'RECEITA' ? c.cliente : c.fornecedor;
  return p?.nomeFantasia || p?.razaoSocial || c.descricao || (nat === 'RECEITA' ? 'Cliente' : 'Fornecedor');
};

const normalizarConta = (c: ContaApi, nat: NatTitulo): TituloReal => ({
  id: c.id, natureza: nat, parte: nomeParte(c, nat), descricao: c.descricao, numero: c.numero,
  status: c.status, valorOriginal: Number(c.valorOriginal) || 0, valorAberto: Number(c.valorAberto) || 0,
  dataVencimento: c.dataVencimento,
});

const emAberto = (t: { status: StatusConta }) => t.status !== 'PAGO' && t.status !== 'CANCELADO';
const dataCurta = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
const dataLonga = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '—' : d.toLocaleDateString('pt-BR'); };

/* ── Rentabilidade por Cliente/Produto — dados reais (custosApi) ── */
interface RentClienteReal {
  clienteId: string; nome: string;
  receita: number; custos: number; resultado: number; margemPct: number; peso: number;
}
interface RentClienteResp { clientes: RentClienteReal[]; totais: { receita: number; custos: number; resultado: number; peso: number; clientes: number; produtos: number; margemPct: number } }

interface MargemProdutoReal {
  produtoId: string; codigo: string; descricao: string; unidade: string;
  qtdVendida: number; precoMedioVenda: number; custoComposto: number;
  receita: number; custoTotal: number; lucroBruto: number; margemPct: number;
}
interface MargemResp { kpis: { cmv: number; receitaTotal: number; perdas: number; lucroBruto: number; margemMediaPct: number }; produtos: MargemProdutoReal[] }

/* Barra de período compartilhada (De/Até) para as abas de rentabilidade. */
function PeriodoBar({ ini, fim, onIni, onFim }: { ini: string; fim: string; onIni: (v: string) => void; onFim: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <CalendarClock className="h-4 w-4 text-neutral-400" />
      <label className="flex items-center gap-1.5 text-neutral-500">De
        <input type="date" value={ini} onChange={(e) => onIni(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
      </label>
      <label className="flex items-center gap-1.5 text-neutral-500">Até
        <input type="date" value={fim} onChange={(e) => onFim(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
      </label>
    </div>
  );
}

/* Metadados visuais por status real do backend. */
const STATUS_META: Record<StatusConta, { label: string; cls: string; icon: React.ElementType }> = {
  ABERTO: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 ring-amber-100', icon: Clock },
  PARCIAL: { label: 'Parcial', cls: 'bg-sky-50 text-sky-700 ring-sky-100', icon: Clock },
  PAGO: { label: 'Pago', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', icon: CheckCircle2 },
  VENCIDO: { label: 'Atrasado', cls: 'bg-rose-50 text-rose-700 ring-rose-100', icon: AlertTriangle },
  CANCELADO: { label: 'Cancelado', cls: 'bg-neutral-100 text-neutral-500 ring-neutral-200', icon: Ban },
};

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
export default function FinancialHub() {
  const [aba, setAba] = useState<AbaFin>('dashboard');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Scale className="h-4 w-4" />}
        titulo="Financeiro & DRE"
        subtitulo="Demonstrativo de Resultados, rentabilidade e gestão de títulos"
        actions={
          <span className={btnGlass}>
            <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> {mesAtualLabel()}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[1400px] mx-auto">
      {/* Tabs */}
      <nav className="flex items-center gap-1 border-b border-neutral-200 mb-6 overflow-x-auto">
        <TabFin ativo={aba === 'dashboard'} icon={LayoutDashboard} label="Dashboard DRE & Caixa" onClick={() => setAba('dashboard')} />
        <TabFin ativo={aba === 'clientes'} icon={Users} label="Rentabilidade por Cliente" onClick={() => setAba('clientes')} />
        <TabFin ativo={aba === 'produtos'} icon={Boxes} label="Rentabilidade por Produto" onClick={() => setAba('produtos')} />
        <TabFin ativo={aba === 'titulos'} icon={ReceiptText} label="Contas a Pagar / Receber" onClick={() => setAba('titulos')} />
      </nav>

      {aba === 'dashboard' && <DashboardDRE />}
      {aba === 'clientes' && <RentabilidadeClientes />}
      {aba === 'produtos' && <RentabilidadeProdutos />}
      {aba === 'titulos' && <GestaoTitulos />}
      </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 1 — DASHBOARD DRE & CAIXA
   ════════════════════════════════════════════════════════════════════════════ */
function DashboardDRE() {
  const [dre, setDre] = useState<DreCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Contas a receber/pagar em aberto — dados reais para os painéis laterais.
  const [receber, setReceber] = useState<TituloReal[]>([]);
  const [pagar, setPagar] = useState<TituloReal[]>([]);
  const [resReceber, setResReceber] = useState<ResumoConta | null>(null);
  const [resPagar, setResPagar] = useState<ResumoConta | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    financeiroApi
      .dreCompleto()
      .then((res) => { if (vivo) { setDre(res.data); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.message || 'Falha ao carregar o DRE.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  // Títulos em aberto (independente do DRE): os painéis mostram o que está por
  // vencer/atrasado agora, não o recorte do período do DRE.
  useEffect(() => {
    let vivo = true;
    const porVenc = (a: TituloReal, b: TituloReal) => +new Date(a.dataVencimento) - +new Date(b.dataVencimento);
    Promise.all([
      financeiroApi.receber().catch(() => ({ data: [] })),
      financeiroApi.receberResumo().catch(() => ({ data: null })),
      financeiroApi.pagar().catch(() => ({ data: [] })),
      financeiroApi.pagarResumo().catch(() => ({ data: null })),
    ]).then(([r, rr, p, rp]) => {
      if (!vivo) return;
      setReceber(((r.data as ContaApi[]) || []).map((c) => normalizarConta(c, 'RECEITA')).filter(emAberto).sort(porVenc));
      setResReceber(rr.data as ResumoConta | null);
      setPagar(((p.data as ContaApi[]) || []).map((c) => normalizarConta(c, 'DESPESA')).filter(emAberto).sort(porVenc));
      setResPagar(rp.data as ResumoConta | null);
    });
    return () => { vivo = false; };
  }, []);

  if (carregando) {
    return <div className="py-16 text-center text-[13px] text-neutral-400">Carregando DRE do período…</div>;
  }
  if (erro || !dre) {
    return (
      <div className="py-16 text-center text-[13px] text-[#c3352b]">
        {erro || 'Sem dados de DRE.'}
      </div>
    );
  }

  const k = dre.kpis;
  const linhas = dre.linhas;

  return (
    <div className="space-y-6">
      {/* KPIs gigantes — reais, do período corrente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiGigante
          label="Receita Bruta"
          valor={k.receitaBruta}
          hint={`Faturamento — ${dre.periodo.label}`}
          icon={ArrowUpRight}
          tom="neutro"
        />
        <KpiGigante
          label="(–) Impostos s/ Vendas"
          valor={-k.deducoes}
          hint="ICMS · ICMS-ST · PIS · COFINS"
          icon={ArrowDownRight}
          tom="deducao"
        />
        <KpiGigante
          label="(=) Receita Líquida"
          valor={k.receitaLiquida}
          hint="Após deduções fiscais"
          icon={Wallet}
          tom="neutro"
        />
        <KpiGigante
          label="(–) CMV"
          valor={-k.cmv}
          hint="Custo da mercadoria vendida"
          icon={ArrowDownRight}
          tom="deducao"
        />
        <KpiGigante
          label="(–) Perdas e Quebras"
          valor={-k.perdas}
          hint="Movimentações de perda/avaria"
          icon={ArrowDownRight}
          tom="deducao"
        />
        <KpiGigante
          label="(=) Resultado Operacional"
          valor={k.resultado}
          hint={`Margem bruta ${pct(k.margemBruta)} · ${dre.cobertura.nfesEmitidas} NF-e${dre.cobertura.vendasSemNota ? ` + ${dre.cobertura.vendasSemNota} vendas sem nota` : ''}`}
          icon={TrendingUp}
          tom="lucro"
        />
        <KpiGigante
          label="(–) Despesas Operac. + Financ."
          valor={-(k.despesasOperacionais + k.despesasFinanceiras)}
          hint="Classificadas no Plano de Contas"
          icon={ArrowDownRight}
          tom="deducao"
        />
        <KpiGigante
          label="(=) Resultado Líquido"
          valor={k.resultadoLiquido}
          hint={`Margem líquida ${pct(k.margemLiquida)} · após despesas e outras receitas`}
          icon={TrendingUp}
          tom={k.resultadoLiquido >= 0 ? 'lucro' : 'deducao'}
        />
      </div>

      {/* Cascata DRE + painéis de caixa */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* DRE detalhada */}
        <section className="xl:col-span-1 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-neutral-400" /> Demonstrativo de Resultados
          </h2>
          <div>
            {linhas.map((l, i) => (
              <LinhaDre key={l.chave} l={l} ultima={i === linhas.length - 1} />
            ))}
          </div>
        </section>

        {/* Contas a Receber — em aberto (real) */}
        <PainelContas
          titulo="Contas a Receber"
          icone={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          corTotal="text-emerald-700 bg-emerald-50"
          titulos={receber}
          totalAberto={resReceber?.valorEmAberto}
          totalVencido={resReceber?.valorVencido}
          vazio="Nenhum título a receber em aberto."
        />

        {/* Contas a Pagar — em aberto (real) */}
        <PainelContas
          titulo="Contas a Pagar"
          icone={<ArrowDownRight className="h-4 w-4 text-rose-500" />}
          corTotal="text-rose-700 bg-rose-50"
          titulos={pagar}
          totalAberto={resPagar?.valorEmAberto}
          totalVencido={resPagar?.valorVencido}
          vazio="Nenhum título a pagar em aberto."
        />
      </div>
    </div>
  );
}

/* Painel lateral de títulos em aberto (receber ou pagar) — lista os próximos a
   vencer e resume total em aberto / atrasado a partir do resumo do backend. */
function PainelContas({
  titulo, icone, corTotal, titulos, totalAberto, totalVencido, vazio,
}: {
  titulo: string; icone: React.ReactNode; corTotal: string; titulos: TituloReal[];
  totalAberto?: number; totalVencido?: number; vazio: string;
}) {
  const topo = titulos.slice(0, 6);
  const totalLista = titulos.reduce((s, t) => s + t.valorAberto, 0);
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">{icone} {titulo}</h2>
        <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${corTotal}`}>
          {brlCompact(totalAberto ?? totalLista)}
        </span>
      </div>
      {topo.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-neutral-400">{vazio}</div>
      ) : (
        <div className="space-y-2.5">
          {topo.map((t) => {
            const atrasado = t.status === 'VENCIDO';
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${atrasado ? 'bg-rose-50 text-rose-600' : 'bg-neutral-100 text-neutral-500'}`}>
                  {atrasado ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800 truncate">{t.parte}</p>
                  <p className="text-[11px] text-neutral-400">
                    vence {dataCurta(t.dataVencimento)}
                    {atrasado ? <span className="text-rose-500 font-medium"> · em atraso</span> : ''}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-slate-900 tabular-nums shrink-0">{brl(t.valorAberto)}</p>
              </div>
            );
          })}
        </div>
      )}
      {(totalVencido ?? 0) > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[12px]">
          <span className="text-neutral-500">{titulos.length} em aberto</span>
          <span className="text-rose-600">Atrasados: <strong>{brlCompact(totalVencido ?? 0)}</strong></span>
        </div>
      )}
    </section>
  );
}

/* Linha do DRE com drill-down opcional (detalhe por conta analítica) */
function LinhaDre({ l, ultima }: { l: DreLinha; ultima: boolean }) {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = !!(l.detalhe && l.detalhe.length > 0);
  return (
    <div className={ultima ? '' : 'border-b border-neutral-100'}>
      <div
        className={`flex items-center justify-between gap-4 py-4 ${temDetalhe ? 'cursor-pointer select-none' : ''}`}
        onClick={temDetalhe ? () => setAberto((v) => !v) : undefined}
      >
        <span
          className={`text-[13.5px] leading-snug flex items-center gap-1.5 ${
            l.tipo === 'resultado' ? 'font-semibold text-slate-900' : 'font-normal text-slate-600'
          }`}
        >
          {temDetalhe && (
            <ChevronRight className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${aberto ? 'rotate-90' : ''}`} />
          )}
          {l.label}
        </span>
        <span
          className={`text-[15px] tabular-nums shrink-0 ${
            l.tipo === 'resultado'
              ? l.valor < 0
                ? 'font-semibold text-rose-500'
                : 'font-semibold text-emerald-600'
              : l.valor < 0
                ? 'font-medium text-rose-500'
                : 'font-medium text-slate-800'
          }`}
        >
          {brl(l.valor)}
        </span>
      </div>
      {temDetalhe && aberto && (
        <div className="pb-3 pl-5 space-y-1.5">
          {l.detalhe!.map((d) => (
            <div key={d.codigo} className="flex items-center justify-between gap-4 text-[12px]">
              <span className="text-neutral-500">{d.codigo} · {d.descricao}</span>
              <span className="tabular-nums text-slate-600">{brl(d.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* KPI oversized */
function KpiGigante({
  label,
  valor,
  hint,
  icon: Icon,
  tom,
}: {
  label: string;
  valor: number;
  hint: string;
  icon: React.ElementType;
  tom: 'neutro' | 'deducao' | 'lucro';
}) {
  const cor =
    tom === 'lucro' ? 'text-emerald-600' : tom === 'deducao' ? 'text-rose-500' : 'text-slate-900';
  const ring = tom === 'lucro' ? 'ring-1 ring-emerald-500/25 bg-emerald-500/10' : 'border border-neutral-200 bg-white';
  return (
    <div className={`rounded-2xl p-5 ${ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-neutral-500">{label}</p>
        <span
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            tom === 'lucro' ? 'bg-emerald-100 text-emerald-700' : tom === 'deducao' ? 'bg-rose-50 text-rose-500' : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-2 text-[34px] leading-none font-semibold tracking-tight tabular-nums ${cor}`}>
        {brl(valor)}
      </p>
      <p className="mt-2 text-[12px] text-neutral-400">{hint}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 2 — RENTABILIDADE POR CLIENTE
   ════════════════════════════════════════════════════════════════════════════ */
function RentabilidadeClientes() {
  const { filialAtiva } = useAuth();
  const [busca, setBusca] = useState('');
  const [ini, setIni] = useState(primeiroDiaMesISO());
  const [fim, setFim] = useState(hojeISO());
  const [dados, setDados] = useState<RentClienteResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!filialAtiva?.id) { setCarregando(false); setErro('Selecione uma filial para ver a rentabilidade.'); return; }
    let vivo = true;
    setCarregando(true);
    custosApi
      .rentabilidade(filialAtiva.id, { dataIni: ini, dataFim: fim })
      .then((r) => { if (vivo) { setDados(r.data); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.message || 'Falha ao carregar a rentabilidade por cliente.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [filialAtiva?.id, ini, fim]);

  const linhas = useMemo(() => {
    const arr = dados?.clientes || [];
    const q = busca.trim().toLowerCase();
    return q ? arr.filter((c) => (c.nome || '').toLowerCase().includes(q)) : arr;
  }, [dados, busca]);
  const tot = dados?.totais;

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <PeriodoBar ini={ini} fim={fim} onIni={setIni} onFim={setFim} />
      </div>

      {carregando ? (
        <div className="py-16 text-center text-[13px] text-neutral-400">Carregando rentabilidade por cliente…</div>
      ) : erro ? (
        <div className="py-16 text-center text-[13px] text-[#c3352b]">{erro}</div>
      ) : linhas.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-neutral-400">Nenhuma venda a cliente identificado no período (rentabilidade usa NF-e emitidas com cliente).</div>
      ) : (
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-y-auto max-h-[62vh]">
          <table className="w-full table-fixed border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase tracking-wide">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-neutral-50 w-[34%]">Cliente</th>
                <th className="text-right font-semibold px-3 py-2">Receita</th>
                <th className="text-right font-semibold px-3 py-2">Custos (CMV)</th>
                <th className="text-right font-semibold px-3 py-2">Resultado</th>
                <th className="text-center font-semibold px-3 py-2">Margem</th>
                <th className="text-right font-semibold px-3 py-2">Peso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((c) => (
                <tr key={c.clienteId} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-3 py-2 sticky left-0 bg-white hover:bg-neutral-50/70">
                    <p className="font-medium text-slate-900 truncate">{c.nome}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{brlCompact(c.receita)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{brlCompact(c.custos)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${corResultado(c.resultado)}`}>
                    {brlCompact(c.resultado)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${corMargem(c.margemPct)}`}>
                      {pct(c.margemPct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{kg(c.peso)}</td>
                </tr>
              ))}
            </tbody>
            {tot && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-[#FBFAF7] text-[#16171D] font-semibold text-[12px]">
                  <td className="px-3 py-2 sticky left-0 bg-white truncate">Totais ({linhas.length})</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brlCompact(tot.receita)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brlCompact(tot.custos)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${tot.resultado >= 0 ? 'text-[#0b7d4e]' : 'text-[#c3352b]'}`}>
                    {brlCompact(tot.resultado)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{pct(tot.margemPct)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kg(tot.peso)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 3 — RENTABILIDADE POR PRODUTO
   ════════════════════════════════════════════════════════════════════════════ */
function RentabilidadeProdutos() {
  const { filialAtiva } = useAuth();
  const [busca, setBusca] = useState('');
  const [ini, setIni] = useState(primeiroDiaMesISO());
  const [fim, setFim] = useState(hojeISO());
  const [dados, setDados] = useState<MargemResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!filialAtiva?.id) { setCarregando(false); setErro('Selecione uma filial para ver a margem por produto.'); return; }
    let vivo = true;
    setCarregando(true);
    custosApi
      .margem(filialAtiva.id, { dataIni: ini, dataFim: fim })
      .then((r) => { if (vivo) { setDados(r.data); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.message || 'Falha ao carregar a margem por produto.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [filialAtiva?.id, ini, fim]);

  const linhas = useMemo(() => {
    const arr = dados?.produtos || [];
    const q = busca.trim().toLowerCase();
    return q ? arr.filter((p) => (p.descricao || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)) : arr;
  }, [dados, busca]);
  const k = dados?.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou código…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <PeriodoBar ini={ini} fim={fim} onIni={setIni} onFim={setFim} />
        {k && (
          <div className="flex items-center gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-neutral-500">
              <DollarSign className="h-4 w-4 text-emerald-500" /> Receita{' '}
              <strong className="text-slate-900">{brlCompact(k.receitaTotal)}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              <Percent className="h-4 w-4 text-neutral-400" /> Margem média{' '}
              <strong className="text-slate-900">{pct(k.margemMediaPct)}</strong>
            </span>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="py-16 text-center text-[13px] text-neutral-400">Carregando margem por produto…</div>
      ) : erro ? (
        <div className="py-16 text-center text-[13px] text-[#c3352b]">{erro}</div>
      ) : linhas.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-neutral-400">Nenhuma venda registrada no período (margem usa movimentações de venda + NF-e emitidas).</div>
      ) : (
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[62vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 text-neutral-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-neutral-50 whitespace-nowrap">Código</th>
                <th className="text-left font-semibold px-4 py-3 min-w-[180px]">Produto</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Qtd Vendida</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Un.</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Preço Médio</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Custo Comp.</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Receita</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">CMV</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Lucro Bruto</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">% Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((p) => (
                <tr key={p.produtoId} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white hover:bg-neutral-50/70 font-mono text-[12px] text-neutral-500">
                    {p.codigo}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.descricao}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{num(p.qtdVendida)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block rounded-md bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px] font-semibold">
                      {p.unidade || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.precoMedioVenda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.custoComposto)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{brl(p.receita)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.custoTotal)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corResultado(p.lucroBruto)}`}>
                    {brl(p.lucroBruto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${corMargem(p.margemPct)}`}>
                      {pct(p.margemPct)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {k && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-[#FBFAF7] text-[#16171D] font-semibold text-[13px]">
                  <td className="px-4 py-3 sticky left-0 bg-white" colSpan={6}>
                    Totalizador ({linhas.length} itens)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(k.receitaTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(k.cmv)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#0b7d4e]">{brl(k.lucroBruto)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{pct(k.margemMediaPct)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 4 — CONTAS A PAGAR / RECEBER (Gestão de Títulos)
   ════════════════════════════════════════════════════════════════════════════ */
function GestaoTitulos() {
  const [titulos, setTitulos] = useState<TituloReal[]>([]);
  const [resReceber, setResReceber] = useState<ResumoConta | null>(null);
  const [resPagar, setResPagar] = useState<ResumoConta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtroNat, setFiltroNat] = useState<'TODOS' | NatTitulo>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ABERTO' | 'VENCIDO' | 'PAGO'>('TODOS');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<TituloReal | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([
      financeiroApi.receber().catch(() => ({ data: [] })),
      financeiroApi.receberResumo().catch(() => ({ data: null })),
      financeiroApi.pagar().catch(() => ({ data: [] })),
      financeiroApi.pagarResumo().catch(() => ({ data: null })),
    ]).then(([r, rr, p, rp]) => {
      const rec = ((r.data as ContaApi[]) || []).map((c) => normalizarConta(c, 'RECEITA'));
      const pag = ((p.data as ContaApi[]) || []).map((c) => normalizarConta(c, 'DESPESA'));
      setTitulos([...rec, ...pag].sort((a, b) => +new Date(a.dataVencimento) - +new Date(b.dataVencimento)));
      setResReceber(rr.data as ResumoConta | null);
      setResPagar(rp.data as ResumoConta | null);
    }).finally(() => setCarregando(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const casaStatus = (t: TituloReal) =>
    filtroStatus === 'TODOS' ? true
    : filtroStatus === 'ABERTO' ? (t.status === 'ABERTO' || t.status === 'PARCIAL')
    : filtroStatus === 'VENCIDO' ? t.status === 'VENCIDO'
    : t.status === 'PAGO';

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return titulos.filter(
      (t) =>
        (filtroNat === 'TODOS' || t.natureza === filtroNat) &&
        casaStatus(t) &&
        (!q || t.parte.toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q)),
    );
  }, [titulos, filtroNat, filtroStatus, busca]);

  const totReceber = resReceber?.valorEmAberto ?? 0;
  const totPagar = resPagar?.valorEmAberto ?? 0;
  const totAtrasado = (resReceber?.valorVencido ?? 0) + (resPagar?.valorVencido ?? 0);

  const baixar = async (t: TituloReal) => {
    if (!(await confirmDialog(`Baixar "${t.parte}" pelo valor em aberto de ${brl(t.valorAberto)}?`, { okLabel: 'Baixar título' }))) return;
    setBaixandoId(t.id);
    try {
      if (t.natureza === 'RECEITA') await financeiroApi.baixarReceber(t.id, { valor: t.valorAberto });
      else await financeiroApi.baixarPagar(t.id, { valor: t.valorAberto });
      toast('Título baixado.', 'success');
      setDetalhe(null);
      carregar();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao baixar o título.', 'error');
    } finally {
      setBaixandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-neutral-500 flex items-center gap-1.5">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" /> A Receber (em aberto)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-emerald-700 tabular-nums">{brl(totReceber)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-neutral-500 flex items-center gap-1.5">
            <ArrowDownRight className="h-4 w-4 text-rose-500" /> A Pagar (em aberto)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-rose-600 tabular-nums">{brl(totPagar)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-neutral-500 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Vencidos (atrasados)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-amber-600 tabular-nums">{brl(totAtrasado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, cliente ou categoria…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['TODOS', 'RECEITA', 'DESPESA'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setFiltroNat(n)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                filtroNat === n ? 'bg-amber-400 text-neutral-900' : 'bg-white border border-neutral-200 text-slate-600 hover:bg-neutral-50'
              }`}
            >
              {n === 'TODOS' ? 'Todos' : n === 'RECEITA' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {([['TODOS', 'Todos status'], ['ABERTO', 'Pendente'], ['VENCIDO', 'Atrasado'], ['PAGO', 'Pago']] as const).map(([s, rot]) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                filtroStatus === s ? 'bg-amber-400 text-neutral-900' : 'bg-white border border-neutral-200 text-slate-600 hover:bg-neutral-50'
              }`}
            >
              {rot}
            </button>
          ))}
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-neutral-50"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Tabela de títulos */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[58vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 text-neutral-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Vencimento</th>
                <th className="text-left font-semibold px-4 py-3 min-w-[220px]">Fornecedor / Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Descrição</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Natureza</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Valor</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Em aberto</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-neutral-400 text-sm">Carregando títulos…</td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    Nenhum título encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : filtrados.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">{dataLonga(t.dataVencimento)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.parte}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[240px]">{t.descricao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                        t.natureza === 'RECEITA' ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {t.natureza === 'RECEITA' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {t.natureza === 'RECEITA' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${t.natureza === 'RECEITA' ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {brl(t.valorOriginal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(t.valorAberto)}</td>
                  <td className="px-4 py-3 text-center">
                    <TagStatus status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {emAberto(t) ? (
                        <button
                          onClick={() => baixar(t)}
                          disabled={baixandoId === t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-neutral-900 px-3 py-1.5 text-[12px] font-semibold hover:bg-amber-300 disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {baixandoId === t.id ? 'Baixando…' : 'Baixar Título'}
                        </button>
                      ) : t.status === 'PAGO' ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium px-3 py-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Baixado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 font-medium px-3 py-1.5">
                          <Ban className="h-3.5 w-3.5" /> Cancelado
                        </span>
                      )}
                      <button
                        onClick={() => setDetalhe(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 text-slate-600 px-3 py-1.5 text-[12px] font-medium hover:bg-neutral-50"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de detalhes */}
      {detalhe && <DetalheTitulo titulo={detalhe} onClose={() => setDetalhe(null)} onBaixar={() => baixar(detalhe)} />}
    </div>
  );
}

function TagStatus({ status }: { status: StatusConta }) {
  const cfg = STATUS_META[status] || STATUS_META.ABERTO;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function DetalheTitulo({ titulo, onClose, onBaixar }: { titulo: TituloReal; onClose: () => void; onBaixar: () => void }) {
  return createPortal((
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-white/60 animate-backdrop" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white backdrop-blur-2xl border-l border-[#E7E5DF] shadow-[0_24px_80px_-12px_rgba(22,23,29,0.18)] flex flex-col animate-[slideL_.2s_ease-out]">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">Detalhes do título</p>
            <h3 className="text-lg font-semibold text-slate-900">{titulo.parte}</h3>
          </div>
          <TagStatus status={titulo.status} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl bg-[#F6F5F2] border border-neutral-200 p-5">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-neutral-500">Valor do título</p>
            <p className={`text-4xl font-semibold tabular-nums mt-1 ${titulo.natureza === 'RECEITA' ? 'text-emerald-700' : 'text-slate-900'}`}>
              {brl(titulo.valorOriginal)}
            </p>
          </div>
          <dl className="space-y-3 text-[13px]">
            <LinhaDet termo="Natureza" valor={titulo.natureza === 'RECEITA' ? 'Receita (a receber)' : 'Despesa (a pagar)'} />
            <LinhaDet termo={titulo.natureza === 'RECEITA' ? 'Cliente' : 'Fornecedor'} valor={titulo.parte} />
            <LinhaDet termo="Descrição" valor={titulo.descricao || '—'} />
            {titulo.numero && <LinhaDet termo="Número" valor={titulo.numero} />}
            <LinhaDet termo="Vencimento" valor={dataLonga(titulo.dataVencimento)} />
            <LinhaDet termo="Situação" valor={(STATUS_META[titulo.status] || STATUS_META.ABERTO).label} />
            <LinhaDet termo="Em aberto" valor={brl(titulo.valorAberto)} />
          </dl>
        </div>
        <div className="border-t border-neutral-200 p-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-200 text-slate-700 py-3 text-sm font-semibold hover:bg-neutral-50"
          >
            Fechar
          </button>
          {emAberto(titulo) && (
            <button
              onClick={onBaixar}
              className="flex-1 rounded-xl bg-amber-400 text-neutral-900 py-3 text-sm font-semibold hover:bg-amber-300 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Baixar Título
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes slideL { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  ), document.body);
}

function LinhaDet({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
      <dt className="text-neutral-500">{termo}</dt>
      <dd className="font-medium text-slate-800">{valor}</dd>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Tab do hub
   ════════════════════════════════════════════════════════════════════════════ */
function TabFin({
  ativo,
  icon: Icon,
  label,
  onClick,
}: {
  ativo: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        ativo ? 'text-[#a9760a]' : 'text-neutral-500 hover:text-slate-700'
      }`}
    >
      <Icon className={`h-4 w-4 ${ativo ? 'text-[#a9760a]' : 'text-neutral-400'}`} />
      {label}
      {ativo && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-400 rounded-full" />}
    </button>
  );
}
