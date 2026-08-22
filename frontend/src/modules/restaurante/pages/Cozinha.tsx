import { useState } from 'react';
import { ChefHat, Clock, Flame, CheckCircle2, Timer } from 'lucide-react';

/**
 * COZINHA (KDS — Kitchen Display System) — modo Restaurante.
 *
 * Fase 1: mock frontend. Mostra os pedidos como cartões que fluem por três
 * colunas (Na fila → Em preparo → Pronto). No servidor, cada item virá das
 * comandas e será roteado para o setor de produção correto (cozinha, bar, etc.).
 */

type Etapa = 'FILA' | 'PREPARO' | 'PRONTO';

interface ItemPedido {
  nome: string;
  qtd: number;
  obs?: string;
}
interface Pedido {
  id: number;
  origem: string;      // "Mesa 3", "Balcão", "Delivery #204"
  hora: string;        // "19:42"
  minutos: number;     // tempo desde a entrada
  etapa: Etapa;
  itens: ItemPedido[];
}

const PEDIDOS_INICIAIS: Pedido[] = [
  { id: 101, origem: 'Mesa 3', hora: '19:42', minutos: 3, etapa: 'FILA', itens: [
    { nome: 'Pizza Calabresa', qtd: 1, obs: 'sem cebola' },
    { nome: 'Refrigerante 2L', qtd: 1 },
  ] },
  { id: 102, origem: 'Delivery #204', hora: '19:40', minutos: 5, etapa: 'FILA', itens: [
    { nome: 'X-Bacon', qtd: 2 },
    { nome: 'Batata frita G', qtd: 1 },
  ] },
  { id: 103, origem: 'Mesa 7', hora: '19:36', minutos: 9, etapa: 'PREPARO', itens: [
    { nome: 'Pizza 4 Queijos', qtd: 1 },
    { nome: 'Pizza Portuguesa', qtd: 1, obs: 'bem passada' },
  ] },
  { id: 104, origem: 'Balcão', hora: '19:38', minutos: 7, etapa: 'PREPARO', itens: [
    { nome: 'Hambúrguer Artesanal', qtd: 1 },
  ] },
  { id: 105, origem: 'Mesa 1', hora: '19:30', minutos: 15, etapa: 'PRONTO', itens: [
    { nome: 'Espaguete Bolonhesa', qtd: 2 },
  ] },
];

const COLUNAS: { etapa: Etapa; label: string; icon: React.ElementType; cor: string; dot: string }[] = [
  { etapa: 'FILA',    label: 'Na fila',    icon: Clock,        cor: 'text-[#8B8D98]', dot: 'bg-[#8B8D98]' },
  { etapa: 'PREPARO', label: 'Em preparo', icon: Flame,        cor: 'text-[#a9760a]', dot: 'bg-[#E8A317]' },
  { etapa: 'PRONTO',  label: 'Pronto',     icon: CheckCircle2, cor: 'text-[#0b7d4e]', dot: 'bg-[#0b7d4e]' },
];

const PROXIMA: Record<Etapa, Etapa | null> = { FILA: 'PREPARO', PREPARO: 'PRONTO', PRONTO: null };
const ROTULO_ACAO: Record<Etapa, string> = { FILA: 'Iniciar preparo', PREPARO: 'Marcar pronto', PRONTO: 'Entregue' };

export default function Cozinha() {
  const [pedidos, setPedidos] = useState<Pedido[]>(PEDIDOS_INICIAIS);

  const avancar = (id: number) => {
    setPedidos((prev) =>
      prev
        .map((p) => {
          if (p.id !== id) return p;
          const prox = PROXIMA[p.etapa];
          return prox ? { ...p, etapa: prox } : p;
        })
        .filter((p) => !(p.id === id && PROXIMA[p.etapa] === null && p.etapa === 'PRONTO')),
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
          <ChefHat className="h-4 w-4 text-[#0678a0]" />
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Cozinha — Painel de Produção (KDS)</h1>
          <p className="text-[11px] text-[#8B8D98]">Os pedidos entram pela esquerda e avançam até ficarem prontos</p>
        </div>
      </div>

      {/* Colunas */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 md:grid-cols-3 max-w-[1400px] mx-auto">
          {COLUNAS.map((col) => {
            const Icon = col.icon;
            const desta = pedidos.filter((p) => p.etapa === col.etapa);
            return (
              <div key={col.etapa} className="flex flex-col">
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h2 className={`text-xs font-bold uppercase tracking-wide ${col.cor}`}>{col.label}</h2>
                  </div>
                  <span className="text-[11px] font-bold text-[#8B8D98] bg-white border border-[#E7E5DF] rounded-full px-2 py-0.5">
                    {desta.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {desta.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-[#E7E5DF] bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-[#16171D]">{p.origem}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          p.minutos >= 12 ? 'bg-rose-500/12 text-[#c3352b] border-rose-400/25' : 'bg-slate-500/10 text-[#5B5D69] border-[#E7E5DF]'
                        }`}>
                          <Timer className="h-3 w-3" /> {p.minutos} min
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A0A2AD] mt-0.5">Pedido #{p.id} · entrou {p.hora}</p>

                      <ul className="mt-2.5 space-y-1.5">
                        {p.itens.map((it, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]">
                            <span className="font-bold text-[#0678a0] shrink-0">{it.qtd}×</span>
                            <span className="text-[#16171D]">
                              {it.nome}
                              {it.obs && <span className="block text-[11px] text-[#c3352b] font-medium">↳ {it.obs}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => avancar(p.id)}
                        className={`w-full mt-3 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                          col.etapa === 'PRONTO'
                            ? 'bg-emerald-500/12 text-[#0b7d4e] hover:bg-emerald-500/20'
                            : 'bg-[#01B8FA] text-[#062B38] hover:bg-[#3DC8FB]'
                        }`}
                      >
                        {ROTULO_ACAO[col.etapa]}
                      </button>
                    </div>
                  ))}
                  {desta.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#E7E5DF] bg-white/50 py-8 text-center text-[11px] text-[#A0A2AD]">
                      Nada aqui.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
