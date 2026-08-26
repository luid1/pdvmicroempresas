import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Search, Users, Clock, Plus, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { restauranteApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * COMANDAS (modo Restaurante) — lista de contas abertas no salão e balcão.
 *
 * Ligado ao backend: mostra as comandas ABERTA/FECHANDO da filial ativa, com
 * consumo e tempo reais. "Nova comanda" abre uma comanda de balcão de verdade.
 * A comanda é a fonte que alimenta a cozinha (KDS) e o fechamento de conta.
 */

type Origem = 'MESA' | 'BALCAO' | 'DELIVERY';

interface ComandaApi {
  id: string;
  numero: number;
  origem: Origem;
  status: 'ABERTA' | 'FECHANDO' | 'FECHADA' | 'CANCELADA';
  clienteNome?: string | null;
  garcomNome?: string | null;
  pessoas?: number | null;
  abertaEm: string;
  total: string | number;
  itens: { id: string }[];
  mesa?: { numero: number; apelido?: string | null } | null;
}

interface ComandaVM {
  id: string;
  codigo: string;
  origem: Origem;
  referencia: string;
  garcom?: string;
  itens: number;
  pessoas?: number;
  abertaHa: number;
  total: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number | null | undefined) => Number(v ?? 0);
const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

const ORIGEM_UI: Record<Origem, { label: string; chip: string }> = {
  MESA:     { label: 'Mesa',     chip: 'bg-[#01B8FA]/12 text-[#01B8FA] border-[#01B8FA]/25' },
  BALCAO:   { label: 'Balcão',   chip: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/25' },
  DELIVERY: { label: 'Delivery', chip: 'bg-[#01B8FA]/12 text-[#0E86D4] border-[#01B8FA]/30' },
};

function referencia(c: ComandaApi): string {
  if (c.origem === 'MESA') return c.mesa ? `Mesa ${c.mesa.numero}` : 'Mesa';
  if (c.origem === 'DELIVERY') return c.clienteNome ? `Delivery · ${c.clienteNome}` : `Delivery #${c.numero}`;
  return c.clienteNome || 'Cliente balcão';
}

const FILTROS: { id: Origem | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'MESA', label: 'Mesas' },
  { id: 'BALCAO', label: 'Balcão' },
  { id: 'DELIVERY', label: 'Delivery' },
];

export default function Comandas() {
  const { filialAtiva } = useAuth();
  const filialId = filialAtiva?.id;

  const [comandas, setComandas] = useState<ComandaVM[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<Origem | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    if (!filialId) return;
    setErro(null);
    try {
      const [rAbertas, rFechando] = await Promise.all([
        restauranteApi.listarComandas({ filialId, status: 'ABERTA' }),
        restauranteApi.listarComandas({ filialId, status: 'FECHANDO' }),
      ]);
      const lista: ComandaApi[] = [...(rAbertas.data ?? []), ...(rFechando.data ?? [])];
      setComandas(lista.map((c) => ({
        id: c.id,
        codigo: `CMD-${String(c.numero).padStart(4, '0')}`,
        origem: c.origem,
        referencia: referencia(c),
        garcom: c.garcomNome ?? undefined,
        itens: (c.itens ?? []).length,
        pessoas: c.pessoas ?? undefined,
        abertaHa: minutosDesde(c.abertaEm),
        total: num(c.total),
      })));
    } catch {
      setErro('Não consegui carregar as comandas. Verifique a conexão e tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [filialId]);

  useEffect(() => { setCarregando(true); void carregar(); }, [carregar]);

  const novaComandaBalcao = async () => {
    if (!filialId || busy) return;
    setBusy(true);
    setErro(null);
    try {
      await restauranteApi.abrirComanda({ filialId, origem: 'BALCAO' });
      await carregar();
    } catch {
      setErro('Não consegui abrir a comanda de balcão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return comandas.filter((c) => {
      const okFiltro = filtro === 'TODAS' || c.origem === filtro;
      const okBusca = !q || c.codigo.toLowerCase().includes(q) || c.referencia.toLowerCase().includes(q);
      return okFiltro && okBusca;
    });
  }, [comandas, filtro, busca]);

  const totalAberto = useMemo(() => comandas.reduce((s, c) => s + c.total, 0), [comandas]);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Comandas abertas</h1>
            <p className="text-[11px] text-[#8A90A0]">
              {comandas.length} abertas · {brl(totalAberto)} em consumo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCarregando(true); void carregar(); }}
            disabled={busy || carregando}
            title="Atualizar"
            className="h-9 w-9 rounded-lg bg-[#0C0D10] border border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40 flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#8A90A0] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código ou mesa"
              className="w-40 text-xs rounded-lg pl-8 pr-2 py-2 text-[#8A90A0] bg-[#0C0D10] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50"
            />
          </div>
          <button
            onClick={novaComandaBalcao}
            disabled={busy || !filialId}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> Nova comanda
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#0C0D10] border-b border-[#23262F] px-5 py-2 shrink-0 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const ativo = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                ativo
                  ? 'bg-[#01B8FA]/[0.14] border-[#01B8FA]/40 text-[#01B8FA] font-semibold'
                  : 'bg-[#101216] border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/30'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {erro && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-[#FF6B7A]/25 bg-[#FF6B7A]/12 px-3 py-2 text-[12px] text-[#FF6B7A]">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-auto p-5">
        {!filialId ? (
          <div className="text-center py-16 text-[#8A90A0] text-sm">Selecione uma filial para ver as comandas.</div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-20 text-[#8A90A0] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando comandas…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-w-[1400px]">
            {visiveis.map((c) => {
              const ui = ORIGEM_UI[c.origem];
              return (
                <div
                  key={c.id}
                  className="text-left rounded-2xl border border-[#23262F] bg-[#101216] p-4 hover:border-[#01B8FA]/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-[#8A90A0] font-num">{c.codigo}</p>
                      <h3 className="text-base font-black text-[#F7F8FA] leading-tight">{c.referencia}</h3>
                    </div>
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${ui.chip}`}>
                      {ui.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-[11px] text-[#8A90A0]">
                    <span className="flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> {c.itens} itens</span>
                    {c.pessoas ? <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.pessoas}</span> : null}
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.abertaHa} min</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#23262F] flex items-center justify-between">
                    {c.garcom
                      ? <span className="text-[11px] text-[#8A90A0]">Garçom: {c.garcom}</span>
                      : <span className="text-[11px] text-[#8A90A0]">Balcão</span>}
                    <span className="text-lg font-black text-[#F7F8FA]">{brl(c.total)}</span>
                  </div>
                </div>
              );
            })}
            {visiveis.length === 0 && (
              <div className="col-span-full text-center py-16 text-[#8A90A0] text-sm">
                Nenhuma comanda aberta{filtro !== 'TODAS' ? ' neste filtro' : ''}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
