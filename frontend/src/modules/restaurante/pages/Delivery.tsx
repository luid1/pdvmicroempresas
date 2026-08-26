import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, MapPin, Clock, User, Package, CookingPot, CheckCircle2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { restauranteApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * DELIVERY (modo Restaurante) — acompanhamento de pedidos para entrega.
 *
 * Ligado ao backend: os pedidos são as comandas de origem DELIVERY (abertas).
 * A fase de cada pedido é derivada da etapa dos itens na cozinha (KDS):
 *   Recebido (fila) → Na cozinha (preparo) → Saiu p/ entrega (pronto) → Entregue.
 * Avançar grava a nova etapa no servidor; "Confirmar entrega" marca os itens
 * como ENTREGUE (o pagamento/fechamento é feito no caixa ou nas Comandas).
 */

type Etapa = 'FILA' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO';
type Fase = 'RECEBIDO' | 'COZINHA' | 'ROTA';

interface ItemComandaApi {
  id: string;
  descricao: string;
  quantidade: string | number;
  etapaKds: Etapa;
  enviadoEm: string;
}
interface ComandaApi {
  id: string;
  numero: number;
  origem: 'MESA' | 'BALCAO' | 'DELIVERY';
  status: 'ABERTA' | 'FECHANDO' | 'FECHADA' | 'CANCELADA';
  clienteNome?: string | null;
  formaPagamento?: string | null;
  abertaEm: string;
  total: string | number;
  itens: ItemComandaApi[];
}

interface PedidoVM {
  id: string;
  numero: number;
  cliente: string;
  itens: number;
  total: number;
  minutos: number;
  pagamento?: string;
  fase: Fase;
  itemIds: string[];
  itensRaw: ItemComandaApi[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number | null | undefined) => Number(v ?? 0);
const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

const FASE_UI: Record<Fase, { label: string; icon: React.ElementType; cor: string; dot: string }> = {
  RECEBIDO: { label: 'Recebido',        icon: Package,      cor: 'text-[#8A90A0]', dot: 'bg-[#8A90A0]' },
  COZINHA:  { label: 'Na cozinha',      icon: CookingPot,   cor: 'text-[#0E86D4]', dot: 'bg-[#01B8FA]' },
  ROTA:     { label: 'Saiu p/ entrega', icon: Bike,         cor: 'text-[#01B8FA]', dot: 'bg-[#01B8FA]' },
};

const ACAO: Record<Fase, string> = { RECEBIDO: 'Enviar p/ cozinha', COZINHA: 'Despachar', ROTA: 'Confirmar entrega' };
const COLUNAS: Fase[] = ['RECEBIDO', 'COZINHA', 'ROTA'];

/** Deriva a fase de entrega a partir das etapas dos itens na cozinha. */
function faseDe(itens: ItemComandaApi[]): Fase | 'ENTREGUE' {
  const ativos = itens.filter((i) => i.etapaKds !== 'CANCELADO');
  if (ativos.length === 0) return 'RECEBIDO';
  const e = ativos.map((i) => i.etapaKds);
  if (e.every((x) => x === 'ENTREGUE')) return 'ENTREGUE';
  if (e.every((x) => x === 'PRONTO' || x === 'ENTREGUE')) return 'ROTA';
  if (e.some((x) => x === 'PREPARO') || (e.some((x) => x === 'PRONTO') && e.some((x) => x === 'FILA'))) return 'COZINHA';
  return 'RECEBIDO';
}

/** Itens que precisam mudar de etapa ao avançar a fase, e para qual etapa. */
function planoAvanco(p: PedidoVM): { ids: string[]; destino: Etapa } {
  if (p.fase === 'RECEBIDO') {
    return { ids: p.itensRaw.filter((i) => i.etapaKds === 'FILA').map((i) => i.id), destino: 'PREPARO' };
  }
  if (p.fase === 'COZINHA') {
    return { ids: p.itensRaw.filter((i) => i.etapaKds !== 'PRONTO' && i.etapaKds !== 'ENTREGUE').map((i) => i.id), destino: 'PRONTO' };
  }
  return { ids: p.itensRaw.filter((i) => i.etapaKds !== 'ENTREGUE').map((i) => i.id), destino: 'ENTREGUE' };
}

export default function Delivery() {
  const { filialAtiva } = useAuth();
  const filialId = filialAtiva?.id;

  const [pedidos, setPedidos] = useState<PedidoVM[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    if (!filialId) return;
    setErro(null);
    try {
      const [rAbertas, rFechando] = await Promise.all([
        restauranteApi.listarComandas({ filialId, status: 'ABERTA' }),
        restauranteApi.listarComandas({ filialId, status: 'FECHANDO' }),
      ]);
      const lista: ComandaApi[] = [...(rAbertas.data ?? []), ...(rFechando.data ?? [])];
      const vms: PedidoVM[] = [];
      for (const c of lista) {
        if (c.origem !== 'DELIVERY') continue;
        const itens = c.itens ?? [];
        const fase = faseDe(itens);
        if (fase === 'ENTREGUE') continue; // já entregue: sai do quadro
        vms.push({
          id: c.id,
          numero: c.numero,
          cliente: c.clienteNome || `Delivery #${c.numero}`,
          itens: itens.length,
          total: num(c.total),
          minutos: minutosDesde(c.abertaEm),
          pagamento: c.formaPagamento ?? undefined,
          fase,
          itemIds: itens.map((i) => i.id),
          itensRaw: itens,
        });
      }
      setPedidos(vms);
    } catch {
      setErro('Não consegui carregar os pedidos de delivery. Verifique a conexão e tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [filialId]);

  useEffect(() => { setCarregando(true); void carregar(); }, [carregar]);

  const avancar = useCallback(async (p: PedidoVM) => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    try {
      const { ids, destino } = planoAvanco(p);
      if (ids.length) await Promise.all(ids.map((id) => restauranteApi.moverEtapaKds(id, destino)));
      await carregar();
    } catch {
      setErro('Não consegui avançar o pedido. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [busy, carregar]);

  const resumo = useMemo(() => ({
    ativos: pedidos.length,
    emRota: pedidos.filter((p) => p.fase === 'ROTA').length,
    faturamento: pedidos.reduce((s, p) => s + p.total, 0),
  }), [pedidos]);

  return (
    <div className="flex flex-col h-full bg-[#0C0D10]">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <Bike className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Delivery</h1>
            <p className="text-[11px] text-[#8A90A0]">
              {resumo.ativos} pedidos ativos · {resumo.emRota} em rota · {brl(resumo.faturamento)}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setCarregando(true); void carregar(); }}
          disabled={busy || carregando}
          title="Atualizar delivery"
          className="h-9 w-9 rounded-lg bg-[#0C0D10] border border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40 flex items-center justify-center disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {erro && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-[#FF6B7A]/25 bg-[#FF6B7A]/12 px-3 py-2 text-[12px] text-[#FF6B7A]">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Colunas por fase */}
      <div className="flex-1 overflow-auto p-4">
        {!filialId ? (
          <div className="text-center py-16 text-[#8A90A0] text-sm">Selecione uma filial para ver o delivery.</div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-20 text-[#8A90A0] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando delivery…
          </div>
        ) : (
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
                    <span className="text-[11px] font-bold text-[#8A90A0] bg-[#101216] border border-[#23262F] rounded-full px-2 py-0.5">
                      {desta.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {desta.map((p) => (
                      <div key={p.id} className="rounded-2xl border border-[#23262F] bg-[#101216] p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-[#F7F8FA]">#{p.numero} · {p.cliente}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            p.minutos >= 20 ? 'bg-[#FF6B7A]/12 text-[#FF6B7A] border-[#FF6B7A]/25' : 'bg-[#16181F]/10 text-[#8A90A0] border-[#23262F]'
                          }`}>
                            <Clock className="h-3 w-3" /> {p.minutos} min
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-[11px] text-[#8A90A0]">
                          <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {p.cliente}</p>
                          <p className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" /> {p.itens} {p.itens === 1 ? 'item' : 'itens'}
                            {p.pagamento ? ` · ${p.pagamento}` : ''}
                          </p>
                          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Comanda #{p.numero}</p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-[#23262F] flex items-center justify-between">
                          <span className="text-base font-black text-[#F7F8FA]">{brl(p.total)}</span>
                          <Icon className={`h-4 w-4 ${ui.cor}`} />
                        </div>

                        <button
                          onClick={() => avancar(p)}
                          disabled={busy}
                          className="w-full mt-3 text-xs font-bold px-3 py-2 rounded-lg bg-[#01B8FA] text-[#062B38] hover:bg-[#3DC8FB] transition-colors disabled:opacity-50"
                        >
                          {ACAO[fase]}
                        </button>
                      </div>
                    ))}
                    {desta.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-[#23262F] bg-[#101216]/50 py-8 text-center text-[11px] text-[#8A90A0]">
                        Nenhum pedido.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
