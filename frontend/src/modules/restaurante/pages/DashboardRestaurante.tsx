import { useMemo, useState } from 'react';
import {
  Gauge, TrendingUp, Clock, Utensils, Percent, DollarSign, Trophy,
  Bike, Store, ShoppingBag, Sparkles,
} from 'lucide-react';

/**
 * DASHBOARD DO RESTAURANTE (modo Restaurante) — o painel do gestor.
 *
 * Reúne os indicadores que um restaurante acompanha todo dia: faturamento,
 * ticket médio, giro de mesas, tempo médio de atendimento, CMV consolidado,
 * mix por canal (salão/delivery/balcão) e os pratos que mais vendem.
 *
 * Fase 7 (frontend-first): números mock, no formato definitivo. No servidor
 * virão das comandas, fichas técnicas e financeiro.
 */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toFixed(1)}%`;

type Periodo = 'HOJE' | 'SEMANA' | 'MES';

const DADOS: Record<Periodo, {
  faturamento: number; pedidos: number; giroMesas: number; tempoMedio: number; cmv: number;
  canais: { id: string; label: string; icon: React.ElementType; valor: number; cor: string }[];
  pratos: { nome: string; vendas: number; receita: number; cmv: number }[];
}> = {
  HOJE: {
    faturamento: 4820.5, pedidos: 96, giroMesas: 2.4, tempoMedio: 42, cmv: 31.2,
    canais: [
      { id: 'salao', label: 'Salão', icon: Store, valor: 2890.3, cor: '#01B8FA' },
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 1420.2, cor: '#2DD4A7' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 510.0, cor: '#0E86D4' },
    ],
    pratos: [
      { nome: 'Pizza Calabresa (G)', vendas: 22, receita: 1097.8, cmv: 28.5 },
      { nome: 'X-Bacon Artesanal', vendas: 31, receita: 868.0, cmv: 34.1 },
      { nome: 'Pizza 4 Queijos (G)', vendas: 14, receita: 768.6, cmv: 33.2 },
      { nome: 'Smash Duplo', vendas: 18, receita: 576.0, cmv: 36.0 },
      { nome: 'Espaguete à Bolonhesa', vendas: 12, receita: 478.8, cmv: 26.7 },
    ],
  },
  SEMANA: {
    faturamento: 31240.0, pedidos: 612, giroMesas: 2.7, tempoMedio: 39, cmv: 30.4,
    canais: [
      { id: 'salao', label: 'Salão', icon: Store, valor: 18120.0, cor: '#01B8FA' },
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 9860.0, cor: '#2DD4A7' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 3260.0, cor: '#0E86D4' },
    ],
    pratos: [
      { nome: 'Pizza Calabresa (G)', vendas: 148, receita: 7385.2, cmv: 28.9 },
      { nome: 'X-Bacon Artesanal', vendas: 201, receita: 5628.0, cmv: 33.8 },
      { nome: 'Pizza 4 Queijos (G)', vendas: 96, receita: 5270.4, cmv: 32.7 },
      { nome: 'Smash Duplo', vendas: 118, receita: 3776.0, cmv: 35.4 },
      { nome: 'Combo Casal', vendas: 44, receita: 3515.6, cmv: 31.0 },
    ],
  },
  MES: {
    faturamento: 128900.0, pedidos: 2530, giroMesas: 2.6, tempoMedio: 40, cmv: 30.9,
    canais: [
      { id: 'salao', label: 'Salão', icon: Store, valor: 74200.0, cor: '#01B8FA' },
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 41300.0, cor: '#2DD4A7' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 13400.0, cor: '#0E86D4' },
    ],
    pratos: [
      { nome: 'Pizza Calabresa (G)', vendas: 612, receita: 30538.8, cmv: 29.2 },
      { nome: 'X-Bacon Artesanal', vendas: 840, receita: 23520.0, cmv: 33.5 },
      { nome: 'Pizza 4 Queijos (G)', vendas: 402, receita: 22069.8, cmv: 32.9 },
      { nome: 'Combo Casal', vendas: 188, receita: 15021.2, cmv: 31.2 },
      { nome: 'Smash Duplo', vendas: 486, receita: 15552.0, cmv: 35.1 },
    ],
  },
};

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'HOJE', label: 'Hoje' },
  { id: 'SEMANA', label: 'Semana' },
  { id: 'MES', label: 'Mês' },
];

const corCmv = (v: number) => (v <= 30 ? 'text-[#2DD4A7]' : v <= 38 ? 'text-[#0E86D4]' : 'text-[#FF6B7A]');

export default function DashboardRestaurante() {
  const [periodo, setPeriodo] = useState<Periodo>('HOJE');
  const d = DADOS[periodo];

  const ticketMedio = d.pedidos > 0 ? d.faturamento / d.pedidos : 0;
  const totalCanais = d.canais.reduce((s, c) => s + c.valor, 0);
  const maxReceita = useMemo(() => Math.max(...d.pratos.map((p) => p.receita)), [d.pratos]);

  // Lu · Insights — dicas determinísticas derivadas dos números do período.
  // Mesmo motor da Lu, mas sem servidor: são leituras diretas do painel, no
  // vocabulário do restaurante (CMV, prato campeão, mix de canal, giro de mesa).
  const insights = useMemo(() => {
    const out: { tom: 'bom' | 'atencao' | 'neutro'; texto: string }[] = [];

    // Prato campeão (maior receita) e prato de maior CMV (aperta a margem).
    const campeao = [...d.pratos].sort((a, b) => b.receita - a.receita)[0];
    const piorCmv = [...d.pratos].sort((a, b) => b.cmv - a.cmv)[0];
    if (campeao) {
      out.push({ tom: 'bom', texto: `Campeão de vendas: ${campeao.nome} (${campeao.vendas} un, ${brl(campeao.receita)}). Garanta insumo em estoque para não furar a venda.` });
    }
    if (piorCmv && piorCmv.cmv > 34) {
      out.push({ tom: 'atencao', texto: `${piorCmv.nome} está com CMV de ${pct(piorCmv.cmv)} — o mais alto do cardápio. Reveja porção ou preço para proteger a margem.` });
    }

    // CMV consolidado.
    if (d.cmv <= 30) out.push({ tom: 'bom', texto: `CMV consolidado em ${pct(d.cmv)}: saudável. Boa gestão de compras e ficha técnica.` });
    else if (d.cmv > 38) out.push({ tom: 'atencao', texto: `CMV consolidado em ${pct(d.cmv)}: acima do ideal (25–38%). Renegocie insumos ou ajuste preços.` });

    // Mix de canal — se delivery domina, olho na taxa das plataformas.
    const canalTop = [...d.canais].sort((a, b) => b.valor - a.valor)[0];
    if (canalTop && totalCanais > 0) {
      const share = (canalTop.valor / totalCanais) * 100;
      if (canalTop.id === 'delivery' && share >= 40) out.push({ tom: 'atencao', texto: `Delivery já é ${pct(share)} do faturamento. Confira a taxa das plataformas no CMV para não corroer a margem.` });
      else out.push({ tom: 'neutro', texto: `${canalTop.label} lidera o mix com ${pct(share)} do faturamento.` });
    }

    // Giro de mesas e tempo médio.
    if (d.giroMesas < 2.5) out.push({ tom: 'atencao', texto: `Giro de ${d.giroMesas.toFixed(1)}× por mesa está baixo. Agilizar o fechamento da conta libera mesa mais rápido.` });
    if (d.tempoMedio >= 45) out.push({ tom: 'atencao', texto: `Tempo médio de ${d.tempoMedio} min: acima de 45 min tende a esfriar a experiência. Vale olhar o gargalo na cozinha.` });
    else out.push({ tom: 'bom', texto: `Tempo médio de ${d.tempoMedio} min está dentro do esperado para o salão.` });

    return out.slice(0, 4);
  }, [d, totalCanais]);

  return (
    <div className="flex flex-col h-full bg-[#0C0D10]">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Dashboard do Restaurante</h1>
            <p className="text-[11px] text-[#8A90A0]">Faturamento, giro, CMV e mix de canais</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#0C0D10] rounded-lg p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                periodo === p.id ? 'bg-[#101216] text-[#01B8FA] shadow-sm' : 'text-[#8A90A0] hover:text-[#F7F8FA]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-[1300px] mx-auto space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icon={DollarSign} titulo="Faturamento" valor={brl(d.faturamento)} cor="text-[#F7F8FA]" />
            <Kpi icon={TrendingUp} titulo="Ticket médio" valor={brl(ticketMedio)} cor="text-[#01B8FA]" />
            <Kpi icon={Utensils} titulo="Pedidos" valor={String(d.pedidos)} cor="text-[#F7F8FA]" />
            <Kpi icon={Clock} titulo="Tempo médio" valor={`${d.tempoMedio} min`} cor="text-[#F7F8FA]" />
            <Kpi icon={Percent} titulo="CMV consolidado" valor={pct(d.cmv)} cor={corCmv(d.cmv)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            {/* Mix por canal */}
            <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-3">Faturamento por canal</h2>
              <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden mb-4">
                {d.canais.map((c) => (
                  <div key={c.id} style={{ width: `${(c.valor / totalCanais) * 100}%`, backgroundColor: c.cor }} />
                ))}
              </div>
              <div className="space-y-2.5">
                {d.canais.map((c) => {
                  const Icon = c.icon;
                  const share = (c.valor / totalCanais) * 100;
                  return (
                    <div key={c.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[#8A90A0]">
                        <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c.cor}1a` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: c.cor }} />
                        </span>
                        {c.label}
                        <span className="text-[11px] text-[#8A90A0]">{pct(share)}</span>
                      </span>
                      <span className="font-bold text-[#F7F8FA]">{brl(c.valor)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-[#23262F] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-[#8A90A0]"><Gauge className="h-4 w-4" /> Giro de mesas</span>
                <span className="font-black text-[#F7F8FA]">{d.giroMesas.toFixed(1)}× <span className="text-[11px] font-normal text-[#8A90A0]">/ mesa</span></span>
              </div>
            </div>

            {/* Pratos que mais vendem */}
            <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-3 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-[#0E86D4]" /> Pratos que mais vendem
              </h2>
              <div className="space-y-3">
                {d.pratos.map((p, idx) => (
                  <div key={p.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-[#F7F8FA] font-medium">
                        <span className="h-5 w-5 rounded-md bg-[#0C0D10] text-[#8A90A0] text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                        {p.nome}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[11px] text-[#8A90A0]">{p.vendas} un</span>
                        <span className={`text-[11px] font-bold ${corCmv(p.cmv)}`}>CMV {pct(p.cmv)}</span>
                        <span className="font-bold text-[#F7F8FA] w-20 text-right">{brl(p.receita)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#0C0D10] overflow-hidden">
                      <div className="h-full rounded-full bg-[#01B8FA]" style={{ width: `${(p.receita / maxReceita) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lu · Insights do restaurante */}
          <div className="rounded-2xl border border-[#01B8FA]/25 bg-gradient-to-br from-[#01B8FA]/[0.06] to-transparent p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#01B8FA] mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Lu · Insights do restaurante
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {insights.map((i, idx) => {
                const dot = i.tom === 'bom' ? '#2DD4A7' : i.tom === 'atencao' ? '#0E86D4' : '#0678a0';
                return (
                  <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-[#23262F] bg-[#101216] px-3.5 py-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
                    <p className="text-[13px] leading-snug text-[#8A90A0]">{i.texto}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#8A90A0]">
              Leituras automáticas do período. Pergunte mais à Lu com <kbd className="rounded bg-[#101216] px-1.5 py-0.5 text-[#8A90A0] ring-1 ring-[#23262F]">Ctrl</kbd>+<kbd className="rounded bg-[#101216] px-1.5 py-0.5 text-[#8A90A0] ring-1 ring-[#23262F]">K</kbd>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, titulo, valor, cor,
}: { icon: React.ElementType; titulo: string; valor: string; cor: string }) {
  return (
    <div className="rounded-2xl border border-[#23262F] bg-[#101216] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] text-[#8A90A0] uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </div>
      <p className={`text-xl font-black mt-1 ${cor}`}>{valor}</p>
    </div>
  );
}
