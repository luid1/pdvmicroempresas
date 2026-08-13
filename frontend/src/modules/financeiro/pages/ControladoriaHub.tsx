import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  UploadCloud,
  Sparkles,
  Landmark,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { financeiroApi, fluxoCaixaApi } from '../../../services/api';
import { PageHeader } from '../../cadastros/ui';

/* ══════════════════════════════════════════════════════════════════════════════
   MÓDULO FINANCEIRO & CONTROLADORIA — Visão consolidada
   SPA de 3 abas (Fluxo de Caixa · Contas a Receber · Contas a Pagar).
   Leitura consolidada dos dados reais; as ações completas (baixa, cancelamento,
   novo título) ficam nas telas dedicadas — os botões "Abrir" levam até lá.
   Tema dark do sistema · âmbar no chrome, verde/vermelho só nos valores.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── Formatação ────────────────────────────────── */
const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const rotularPeriodo = (p: string, ag: 'dia' | 'mes') => {
  if (ag === 'mes') { const [a, m] = p.split('-'); return `${MESES[Number(m) - 1]}/${a}`; }
  const [a, m, d] = p.split('-'); return `${d}/${m}/${a}`;
};

/* Status compartilhado com as telas dedicadas de Contas a Receber/Pagar. */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  ABERTO: { label: 'Pendente', cls: 'bg-slate-400/10 text-[#8B8D98] border-slate-400/20' },
  PARCIAL: { label: 'Parcial', cls: 'bg-[#E8A317]/12 text-[#a9760a] border-[#E8A317]/40' },
  PAGO: { label: 'Pago', cls: 'bg-emerald-400/10 text-[#0b7d4e] border-emerald-400/20' },
  VENCIDO: { label: 'Atrasado', cls: 'bg-rose-400/10 text-[#c3352b] border-rose-400/20' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

type Aba = 'fluxo' | 'receber' | 'pagar';

interface Conta {
  id: string; descricao: string; numero?: string; status: string;
  valorOriginal: number; valorPago: number; valorAberto: number;
  dataEmissao: string; dataVencimento: string; dataPagamento?: string;
  cliente?: { razaoSocial?: string; nomeFantasia?: string };
  fornecedor?: { razaoSocial?: string; nomeFantasia?: string };
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE RAIZ
   ════════════════════════════════════════════════════════════════════════════ */
export default function ControladoriaHub() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('fluxo');
  const [busca, setBusca] = useState('');
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full bg-white text-[#16171D]">
      <PageHeader
        icon={<Landmark className="h-4 w-4" />}
        titulo="Financeiro & Controladoria"
        subtitulo="Visão consolidada · fluxo de caixa, contas a receber e a pagar"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nesta aba…"
                className="w-52 rounded-lg border border-[#E7E5DF] bg-white pl-9 pr-3 py-1.5 text-sm text-[#16171D] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-[#E8A317]"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <button onClick={() => setRefreshKey(k => k + 1)} className="flex items-center gap-1.5 bg-white hover:bg-[#EFEDE7] text-[#5B5D69] text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#E7E5DF]">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* ── Tabs ── */}
          <nav className="flex items-center gap-1 border-b border-[#E7E5DF] mb-6">
            <Tab ativo={aba === 'fluxo'} icon={BarChart3} label="Fluxo de Caixa" onClick={() => setAba('fluxo')} />
            <Tab ativo={aba === 'receber'} icon={ArrowUpRight} label="Contas a Receber" onClick={() => setAba('receber')} />
            <Tab ativo={aba === 'pagar'} icon={ArrowDownRight} label="Contas a Pagar" onClick={() => setAba('pagar')} />
          </nav>

          {aba === 'fluxo' && <AbaFluxo ini={ini} fim={fim} refreshKey={refreshKey} navigate={navigate} />}
          {aba === 'receber' && <AbaReceber ini={ini} fim={fim} busca={busca} refreshKey={refreshKey} navigate={navigate} />}
          {aba === 'pagar' && <AbaPagar ini={ini} fim={fim} busca={busca} refreshKey={refreshKey} navigate={navigate} />}
        </div>
      </div>
    </div>
  );
}

type AbaProps = {
  ini: string;
  fim: string;
  busca?: string;
  refreshKey: number;
  navigate: (to: string) => void;
};

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 1 — FLUXO DE CAIXA
   ════════════════════════════════════════════════════════════════════════════ */
function AbaFluxo({ ini, fim, refreshKey, navigate }: AbaProps) {
  const [dados, setDados] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    setLoading(true);
    fluxoCaixaApi.consolidado({ dataIni: ini, dataFim: fim, agrupamento: 'mes' })
      .then(r => setDados(r.data)).catch(() => setDados(null)).finally(() => setLoading(false));
  }, [ini, fim]);
  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const k = dados?.kpis;
  const periodos: any[] = dados?.periodos || [];
  const maxBar = Math.max(1, ...periodos.map(p => Math.max(p.entradas, p.saidas)));

  return (
    <div className="space-y-6">
      {/* KPIs reais (caixa realizado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} cor="emerald" label="Entradas (recebidas)" valor={loading ? null : R$(k?.totalEntradas)} />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} cor="rose" label="Saídas (pagas)" valor={loading ? null : R$(k?.totalSaidas)} />
        <Kpi icon={<Scale className="h-4 w-4" />} cor={Number(k?.saldoLiquido) < 0 ? 'rose' : 'sky'} label="Saldo líquido" valor={loading ? null : R$(k?.saldoLiquido)} destaque />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Movimento por mês (dados reais) */}
        <section className="xl:col-span-2 bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E5DF]">
            <h3 className="font-semibold text-sm text-[#5B5D69] flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#a9760a]" /> Movimento por mês
            </h3>
            <button onClick={() => navigate('/financeiro/fluxo-caixa')} className="flex items-center gap-1.5 text-xs font-semibold text-[#a9760a] hover:text-[#a9760a]">
              Abrir tela completa <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-[#F0EEE9] rounded animate-pulse" />)}
            </div>
          ) : periodos.length === 0 ? (
            <p className="text-sm text-slate-500 py-16 text-center">Sem movimentação de caixa no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Competência</th>
                  <th className="px-4 py-2.5 text-left font-semibold w-1/3">Fluxo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Entradas</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saídas</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {periodos.map(p => (
                  <tr key={p.periodo} className="border-t border-[#E7E5DF] hover:bg-[#EFEDE7]">
                    <td className="px-4 py-2.5 font-semibold text-[#16171D]">{rotularPeriodo(p.periodo, dados.agrupamento || 'mes')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 rounded-full bg-emerald-400/70" style={{ width: `${(p.entradas / maxBar) * 100}%`, minWidth: p.entradas > 0 ? '4px' : '0' }} />
                        <div className="h-1.5 rounded-full bg-rose-400/70" style={{ width: `${(p.saidas / maxBar) * 100}%`, minWidth: p.saidas > 0 ? '4px' : '0' }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#0b7d4e]">{R$(p.entradas)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#c3352b]">{R$(p.saidas)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-extrabold ${p.saldoAcumulado < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}`}>{R$(p.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Projeção por IA — placeholder honesto (recurso futuro) */}
        <section className="rounded-2xl border border-[#E7E5DF] bg-white p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-8 w-8 rounded-lg bg-amber-400/15 text-[#a9760a] flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[#16171D]">Projeção de Caixa (IA)</h2>
              <p className="text-[12px] text-slate-500">Modelo preditivo sobre recebíveis e obrigações</p>
            </div>
          </div>
          <div className="flex-1 min-h-[220px] rounded-xl bg-white border border-dashed border-[#E7E5DF] flex flex-col items-center justify-center gap-2 text-slate-500 text-center px-4">
            <BarChart3 className="h-8 w-8" />
            <p className="text-sm font-medium text-slate-400">Em breve</p>
            <p className="text-[12px]">A projeção preditiva de caixa (entradas × saídas futuras) será liberada em uma próxima atualização.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 2 — CONTAS A RECEBER
   ════════════════════════════════════════════════════════════════════════════ */
function AbaReceber({ ini, fim, busca, refreshKey, navigate }: AbaProps) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    const params = { dataIni: ini, dataFim: fim, ...(status && { status }) };
    Promise.all([
      financeiroApi.receber(params),
      financeiroApi.receberResumo(params),
    ])
      .then(([r, res]) => { setContas(r.data || []); setResumo(res.data || null); })
      .catch(() => { setContas([]); setResumo(null); })
      .finally(() => setLoading(false));
  }, [ini, fim, status]);
  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const filtradas = useMemo(() => {
    const q = (busca || '').trim().toLowerCase();
    if (!q) return contas;
    return contas.filter(c =>
      c.descricao?.toLowerCase().includes(q) ||
      c.numero?.toLowerCase().includes(q) ||
      c.cliente?.razaoSocial?.toLowerCase().includes(q) ||
      c.cliente?.nomeFantasia?.toLowerCase().includes(q),
    );
  }, [contas, busca]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<CircleDollarSign className="h-4 w-4" />} cor="sky" label="Total no período" valor={loading ? null : R$(resumo?.valorOriginalTotal)} />
        <Kpi icon={<Wallet className="h-4 w-4" />} cor="emerald" label="Recebido" valor={loading ? null : R$(resumo?.valorRecebido)} />
        <Kpi icon={<Clock className="h-4 w-4" />} cor="amber" label="Em aberto" valor={loading ? null : R$(resumo?.valorEmAberto)} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} cor="rose" label="Atrasado" valor={loading ? null : R$(resumo?.valorVencido)} />
      </div>

      {/* Filtro por status */}
      <div className="flex items-center gap-1 flex-wrap">
        {['', 'ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO'].map(s => (
          <button key={s || 'todos'} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${status === s ? 'bg-amber-500/15 text-[#a9760a] border-[#E8A317]/40' : 'bg-white text-slate-400 border-[#E7E5DF] hover:text-[#5B5D69]'}`}>
            {s === '' ? 'Todos' : STATUS_META[s].label}
          </button>
        ))}
        <button onClick={() => navigate('/financeiro/receber')} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#a9760a] hover:text-[#a9760a]">
          Abrir tela completa <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs text-slate-400">
            <tr>
              {['Cliente / Descrição', 'Nº', 'Vencimento', 'Valor', 'Em aberto', 'Status', ''].map((h, i) => (
                <th key={h || i} className={`px-4 py-2.5 font-semibold ${i >= 3 && i <= 4 ? 'text-right' : i === 5 || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-t border-[#E7E5DF]"><td colSpan={7} className="px-4 py-3"><div className="h-5 bg-[#F0EEE9] rounded animate-pulse" /></td></tr>
              ))
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-500 py-16">Nenhum título no período.</td></tr>
            ) : (
              filtradas.map(c => {
                const meta = STATUS_META[c.status] || STATUS_META.ABERTO;
                return (
                  <tr key={c.id} className="border-t border-[#E7E5DF] hover:bg-[#EFEDE7]">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#16171D]">{c.cliente?.nomeFantasia || c.cliente?.razaoSocial || c.descricao}</div>
                      {(c.cliente?.nomeFantasia || c.cliente?.razaoSocial) && <div className="text-xs text-slate-500">{c.descricao}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.numero || '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B8D98]">{dataBR(c.dataVencimento)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#5B5D69]">{R$(c.valorOriginal)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16171D]">{R$(c.valorAberto)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => navigate('/financeiro/receber')} title="Abrir na tela de Contas a Receber" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#a9760a] hover:bg-amber-500/15">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ABA 3 — CONTAS A PAGAR
   ════════════════════════════════════════════════════════════════════════════ */
function AbaPagar({ ini, fim, busca, refreshKey, navigate }: AbaProps) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    const params = { dataIni: ini, dataFim: fim, ...(status && { status }) };
    Promise.all([
      financeiroApi.pagar(params),
      financeiroApi.pagarResumo(params),
    ])
      .then(([r, res]) => { setContas(r.data || []); setResumo(res.data || null); })
      .catch(() => { setContas([]); setResumo(null); })
      .finally(() => setLoading(false));
  }, [ini, fim, status]);
  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const filtradas = useMemo(() => {
    const q = (busca || '').trim().toLowerCase();
    if (!q) return contas;
    return contas.filter(c =>
      c.descricao?.toLowerCase().includes(q) ||
      c.numero?.toLowerCase().includes(q) ||
      c.fornecedor?.razaoSocial?.toLowerCase().includes(q) ||
      c.fornecedor?.nomeFantasia?.toLowerCase().includes(q),
    );
  }, [contas, busca]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<CircleDollarSign className="h-4 w-4" />} cor="sky" label="Total no período" valor={loading ? null : R$(resumo?.valorOriginalTotal)} />
        <Kpi icon={<Wallet className="h-4 w-4" />} cor="emerald" label="Pago" valor={loading ? null : R$(resumo?.valorPago)} />
        <Kpi icon={<Clock className="h-4 w-4" />} cor="amber" label="Em aberto" valor={loading ? null : R$(resumo?.valorEmAberto)} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} cor="rose" label="Atrasado" valor={loading ? null : R$(resumo?.valorVencido)} />
      </div>

      {/* Leitura de boleto/NF por OCR — placeholder honesto (recurso futuro) */}
      <div className="rounded-2xl border-2 border-dashed border-[#E7E5DF] bg-white px-6 py-6 text-center">
        <span className="mx-auto mb-3 h-11 w-11 rounded-2xl bg-amber-400/15 text-[#a9760a] flex items-center justify-center">
          <UploadCloud className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-[#8B8D98]">Leitura automática de Boleto/NF por OCR — em breve</p>
        <p className="text-[12px] text-slate-500 mt-0.5">Em breve será possível arrastar o PDF e a IA preencher fornecedor, valor e vencimento. Por ora, cadastre pela tela de Contas a Pagar.</p>
      </div>

      {/* Filtro por status */}
      <div className="flex items-center gap-1 flex-wrap">
        {['', 'ABERTO', 'PARCIAL', 'PAGO', 'VENCIDO'].map(s => (
          <button key={s || 'todos'} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${status === s ? 'bg-amber-500/15 text-[#a9760a] border-[#E8A317]/40' : 'bg-white text-slate-400 border-[#E7E5DF] hover:text-[#5B5D69]'}`}>
            {s === '' ? 'Todos' : STATUS_META[s].label}
          </button>
        ))}
        <button onClick={() => navigate('/financeiro/pagar')} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#a9760a] hover:text-[#a9760a]">
          Abrir tela completa <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs text-slate-400">
            <tr>
              {['Fornecedor / Descrição', 'Nº', 'Vencimento', 'Valor', 'Em aberto', 'Status', ''].map((h, i) => (
                <th key={h || i} className={`px-4 py-2.5 font-semibold ${i >= 3 && i <= 4 ? 'text-right' : i === 5 || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-t border-[#E7E5DF]"><td colSpan={7} className="px-4 py-3"><div className="h-5 bg-[#F0EEE9] rounded animate-pulse" /></td></tr>
              ))
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-500 py-16">Nenhuma conta no período.</td></tr>
            ) : (
              filtradas.map(c => {
                const meta = STATUS_META[c.status] || STATUS_META.ABERTO;
                return (
                  <tr key={c.id} className="border-t border-[#E7E5DF] hover:bg-[#EFEDE7]">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#16171D]">{c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial || c.descricao}</div>
                      {(c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial) && <div className="text-xs text-slate-500">{c.descricao}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.numero || '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B8D98]">{dataBR(c.dataVencimento)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#5B5D69]">{R$(c.valorOriginal)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16171D]">{R$(c.valorAberto)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => navigate('/financeiro/pagar')} title="Abrir na tela de Contas a Pagar" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#a9760a] hover:bg-amber-500/15">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTES AUXILIARES
   ════════════════════════════════════════════════════════════════════════════ */
const CORES: Record<string, string> = {
  amber: 'bg-[#E8A317]/12 text-[#a9760a]',
  sky: 'bg-[#E8A317]/12 text-[#a9760a]',
  rose: 'bg-rose-400/10 text-[#c3352b]',
  emerald: 'bg-emerald-400/10 text-[#0b7d4e]',
};
function Kpi({ icon, label, valor, cor, destaque }: { icon: any; label: string; valor: string | null; cor: string; destaque?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${destaque ? 'border-[#E8A317]/30' : 'border-[#E7E5DF]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null
        ? <div className="h-7 w-28 bg-[#F0EEE9] rounded animate-pulse" />
        : <p className="text-2xl font-extrabold text-[#16171D] tracking-tight truncate">{valor}</p>}
    </div>
  );
}

function Tab({ ativo, icon: Icon, label, onClick }: { ativo: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        ativo ? 'text-[#a9760a]' : 'text-slate-400 hover:text-[#5B5D69]'
      }`}
    >
      <Icon className={`h-4 w-4 ${ativo ? 'text-[#a9760a]' : 'text-slate-500'}`} />
      {label}
      {ativo && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-400 rounded-full" />}
    </button>
  );
}
