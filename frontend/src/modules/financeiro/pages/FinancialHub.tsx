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
   Rentabilidade por Produto, Contas a Pagar/Receber). Tema dark Lumin: canvas
   #08090A, superfícies #101216 com bordas #23262F, acento ciano #01B8FA, números
   mono/tabular e cores semânticas (verde #2DD4A7 · rosa #FF6B7A · âmbar #FF9F45).
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
  if (margem >= 20) return 'bg-[#2DD4A7]/15 text-[#2DD4A7] ring-1 ring-[#2DD4A7]/25';
  if (margem >= 10) return 'bg-[#FF9F45]/15 text-[#FF9F45] ring-1 ring-[#FF9F45]/25';
  return 'bg-[#FF6B7A]/15 text-[#FF6B7A] ring-1 ring-[#FF6B7A]/25';
}
function corResultado(v: number): string {
  return v >= 0 ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]';
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
  receitaBruta: number; devolucoes?: number; deducoes: number; receitaLiquida: number;
  cmv: number; lucroBruto: number; perdas: number; resultado: number; margemBruta: number;
  despesasOperacionais: number; despesasFinanceiras: number; outrasReceitas: number;
  resultadoLiquido: number; margemLiquida: number;
}
interface DreCompleto {
  periodo: { inicio: string; fim: string; label: string };
  linhas: DreLinha[];
  kpis: DreKpis;
  cobertura: { nfesEmitidas: number; notasDevolucao?: number; vendasSemNota?: number; movimentacoesVenda: number; observacao: string };
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
      <CalendarClock className="h-4 w-4 text-[#5E6472]" />
      <label className="flex items-center gap-1.5 text-[#8A90A0]">De
        <input type="date" value={ini} onChange={(e) => onIni(e.target.value)}
          className="rounded-lg border border-[#23262F] bg-[#101216] px-2 py-1.5 text-[13px] text-[#F7F8FA] [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#01B8FA]/30" />
      </label>
      <label className="flex items-center gap-1.5 text-[#8A90A0]">Até
        <input type="date" value={fim} onChange={(e) => onFim(e.target.value)}
          className="rounded-lg border border-[#23262F] bg-[#101216] px-2 py-1.5 text-[13px] text-[#F7F8FA] [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#01B8FA]/30" />
      </label>
    </div>
  );
}

/* Metadados visuais por status real do backend. */
const STATUS_META: Record<StatusConta, { label: string; cls: string; icon: React.ElementType }> = {
  ABERTO: { label: 'Pendente', cls: 'bg-[#FF9F45]/15 text-[#FF9F45] ring-[#FF9F45]/25', icon: Clock },
  PARCIAL: { label: 'Parcial', cls: 'bg-cyan-500/15 text-[#22D3EE] ring-cyan-500/25', icon: Clock },
  PAGO: { label: 'Pago', cls: 'bg-[#2DD4A7]/15 text-[#2DD4A7] ring-[#2DD4A7]/25', icon: CheckCircle2 },
  VENCIDO: { label: 'Atrasado', cls: 'bg-[#FF6B7A]/15 text-[#FF6B7A] ring-[#FF6B7A]/25', icon: AlertTriangle },
  CANCELADO: { label: 'Cancelado', cls: 'bg-[#16181F] text-[#5E6472] ring-[#23262F]', icon: Ban },
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
            <CalendarClock className="h-3.5 w-3.5 text-[#5E6472]" /> {mesAtualLabel()}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[1400px] mx-auto">
      {/* Tabs */}
      <nav className="flex items-center gap-1 border-b border-[#23262F] mb-6 overflow-x-auto">
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
    return <div className="py-16 text-center text-[13px] text-[#5E6472]">Carregando DRE do período…</div>;
  }
  if (erro || !dre) {
    return (
      <div className="py-16 text-center text-[13px] text-[#FF6B7A]">
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
        {(k.devolucoes ?? 0) > 0 && (
          <KpiGigante
            label="(–) Devoluções de Vendas"
            valor={-(k.devolucoes ?? 0)}
            hint={`${dre.cobertura.notasDevolucao ?? 0} NF-e de devolução no período`}
            icon={ArrowDownRight}
            tom="deducao"
          />
        )}
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
        <section className="xl:col-span-1 rounded-2xl border border-[#23262F] bg-[#101216] p-6">
          <h2 className="text-[11px] font-semibold text-[#8A90A0] uppercase tracking-widest mb-2 flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-[#5E6472]" /> Demonstrativo de Resultados
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
          icone={<ArrowUpRight className="h-4 w-4 text-[#2DD4A7]" />}
          corTotal="text-[#2DD4A7] bg-[#2DD4A7]/15"
          titulos={receber}
          totalAberto={resReceber?.valorEmAberto}
          totalVencido={resReceber?.valorVencido}
          vazio="Nenhum título a receber em aberto."
        />

        {/* Contas a Pagar — em aberto (real) */}
        <PainelContas
          titulo="Contas a Pagar"
          icone={<ArrowDownRight className="h-4 w-4 text-[#FF6B7A]" />}
          corTotal="text-[#FF6B7A] bg-[#FF6B7A]/15"
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
    <section className="rounded-2xl border border-[#23262F] bg-[#101216] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#F7F8FA] flex items-center gap-2">{icone} {titulo}</h2>
        <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${corTotal}`}>
          {brlCompact(totalAberto ?? totalLista)}
        </span>
      </div>
      {topo.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-[#5E6472]">{vazio}</div>
      ) : (
        <div className="space-y-2.5">
          {topo.map((t) => {
            const atrasado = t.status === 'VENCIDO';
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${atrasado ? 'bg-[#FF6B7A]/15 text-[#FF6B7A]' : 'bg-[#16181F] text-[#8A90A0]'}`}>
                  {atrasado ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#F7F8FA] truncate">{t.parte}</p>
                  <p className="text-[11px] text-[#5E6472]">
                    vence {dataCurta(t.dataVencimento)}
                    {atrasado ? <span className="text-[#FF6B7A] font-medium"> · em atraso</span> : ''}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-[#F7F8FA] tabular-nums shrink-0">{brl(t.valorAberto)}</p>
              </div>
            );
          })}
        </div>
      )}
      {(totalVencido ?? 0) > 0 && (
        <div className="mt-4 pt-3 border-t border-[#191B21] flex items-center justify-between text-[12px]">
          <span className="text-[#8A90A0]">{titulos.length} em aberto</span>
          <span className="text-[#FF6B7A]">Atrasados: <strong>{brlCompact(totalVencido ?? 0)}</strong></span>
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
    <div className={ultima ? '' : 'border-b border-[#191B21]'}>
      <div
        className={`flex items-center justify-between gap-4 py-4 ${temDetalhe ? 'cursor-pointer select-none' : ''}`}
        onClick={temDetalhe ? () => setAberto((v) => !v) : undefined}
      >
        <span
          className={`text-[13.5px] leading-snug flex items-center gap-1.5 ${
            l.tipo === 'resultado' ? 'font-semibold text-[#F7F8FA]' : 'font-normal text-[#8A90A0]'
          }`}
        >
          {temDetalhe && (
            <ChevronRight className={`h-3.5 w-3.5 text-[#5E6472] transition-transform ${aberto ? 'rotate-90' : ''}`} />
          )}
          {l.label}
        </span>
        <span
          className={`text-[15px] tabular-nums shrink-0 ${
            l.tipo === 'resultado'
              ? l.valor < 0
                ? 'font-semibold text-[#FF6B7A]'
                : 'font-semibold text-[#2DD4A7]'
              : l.valor < 0
                ? 'font-medium text-[#FF6B7A]'
                : 'font-medium text-[#F7F8FA]'
          }`}
        >
          {brl(l.valor)}
        </span>
      </div>
      {temDetalhe && aberto && (
        <div className="pb-3 pl-5 space-y-1.5">
          {l.detalhe!.map((d) => (
            <div key={d.codigo} className="flex items-center justify-between gap-4 text-[12px]">
              <span className="text-[#8A90A0]">{d.codigo} · {d.descricao}</span>
              <span className="tabular-nums text-[#8A90A0]">{brl(d.valor)}</span>
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
    tom === 'lucro' ? 'text-[#2DD4A7]' : tom === 'deducao' ? 'text-[#FF6B7A]' : 'text-[#F7F8FA]';
  const ring = tom === 'lucro' ? 'ring-1 ring-[#2DD4A7]/25 bg-[#2DD4A7]/10' : 'border border-[#23262F] bg-[#101216]';
  return (
    <div className={`rounded-2xl p-5 ${ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-[#8A90A0]">{label}</p>
        <span
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            tom === 'lucro' ? 'bg-[#2DD4A7]/15 text-[#2DD4A7]' : tom === 'deducao' ? 'bg-[#FF6B7A]/15 text-[#FF6B7A]' : 'bg-[#16181F] text-[#8A90A0]'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-2 text-[34px] leading-none font-semibold tracking-tight tabular-nums ${cor}`}>
        {brl(valor)}
      </p>
      <p className="mt-2 text-[12px] text-[#5E6472]">{hint}</p>
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E6472]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-xl border border-[#23262F] bg-[#101216] pl-10 pr-4 py-2.5 text-sm text-[#F7F8FA] placeholder:text-[#5E6472] focus:outline-none focus:ring-2 focus:ring-[#01B8FA]/30"
          />
        </div>
        <PeriodoBar ini={ini} fim={fim} onIni={setIni} onFim={setFim} />
      </div>

      {carregando ? (
        <div className="py-16 text-center text-[13px] text-[#5E6472]">Carregando rentabilidade por cliente…</div>
      ) : erro ? (
        <div className="py-16 text-center text-[13px] text-[#FF6B7A]">{erro}</div>
      ) : linhas.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#5E6472]">Nenhuma venda a cliente identificado no período (rentabilidade usa NF-e emitidas com cliente).</div>
      ) : (
      <div className="rounded-2xl border border-[#23262F] bg-[#101216] overflow-hidden">
        <div className="overflow-y-auto max-h-[62vh]">
          <table className="w-full table-fixed border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0C0D10] text-[#8A90A0] text-[10px] uppercase tracking-wide">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-[#0C0D10] w-[34%]">Cliente</th>
                <th className="text-right font-semibold px-3 py-2">Receita</th>
                <th className="text-right font-semibold px-3 py-2">Custos (CMV)</th>
                <th className="text-right font-semibold px-3 py-2">Resultado</th>
                <th className="text-center font-semibold px-3 py-2">Margem</th>
                <th className="text-right font-semibold px-3 py-2">Peso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#23262F]">
              {linhas.map((c) => (
                <tr key={c.clienteId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 sticky left-0 bg-[#101216] hover:bg-white/[0.03]">
                    <p className="font-medium text-[#F7F8FA] truncate">{c.nome}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-[#F7F8FA]">{brlCompact(c.receita)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#8A90A0]">{brlCompact(c.custos)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${corResultado(c.resultado)}`}>
                    {brlCompact(c.resultado)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${corMargem(c.margemPct)}`}>
                      {pct(c.margemPct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#5E6472]">{kg(c.peso)}</td>
                </tr>
              ))}
            </tbody>
            {tot && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-[#0C0D10] text-[#F7F8FA] font-semibold text-[12px]">
                  <td className="px-3 py-2 sticky left-0 bg-[#101216] truncate">Totais ({linhas.length})</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brlCompact(tot.receita)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brlCompact(tot.custos)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${tot.resultado >= 0 ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]'}`}>
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E6472]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou código…"
            className="w-full rounded-xl border border-[#23262F] bg-[#101216] pl-10 pr-4 py-2.5 text-sm text-[#F7F8FA] placeholder:text-[#5E6472] focus:outline-none focus:ring-2 focus:ring-[#01B8FA]/30"
          />
        </div>
        <PeriodoBar ini={ini} fim={fim} onIni={setIni} onFim={setFim} />
        {k && (
          <div className="flex items-center gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-[#8A90A0]">
              <DollarSign className="h-4 w-4 text-[#2DD4A7]" /> Receita{' '}
              <strong className="text-[#F7F8FA]">{brlCompact(k.receitaTotal)}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-[#8A90A0]">
              <Percent className="h-4 w-4 text-[#5E6472]" /> Margem média{' '}
              <strong className="text-[#F7F8FA]">{pct(k.margemMediaPct)}</strong>
            </span>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="py-16 text-center text-[13px] text-[#5E6472]">Carregando margem por produto…</div>
      ) : erro ? (
        <div className="py-16 text-center text-[13px] text-[#FF6B7A]">{erro}</div>
      ) : linhas.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#5E6472]">Nenhuma venda registrada no período (margem usa movimentações de venda + NF-e emitidas).</div>
      ) : (
      <div className="rounded-2xl border border-[#23262F] bg-[#101216] overflow-hidden">
        <div className="overflow-x-auto max-h-[62vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0C0D10] text-[#8A90A0] text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-[#0C0D10] whitespace-nowrap">Código</th>
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
            <tbody className="divide-y divide-[#23262F]">
              {linhas.map((p) => (
                <tr key={p.produtoId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-[#101216] hover:bg-white/[0.03] font-num text-[12px] text-[#8A90A0]">
                    {p.codigo}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#F7F8FA]">{p.descricao}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8A90A0]">{num(p.qtdVendida)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block rounded-md bg-[#16181F] text-[#8A90A0] px-2 py-0.5 text-[11px] font-semibold">
                      {p.unidade || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8A90A0]">{brl(p.precoMedioVenda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8A90A0]">{brl(p.custoComposto)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-[#F7F8FA]">{brl(p.receita)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8A90A0]">{brl(p.custoTotal)}</td>
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
                <tr className="bg-[#0C0D10] text-[#F7F8FA] font-semibold text-[13px]">
                  <td className="px-4 py-3 sticky left-0 bg-[#101216]" colSpan={6}>
                    Totalizador ({linhas.length} itens)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(k.receitaTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(k.cmv)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#2DD4A7]">{brl(k.lucroBruto)}</td>
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
        <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-[#8A90A0] flex items-center gap-1.5">
            <ArrowUpRight className="h-4 w-4 text-[#2DD4A7]" /> A Receber (em aberto)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-[#2DD4A7] tabular-nums">{brl(totReceber)}</p>
        </div>
        <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-[#8A90A0] flex items-center gap-1.5">
            <ArrowDownRight className="h-4 w-4 text-[#FF6B7A]" /> A Pagar (em aberto)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-[#FF6B7A] tabular-nums">{brl(totPagar)}</p>
        </div>
        <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-4">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-[#8A90A0] flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-[#FF9F45]" /> Vencidos (atrasados)
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-[#FF9F45] tabular-nums">{brl(totAtrasado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E6472]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, cliente ou categoria…"
            className="w-full rounded-xl border border-[#23262F] bg-[#101216] pl-10 pr-4 py-2.5 text-sm text-[#F7F8FA] placeholder:text-[#5E6472] focus:outline-none focus:ring-2 focus:ring-[#01B8FA]/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['TODOS', 'RECEITA', 'DESPESA'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setFiltroNat(n)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                filtroNat === n ? 'bg-[#01B8FA] text-[#04121A]' : 'bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:bg-white/[0.04]'
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
                filtroStatus === s ? 'bg-[#01B8FA] text-[#04121A]' : 'bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:bg-white/[0.04]'
              }`}
            >
              {rot}
            </button>
          ))}
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-[#23262F] bg-[#101216] px-3 py-1.5 text-[13px] font-medium text-[#8A90A0] hover:bg-white/[0.04]"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Tabela de títulos */}
      <div className="rounded-2xl border border-[#23262F] bg-[#101216] overflow-hidden">
        <div className="overflow-x-auto max-h-[58vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0C0D10] text-[#8A90A0] text-[11px] uppercase tracking-wide">
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
            <tbody className="divide-y divide-[#23262F]">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#5E6472] text-sm">Carregando títulos…</td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#5E6472] text-sm">
                    Nenhum título encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : filtrados.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-[#8A90A0] tabular-nums">{dataLonga(t.dataVencimento)}</td>
                  <td className="px-4 py-3 font-medium text-[#F7F8FA]">{t.parte}</td>
                  <td className="px-4 py-3 text-[#8A90A0] truncate max-w-[240px]">{t.descricao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                        t.natureza === 'RECEITA' ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]'
                      }`}
                    >
                      {t.natureza === 'RECEITA' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {t.natureza === 'RECEITA' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${t.natureza === 'RECEITA' ? 'text-[#2DD4A7]' : 'text-[#F7F8FA]'}`}>
                    {brl(t.valorOriginal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8A90A0]">{brl(t.valorAberto)}</td>
                  <td className="px-4 py-3 text-center">
                    <TagStatus status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {emAberto(t) ? (
                        <button
                          onClick={() => baixar(t)}
                          disabled={baixandoId === t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#01B8FA] text-[#04121A] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#3AC7FB] disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {baixandoId === t.id ? 'Baixando…' : 'Baixar Título'}
                        </button>
                      ) : t.status === 'PAGO' ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#2DD4A7] font-medium px-3 py-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Baixado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#5E6472] font-medium px-3 py-1.5">
                          <Ban className="h-3.5 w-3.5" /> Cancelado
                        </span>
                      )}
                      <button
                        onClick={() => setDetalhe(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#23262F] text-[#8A90A0] px-3 py-1.5 text-[12px] font-medium hover:bg-white/[0.04]"
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#101216] border-l border-[#23262F] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] flex flex-col animate-[slideL_.2s_ease-out]">
        <div className="border-b border-[#23262F] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#5E6472] font-semibold">Detalhes do título</p>
            <h3 className="text-lg font-semibold text-[#F7F8FA]">{titulo.parte}</h3>
          </div>
          <TagStatus status={titulo.status} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl bg-[#0C0D10] border border-[#23262F] p-5">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-[#8A90A0]">Valor do título</p>
            <p className={`text-4xl font-semibold tabular-nums mt-1 ${titulo.natureza === 'RECEITA' ? 'text-[#2DD4A7]' : 'text-[#F7F8FA]'}`}>
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
        <div className="border-t border-[#23262F] p-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#23262F] text-[#8A90A0] py-3 text-sm font-semibold hover:bg-white/[0.04]"
          >
            Fechar
          </button>
          {emAberto(titulo) && (
            <button
              onClick={onBaixar}
              className="flex-1 rounded-xl bg-[#01B8FA] text-[#04121A] py-3 text-sm font-semibold hover:bg-[#3AC7FB] flex items-center justify-center gap-2"
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
    <div className="flex items-center justify-between border-b border-[#191B21] pb-2">
      <dt className="text-[#8A90A0]">{termo}</dt>
      <dd className="font-medium text-[#F7F8FA]">{valor}</dd>
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
        ativo ? 'text-[#01B8FA]' : 'text-[#8A90A0] hover:text-[#8A90A0]'
      }`}
    >
      <Icon className={`h-4 w-4 ${ativo ? 'text-[#01B8FA]' : 'text-[#5E6472]'}`} />
      {label}
      {ativo && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#01B8FA] rounded-full" />}
    </button>
  );
}
