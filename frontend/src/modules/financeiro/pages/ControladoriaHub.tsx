import { useMemo, useState } from 'react';
import {
  Search,
  Command,
  Plus,
  Download,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  MessageCircle,
  Link2,
  MoreHorizontal,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  Zap,
  Landmark,
  Receipt,
  CreditCard,
  Eye,
  BarChart3,
  History,
} from 'lucide-react';
import { PageHeader } from '../../cadastros/ui';

/* ══════════════════════════════════════════════════════════════════════════════
   MÓDULO FINANCEIRO & CONTROLADORIA
   SPA de 3 abas (Fluxo de Caixa · Contas a Receber · Contas a Pagar).
   Tema dark do sistema · âmbar no chrome, verde/vermelho só nos valores.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── Formatação ────────────────────────────────── */
const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/* ═══════════════════════════ Tipos & Mocks ═══════════════════════════════════ */
type Aba = 'fluxo' | 'receber' | 'pagar';

type StatusReceber = 'PENDENTE' | 'VENCIDO' | 'PAGO';
interface TituloReceber {
  id: string;
  cliente: string;
  cnpj: string;
  descricao: string;
  vencimento: string;
  valor: number;
  status: StatusReceber;
  telefone: string;
}

const RECEBER_MOCK: TituloReceber[] = [
  { id: 'r1', cliente: 'Rede Sabor & Cia Restaurantes', cnpj: '12.345.678/0001-90', descricao: 'NF-e 120.482 · Venda Atacado', vencimento: '08/07/2026', valor: 84_320, status: 'PENDENTE', telefone: '5511990001111' },
  { id: 'r2', cliente: 'Hotel Fasano Group', cnpj: '08.223.114/0001-55', descricao: 'NF-e 120.517 · Venda Atacado', vencimento: '10/07/2026', valor: 61_180, status: 'PENDENTE', telefone: '5511990002222' },
  { id: 'r3', cliente: 'Buffet Villa Gourmet', cnpj: '21.998.740/0001-12', descricao: 'NF-e 120.310 · Venda Atacado', vencimento: '02/07/2026', valor: 27_540, status: 'VENCIDO', telefone: '5511990003333' },
  { id: 'r4', cliente: 'Mercado do Zé — Pinheiros', cnpj: '33.104.552/0001-08', descricao: 'NF-e 120.288 · Venda Varejo', vencimento: '29/06/2026', valor: 18_970, status: 'VENCIDO', telefone: '5511990004444' },
  { id: 'r5', cliente: 'Cozinha Industrial GRSA', cnpj: '45.667.881/0001-31', descricao: 'NF-e 120.540 · Refeição Coletiva', vencimento: '14/07/2026', valor: 112_400, status: 'PENDENTE', telefone: '5511990005555' },
  { id: 'r6', cliente: 'Grupo Coco Bambu', cnpj: '19.884.220/0001-77', descricao: 'NF-e 120.201 · Venda Atacado', vencimento: '25/06/2026', valor: 61_180, status: 'PAGO', telefone: '5511990006666' },
];

type StatusPagar = 'APROVACAO_PENDENTE' | 'APROVADO' | 'PAGO';
interface TituloPagar {
  id: string;
  fornecedor: string;
  categoria: string;
  centroCusto: string;
  vencimento: string;
  valor: number;
  status: StatusPagar;
}

const PAGAR_MOCK: TituloPagar[] = [
  { id: 'p1', fornecedor: 'Cooperativa Agrícola do Vale', categoria: 'Fornecedor FLV', centroCusto: 'Suprimentos', vencimento: '07/07/2026', valor: 96_720, status: 'APROVACAO_PENDENTE' },
  { id: 'p2', fornecedor: 'Folha de Pagamento — Julho', categoria: 'Folha', centroCusto: 'RH', vencimento: '05/07/2026', valor: 148_500, status: 'APROVADO' },
  { id: 'p3', fornecedor: 'Transportadora RápidoLog', categoria: 'Frete', centroCusto: 'Logística', vencimento: '09/07/2026', valor: 34_180, status: 'APROVACAO_PENDENTE' },
  { id: 'p4', fornecedor: 'Energia Elétrica — CD Matriz', categoria: 'Utilidades', centroCusto: 'Operação', vencimento: '11/07/2026', valor: 12_940, status: 'PAGO' },
  { id: 'p5', fornecedor: 'Embalagens Vitória Ltda', categoria: 'Insumos', centroCusto: 'Suprimentos', vencimento: '06/07/2026', valor: 21_360, status: 'APROVADO' },
  { id: 'p6', fornecedor: 'DAS — Simples Nacional', categoria: 'Impostos', centroCusto: 'Fiscal', vencimento: '20/07/2026', valor: 45_980, status: 'APROVACAO_PENDENTE' },
];

interface EventoAuto {
  id: string;
  titulo: string;
  detalhe: string;
  quando: string;
  tom: 'ok' | 'info' | 'alerta';
  icon: React.ElementType;
}
const EVENTOS: EventoAuto[] = [
  { id: 'e1', titulo: 'Pix de R$ 5.000 reconhecido', detalhe: 'Conciliado ao título #120.288', quando: 'há 8 min', tom: 'ok', icon: Zap },
  { id: 'e2', titulo: 'Nota Fiscal #120.540 emitida', detalhe: 'Cozinha Industrial GRSA', quando: 'há 22 min', tom: 'info', icon: Receipt },
  { id: 'e3', titulo: 'Boleto lido por OCR', detalhe: 'Cooperativa Agrícola do Vale · R$ 96.720', quando: 'há 1 h', tom: 'info', icon: FileText },
  { id: 'e4', titulo: 'Conciliação bancária automática', detalhe: '12 lançamentos batidos', quando: 'há 2 h', tom: 'ok', icon: CheckCircle2 },
  { id: 'e5', titulo: 'Cobrança enviada via WhatsApp', detalhe: '3 clientes vencidos notificados', quando: 'há 3 h', tom: 'alerta', icon: MessageCircle },
];

/* KPIs do Fluxo de Caixa */
const KPI_FLUXO = {
  saldoAtual: 342_180,
  receitaProjetada: 1_482_350,
  receitaTendencia: 12.4,
  saidaProjetada: 1_066_490,
  lucroPrevisto: 102_720,
};

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
export default function ControladoriaHub() {
  const [aba, setAba] = useState<Aba>('fluxo');
  const [buscaGlobal, setBuscaGlobal] = useState('');

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      <PageHeader
        icon={<Landmark className="h-4 w-4" />}
        titulo="Financeiro & Controladoria"
        subtitulo="Controladoria"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={buscaGlobal}
                onChange={(e) => setBuscaGlobal(e.target.value)}
                placeholder="Busca global…"
                className="w-56 rounded-lg border border-slate-700 bg-slate-800 pl-10 pr-16 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-slate-500 border border-slate-700 rounded-md px-1.5 py-0.5">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700">
              <Download className="h-4 w-4 text-slate-500" /> Exportar
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-amber-400 text-slate-900 px-3 py-1.5 text-sm font-semibold hover:bg-amber-300">
              <Plus className="h-4 w-4" /> Novo lançamento
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* ── Tabs ── */}
          <nav className="flex items-center gap-1 border-b border-slate-800 mb-6">
            <Tab ativo={aba === 'fluxo'} icon={BarChart3} label="Fluxo de Caixa" onClick={() => setAba('fluxo')} />
            <Tab ativo={aba === 'receber'} icon={ArrowUpRight} label="Contas a Receber" onClick={() => setAba('receber')} />
            <Tab ativo={aba === 'pagar'} icon={ArrowDownRight} label="Contas a Pagar" onClick={() => setAba('pagar')} />
          </nav>

          {aba === 'fluxo' && <AbaFluxo />}
          {aba === 'receber' && <AbaReceber />}
          {aba === 'pagar' && <AbaPagar />}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 1 — FLUXO DE CAIXA
   ════════════════════════════════════════════════════════════════════════════ */
function AbaFluxo() {
  const [periodo, setPeriodo] = useState<'7' | '15' | '30'>('30');

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Saldo Atual" valor={KPI_FLUXO.saldoAtual} hint="Posição consolidada em caixa/bancos" icon={Wallet} tom="neutro" />
        <Kpi
          label="Receita Projetada"
          valor={KPI_FLUXO.receitaProjetada}
          hint={`${pct(KPI_FLUXO.receitaTendencia)} vs. mês anterior`}
          icon={TrendingUp}
          tom="positivo"
          tendencia={KPI_FLUXO.receitaTendencia}
        />
        <Kpi label="Saída Projetada" valor={-KPI_FLUXO.saidaProjetada} hint="Despesas + compras previstas" icon={TrendingDown} tom="negativo" />
        <Kpi label="Lucro Líquido Previsto" valor={KPI_FLUXO.lucroPrevisto} hint="Após todas as saídas do período" icon={Sparkles} tom="destaque" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico (placeholder) */}
        <section className="xl:col-span-2 rounded-2xl border border-slate-700/60 bg-slate-800/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-amber-400/15 text-amber-300 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Projeção de Caixa (IA)</h2>
                <p className="text-[12px] text-slate-500">Modelo preditivo sobre recebíveis e obrigações</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              {(['7', '15', '30'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
                    periodo === p ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 rounded-xl bg-slate-900/40 border border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-500">
            <BarChart3 className="h-8 w-8" />
            <p className="text-sm font-medium">Projeção de Caixa — próximos {periodo} dias</p>
            <p className="text-[12px]">Gráfico de movimentação (entradas × saídas)</p>
          </div>
        </section>

        {/* Timeline de ações automatizadas */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-6">
          <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-amber-300" /> Ações automatizadas
          </h2>
          <ol className="relative border-l border-slate-700 ml-1.5 space-y-5">
            {EVENTOS.map((ev) => {
              const Icon = ev.icon;
              const tom =
                ev.tom === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : ev.tom === 'alerta' ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-700/60 text-slate-400';
              return (
                <li key={ev.id} className="ml-5">
                  <span className={`absolute -left-[13px] h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-slate-900 ${tom}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <p className="text-[13px] font-medium text-slate-200 leading-snug">{ev.titulo}</p>
                  <p className="text-[12px] text-slate-500">{ev.detalhe}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{ev.quando}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 2 — CONTAS A RECEBER
   ════════════════════════════════════════════════════════════════════════════ */
function AbaReceber() {
  const [titulos, setTitulos] = useState<TituloReceber[]>(RECEBER_MOCK);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'TODOS' | StatusReceber>('TODOS');
  const [ordem, setOrdem] = useState<'venc' | 'valorDesc' | 'valorAsc'>('venc');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = titulos.filter(
      (t) =>
        (status === 'TODOS' || t.status === status) &&
        (!q || t.cliente.toLowerCase().includes(q) || t.cnpj.includes(q) || t.descricao.toLowerCase().includes(q)),
    );
    return [...base].sort((a, b) => {
      if (ordem === 'valorDesc') return b.valor - a.valor;
      if (ordem === 'valorAsc') return a.valor - b.valor;
      return a.vencimento.split('/').reverse().join('').localeCompare(b.vencimento.split('/').reverse().join(''));
    });
  }, [titulos, busca, status, ordem]);

  const totalAberto = titulos.filter((t) => t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const vencendoHoje = titulos.filter((t) => t.vencimento === '06/07/2026' && t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const inadimplencia = titulos.filter((t) => t.status === 'VENCIDO').reduce((s, t) => s + t.valor, 0);

  const receber = (id: string) => setTitulos((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'PAGO' } : t)));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Total em Aberto" valor={totalAberto} hint={`${titulos.filter((t) => t.status !== 'PAGO').length} títulos`} icon={ArrowUpRight} tom="neutro" />
        <Kpi label="Vencendo Hoje" valor={vencendoHoje} hint="Requer atenção" icon={Clock} tom="processando" />
        <Kpi label="Inadimplência Crítica" valor={inadimplencia} hint={`${titulos.filter((t) => t.status === 'VENCIDO').length} clientes vencidos`} icon={AlertTriangle} tom="negativo" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, CNPJ ou NF…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400">
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="VENCIDO">Vencido</option>
          <option value="PAGO">Pago</option>
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as any)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400">
          <option value="venc">Ordenar: Vencimento</option>
          <option value="valorDesc">Maior valor</option>
          <option value="valorAsc">Menor valor</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-700/60">
                <th className="text-left font-semibold px-6 py-3">Cliente</th>
                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Vencimento</th>
                <th className="text-right font-semibold px-6 py-3">Valor</th>
                <th className="text-center font-semibold px-6 py-3">Status</th>
                <th className="text-right font-semibold px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum título encontrado.</td></tr>
              )}
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{t.cliente}</p>
                    <p className="text-[12px] text-slate-500">{t.cnpj} · {t.descricao}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-400 tabular-nums whitespace-nowrap">{t.vencimento}</td>
                  <td className="px-6 py-4 text-right tabular-nums font-semibold text-white">{brl(t.valor)}</td>
                  <td className="px-6 py-4 text-center"><BadgeReceber status={t.status} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={`https://wa.me/${t.telefone}?text=${encodeURIComponent(`Olá! Consta em aberto o título de ${brl(t.valor)} com vencimento em ${t.vencimento}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Cobrar via WhatsApp"
                        className="h-8 w-8 rounded-lg border border-slate-700 text-emerald-300 flex items-center justify-center hover:bg-emerald-500/10"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <button title="Gerar link de pagamento" className="h-8 w-8 rounded-lg border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700/30">
                        <Link2 className="h-4 w-4" />
                      </button>
                      {t.status !== 'PAGO' && (
                        <button onClick={() => receber(t.id)} className="rounded-lg bg-amber-400 text-slate-900 px-3 py-1.5 text-[12px] font-semibold hover:bg-amber-300">
                          Receber
                        </button>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => setMenuAberto(menuAberto === t.id ? null : t.id)}
                          className="h-8 w-8 rounded-lg border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700/30"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuAberto === t.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(null)} />
                            <div className="absolute right-0 mt-1 z-20 w-48 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-lg shadow-black/40">
                              <MenuItem icon={BarChart3} label="Ver DRE do cliente" onClick={() => setMenuAberto(null)} />
                              <MenuItem icon={History} label="Histórico de títulos" onClick={() => setMenuAberto(null)} />
                              <MenuItem icon={Eye} label="Detalhes" onClick={() => setMenuAberto(null)} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 3 — CONTAS A PAGAR
   ════════════════════════════════════════════════════════════════════════════ */
function AbaPagar() {
  const [titulos, setTitulos] = useState<TituloPagar[]>(PAGAR_MOCK);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<'TODAS' | string>('TODAS');
  const [arrastando, setArrastando] = useState(false);

  const categorias = useMemo(() => Array.from(new Set(PAGAR_MOCK.map((t) => t.categoria))), []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return titulos.filter(
      (t) => (categoria === 'TODAS' || t.categoria === categoria) && (!q || t.fornecedor.toLowerCase().includes(q)),
    );
  }, [titulos, busca, categoria]);

  const totalMes = titulos.filter((t) => t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const pagamentosHoje = titulos.filter((t) => t.vencimento === '06/07/2026' && t.status !== 'PAGO').reduce((s, t) => s + t.valor, 0);
  const economia = 8_940; // negociações/descontos por antecipação

  const aprovar = (id: string) => setTitulos((prev) => prev.map((t) => (t.id === id ? { ...t, status: t.status === 'APROVACAO_PENDENTE' ? 'APROVADO' : 'PAGO' } : t)));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Total a Pagar no Mês" valor={-totalMes} hint={`${titulos.filter((t) => t.status !== 'PAGO').length} obrigações`} icon={ArrowDownRight} tom="negativo" />
        <Kpi label="Pagamentos de Hoje" valor={-pagamentosHoje} hint="Prioridade máxima" icon={Clock} tom="processando" />
        <Kpi label="Economia Gerada" valor={economia} hint="Descontos por antecipação (IA)" icon={Sparkles} tom="positivo" />
      </div>

      {/* Área de OCR */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); }}
        className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
          arrastando ? 'border-amber-400 bg-slate-800' : 'border-slate-700 bg-slate-800/50'
        }`}
      >
        <span className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center">
          <UploadCloud className="h-6 w-6" />
        </span>
        <p className="text-sm font-semibold text-slate-200">Arraste o PDF do Boleto ou Nota Fiscal aqui</p>
        <p className="text-[12px] text-slate-500 mt-0.5">A IA lê o documento (OCR) e preenche fornecedor, valor e vencimento automaticamente.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
          />
        </div>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400">
          <option value="TODAS">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-700/60">
                <th className="text-left font-semibold px-6 py-3">Fornecedor</th>
                <th className="text-left font-semibold px-6 py-3">Categoria / Centro de Custo</th>
                <th className="text-left font-semibold px-6 py-3 whitespace-nowrap">Vencimento</th>
                <th className="text-right font-semibold px-6 py-3">Valor</th>
                <th className="text-center font-semibold px-6 py-3">Status</th>
                <th className="text-right font-semibold px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma conta encontrada.</td></tr>
              )}
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{t.fornecedor}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-md bg-slate-700/50 text-slate-300 px-2 py-0.5 text-[12px] font-medium">{t.categoria}</span>
                    <p className="text-[12px] text-slate-500 mt-0.5">{t.centroCusto}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-400 tabular-nums whitespace-nowrap">{t.vencimento}</td>
                  <td className="px-6 py-4 text-right tabular-nums font-semibold text-white">{brl(t.valor)}</td>
                  <td className="px-6 py-4 text-center"><BadgePagar status={t.status} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button title="Ver documento (PDF)" className="h-8 w-8 rounded-lg border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700/30">
                        <FileText className="h-4 w-4" />
                      </button>
                      {t.status === 'APROVACAO_PENDENTE' ? (
                        <button onClick={() => aprovar(t.id)} className="rounded-lg bg-amber-400 text-slate-900 px-3 py-1.5 text-[12px] font-semibold hover:bg-amber-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </button>
                      ) : t.status === 'APROVADO' ? (
                        <button onClick={() => aprovar(t.id)} className="rounded-lg border border-slate-700 text-slate-200 px-3 py-1.5 text-[12px] font-semibold hover:bg-slate-700/30 flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" /> Realizar Pagamento
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 font-medium px-3 py-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTES AUXILIARES
   ════════════════════════════════════════════════════════════════════════════ */
function Kpi({
  label,
  valor,
  hint,
  icon: Icon,
  tom,
  tendencia,
}: {
  label: string;
  valor: number;
  hint: string;
  icon: React.ElementType;
  tom: 'neutro' | 'positivo' | 'negativo' | 'processando' | 'destaque';
  tendencia?: number;
}) {
  const cor =
    tom === 'destaque' || tom === 'processando'
      ? 'text-amber-300'
      : tom === 'positivo'
        ? 'text-emerald-300'
        : tom === 'negativo'
          ? 'text-rose-300'
          : 'text-white';
  const chip =
    tom === 'destaque' || tom === 'processando'
      ? 'bg-amber-400/15 text-amber-300'
      : tom === 'positivo'
        ? 'bg-emerald-500/10 text-emerald-300'
        : tom === 'negativo'
          ? 'bg-rose-500/10 text-rose-300'
          : 'bg-slate-700/50 text-slate-400';
  const moldura = tom === 'destaque' ? 'ring-1 ring-amber-400/30 bg-amber-400/[0.06]' : 'border border-slate-700/60 bg-slate-800/50';

  return (
    <div className={`rounded-2xl p-5 ${moldura}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-500">{label}</p>
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${chip}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-3 text-3xl leading-none font-semibold tracking-tight tabular-nums ${cor}`}>{brl(valor)}</p>
      <div className="mt-2 flex items-center gap-2">
        {tendencia != null && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${tendencia >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
            {pct(tendencia)}
          </span>
        )}
        <p className="text-[12px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function BadgeReceber({ status }: { status: StatusReceber }) {
  const cfg =
    status === 'PAGO'
      ? { cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20', icon: CheckCircle2, label: 'Pago' }
      : status === 'VENCIDO'
        ? { cls: 'bg-rose-500/10 text-rose-300 ring-rose-500/20', icon: AlertTriangle, label: 'Vencido' }
        : { cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', icon: Clock, label: 'Pendente' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function BadgePagar({ status }: { status: StatusPagar }) {
  const cfg =
    status === 'PAGO'
      ? { cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20', icon: CheckCircle2, label: 'Pago' }
      : status === 'APROVADO'
        ? { cls: 'bg-slate-700/50 text-slate-300 ring-slate-600', icon: CheckCircle2, label: 'Aprovado' }
        : { cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', icon: Clock, label: 'Aprovação Pendente' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${cfg.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </span>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-300 hover:bg-slate-700/40 text-left">
      <Icon className="h-4 w-4 text-slate-500" /> {label}
    </button>
  );
}

function Tab({ ativo, icon: Icon, label, onClick }: { ativo: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        ativo ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon className={`h-4 w-4 ${ativo ? 'text-amber-300' : 'text-slate-500'}`} />
      {label}
      {ativo && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-400 rounded-full" />}
    </button>
  );
}
