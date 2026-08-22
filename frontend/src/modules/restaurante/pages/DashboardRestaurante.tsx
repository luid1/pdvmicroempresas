import { useMemo, useState } from 'react';
import {
  Gauge, TrendingUp, Clock, Utensils, Percent, DollarSign, Trophy,
  Bike, Store, ShoppingBag,
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
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 1420.2, cor: '#0b7d4e' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 510.0, cor: '#a9760a' },
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
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 9860.0, cor: '#0b7d4e' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 3260.0, cor: '#a9760a' },
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
      { id: 'delivery', label: 'Delivery', icon: Bike, valor: 41300.0, cor: '#0b7d4e' },
      { id: 'balcao', label: 'Balcão', icon: ShoppingBag, valor: 13400.0, cor: '#a9760a' },
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

const corCmv = (v: number) => (v <= 30 ? 'text-[#0b7d4e]' : v <= 38 ? 'text-[#a9760a]' : 'text-[#c3352b]');

export default function DashboardRestaurante() {
  const [periodo, setPeriodo] = useState<Periodo>('HOJE');
  const d = DADOS[periodo];

  const ticketMedio = d.pedidos > 0 ? d.faturamento / d.pedidos : 0;
  const totalCanais = d.canais.reduce((s, c) => s + c.valor, 0);
  const maxReceita = useMemo(() => Math.max(...d.pratos.map((p) => p.receita)), [d.pratos]);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-[#0678a0]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Dashboard do Restaurante</h1>
            <p className="text-[11px] text-[#8B8D98]">Faturamento, giro, CMV e mix de canais</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#F1F1F3] rounded-lg p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                periodo === p.id ? 'bg-white text-[#0678a0] shadow-sm' : 'text-[#8B8D98] hover:text-[#16171D]'
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
            <Kpi icon={DollarSign} titulo="Faturamento" valor={brl(d.faturamento)} cor="text-[#16171D]" />
            <Kpi icon={TrendingUp} titulo="Ticket médio" valor={brl(ticketMedio)} cor="text-[#0678a0]" />
            <Kpi icon={Utensils} titulo="Pedidos" valor={String(d.pedidos)} cor="text-[#16171D]" />
            <Kpi icon={Clock} titulo="Tempo médio" valor={`${d.tempoMedio} min`} cor="text-[#16171D]" />
            <Kpi icon={Percent} titulo="CMV consolidado" valor={pct(d.cmv)} cor={corCmv(d.cmv)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            {/* Mix por canal */}
            <div className="rounded-2xl border border-[#E7E5DF] bg-white p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8B8D98] mb-3">Faturamento por canal</h2>
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
                      <span className="flex items-center gap-2 text-sm text-[#5B5D69]">
                        <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c.cor}1a` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: c.cor }} />
                        </span>
                        {c.label}
                        <span className="text-[11px] text-[#A0A2AD]">{pct(share)}</span>
                      </span>
                      <span className="font-bold text-[#16171D]">{brl(c.valor)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E5DF] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-[#5B5D69]"><Gauge className="h-4 w-4" /> Giro de mesas</span>
                <span className="font-black text-[#16171D]">{d.giroMesas.toFixed(1)}× <span className="text-[11px] font-normal text-[#A0A2AD]">/ mesa</span></span>
              </div>
            </div>

            {/* Pratos que mais vendem */}
            <div className="rounded-2xl border border-[#E7E5DF] bg-white p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8B8D98] mb-3 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-[#a9760a]" /> Pratos que mais vendem
              </h2>
              <div className="space-y-3">
                {d.pratos.map((p, idx) => (
                  <div key={p.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-[#16171D] font-medium">
                        <span className="h-5 w-5 rounded-md bg-[#F1F1F3] text-[#8B8D98] text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                        {p.nome}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[11px] text-[#8B8D98]">{p.vendas} un</span>
                        <span className={`text-[11px] font-bold ${corCmv(p.cmv)}`}>CMV {pct(p.cmv)}</span>
                        <span className="font-bold text-[#16171D] w-20 text-right">{brl(p.receita)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F1F1F3] overflow-hidden">
                      <div className="h-full rounded-full bg-[#01B8FA]" style={{ width: `${(p.receita / maxReceita) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
    <div className="rounded-2xl border border-[#E7E5DF] bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] text-[#8B8D98] uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </div>
      <p className={`text-xl font-black mt-1 ${cor}`}>{valor}</p>
    </div>
  );
}
