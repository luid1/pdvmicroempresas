import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { financeiroApi } from '../../../services/api';
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
  Filter,
  Download,
  Eye,
  Scale,
  Percent,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { PageHeader, btnGlass, btnPrimary } from '../../cadastros/ui';

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
  cobertura: { nfesEmitidas: number; movimentacoesVenda: number; observacao: string };
}

interface ContaResumo {
  id: string;
  parte: string;
  categoria: string;
  valor: number;
  venc: string;
  atrasoDias?: number;
}

const CONTAS_RECEBER: ContaResumo[] = [
  { id: 'r1', parte: 'Rede Sabor & Cia Restaurantes', categoria: 'Venda Atacado', valor: 84_320, venc: '08/07' },
  { id: 'r2', parte: 'Hotel Fasano Group', categoria: 'Venda Atacado', valor: 61_180, venc: '10/07' },
  { id: 'r3', parte: 'Buffet Villa Gourmet', categoria: 'Venda Atacado', valor: 27_540, venc: '02/07', atrasoDias: 4 },
  { id: 'r4', parte: 'Mercado do Zé — Pinheiros', categoria: 'Venda Varejo', valor: 18_970, venc: '29/06', atrasoDias: 7 },
  { id: 'r5', parte: 'Cozinha Industrial GRSA', categoria: 'Venda Atacado', valor: 112_400, venc: '14/07' },
];

const CONTAS_PAGAR: ContaResumo[] = [
  { id: 'p1', parte: 'Cooperativa Agrícola do Vale', categoria: 'Fornecedor FLV', valor: 96_720, venc: '07/07' },
  { id: 'p2', parte: 'Folha de Pagamento — Julho', categoria: 'Folha de Pagamento', valor: 148_500, venc: '05/07' },
  { id: 'p3', parte: 'Transportadora RápidoLog', categoria: 'Frete', valor: 34_180, venc: '09/07' },
  { id: 'p4', parte: 'Energia Elétrica — CD Matriz', categoria: 'Utilidades', valor: 12_940, venc: '11/07' },
  { id: 'p5', parte: 'Embalagens Vitória Ltda', categoria: 'Fornecedor Insumos', valor: 21_360, venc: '06/07' },
];

/* ── Rentabilidade por Cliente ── */
interface Cliente {
  id: string;
  nome: string;
  segmento: string;
  valorVendido: number;
  devolucoes: number;
  totalCmv: number;
  valorFrete: number;
  custosOperacionais: number;
  pesoKg: number;
}
function derivarCliente(c: Cliente) {
  const valorLiquido = c.valorVendido - c.devolucoes;
  const totalCustos = c.totalCmv + c.valorFrete + c.custosOperacionais;
  const resultadoLiquido = valorLiquido - totalCustos;
  const margem = valorLiquido > 0 ? (resultadoLiquido / valorLiquido) * 100 : 0;
  return { ...c, valorLiquido, totalCustos, resultadoLiquido, margem };
}

const CLIENTES_RAW: Cliente[] = [
  { id: 'c1', nome: 'Hotel Fasano Group', segmento: 'Hotelaria', valorVendido: 214_800, devolucoes: 3_120, totalCmv: 121_400, valorFrete: 9_800, custosOperacionais: 12_300, pesoKg: 38_420 },
  { id: 'c2', nome: 'Rede Sabor & Cia Restaurantes', segmento: 'Food Service', valorVendido: 186_300, devolucoes: 8_940, totalCmv: 118_200, valorFrete: 11_200, custosOperacionais: 14_600, pesoKg: 51_180 },
  { id: 'c3', nome: 'Cozinha Industrial GRSA', segmento: 'Refeição Coletiva', valorVendido: 342_150, devolucoes: 5_600, totalCmv: 246_300, valorFrete: 18_900, custosOperacionais: 21_400, pesoKg: 128_640 },
  { id: 'c4', nome: 'Buffet Villa Gourmet', segmento: 'Eventos', valorVendido: 74_500, devolucoes: 12_300, totalCmv: 52_100, valorFrete: 6_400, custosOperacionais: 5_900, pesoKg: 14_260 },
  { id: 'c5', nome: 'Rede Hoteleira Accor SP', segmento: 'Hotelaria', valorVendido: 268_900, devolucoes: 4_200, totalCmv: 158_400, valorFrete: 13_100, custosOperacionais: 17_800, pesoKg: 62_940 },
  { id: 'c6', nome: 'Restaurante Mocotó', segmento: 'Food Service', valorVendido: 58_700, devolucoes: 1_100, totalCmv: 34_900, valorFrete: 3_800, custosOperacionais: 4_100, pesoKg: 11_820 },
  { id: 'c7', nome: 'Mercado do Zé — Pinheiros', segmento: 'Varejo', valorVendido: 41_200, devolucoes: 6_800, totalCmv: 33_400, valorFrete: 2_900, custosOperacionais: 3_200, pesoKg: 9_540 },
  { id: 'c8', nome: 'Grupo Coco Bambu', segmento: 'Food Service', valorVendido: 197_600, devolucoes: 2_400, totalCmv: 128_700, valorFrete: 10_600, custosOperacionais: 13_900, pesoKg: 46_310 },
];

/* ── Rentabilidade por Produto ── */
interface Produto {
  codigo: string;
  nome: string;
  qtdVendida: number;
  unidade: 'KG' | 'CX';
  precoMedioVenda: number;
  custoMedio: number;
}
function derivarProduto(p: Produto) {
  const vlrTotalVenda = p.qtdVendida * p.precoMedioVenda;
  const vlrTotalCmv = p.qtdVendida * p.custoMedio;
  const vlrLucroBruto = vlrTotalVenda - vlrTotalCmv;
  const margem = vlrTotalVenda > 0 ? (vlrLucroBruto / vlrTotalVenda) * 100 : 0;
  return { ...p, vlrTotalVenda, vlrTotalCmv, vlrLucroBruto, margem };
}

const PRODUTOS_RAW: Produto[] = [
  { codigo: 'FLV-0142', nome: 'Laranja Lima', qtdVendida: 42_800, unidade: 'KG', precoMedioVenda: 4.9, custoMedio: 3.1 },
  { codigo: 'FLV-0088', nome: 'Tomate Italiano', qtdVendida: 31_450, unidade: 'KG', precoMedioVenda: 6.8, custoMedio: 4.2 },
  { codigo: 'FLV-0311', nome: 'Cogumelo Enoke', qtdVendida: 2_180, unidade: 'CX', precoMedioVenda: 38.5, custoMedio: 22.4 },
  { codigo: 'FLV-0205', nome: 'Alface Americana', qtdVendida: 18_900, unidade: 'CX', precoMedioVenda: 24.9, custoMedio: 19.8 },
  { codigo: 'FLV-0017', nome: 'Banana Nanica', qtdVendida: 54_600, unidade: 'KG', precoMedioVenda: 3.9, custoMedio: 2.4 },
  { codigo: 'FLV-0423', nome: 'Cogumelo Shitake', qtdVendida: 1_640, unidade: 'CX', precoMedioVenda: 46.0, custoMedio: 31.5 },
  { codigo: 'FLV-0099', nome: 'Batata Lavada', qtdVendida: 61_200, unidade: 'KG', precoMedioVenda: 3.4, custoMedio: 2.6 },
  { codigo: 'FLV-0256', nome: 'Rúcula Hidropônica', qtdVendida: 8_740, unidade: 'CX', precoMedioVenda: 18.9, custoMedio: 15.9 },
  { codigo: 'FLV-0180', nome: 'Manga Palmer', qtdVendida: 22_300, unidade: 'KG', precoMedioVenda: 7.2, custoMedio: 4.1 },
  { codigo: 'FLV-0367', nome: 'Pimentão Amarelo', qtdVendida: 14_500, unidade: 'KG', precoMedioVenda: 9.8, custoMedio: 7.9 },
];

/* ── Títulos (Contas a Pagar/Receber mescladas) ── */
type StatusTitulo = 'PAGO' | 'PENDENTE' | 'ATRASADO';
type NatTitulo = 'RECEITA' | 'DESPESA';
interface Titulo {
  id: string;
  venc: string;
  parte: string;
  categoria: string;
  natureza: NatTitulo;
  valor: number;
  status: StatusTitulo;
}

const TITULOS: Titulo[] = [
  { id: 't1', venc: '05/07/2026', parte: 'Folha de Pagamento — Julho', categoria: 'Folha de Pagamento', natureza: 'DESPESA', valor: 148_500, status: 'PENDENTE' },
  { id: 't2', venc: '02/07/2026', parte: 'Buffet Villa Gourmet', categoria: 'Venda Atacado', natureza: 'RECEITA', valor: 27_540, status: 'ATRASADO' },
  { id: 't3', venc: '06/07/2026', parte: 'Embalagens Vitória Ltda', categoria: 'Fornecedor Insumos', natureza: 'DESPESA', valor: 21_360, status: 'PENDENTE' },
  { id: 't4', venc: '28/06/2026', parte: 'Cooperativa Agrícola do Vale', categoria: 'Fornecedor FLV', natureza: 'DESPESA', valor: 88_400, status: 'PAGO' },
  { id: 't5', venc: '29/06/2026', parte: 'Mercado do Zé — Pinheiros', categoria: 'Venda Varejo', natureza: 'RECEITA', valor: 18_970, status: 'ATRASADO' },
  { id: 't6', venc: '08/07/2026', parte: 'Rede Sabor & Cia Restaurantes', categoria: 'Venda Atacado', natureza: 'RECEITA', valor: 84_320, status: 'PENDENTE' },
  { id: 't7', venc: '09/07/2026', parte: 'Transportadora RápidoLog', categoria: 'Frete', natureza: 'DESPESA', valor: 34_180, status: 'PENDENTE' },
  { id: 't8', venc: '25/06/2026', parte: 'Hotel Fasano Group', categoria: 'Venda Atacado', natureza: 'RECEITA', valor: 61_180, status: 'PAGO' },
  { id: 't9', venc: '11/07/2026', parte: 'Energia Elétrica — CD Matriz', categoria: 'Utilidades', natureza: 'DESPESA', valor: 12_940, status: 'PENDENTE' },
  { id: 't10', venc: '14/07/2026', parte: 'Cozinha Industrial GRSA', categoria: 'Venda Atacado', natureza: 'RECEITA', valor: 112_400, status: 'PENDENTE' },
  { id: 't11', venc: '24/06/2026', parte: 'Folha de Pagamento — Junho', categoria: 'Folha de Pagamento', natureza: 'DESPESA', valor: 145_200, status: 'PAGO' },
  { id: 't12', venc: '01/07/2026', parte: 'Grupo Coco Bambu', categoria: 'Venda Atacado', natureza: 'RECEITA', valor: 97_600, status: 'ATRASADO' },
];

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
export default function FinancialHub() {
  const [aba, setAba] = useState<AbaFin>('dashboard');

  return (
    <div className="fin-dark flex flex-col h-full">
      {/* Tema dark alinhado ao site — paleta espacial com contraste reforçado */}
      <style>{`
        .fin-dark { color: #e2e8f0; }
        /* Superfícies (card mais claro que o canvas p/ separar por contraste, não por sombra) */
        .fin-dark .bg-white { background-color: #141b27 !important; }
        .fin-dark .bg-slate-50 { background-color: #0d1420 !important; }
        .fin-dark .bg-neutral-50 { background-color: #1a2333 !important; }
        .fin-dark .bg-neutral-100 { background-color: #1e2838 !important; }
        .fin-dark .bg-neutral-200 { background-color: #273246 !important; }
        .fin-dark .hover\\:bg-neutral-50:hover { background-color: #1e2838 !important; }
        .fin-dark .hover\\:bg-neutral-50\\/70:hover { background-color: #1a2333 !important; }
        /* Bordas de cristal */
        .fin-dark .border-neutral-200 { border-color: rgba(255,255,255,0.09) !important; }
        .fin-dark .border-neutral-100 { border-color: rgba(255,255,255,0.05) !important; }
        .fin-dark .divide-neutral-100 > * + * { border-color: rgba(255,255,255,0.05) !important; }
        /* Textos com contraste reforçado */
        .fin-dark .text-slate-900 { color: #f8fafc !important; }
        .fin-dark .text-slate-800 { color: #e8eef6 !important; }
        .fin-dark .text-slate-700 { color: #cbd5e1 !important; }
        .fin-dark .text-slate-600 { color: #aeb9c9 !important; }
        .fin-dark .text-neutral-500 { color: #94a3b8 !important; }
        .fin-dark .text-neutral-400 { color: #8290a3 !important; }
        /* Inputs */
        .fin-dark input:not([type="checkbox"]):not([type="radio"]),
        .fin-dark select,
        .fin-dark textarea { background-color: #1a2333 !important; color: #e8eef6 !important; border-color: rgba(255,255,255,0.1) !important; }
        .fin-dark input::placeholder,
        .fin-dark textarea::placeholder { color: #64748b !important; }
      `}</style>

      <PageHeader
        icon={<Scale className="h-4 w-4" />}
        titulo="Financeiro & DRE"
        subtitulo="Demonstrativo de Resultados, rentabilidade e gestão de títulos — Julho/2026"
        actions={
          <>
            <button className={btnGlass}>
              <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> Julho / 2026
            </button>
            <button className={btnPrimary}>
              <Download className="h-3.5 w-3.5" /> Exportar DRE
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[1400px] mx-auto">
      {/* Aviso: dados de demonstração (ainda não conectado ao financeiro real) */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-[13px] leading-snug">
          <b>DRE & KPIs já são reais</b> (Dashboard DRE, calculado das NF-e emitidas e movimentações
          de estoque do período). As abas <b>Rentabilidade por Cliente/Produto</b> e os painéis de
          <b> Contas a Pagar/Receber</b> desta tela ainda são ilustrativos — não use esses para decisão
          até a integração completa dos lançamentos.
        </div>
      </div>
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

  if (carregando) {
    return <div className="py-16 text-center text-[13px] text-neutral-400">Carregando DRE do período…</div>;
  }
  if (erro || !dre) {
    return (
      <div className="py-16 text-center text-[13px] text-rose-400">
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
          hint={`Margem bruta ${pct(k.margemBruta)} · ${dre.cobertura.nfesEmitidas} NF-e no período`}
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

        {/* Contas a Receber */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Contas a Receber
            </h2>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
              {brlCompact(CONTAS_RECEBER.reduce((s, c) => s + c.valor, 0))}
            </span>
          </div>
          <div className="space-y-2.5">
            {CONTAS_RECEBER.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    c.atrasoDias ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {c.atrasoDias ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800 truncate">{c.parte}</p>
                  <p className="text-[11px] text-neutral-400">
                    {c.categoria} · vence {c.venc}
                    {c.atrasoDias ? <span className="text-rose-500 font-medium"> · {c.atrasoDias}d atraso</span> : ''}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-slate-900 tabular-nums shrink-0">{brl(c.valor)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[12px]">
            <span className="text-neutral-500">
              A vencer:{' '}
              <strong className="text-slate-700">
                {brlCompact(CONTAS_RECEBER.filter((c) => !c.atrasoDias).reduce((s, c) => s + c.valor, 0))}
              </strong>
            </span>
            <span className="text-rose-600">
              Atrasados:{' '}
              <strong>{brlCompact(CONTAS_RECEBER.filter((c) => c.atrasoDias).reduce((s, c) => s + c.valor, 0))}</strong>
            </span>
          </div>
        </section>

        {/* Contas a Pagar */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-rose-500" /> Contas a Pagar
              <span className="text-neutral-400 font-normal">· 7 dias</span>
            </h2>
            <span className="text-[11px] font-medium text-rose-700 bg-rose-50 rounded-full px-2.5 py-1">
              {brlCompact(CONTAS_PAGAR.reduce((s, c) => s + c.valor, 0))}
            </span>
          </div>
          <div className="space-y-2.5">
            {CONTAS_PAGAR.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800 truncate">{c.parte}</p>
                  <p className="text-[11px] text-neutral-400">
                    {c.categoria} · vence {c.venc}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-slate-900 tabular-nums shrink-0">{brl(c.valor)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[12px]">
            <span className="text-neutral-500">Saldo projetado (7d)</span>
            <strong
              className={corResultado(
                CONTAS_RECEBER.reduce((s, c) => s + c.valor, 0) - CONTAS_PAGAR.reduce((s, c) => s + c.valor, 0),
              )}
            >
              {brlCompact(
                CONTAS_RECEBER.reduce((s, c) => s + c.valor, 0) - CONTAS_PAGAR.reduce((s, c) => s + c.valor, 0),
              )}
            </strong>
          </div>
        </section>
      </div>
    </div>
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
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'resultado' | 'margem' | 'valor'>('resultado');

  const linhas = useMemo(() => {
    const derivadas = CLIENTES_RAW.map(derivarCliente);
    const q = busca.trim().toLowerCase();
    const filtradas = q
      ? derivadas.filter((c) => c.nome.toLowerCase().includes(q) || c.segmento.toLowerCase().includes(q))
      : derivadas;
    return [...filtradas].sort((a, b) => {
      if (ordem === 'margem') return b.margem - a.margem;
      if (ordem === 'valor') return b.valorLiquido - a.valorLiquido;
      return b.resultadoLiquido - a.resultadoLiquido;
    });
  }, [busca, ordem]);

  const tot = useMemo(
    () =>
      linhas.reduce(
        (acc, c) => ({
          valorVendido: acc.valorVendido + c.valorVendido,
          devolucoes: acc.devolucoes + c.devolucoes,
          valorLiquido: acc.valorLiquido + c.valorLiquido,
          totalCmv: acc.totalCmv + c.totalCmv,
          valorFrete: acc.valorFrete + c.valorFrete,
          custosOperacionais: acc.custosOperacionais + c.custosOperacionais,
          totalCustos: acc.totalCustos + c.totalCustos,
          resultadoLiquido: acc.resultadoLiquido + c.resultadoLiquido,
          pesoKg: acc.pesoKg + c.pesoKg,
        }),
        {
          valorVendido: 0, devolucoes: 0, valorLiquido: 0, totalCmv: 0, valorFrete: 0,
          custosOperacionais: 0, totalCustos: 0, resultadoLiquido: 0, pesoKg: 0,
        },
      ),
    [linhas],
  );
  const margemTotal = tot.valorLiquido > 0 ? (tot.resultadoLiquido / tot.valorLiquido) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente ou segmento…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-neutral-400" />
          <span className="text-neutral-500">Ordenar:</span>
          {(['resultado', 'margem', 'valor'] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOrdem(o)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize ${
                ordem === o ? 'bg-slate-900 text-white' : 'bg-white border border-neutral-200 text-slate-600 hover:bg-neutral-50'
              }`}
            >
              {o === 'resultado' ? 'Resultado' : o === 'margem' ? 'Margem' : 'Valor'}
            </button>
          ))}
        </div>
      </div>

      {/* Data grid */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[62vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 text-neutral-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-neutral-50 min-w-[220px]">Cliente</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Valor Vendido</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Devoluções</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Valor Líquido</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Total CMV</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Frete</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Custos Oper.</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Total Custos</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Resultado Líq.</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Margem</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Peso Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white hover:bg-neutral-50/70">
                    <p className="font-medium text-slate-900">{c.nome}</p>
                    <p className="text-[11px] text-neutral-400">{c.segmento}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{brl(c.valorVendido)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-500">-{brl(c.devolucoes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{brl(c.valorLiquido)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(c.totalCmv)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(c.valorFrete)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(c.custosOperacionais)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{brl(c.totalCustos)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corResultado(c.resultadoLiquido)}`}>
                    {brl(c.resultadoLiquido)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${corMargem(c.margem)}`}>
                      {pct(c.margem)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{kg(c.pesoKg)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-900 text-white font-semibold text-[13px]">
                <td className="px-4 py-3 sticky left-0 bg-slate-900">Totais ({linhas.length})</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.valorVendido)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-300">-{brl(tot.devolucoes)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.valorLiquido)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.totalCmv)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.valorFrete)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.custosOperacionais)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.totalCustos)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${tot.resultadoLiquido >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {brl(tot.resultadoLiquido)}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{pct(margemTotal)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{kg(tot.pesoKg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 3 — RENTABILIDADE POR PRODUTO
   ════════════════════════════════════════════════════════════════════════════ */
function RentabilidadeProdutos() {
  const [busca, setBusca] = useState('');
  const linhas = useMemo(() => {
    const derivadas = PRODUTOS_RAW.map(derivarProduto);
    const q = busca.trim().toLowerCase();
    const filtradas = q
      ? derivadas.filter((p) => p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
      : derivadas;
    return [...filtradas].sort((a, b) => b.vlrLucroBruto - a.vlrLucroBruto);
  }, [busca]);

  const tot = useMemo(
    () =>
      linhas.reduce(
        (acc, p) => ({
          vlrTotalVenda: acc.vlrTotalVenda + p.vlrTotalVenda,
          vlrTotalCmv: acc.vlrTotalCmv + p.vlrTotalCmv,
          vlrLucroBruto: acc.vlrLucroBruto + p.vlrLucroBruto,
        }),
        { vlrTotalVenda: 0, vlrTotalCmv: 0, vlrLucroBruto: 0 },
      ),
    [linhas],
  );
  const margemTotal = tot.vlrTotalVenda > 0 ? (tot.vlrLucroBruto / tot.vlrTotalVenda) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou código…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-neutral-500">
            <DollarSign className="h-4 w-4 text-emerald-500" /> Venda total{' '}
            <strong className="text-slate-900">{brlCompact(tot.vlrTotalVenda)}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-neutral-500">
            <Percent className="h-4 w-4 text-neutral-400" /> Margem média{' '}
            <strong className="text-slate-900">{pct(margemTotal)}</strong>
          </span>
        </div>
      </div>

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
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Vlr Total Venda</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Custo Médio</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Vlr Total CMV</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Lucro Bruto</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">% Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((p) => (
                <tr key={p.codigo} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white hover:bg-neutral-50/70 font-mono text-[12px] text-neutral-500">
                    {p.codigo}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{num(p.qtdVendida)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block rounded-md bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px] font-semibold">
                      {p.unidade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.precoMedioVenda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{brl(p.vlrTotalVenda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.custoMedio)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{brl(p.vlrTotalCmv)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corResultado(p.vlrLucroBruto)}`}>
                    {brl(p.vlrLucroBruto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${corMargem(p.margem)}`}>
                      {pct(p.margem)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-900 text-white font-semibold text-[13px]">
                <td className="px-4 py-3 sticky left-0 bg-slate-900" colSpan={5}>
                  Totalizador ({linhas.length} itens)
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.vlrTotalVenda)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums">{brl(tot.vlrTotalCmv)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-300">{brl(tot.vlrLucroBruto)}</td>
                <td className="px-4 py-3 text-center tabular-nums">{pct(margemTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 4 — CONTAS A PAGAR / RECEBER (Gestão de Títulos)
   ════════════════════════════════════════════════════════════════════════════ */
function GestaoTitulos() {
  const [titulos, setTitulos] = useState<Titulo[]>(TITULOS);
  const [filtroNat, setFiltroNat] = useState<'TODOS' | NatTitulo>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | StatusTitulo>('TODOS');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<Titulo | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return titulos.filter(
      (t) =>
        (filtroNat === 'TODOS' || t.natureza === filtroNat) &&
        (filtroStatus === 'TODOS' || t.status === filtroStatus) &&
        (!q || t.parte.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q)),
    );
  }, [titulos, filtroNat, filtroStatus, busca]);

  const totReceber = filtrados.filter((t) => t.natureza === 'RECEITA' && t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const totPagar = filtrados.filter((t) => t.natureza === 'DESPESA' && t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const totAtrasado = filtrados.filter((t) => t.status === 'ATRASADO').reduce((s, t) => s + t.valor, 0);

  const baixar = (id: string) =>
    setTitulos((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'PAGO' } : t)));

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
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['TODOS', 'RECEITA', 'DESPESA'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setFiltroNat(n)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                filtroNat === n ? 'bg-slate-900 text-white' : 'bg-white border border-neutral-200 text-slate-600 hover:bg-neutral-50'
              }`}
            >
              {n === 'TODOS' ? 'Todos' : n === 'RECEITA' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {(['TODOS', 'PENDENTE', 'ATRASADO', 'PAGO'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                filtroStatus === s ? 'bg-slate-900 text-white' : 'bg-white border border-neutral-200 text-slate-600 hover:bg-neutral-50'
              }`}
            >
              {s === 'TODOS' ? 'Todos status' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de títulos */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[58vh]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-50 text-neutral-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Vencimento</th>
                <th className="text-left font-semibold px-4 py-3 min-w-[220px]">Fornecedor / Cliente</th>
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Categoria</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Natureza</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Valor</th>
                <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    Nenhum título encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {filtrados.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">{t.venc}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.parte}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-block rounded-md bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[12px]">
                      {t.categoria}
                    </span>
                  </td>
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
                    {brl(t.valor)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TagStatus status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {t.status !== 'PAGO' ? (
                        <button
                          onClick={() => baixar(t.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Baixar Título
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium px-3 py-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Baixado
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
      {detalhe && <DetalheTitulo titulo={detalhe} onClose={() => setDetalhe(null)} onBaixar={() => { baixar(detalhe.id); setDetalhe(null); }} />}
    </div>
  );
}

function TagStatus({ status }: { status: StatusTitulo }) {
  const cfg =
    status === 'PAGO'
      ? { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', icon: CheckCircle2, label: 'Pago' }
      : status === 'ATRASADO'
        ? { cls: 'bg-rose-50 text-rose-700 ring-rose-100', icon: AlertTriangle, label: 'Atrasado' }
        : { cls: 'bg-amber-50 text-amber-700 ring-amber-100', icon: Clock, label: 'Pendente' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function DetalheTitulo({ titulo, onClose, onBaixar }: { titulo: Titulo; onClose: () => void; onBaixar: () => void }) {
  return createPortal((
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/60 animate-backdrop" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0E141F]/90 backdrop-blur-2xl border-l border-white/10 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] flex flex-col animate-[slideL_.2s_ease-out]">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">Detalhes do título</p>
            <h3 className="text-lg font-semibold text-slate-900">{titulo.parte}</h3>
          </div>
          <TagStatus status={titulo.status} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl bg-white/[0.04] border border-neutral-200 p-5">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-neutral-500">Valor do título</p>
            <p className={`text-4xl font-semibold tabular-nums mt-1 ${titulo.natureza === 'RECEITA' ? 'text-emerald-700' : 'text-slate-900'}`}>
              {brl(titulo.valor)}
            </p>
          </div>
          <dl className="space-y-3 text-[13px]">
            <LinhaDet termo="Natureza" valor={titulo.natureza === 'RECEITA' ? 'Receita (a receber)' : 'Despesa (a pagar)'} />
            <LinhaDet termo="Categoria" valor={titulo.categoria} />
            <LinhaDet termo="Vencimento" valor={titulo.venc} />
            <LinhaDet termo="Situação" valor={titulo.status.charAt(0) + titulo.status.slice(1).toLowerCase()} />
            <LinhaDet termo="Centro de custo" valor={titulo.natureza === 'RECEITA' ? 'Comercial' : 'Suprimentos / Operação'} />
            <LinhaDet termo="Forma prevista" valor="Boleto bancário · D+0" />
          </dl>
        </div>
        <div className="border-t border-neutral-200 p-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-200 text-slate-700 py-3 text-sm font-semibold hover:bg-neutral-50"
          >
            Fechar
          </button>
          {titulo.status !== 'PAGO' && (
            <button
              onClick={onBaixar}
              className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-black flex items-center justify-center gap-2"
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
        ativo ? 'text-slate-900' : 'text-neutral-500 hover:text-slate-700'
      }`}
    >
      <Icon className={`h-4 w-4 ${ativo ? 'text-slate-900' : 'text-neutral-400'}`} />
      {label}
      {ativo && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-slate-900 rounded-full" />}
    </button>
  );
}
