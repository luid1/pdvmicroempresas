import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, Flame, CheckCircle2, Timer, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { restauranteApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * COZINHA (KDS — Kitchen Display System) — modo Restaurante.
 *
 * Ligado ao backend: cada item das comandas abertas entra na fila e flui por
 * três colunas (Na fila → Em preparo → Pronto). Avançar um pedido grava a nova
 * etapa no servidor (moverEtapaKds). Itens do mesmo pedido são agrupados num
 * cartão; avançar move todos os itens visíveis daquele cartão.
 */

type Etapa = 'FILA' | 'PREPARO' | 'PRONTO';

interface ItemKdsApi {
  id: string;
  descricao: string;
  quantidade: string | number;
  observacao?: string | null;
  etapaKds: Etapa;
  enviadoEm: string;
  comanda?: {
    numero: number;
    origem: 'MESA' | 'BALCAO' | 'DELIVERY';
    mesaId?: string | null;
    mesa?: { numero: number } | null;
  } | null;
}
interface KdsResp { FILA: ItemKdsApi[]; PREPARO: ItemKdsApi[]; PRONTO: ItemKdsApi[] }

interface ItemVM { id: string; descricao: string; qtd: number; obs?: string }
interface PedidoVM {
  chave: string;       // comandaId + etapa (cartão por pedido dentro da coluna)
  origem: string;      // "Mesa 3", "Balcão", "Delivery #204"
  numero: number;
  minutos: number;
  etapa: Etapa;
  itemIds: string[];
  itens: ItemVM[];
}

const num = (v: string | number | null | undefined) => Number(v ?? 0);
const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function referenciaPedido(c: ItemKdsApi['comanda']): string {
  if (!c) return 'Pedido';
  if (c.origem === 'MESA') return c.mesa ? `Mesa ${c.mesa.numero}` : 'Mesa';
  if (c.origem === 'DELIVERY') return `Delivery #${c.numero}`;
  return 'Balcão';
}

const COLUNAS: { etapa: Etapa; label: string; icon: React.ElementType; cor: string; dot: string }[] = [
  { etapa: 'FILA',    label: 'Na fila',    icon: Clock,        cor: 'text-[#8B8D98]', dot: 'bg-[#8B8D98]' },
  { etapa: 'PREPARO', label: 'Em preparo', icon: Flame,        cor: 'text-[#a9760a]', dot: 'bg-[#E8A317]' },
  { etapa: 'PRONTO',  label: 'Pronto',     icon: CheckCircle2, cor: 'text-[#0b7d4e]', dot: 'bg-[#0b7d4e]' },
];

const PROXIMA: Record<Etapa, 'PREPARO' | 'PRONTO' | 'ENTREGUE'> = { FILA: 'PREPARO', PREPARO: 'PRONTO', PRONTO: 'ENTREGUE' };
const ROTULO_ACAO: Record<Etapa, string> = { FILA: 'Iniciar preparo', PREPARO: 'Marcar pronto', PRONTO: 'Entregue' };

/** Agrupa os itens de uma etapa por comanda, formando os cartões de pedido. */
function agruparPorPedido(itens: ItemKdsApi[], etapa: Etapa): PedidoVM[] {
  const mapa = new Map<string, PedidoVM>();
  for (const it of itens) {
    const cNumero = it.comanda?.numero ?? 0;
    const chave = `${cNumero}-${etapa}`;
    const g = mapa.get(chave);
    const linha: ItemVM = { id: it.id, descricao: it.descricao, qtd: num(it.quantidade), obs: it.observacao ?? undefined };
    if (g) {
      g.itemIds.push(it.id);
      g.itens.push(linha);
      g.minutos = Math.max(g.minutos, minutosDesde(it.enviadoEm));
    } else {
      mapa.set(chave, {
        chave,
        origem: referenciaPedido(it.comanda),
        numero: cNumero,
        minutos: minutosDesde(it.enviadoEm),
        etapa,
        itemIds: [it.id],
        itens: [linha],
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.minutos - a.minutos);
}

export default function Cozinha() {
  const { filialAtiva } = useAuth();
  const filialId = filialAtiva?.id;

  const [kds, setKds] = useState<KdsResp>({ FILA: [], PREPARO: [], PRONTO: [] });
  const [primeiraHora, setPrimeiraHora] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    if (!filialId) return;
    setErro(null);
    try {
      const { data } = await restauranteApi.listarKds(filialId);
      const resp: KdsResp = { FILA: data?.FILA ?? [], PREPARO: data?.PREPARO ?? [], PRONTO: data?.PRONTO ?? [] };
      setKds(resp);
      const horas: Record<string, string> = {};
      [...resp.FILA, ...resp.PREPARO, ...resp.PRONTO].forEach((it) => { horas[it.id] = horaDe(it.enviadoEm); });
      setPrimeiraHora(horas);
    } catch {
      setErro('Não consegui carregar a cozinha. Verifique a conexão e tente de novo.');
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
      const destino = PROXIMA[p.etapa];
      await Promise.all(p.itemIds.map((id) => restauranteApi.moverEtapaKds(id, destino)));
      await carregar();
    } catch {
      setErro('Não consegui mover o pedido. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [busy, carregar]);

  const colunas = useMemo(() => ({
    FILA: agruparPorPedido(kds.FILA, 'FILA'),
    PREPARO: agruparPorPedido(kds.PREPARO, 'PREPARO'),
    PRONTO: agruparPorPedido(kds.PRONTO, 'PRONTO'),
  }), [kds]);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-[#0678a0]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Cozinha — Painel de Produção (KDS)</h1>
            <p className="text-[11px] text-[#8B8D98]">Os pedidos entram pela esquerda e avançam até ficarem prontos</p>
          </div>
        </div>
        <button
          onClick={() => { setCarregando(true); void carregar(); }}
          disabled={busy || carregando}
          title="Atualizar cozinha"
          className="h-9 w-9 rounded-lg bg-[#F6F5F2] border border-[#E7E5DF] text-[#5B5D69] hover:border-[#01B8FA]/40 flex items-center justify-center disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {erro && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Colunas */}
      <div className="flex-1 overflow-auto p-4">
        {!filialId ? (
          <div className="text-center py-16 text-[#A0A2AD] text-sm">Selecione uma filial para ver a cozinha.</div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-20 text-[#8B8D98] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando cozinha…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 max-w-[1400px] mx-auto">
            {COLUNAS.map((col) => {
              const desta = colunas[col.etapa];
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
                      <div key={p.chave} className="rounded-2xl border border-[#E7E5DF] bg-white p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-[#16171D]">{p.origem}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            p.minutos >= 12 ? 'bg-rose-500/12 text-[#c3352b] border-rose-400/25' : 'bg-slate-500/10 text-[#5B5D69] border-[#E7E5DF]'
                          }`}>
                            <Timer className="h-3 w-3" /> {p.minutos} min
                          </span>
                        </div>
                        <p className="text-[10px] text-[#A0A2AD] mt-0.5">
                          Comanda #{p.numero} · entrou {primeiraHora[p.itemIds[0]] ?? ''}
                        </p>

                        <ul className="mt-2.5 space-y-1.5">
                          {p.itens.map((it) => (
                            <li key={it.id} className="flex items-start gap-2 text-[13px]">
                              <span className="font-bold text-[#0678a0] shrink-0">{it.qtd}×</span>
                              <span className="text-[#16171D]">
                                {it.descricao}
                                {it.obs && <span className="block text-[11px] text-[#c3352b] font-medium">↳ {it.obs}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => avancar(p)}
                          disabled={busy}
                          className={`w-full mt-3 text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
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
        )}
      </div>
    </div>
  );
}
