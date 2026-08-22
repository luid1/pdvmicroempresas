import { useMemo, useState } from 'react';
import { Bike, MapPin, Clock, Phone, Package, CookingPot, CheckCircle2 } from 'lucide-react';

/**
 * DELIVERY (modo Restaurante) — acompanhamento de pedidos para entrega.
 *
 * Fase 1: mock frontend. Os pedidos fluem por etapas (Recebido → Na cozinha →
 * Saiu para entrega → Entregue). No servidor isso se integra à comanda, à
 * cozinha (KDS) e aos canais (WhatsApp, iFood, cardápio digital).
 */

type Fase = 'RECEBIDO' | 'COZINHA' | 'ROTA' | 'ENTREGUE';

interface PedidoDelivery {
  id: number;
  cliente: string;
  telefone: string;
  bairro: string;
  itens: number;
  total: number;
  minutos: number;
  pagamento: string;
  fase: Fase;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FASE_UI: Record<Fase, { label: string; icon: React.ElementType; cor: string; dot: string }> = {
  RECEBIDO: { label: 'Recebido',         icon: Package,      cor: 'text-[#5B5D69]', dot: 'bg-[#8B8D98]' },
  COZINHA:  { label: 'Na cozinha',       icon: CookingPot,   cor: 'text-[#a9760a]', dot: 'bg-[#E8A317]' },
  ROTA:     { label: 'Saiu p/ entrega',  icon: Bike,         cor: 'text-[#0678a0]', dot: 'bg-[#01B8FA]' },
  ENTREGUE: { label: 'Entregue',         icon: CheckCircle2, cor: 'text-[#0b7d4e]', dot: 'bg-[#0b7d4e]' },
};

const PROXIMA: Record<Fase, Fase | null> = { RECEBIDO: 'COZINHA', COZINHA: 'ROTA', ROTA: 'ENTREGUE', ENTREGUE: null };
const ACAO: Record<Fase, string> = { RECEBIDO: 'Enviar p/ cozinha', COZINHA: 'Despachar', ROTA: 'Confirmar entrega', ENTREGUE: '' };

const PEDIDOS_INICIAIS: PedidoDelivery[] = [
  { id: 204, cliente: 'Carlos Mendes', telefone: '(11) 99812-3344', bairro: 'Centro', itens: 3, total: 61.9, minutos: 5, pagamento: 'Pix', fase: 'RECEBIDO' },
  { id: 205, cliente: 'Fernanda Lima', telefone: '(11) 99745-1120', bairro: 'Jardim América', itens: 2, total: 44.0, minutos: 11, pagamento: 'Cartão', fase: 'COZINHA' },
  { id: 206, cliente: 'Rodrigo Alves', telefone: '(11) 99500-8890', bairro: 'Vila Nova', itens: 5, total: 128.5, minutos: 23, pagamento: 'Dinheiro', fase: 'ROTA' },
  { id: 207, cliente: 'Beatriz Souza', telefone: '(11) 99333-2201', bairro: 'Centro', itens: 1, total: 27.9, minutos: 2, pagamento: 'Pix', fase: 'RECEBIDO' },
];

const COLUNAS: Fase[] = ['RECEBIDO', 'COZINHA', 'ROTA'];

export default function Delivery() {
  const [pedidos, setPedidos] = useState<PedidoDelivery[]>(PEDIDOS_INICIAIS);

  const avancar = (id: number) => {
    setPedidos((prev) =>
      prev
        .map((p) => (p.id === id && PROXIMA[p.fase] ? { ...p, fase: PROXIMA[p.fase] as Fase } : p))
        .filter((p) => p.fase !== 'ENTREGUE'),
    );
  };

  const resumo = useMemo(() => ({
    ativos: pedidos.length,
    emRota: pedidos.filter((p) => p.fase === 'ROTA').length,
    faturamento: pedidos.reduce((s, p) => s + p.total, 0),
  }), [pedidos]);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <Bike className="h-4 w-4 text-[#0678a0]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Delivery</h1>
            <p className="text-[11px] text-[#8B8D98]">
              {resumo.ativos} pedidos ativos · {resumo.emRota} em rota · {brl(resumo.faturamento)}
            </p>
          </div>
        </div>
      </div>

      {/* Colunas por fase */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 md:grid-cols-3 max-w-[1300px] mx-auto">
          {COLUNAS.map((fase) => {
            const ui = FASE_UI[fase];
            const Icon = ui.icon;
            const desta = pedidos.filter((p) => p.fase === fase);
            return (
              <div key={fase} className="flex flex-col">
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ui.dot}`} />
                    <h2 className={`text-xs font-bold uppercase tracking-wide ${ui.cor}`}>{ui.label}</h2>
                  </div>
                  <span className="text-[11px] font-bold text-[#8B8D98] bg-white border border-[#E7E5DF] rounded-full px-2 py-0.5">
                    {desta.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {desta.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-[#E7E5DF] bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-[#16171D]">#{p.id} · {p.cliente}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          p.minutos >= 20 ? 'bg-rose-500/12 text-[#c3352b] border-rose-400/25' : 'bg-slate-500/10 text-[#5B5D69] border-[#E7E5DF]'
                        }`}>
                          <Clock className="h-3 w-3" /> {p.minutos} min
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-[#8B8D98]">
                        <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {p.bairro}</p>
                        <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {p.telefone}</p>
                        <p className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> {p.itens} itens · {p.pagamento}</p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#E7E5DF] flex items-center justify-between">
                        <span className="text-base font-black text-[#16171D]">{brl(p.total)}</span>
                        <Icon className={`h-4 w-4 ${ui.cor}`} />
                      </div>

                      <button
                        onClick={() => avancar(p.id)}
                        className="w-full mt-3 text-xs font-bold px-3 py-2 rounded-lg bg-[#01B8FA] text-[#062B38] hover:bg-[#3DC8FB] transition-colors"
                      >
                        {ACAO[fase]}
                      </button>
                    </div>
                  ))}
                  {desta.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#E7E5DF] bg-white/50 py-8 text-center text-[11px] text-[#A0A2AD]">
                      Nenhum pedido.
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
