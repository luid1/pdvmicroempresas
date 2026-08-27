import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, Users, Clock, Receipt, Plus, Search, CheckCircle2, X, Minus, Trash2,
  RefreshCw, AlertCircle, Loader2, ChefHat, Zap,
} from 'lucide-react';
import { restauranteApi, pdvApi, type ItemComandaInput } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * MAPA DE MESAS (modo Restaurante) — visão de salão em tempo real.
 *
 * Agora ligado ao backend: mesas e comandas são de verdade. Abrir uma mesa
 * cria a comanda no servidor, o menu rápido lança itens (grava), "Pedir a
 * conta" e "Fechar conta" mudam o estado real e liberam a mesa. Cada ação
 * recarrega o salão para refletir o estado autoritativo do servidor.
 */

type StatusMesa = 'LIVRE' | 'OCUPADA' | 'CONTA' | 'RESERVADA';

// ── Formatos do backend (Decimals chegam como string no JSON) ──
interface MesaApi {
  id: string;
  numero: number;
  lugares: number;
  status: StatusMesa;
  apelido?: string | null;
}
interface ItemComandaApi {
  id: string;
  descricao: string;
  quantidade: string | number;
  precoUnitario: string | number;
  valorTotal: string | number;
}
interface ComandaApi {
  id: string;
  numero: number;
  status: 'ABERTA' | 'FECHANDO' | 'FECHADA' | 'CANCELADA';
  mesaId: string | null;
  garcomNome?: string | null;
  pessoas?: number | null;
  abertaEm: string;
  total: string | number;
  itens: ItemComandaApi[];
}

// ── View-models (já normalizados p/ a tela) ──
interface GrupoItem { descricao: string; preco: number; qtd: number; ids: string[] }
interface ComandaVM {
  id: string;
  status: ComandaApi['status'];
  garcom?: string;
  abertaHa: number;   // minutos
  total: number;
  pessoas?: number;
  itens: GrupoItem[];
}
interface MesaVM {
  id: string;
  numero: number;
  lugares: number;
  status: StatusMesa;
  comanda?: ComandaVM;
}

// Opções escolhidas no fechamento da conta (caixa/balcão).
type FecharOpts = { aplicarTaxa10: boolean; desconto: number; formaPagamento?: string };

const PAGAMENTOS: { id: string; label: string }[] = [
  { id: 'DINHEIRO', label: 'Dinheiro' },
  { id: 'PIX', label: 'PIX' },
  { id: 'CARTAO_CREDITO', label: 'Crédito' },
  { id: 'CARTAO_DEBITO', label: 'Débito' },
];

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const num = (v: string | number | null | undefined) => Number(v ?? 0);

const STATUS_UI: Record<StatusMesa, { label: string; dot: string; card: string; chip: string }> = {
  LIVRE:     { label: 'Livre',     dot: 'bg-[#2DD4A7]',  card: 'border-[#23262F] bg-[#101216] hover:border-[#01B8FA]/40', chip: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/25' },
  OCUPADA:   { label: 'Ocupada',   dot: 'bg-[#01B8FA]',  card: 'border-[#01B8FA]/30 bg-[#01B8FA]/[0.05]',            chip: 'bg-[#01B8FA]/12 text-[#01B8FA] border-[#01B8FA]/25' },
  CONTA:     { label: 'Fechando',  dot: 'bg-[#FF9F45]',  card: 'border-[#FF9F45]/40 bg-[#FF9F45]/[0.06]',            chip: 'bg-[#FF9F45]/12 text-[#FF9F45] border-[#FF9F45]/30' },
  RESERVADA: { label: 'Reservada', dot: 'bg-[#8A90A0]',  card: 'border-[#23262F] bg-[#0C0D10]',                      chip: 'bg-[#16181F] text-[#8A90A0] border-[#23262F]' },
};

const FILTROS: { id: StatusMesa | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'LIVRE', label: 'Livres' },
  { id: 'OCUPADA', label: 'Ocupadas' },
  { id: 'CONTA', label: 'Fechando conta' },
  { id: 'RESERVADA', label: 'Reservadas' },
];

/** Agrupa os itens da comanda por descrição, somando quantidades e guardando os ids
 *  (para "tirar" uma unidade removendo a linha mais recente daquele item). */
function agruparItens(itens: ItemComandaApi[]): GrupoItem[] {
  const mapa = new Map<string, GrupoItem>();
  for (const it of itens) {
    const g = mapa.get(it.descricao);
    if (g) { g.qtd += num(it.quantidade); g.ids.push(it.id); }
    else mapa.set(it.descricao, { descricao: it.descricao, preco: num(it.precoUnitario), qtd: num(it.quantidade), ids: [it.id] });
  }
  return [...mapa.values()];
}

function minutosDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

/** Extrai a mensagem real do erro do backend (Nest devolve em response.data.error.message
 *  ou response.data.message). Sem isso, o usuário só via um "tente novamente" genérico
 *  que escondia a causa (400 de validação, 403 de permissão, 500 do servidor, etc.). */
function msgErro(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: any }; message?: string };
  const data = e?.response?.data;
  const backend = data?.error?.message || data?.message;
  if (Array.isArray(backend)) return backend.join(' · ');
  if (typeof backend === 'string' && backend.trim()) return backend;
  if (e?.response?.status) return `${fallback} (erro ${e.response.status}).`;
  if (e?.message === 'Network Error') return 'Sem conexão com o servidor. Verifique a internet.';
  return fallback;
}

export default function Mesas() {
  const { filialAtiva } = useAuth();
  const filialId = filialAtiva?.id;

  const [mesasApi, setMesasApi] = useState<MesaApi[]>([]);
  const [comandas, setComandas] = useState<ComandaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filtro, setFiltro] = useState<StatusMesa | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!filialId) return;
    setErro(null);
    try {
      const [rMesas, rAbertas, rFechando] = await Promise.all([
        restauranteApi.listarMesas(filialId),
        restauranteApi.listarComandas({ filialId, status: 'ABERTA' }),
        restauranteApi.listarComandas({ filialId, status: 'FECHANDO' }),
      ]);
      setMesasApi(rMesas.data ?? []);
      setComandas([...(rAbertas.data ?? []), ...(rFechando.data ?? [])]);
    } catch (err) {
      setErro(msgErro(err, 'Não consegui carregar o salão. Verifique a conexão e tente de novo.'));
    } finally {
      setCarregando(false);
    }
  }, [filialId]);

  useEffect(() => {
    setCarregando(true);
    void carregar();
  }, [carregar]);

  // Cruza mesa + comanda aberta (fonte da verdade do consumo/itens da mesa).
  const mesas = useMemo<MesaVM[]>(() => {
    const porMesa = new Map<string, ComandaApi>();
    for (const c of comandas) if (c.mesaId) porMesa.set(c.mesaId, c);
    return mesasApi.map((m) => {
      const c = porMesa.get(m.id);
      const comanda: ComandaVM | undefined = c && {
        id: c.id,
        status: c.status,
        garcom: c.garcomNome ?? undefined,
        abertaHa: minutosDesde(c.abertaEm),
        total: num(c.total),
        pessoas: c.pessoas ?? undefined,
        itens: agruparItens(c.itens ?? []),
      };
      return { id: m.id, numero: m.numero, lugares: m.lugares, status: m.status, comanda };
    });
  }, [mesasApi, comandas]);

  const selecionada = useMemo(() => mesas.find((m) => m.id === selId) || null, [mesas, selId]);

  const visiveis = useMemo(() => {
    return mesas.filter((m) => {
      const okStatus = filtro === 'TODAS' || m.status === filtro;
      const okBusca = !busca || String(m.numero).includes(busca.trim());
      return okStatus && okBusca;
    });
  }, [mesas, filtro, busca]);

  const resumo = useMemo(() => {
    const ocupadas = mesas.filter((m) => m.status === 'OCUPADA' || m.status === 'CONTA');
    const consumo = ocupadas.reduce((s, m) => s + (m.comanda?.total || 0), 0);
    const pessoas = ocupadas.reduce((s, m) => s + (m.comanda?.pessoas || 0), 0);
    return {
      livres: mesas.filter((m) => m.status === 'LIVRE').length,
      ocupadas: ocupadas.length,
      pessoas,
      consumo,
    };
  }, [mesas]);

  // Wrapper: executa uma ação no servidor e recarrega o salão.
  const acao = useCallback(async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (err) {
      setErro(msgErro(err, 'Não consegui concluir a ação. Tente novamente.'));
    } finally {
      setBusy(false);
    }
  }, [busy, carregar]);

  const abrirComanda = (mesaId: string) =>
    acao(() => restauranteApi.abrirComanda({ filialId: filialId!, mesaId, origem: 'MESA' }));

  const enviarItens = (comandaId: string, itens: ItemComandaInput[]) =>
    acao(() => restauranteApi.adicionarItens(comandaId, itens));

  const tirarItem = (comandaId: string, itemId: string) =>
    acao(() => restauranteApi.removerItem(comandaId, itemId));

  const pedirConta = (comandaId: string) =>
    acao(() => restauranteApi.pedirConta(comandaId));

  const fecharConta = (comandaId: string, opts: FecharOpts) =>
    acao(async () => { await restauranteApi.fecharComanda(comandaId, opts); setSelId(null); });

  const criarMesas = (quantidade: number) =>
    acao(async () => {
      const base = mesasApi.reduce((mx, m) => Math.max(mx, m.numero), 0);
      for (let i = 1; i <= quantidade; i++) {
        await restauranteApi.criarMesa({ filialId: filialId!, numero: base + i, lugares: 4 });
      }
    });

  const abrirPrimeiraLivre = () => {
    const livre = mesas.find((m) => m.status === 'LIVRE');
    if (livre) { void abrirComanda(livre.id); setSelId(livre.id); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <LayoutGrid className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Mapa de Mesas</h1>
            <p className="text-[11px] text-[#8A90A0]">Salão em tempo real — toque numa mesa para abrir a comanda</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCarregando(true); void carregar(); }}
            disabled={busy || carregando}
            title="Atualizar salão"
            className="h-9 w-9 rounded-lg bg-[#0C0D10] border border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40 flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#8A90A0] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº da mesa"
              className="w-28 text-xs rounded-lg pl-8 pr-2 py-2 text-[#8A90A0] bg-[#0C0D10] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50"
            />
          </div>
          <button
            onClick={abrirPrimeiraLivre}
            disabled={busy || resumo.livres === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> Abrir mesa
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-2.5 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <ResumoKpi icon={CheckCircle2} cor="text-[#2DD4A7]" titulo="Mesas livres" valor={String(resumo.livres)} />
        <ResumoKpi icon={LayoutGrid} cor="text-[#01B8FA]" titulo="Mesas ocupadas" valor={String(resumo.ocupadas)} />
        <ResumoKpi icon={Users} cor="text-[#8A90A0]" titulo="Pessoas no salão" valor={String(resumo.pessoas)} />
        <ResumoKpi icon={Receipt} cor="text-[#0E86D4]" titulo="Consumo aberto" valor={brl(resumo.consumo)} />
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

      {/* Grade de mesas */}
      <div className="flex-1 overflow-auto p-5">
        {!filialId ? (
          <div className="text-center py-16 text-[#8A90A0] text-sm">Selecione uma filial para ver o salão.</div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-20 text-[#8A90A0] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando salão…
          </div>
        ) : mesasApi.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16">
            <LayoutGrid className="h-8 w-8 text-[#5E6472] mx-auto" />
            <p className="text-[15px] font-semibold text-[#F7F8FA] mt-3">Nenhuma mesa cadastrada ainda</p>
            <p className="text-sm text-[#8A90A0] mt-1">Crie o salão para começar a lançar comandas. Você pode ajustar depois.</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => criarMesas(8)}
                disabled={busy}
                className="text-sm font-bold px-4 py-2.5 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-50"
              >
                Criar 8 mesas
              </button>
              <button
                onClick={() => criarMesas(1)}
                disabled={busy}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#0C0D10] border border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40 transition-colors disabled:opacity-50"
              >
                + 1 mesa
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 max-w-[1400px]">
            {visiveis.map((m) => {
              const ui = STATUS_UI[m.status];
              return (
                <button
                  key={m.id}
                  onClick={() => setSelId(m.id)}
                  className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md ${ui.card}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-[#F7F8FA] leading-none">{m.numero}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ui.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} /> {ui.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-[#8A90A0]">
                    <Users className="h-3.5 w-3.5" /> {m.lugares} lugares
                  </div>
                  {(m.status === 'OCUPADA' || m.status === 'CONTA') && m.comanda && (
                    <div className="mt-2 pt-2 border-t border-[#23262F] space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8A90A0] flex items-center gap-1"><Clock className="h-3 w-3" /> {m.comanda.abertaHa} min</span>
                        <span className="font-bold text-[#F7F8FA]">{brl(m.comanda.total)}</span>
                      </div>
                      {m.comanda.garcom && <p className="text-[10px] text-[#8A90A0]">Garçom: {m.comanda.garcom}</p>}
                    </div>
                  )}
                </button>
              );
            })}
            {visiveis.length === 0 && (
              <div className="col-span-full text-center py-16 text-[#8A90A0] text-sm">
                Nenhuma mesa neste filtro.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Painel lateral (comanda da mesa) */}
      {selecionada && (
        <DetalheMesa
          mesa={selecionada}
          filialId={filialId!}
          busy={busy}
          onFechar={() => setSelId(null)}
          onAbrir={() => abrirComanda(selecionada.id)}
          onEnviar={(itens) => (selecionada.comanda ? enviarItens(selecionada.comanda.id, itens) : Promise.resolve())}
          onTirarItem={(itemId) => selecionada.comanda && tirarItem(selecionada.comanda.id, itemId)}
          onPedirConta={() => selecionada.comanda && pedirConta(selecionada.comanda.id)}
          onFecharConta={(opts) => selecionada.comanda && fecharConta(selecionada.comanda.id, opts)}
        />
      )}
    </div>
  );
}

function ResumoKpi({
  icon: Icon, cor, titulo, valor,
}: { icon: React.ElementType; cor: string; titulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#0C0D10] border border-[#23262F] px-3 py-2">
      <Icon className={`h-4 w-4 ${cor}`} />
      <div>
        <p className="text-[10px] text-[#8A90A0] uppercase tracking-wide leading-none">{titulo}</p>
        <p className="text-sm font-bold text-[#F7F8FA] mt-0.5">{valor}</p>
      </div>
    </div>
  );
}

// ── Busca no cardápio real (produtos do estoque/catálogo) ──
interface ProdutoBusca {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  precoVenda: number;
  estoqueDisponivel: number;
}

function BuscaCardapio({
  filialId, busy, onAdd,
}: {
  filialId: string;
  busy: boolean;
  onAdd: (item: { nome: string; preco: number; produtoId: string }) => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await pdvApi.buscarProdutos(t, filialId);
        setResultados(Array.isArray(data) ? data : []);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [termo, filialId]);

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A90A0] mb-1.5">Adicionar do cardápio</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5E6472]" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar produto por nome ou código…"
          className="w-full rounded-lg border border-[#23262F] bg-[#0C0D10] pl-8 pr-8 py-2 text-sm text-[#F7F8FA] placeholder:text-[#5E6472] focus:border-[#01B8FA]/50 focus:outline-none"
        />
        {buscando && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5E6472] animate-spin" />}
      </div>

      {termo.trim().length >= 2 && (
        <div className="mt-1.5 rounded-lg border border-[#23262F] bg-[#101216] overflow-hidden divide-y divide-[#23262F] max-h-64 overflow-y-auto">
          {resultados.length === 0 && !buscando ? (
            <p className="px-3 py-3 text-center text-[12px] text-[#8A90A0]">Nenhum produto encontrado.</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => { onAdd({ nome: p.descricao, preco: p.precoVenda, produtoId: p.id }); setTermo(''); }}
                disabled={busy}
                className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#01B8FA]/[0.05] disabled:opacity-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-[#F7F8FA] font-medium truncate">{p.descricao}</p>
                  <p className="text-[11px] text-[#8A90A0]">{p.codigo ? `Cód. ${p.codigo} · ` : ''}{p.unidade}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-bold text-[#F7F8FA] tabular-nums">{brl(p.precoVenda)}</span>
                  <span className="h-6 w-6 rounded-md bg-[#01B8FA]/15 text-[#01B8FA] flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DetalheMesa({
  mesa, filialId, busy, onFechar, onAbrir, onEnviar, onTirarItem, onPedirConta, onFecharConta,
}: {
  mesa: MesaVM;
  filialId: string;
  busy: boolean;
  onFechar: () => void;
  onAbrir: () => void;
  onEnviar: (itens: ItemComandaInput[]) => Promise<unknown>;
  onTirarItem: (itemId: string) => void;
  onPedirConta: () => void;
  onFecharConta: (opts: FecharOpts) => void;
}) {
  const ui = STATUS_UI[mesa.status];
  const aberta = mesa.status === 'OCUPADA' || mesa.status === 'CONTA';
  const itens = mesa.comanda?.itens || [];
  const total = mesa.comanda?.total || 0;
  const [checkout, setCheckout] = useState(false);

  // Carrinho local: o garçom monta o pedido e só ao "Enviar" grava/manda pra cozinha.
  const [carrinho, setCarrinho] = useState<{ nome: string; preco: number; produtoId?: string; qtd: number }[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Menu rápido = os primeiros produtos ATIVOS do catálogo da loja (os mesmos de
  // Produtos & Código de Barras), pra bater na comanda num toque — sem digitar.
  const [menuRapido, setMenuRapido] = useState<ProdutoBusca[]>([]);
  useEffect(() => {
    let vivo = true;
    pdvApi
      .buscarProdutos('', filialId)
      .then(({ data }) => { if (vivo) setMenuRapido(Array.isArray(data) ? data.slice(0, 8) : []); })
      .catch(() => { if (vivo) setMenuRapido([]); });
    return () => { vivo = false; };
  }, [filialId]);

  const addAoCarrinho = (item: { nome: string; preco: number; produtoId?: string }) =>
    setCarrinho((cur) => {
      const idx = cur.findIndex((c) => (item.produtoId ? c.produtoId === item.produtoId : c.nome === item.nome));
      if (idx >= 0) {
        const copia = [...cur];
        copia[idx] = { ...copia[idx], qtd: copia[idx].qtd + 1 };
        return copia;
      }
      return [...cur, { ...item, qtd: 1 }];
    });

  const mudarQtd = (idx: number, delta: number) =>
    setCarrinho((cur) =>
      cur.flatMap((c, i) => {
        if (i !== idx) return [c];
        const q = c.qtd + delta;
        return q <= 0 ? [] : [{ ...c, qtd: q }];
      }),
    );

  const totalCarrinho = carrinho.reduce((s, c) => s + c.preco * c.qtd, 0);

  // paraCozinha=true → itens vão pro KDS (FILA). false → lançados direto na conta
  // (ENTREGUE), sem passar pela cozinha (bebidas, itens já prontos).
  const enviar = async (paraCozinha: boolean) => {
    if (carrinho.length === 0) return;
    setEnviando(true);
    try {
      await onEnviar(
        carrinho.map((c) => ({
          descricao: c.nome,
          quantidade: c.qtd,
          precoUnitario: c.preco,
          produtoId: c.produtoId,
          ...(paraCozinha ? {} : { etapaKds: 'ENTREGUE' as const }),
        })),
      );
      setCarrinho([]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onFechar} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[#101216] border-l border-[#23262F] z-50 shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#23262F] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#8A90A0]">Mesa</p>
            <h2 className="text-xl font-black text-[#F7F8FA] leading-none">Nº {mesa.numero}</h2>
          </div>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg hover:bg-[#0C0D10] flex items-center justify-center text-[#8A90A0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 flex-1 overflow-auto">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${ui.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} /> {ui.label}
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <MiniInfo titulo="Lugares" valor={`${mesa.lugares}`} />
            <MiniInfo titulo="Pessoas" valor={mesa.comanda?.pessoas ? String(mesa.comanda.pessoas) : '—'} />
            <MiniInfo titulo="Aberta há" valor={mesa.comanda ? `${mesa.comanda.abertaHa} min` : '—'} />
            <MiniInfo titulo="Garçom" valor={mesa.comanda?.garcom || '—'} />
          </div>

          {aberta ? (
            <>
              {/* Itens já lançados */}
              <div className="rounded-xl border border-[#23262F] bg-[#101216] overflow-hidden">
                <div className="px-3.5 py-2 bg-[#0C0D10] border-b border-[#23262F] flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#8A90A0]">Comanda</span>
                  <span className="text-[11px] text-[#8A90A0]">{itens.reduce((s, i) => s + i.qtd, 0)} itens</span>
                </div>
                {itens.length === 0 ? (
                  <p className="px-3.5 py-6 text-center text-sm text-[#8A90A0]">Nenhum item enviado ainda. Monte o pedido abaixo e envie pra cozinha.</p>
                ) : (
                  <ul className="divide-y divide-[#23262F]">
                    {itens.map((i) => (
                      <li key={i.descricao} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#F7F8FA] font-medium truncate">{i.descricao}</p>
                          <p className="text-[11px] text-[#8A90A0]">{i.qtd} × {brl(i.preco)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm font-bold text-[#F7F8FA] w-16 text-right">{brl(i.preco * i.qtd)}</span>
                          {mesa.status === 'OCUPADA' && (
                            <button
                              onClick={() => onTirarItem(i.ids[i.ids.length - 1])}
                              disabled={busy}
                              className="h-6 w-6 rounded-md bg-[#0C0D10] hover:bg-[#23262F] text-[#8A90A0] flex items-center justify-center disabled:opacity-50"
                              title="Remover uma unidade"
                            >
                              {i.qtd > 1 ? <Minus className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-3.5 py-2.5 border-t border-[#23262F] flex items-center justify-between bg-[#0C0D10]">
                  <span className="text-sm text-[#8A90A0]">Total</span>
                  <span className="text-lg font-black text-[#F7F8FA]">{brl(total)}</span>
                </div>
              </div>

              {/* Adicionar do cardápio real */}
              {mesa.status === 'OCUPADA' && (
                <BuscaCardapio filialId={filialId} busy={busy} onAdd={addAoCarrinho} />
              )}

              {/* Carrinho — pedido a enviar pra cozinha */}
              {mesa.status === 'OCUPADA' && carrinho.length > 0 && (
                <div className="rounded-xl border border-[#01B8FA]/30 bg-[#01B8FA]/[0.04] overflow-hidden">
                  <div className="px-3.5 py-2 border-b border-[#01B8FA]/20 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#01B8FA]">A enviar</span>
                    <span className="text-[11px] text-[#8A90A0]">{carrinho.reduce((s, c) => s + c.qtd, 0)} itens</span>
                  </div>
                  <ul className="divide-y divide-[#01B8FA]/10">
                    {carrinho.map((c, idx) => (
                      <li key={c.produtoId || c.nome} className="px-3.5 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#F7F8FA] font-medium truncate">{c.nome}</p>
                          <p className="text-[11px] text-[#8A90A0] tabular-nums">{brl(c.preco)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => mudarQtd(idx, -1)} className="h-6 w-6 rounded-md bg-[#0C0D10] hover:bg-[#23262F] text-[#8A90A0] flex items-center justify-center">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-bold text-[#F7F8FA] w-5 text-center tabular-nums">{c.qtd}</span>
                          <button onClick={() => mudarQtd(idx, 1)} className="h-6 w-6 rounded-md bg-[#0C0D10] hover:bg-[#23262F] text-[#8A90A0] flex items-center justify-center">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="px-3.5 py-2 border-t border-[#01B8FA]/20 flex items-center justify-between">
                    <span className="text-sm text-[#8A90A0]">Subtotal a enviar</span>
                    <span className="text-sm font-bold text-[#F7F8FA] tabular-nums">{brl(totalCarrinho)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[#01B8FA]/20">
                    <button
                      onClick={() => enviar(true)}
                      disabled={busy || enviando}
                      className="text-sm font-bold px-3 py-2.5 bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#04121A] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      title="Manda os itens pro painel da cozinha (KDS)"
                    >
                      <ChefHat className="h-4 w-4" />
                      {enviando ? 'Enviando…' : 'Pra cozinha'}
                    </button>
                    <button
                      onClick={() => enviar(false)}
                      disabled={busy || enviando}
                      className="text-sm font-bold px-3 py-2.5 bg-[#0C0D10] hover:bg-[#23262F] text-[#F7F8FA] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      title="Lança direto na conta, sem passar pela cozinha (bebidas, itens prontos)"
                    >
                      <Zap className="h-4 w-4 text-[#01B8FA]" />
                      {enviando ? 'Lançando…' : 'Lançar direto'}
                    </button>
                  </div>
                </div>
              )}

              {/* Menu rápido — produtos reais do catálogo da loja */}
              {mesa.status === 'OCUPADA' && menuRapido.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A90A0] mb-1.5">Menu rápido</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {menuRapido.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addAoCarrinho({ nome: item.descricao, preco: item.precoVenda, produtoId: item.id })}
                        disabled={busy}
                        className="text-left rounded-lg border border-[#23262F] bg-[#101216] px-2.5 py-2 hover:border-[#01B8FA]/40 hover:bg-[#01B8FA]/[0.04] transition-colors disabled:opacity-50"
                      >
                        <p className="text-[12px] text-[#F7F8FA] font-medium leading-tight truncate">{item.descricao}</p>
                        <p className="text-[11px] text-[#8A90A0]">{brl(item.precoVenda)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : mesa.status === 'RESERVADA' ? (
            <div className="rounded-xl border border-dashed border-[#23262F] bg-[#0C0D10] p-6 text-center">
              <LayoutGrid className="h-6 w-6 text-[#5E6472] mx-auto" />
              <p className="text-sm text-[#8A90A0] mt-2">Mesa reservada.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#23262F] bg-[#0C0D10] p-6 text-center">
              <LayoutGrid className="h-6 w-6 text-[#5E6472] mx-auto" />
              <p className="text-sm text-[#8A90A0] mt-2">Mesa livre — abra a comanda para começar a lançar.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#23262F] flex gap-2">
          {mesa.status === 'LIVRE' ? (
            <button
              onClick={onAbrir}
              disabled={busy}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-50"
            >
              Abrir comanda
            </button>
          ) : mesa.status === 'OCUPADA' ? (
            <button
              onClick={onPedirConta}
              disabled={busy || itens.length === 0}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Pedir a conta
            </button>
          ) : mesa.status === 'CONTA' ? (
            <button
              onClick={() => setCheckout(true)}
              disabled={busy}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#2DD4A7] hover:bg-[#26b892] text-[#04121A] transition-colors disabled:opacity-50"
            >
              Fechar conta • {brl(total)}
            </button>
          ) : (
            <button className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#0C0D10] text-[#8A90A0]">
              —
            </button>
          )}
        </div>
      </aside>

      {checkout && (
        <ModalFechamento
          mesa={mesa}
          busy={busy}
          onClose={() => setCheckout(false)}
          onConfirmar={onFecharConta}
        />
      )}
    </>
  );
}

// ── Fechamento da conta (caixa/balcão) + visão-cliente ──
function ModalFechamento({
  mesa, busy, onClose, onConfirmar,
}: {
  mesa: MesaVM;
  busy: boolean;
  onClose: () => void;
  onConfirmar: (opts: FecharOpts) => void;
}) {
  const itens = mesa.comanda?.itens || [];
  const subtotal = mesa.comanda?.total || 0;
  const [taxa10, setTaxa10] = useState(true);
  const [descontoStr, setDescontoStr] = useState('');
  const [forma, setForma] = useState<string | undefined>(undefined);
  const [modoCliente, setModoCliente] = useState(false);

  const desconto = Math.max(0, Number(descontoStr.replace(',', '.')) || 0);
  const taxa = taxa10 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const total = Math.max(0, subtotal + taxa - desconto);

  if (modoCliente) {
    return (
      <VisaoCliente
        mesa={mesa}
        itens={itens}
        subtotal={subtotal}
        taxa={taxa}
        desconto={desconto}
        total={total}
        onVoltar={() => setModoCliente(false)}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-[#101216] border border-[#23262F] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
          <div className="px-5 py-4 border-b border-[#23262F] flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#8A90A0]">Fechar conta</p>
              <h2 className="text-lg font-black text-[#F7F8FA] leading-none">Mesa Nº {mesa.numero}</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#0C0D10] flex items-center justify-center text-[#8A90A0]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-auto">
            {/* Itens */}
            <ul className="rounded-xl border border-[#23262F] bg-[#0C0D10] divide-y divide-[#23262F] max-h-40 overflow-y-auto">
              {itens.map((i) => (
                <li key={i.descricao} className="px-3.5 py-2 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-[#F7F8FA] truncate">{i.qtd}× {i.descricao}</span>
                  <span className="text-[13px] font-bold text-[#F7F8FA] tabular-nums shrink-0">{brl(i.preco * i.qtd)}</span>
                </li>
              ))}
            </ul>

            {/* Taxa e desconto */}
            <div className="space-y-2">
              <button
                onClick={() => setTaxa10((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-[#23262F] bg-[#0C0D10] px-3.5 py-2.5"
              >
                <span className="text-sm text-[#F7F8FA]">Taxa de serviço (10%)</span>
                <span className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${taxa10 ? 'bg-[#2DD4A7] justify-end' : 'bg-[#23262F] justify-start'}`}>
                  <span className="h-4 w-4 rounded-full bg-white" />
                </span>
              </button>
              <div className="flex items-center justify-between rounded-xl border border-[#23262F] bg-[#0C0D10] px-3.5 py-2">
                <span className="text-sm text-[#F7F8FA]">Desconto (R$)</span>
                <input
                  value={descontoStr}
                  onChange={(e) => setDescontoStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-24 text-right bg-transparent text-sm font-bold text-[#F7F8FA] tabular-nums placeholder:text-[#5E6472] focus:outline-none"
                />
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-xl border border-[#23262F] bg-[#0C0D10] px-3.5 py-3 space-y-1.5">
              <Linha label="Subtotal" valor={brl(subtotal)} />
              {taxa > 0 && <Linha label="Taxa de serviço (10%)" valor={brl(taxa)} />}
              {desconto > 0 && <Linha label="Desconto" valor={`- ${brl(desconto)}`} cor="text-[#FF6B7A]" />}
              <div className="pt-1.5 border-t border-[#23262F] flex items-center justify-between">
                <span className="text-sm font-bold text-[#F7F8FA]">Total</span>
                <span className="text-xl font-black text-[#2DD4A7] tabular-nums">{brl(total)}</span>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A90A0] mb-1.5">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PAGAMENTOS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setForma((f) => (f === p.id ? undefined : p.id))}
                    className={`text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
                      forma === p.id
                        ? 'border-[#01B8FA] bg-[#01B8FA]/[0.08] text-[#01B8FA]'
                        : 'border-[#23262F] bg-[#101216] text-[#F7F8FA] hover:border-[#01B8FA]/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-[#23262F] flex gap-2">
            <button
              onClick={() => setModoCliente(true)}
              className="text-sm font-bold px-4 py-2.5 rounded-xl bg-[#16181F] border border-[#23262F] text-[#F7F8FA] hover:border-[#01B8FA]/40 transition-colors flex items-center gap-1.5"
            >
              <Receipt className="h-4 w-4" /> Mostrar ao cliente
            </button>
            <button
              onClick={() => onConfirmar({ aplicarTaxa10: taxa10, desconto, formaPagamento: forma })}
              disabled={busy}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#2DD4A7] hover:bg-[#26b892] text-[#04121A] transition-colors disabled:opacity-50"
            >
              {busy ? 'Fechando…' : `Confirmar • ${brl(total)}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Linha({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#8A90A0]">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${cor || 'text-[#F7F8FA]'}`}>{valor}</span>
    </div>
  );
}

// Tela cheia, limpa e grande — girada para o cliente conferir a conta no balcão.
function VisaoCliente({
  mesa, itens, subtotal, taxa, desconto, total, onVoltar,
}: {
  mesa: MesaVM;
  itens: GrupoItem[];
  subtotal: number;
  taxa: number;
  desconto: number;
  total: number;
  onVoltar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-[#08090A] flex flex-col">
      <div className="px-6 py-5 border-b border-[#23262F] flex items-center justify-between">
        <div>
          <p className="text-sm text-[#8A90A0]">Sua conta</p>
          <h1 className="text-2xl font-black text-[#F7F8FA]">Mesa Nº {mesa.numero}</h1>
        </div>
        <button
          onClick={onVoltar}
          className="h-10 w-10 rounded-xl bg-[#16181F] border border-[#23262F] flex items-center justify-center text-[#8A90A0] hover:text-[#F7F8FA]"
          title="Voltar ao caixa"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 max-w-2xl w-full mx-auto">
        <ul className="divide-y divide-[#23262F]">
          {itens.map((i) => (
            <li key={i.descricao} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg text-[#F7F8FA] font-semibold truncate">{i.descricao}</p>
                <p className="text-sm text-[#8A90A0]">{i.qtd} × {brl(i.preco)}</p>
              </div>
              <span className="text-lg font-bold text-[#F7F8FA] tabular-nums shrink-0">{brl(i.preco * i.qtd)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-[#23262F] px-6 py-6 max-w-2xl w-full mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-base text-[#8A90A0]">Subtotal</span>
          <span className="text-base font-semibold text-[#F7F8FA] tabular-nums">{brl(subtotal)}</span>
        </div>
        {taxa > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-base text-[#8A90A0]">Taxa de serviço (10%)</span>
            <span className="text-base font-semibold text-[#F7F8FA] tabular-nums">{brl(taxa)}</span>
          </div>
        )}
        {desconto > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-base text-[#8A90A0]">Desconto</span>
            <span className="text-base font-semibold text-[#FF6B7A] tabular-nums">- {brl(desconto)}</span>
          </div>
        )}
        <div className="pt-3 mt-1 border-t border-[#23262F] flex items-end justify-between">
          <span className="text-xl font-bold text-[#F7F8FA]">Total</span>
          <span className="text-4xl font-black text-[#2DD4A7] tabular-nums">{brl(total)}</span>
        </div>
        <p className="text-center text-[13px] text-[#5E6472] pt-2">Confira os itens com o atendente antes de pagar.</p>
      </div>
    </div>
  );
}

function MiniInfo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-[#23262F] bg-[#101216] px-3 py-2">
      <p className="text-[10px] text-[#8A90A0] uppercase tracking-wide leading-none">{titulo}</p>
      <p className="text-sm font-bold text-[#F7F8FA] mt-1">{valor}</p>
    </div>
  );
}
