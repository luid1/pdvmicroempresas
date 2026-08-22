import { useMemo, useState } from 'react';
import {
  LayoutGrid, Users, Clock, Receipt, Plus, Search, CheckCircle2, X, Minus, Trash2,
} from 'lucide-react';

/**
 * MAPA DE MESAS (modo Restaurante) — visão de salão em tempo real.
 *
 * Fase 5 (frontend-first): a comanda já é interativa dentro da tela. Abrir uma
 * mesa cria a comanda, o menu rápido lança itens, o consumo soma ao vivo e
 * "Fechar conta" libera a mesa. Tudo em estado local — quando o servidor entrar
 * (Fase 3), estas mesmas ações passam a gravar comandas de verdade.
 */

type StatusMesa = 'LIVRE' | 'OCUPADA' | 'CONTA' | 'RESERVADA';

interface ItemComanda {
  nome: string;
  preco: number;
  qtd: number;
}

interface Mesa {
  id: number;
  numero: number;
  lugares: number;
  status: StatusMesa;
  garcom?: string;
  abertaHa?: number;   // minutos
  consumo?: number;    // R$
  pessoas?: number;
  itens?: ItemComanda[];
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_UI: Record<StatusMesa, { label: string; dot: string; card: string; chip: string }> = {
  LIVRE:     { label: 'Livre',     dot: 'bg-[#0b7d4e]',  card: 'border-[#E7E5DF] bg-white hover:border-[#01B8FA]/40', chip: 'bg-emerald-500/12 text-[#0b7d4e] border-emerald-400/25' },
  OCUPADA:   { label: 'Ocupada',   dot: 'bg-[#01B8FA]',  card: 'border-[#01B8FA]/30 bg-[#01B8FA]/[0.05]',            chip: 'bg-[#01B8FA]/12 text-[#0678a0] border-[#01B8FA]/25' },
  CONTA:     { label: 'Fechando',  dot: 'bg-[#E8A317]',  card: 'border-[#E8A317]/40 bg-amber-400/[0.06]',            chip: 'bg-amber-500/12 text-[#a9760a] border-[#E8A317]/30' },
  RESERVADA: { label: 'Reservada', dot: 'bg-[#8B8D98]',  card: 'border-[#E7E5DF] bg-[#F6F5F2]',                      chip: 'bg-slate-500/10 text-[#5B5D69] border-[#E7E5DF]' },
};

/** Menu rápido do garçom — os itens mais lançados, para bater na comanda num toque. */
const MENU_RAPIDO: { nome: string; preco: number }[] = [
  { nome: 'Pizza Calabresa (G)', preco: 49.9 },
  { nome: 'X-Bacon Artesanal', preco: 28.0 },
  { nome: 'Smash Duplo', preco: 32.0 },
  { nome: 'Espaguete à Bolonhesa', preco: 39.9 },
  { nome: 'Refrigerante Lata', preco: 7.0 },
  { nome: 'Suco Natural', preco: 12.0 },
  { nome: 'Chopp 300ml', preco: 11.5 },
  { nome: 'Sobremesa do dia', preco: 18.0 },
];

const MESAS_INICIAIS: Mesa[] = [
  { id: 1, numero: 1, lugares: 2, status: 'OCUPADA', garcom: 'João', abertaHa: 34, consumo: 88.5, pessoas: 2, itens: [
    { nome: 'X-Bacon Artesanal', preco: 28.0, qtd: 2 }, { nome: 'Refrigerante Lata', preco: 7.0, qtd: 2 }, { nome: 'Sobremesa do dia', preco: 18.5, qtd: 1 },
  ] },
  { id: 2, numero: 2, lugares: 4, status: 'LIVRE' },
  { id: 3, numero: 3, lugares: 4, status: 'CONTA', garcom: 'Maria', abertaHa: 72, consumo: 214.9, pessoas: 4, itens: [
    { nome: 'Pizza Calabresa (G)', preco: 49.9, qtd: 2 }, { nome: 'Chopp 300ml', preco: 11.5, qtd: 8 }, { nome: 'Sobremesa do dia', preco: 18.0, qtd: 1 },
  ] },
  { id: 4, numero: 4, lugares: 2, status: 'LIVRE' },
  { id: 5, numero: 5, lugares: 6, status: 'OCUPADA', garcom: 'João', abertaHa: 12, consumo: 46.0, pessoas: 5, itens: [
    { nome: 'Refrigerante Lata', preco: 7.0, qtd: 2 }, { nome: 'Smash Duplo', preco: 32.0, qtd: 1 },
  ] },
  { id: 6, numero: 6, lugares: 4, status: 'RESERVADA' },
  { id: 7, numero: 7, lugares: 2, status: 'OCUPADA', garcom: 'Ana', abertaHa: 58, consumo: 132.0, pessoas: 2, itens: [
    { nome: 'Espaguete à Bolonhesa', preco: 39.9, qtd: 2 }, { nome: 'Suco Natural', preco: 12.0, qtd: 2 }, { nome: 'Chopp 300ml', preco: 11.5, qtd: 2 },
  ] },
  { id: 8, numero: 8, lugares: 8, status: 'LIVRE' },
  { id: 9, numero: 9, lugares: 4, status: 'OCUPADA', garcom: 'Maria', abertaHa: 5, consumo: 21.5, pessoas: 3, itens: [
    { nome: 'Refrigerante Lata', preco: 7.0, qtd: 1 }, { nome: 'Suco Natural', preco: 12.0, qtd: 1 },
  ] },
  { id: 10, numero: 10, lugares: 2, status: 'LIVRE' },
  { id: 11, numero: 11, lugares: 4, status: 'CONTA', garcom: 'Ana', abertaHa: 95, consumo: 308.7, pessoas: 4, itens: [
    { nome: 'Pizza Calabresa (G)', preco: 49.9, qtd: 4 }, { nome: 'Chopp 300ml', preco: 11.5, qtd: 8 }, { nome: 'Sobremesa do dia', preco: 18.0, qtd: 1 },
  ] },
  { id: 12, numero: 12, lugares: 6, status: 'LIVRE' },
];

const FILTROS: { id: StatusMesa | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'LIVRE', label: 'Livres' },
  { id: 'OCUPADA', label: 'Ocupadas' },
  { id: 'CONTA', label: 'Fechando conta' },
  { id: 'RESERVADA', label: 'Reservadas' },
];

const somaItens = (itens?: ItemComanda[]) =>
  (itens || []).reduce((s, i) => s + i.preco * i.qtd, 0);

export default function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INICIAIS);
  const [filtro, setFiltro] = useState<StatusMesa | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState<number | null>(null);

  // A mesa selecionada é derivada do estado vivo, para o painel refletir os
  // lançamentos em tempo real (ao adicionar item, o total já sobe na hora).
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
    const consumo = ocupadas.reduce((s, m) => s + (m.consumo || 0), 0);
    const pessoas = ocupadas.reduce((s, m) => s + (m.pessoas || 0), 0);
    return {
      livres: mesas.filter((m) => m.status === 'LIVRE').length,
      ocupadas: ocupadas.length,
      pessoas,
      consumo,
    };
  }, [mesas]);

  const patch = (id: number, muda: (m: Mesa) => Mesa) =>
    setMesas((lista) => lista.map((m) => (m.id === id ? muda(m) : m)));

  const abrirComanda = (id: number) =>
    patch(id, (m) => ({
      ...m, status: 'OCUPADA', garcom: 'Você', abertaHa: 0, pessoas: m.pessoas || 2, consumo: 0, itens: [],
    }));

  const adicionarItem = (id: number, novo: { nome: string; preco: number }) =>
    patch(id, (m) => {
      const itens = [...(m.itens || [])];
      const i = itens.findIndex((x) => x.nome === novo.nome);
      if (i >= 0) itens[i] = { ...itens[i], qtd: itens[i].qtd + 1 };
      else itens.push({ ...novo, qtd: 1 });
      return { ...m, itens, consumo: somaItens(itens) };
    });

  const tirarItem = (id: number, nome: string) =>
    patch(id, (m) => {
      const itens = (m.itens || [])
        .map((x) => (x.nome === nome ? { ...x, qtd: x.qtd - 1 } : x))
        .filter((x) => x.qtd > 0);
      return { ...m, itens, consumo: somaItens(itens) };
    });

  const pedirConta = (id: number) => patch(id, (m) => ({ ...m, status: 'CONTA' }));

  const fecharConta = (id: number) => {
    patch(id, (m) => ({
      id: m.id, numero: m.numero, lugares: m.lugares, status: 'LIVRE',
    }));
    setSelId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <LayoutGrid className="h-4 w-4 text-[#0678a0]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Mapa de Mesas</h1>
            <p className="text-[11px] text-[#8B8D98]">Salão em tempo real — toque numa mesa para abrir a comanda</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#A0A2AD] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº da mesa"
              className="w-28 text-xs rounded-lg pl-8 pr-2 py-2 text-[#5B5D69] bg-[#F6F5F2] border border-[#E7E5DF] focus:outline-none focus:border-[#01B8FA]/50"
            />
          </div>
          <button
            onClick={() => {
              const livre = mesas.find((m) => m.status === 'LIVRE');
              if (livre) { abrirComanda(livre.id); setSelId(livre.id); }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Abrir mesa
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-2.5 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <ResumoKpi icon={CheckCircle2} cor="text-[#0b7d4e]" titulo="Mesas livres" valor={String(resumo.livres)} />
        <ResumoKpi icon={LayoutGrid} cor="text-[#0678a0]" titulo="Mesas ocupadas" valor={String(resumo.ocupadas)} />
        <ResumoKpi icon={Users} cor="text-[#5B5D69]" titulo="Pessoas no salão" valor={String(resumo.pessoas)} />
        <ResumoKpi icon={Receipt} cor="text-[#a9760a]" titulo="Consumo aberto" valor={brl(resumo.consumo)} />
      </div>

      {/* Filtros */}
      <div className="bg-[#FAFAF8] border-b border-[#E5E7EB] px-5 py-2 shrink-0 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const ativo = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                ativo
                  ? 'bg-[#01B8FA]/[0.14] border-[#01B8FA]/40 text-[#0678a0] font-semibold'
                  : 'bg-white border-[#E7E5DF] text-[#8B8D98] hover:border-[#01B8FA]/30'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Grade de mesas */}
      <div className="flex-1 overflow-auto p-5">
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
                  <span className="text-2xl font-black text-[#16171D] leading-none">{m.numero}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ui.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} /> {ui.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-[#8B8D98]">
                  <Users className="h-3.5 w-3.5" /> {m.lugares} lugares
                </div>
                {(m.status === 'OCUPADA' || m.status === 'CONTA') && (
                  <div className="mt-2 pt-2 border-t border-[#E7E5DF] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8B8D98] flex items-center gap-1"><Clock className="h-3 w-3" /> {m.abertaHa} min</span>
                      <span className="font-bold text-[#16171D]">{brl(m.consumo || 0)}</span>
                    </div>
                    {m.garcom && <p className="text-[10px] text-[#A0A2AD]">Garçom: {m.garcom}</p>}
                  </div>
                )}
              </button>
            );
          })}
          {visiveis.length === 0 && (
            <div className="col-span-full text-center py-16 text-[#A0A2AD] text-sm">
              Nenhuma mesa neste filtro.
            </div>
          )}
        </div>
      </div>

      {/* Painel lateral (comanda da mesa) */}
      {selecionada && (
        <DetalheMesa
          mesa={selecionada}
          onFechar={() => setSelId(null)}
          onAbrir={() => abrirComanda(selecionada.id)}
          onAddItem={(item) => adicionarItem(selecionada.id, item)}
          onTirarItem={(nome) => tirarItem(selecionada.id, nome)}
          onPedirConta={() => pedirConta(selecionada.id)}
          onFecharConta={() => fecharConta(selecionada.id)}
        />
      )}
    </div>
  );
}

function ResumoKpi({
  icon: Icon, cor, titulo, valor,
}: { icon: React.ElementType; cor: string; titulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#F6F5F2] border border-[#E7E5DF] px-3 py-2">
      <Icon className={`h-4 w-4 ${cor}`} />
      <div>
        <p className="text-[10px] text-[#8B8D98] uppercase tracking-wide leading-none">{titulo}</p>
        <p className="text-sm font-bold text-[#16171D] mt-0.5">{valor}</p>
      </div>
    </div>
  );
}

function DetalheMesa({
  mesa, onFechar, onAbrir, onAddItem, onTirarItem, onPedirConta, onFecharConta,
}: {
  mesa: Mesa;
  onFechar: () => void;
  onAbrir: () => void;
  onAddItem: (item: { nome: string; preco: number }) => void;
  onTirarItem: (nome: string) => void;
  onPedirConta: () => void;
  onFecharConta: () => void;
}) {
  const ui = STATUS_UI[mesa.status];
  const aberta = mesa.status === 'OCUPADA' || mesa.status === 'CONTA';
  const itens = mesa.itens || [];

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onFechar} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-white border-l border-[#E5E7EB] z-50 shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#8B8D98]">Mesa</p>
            <h2 className="text-xl font-black text-[#16171D] leading-none">Nº {mesa.numero}</h2>
          </div>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg hover:bg-[#F1F1F3] flex items-center justify-center text-[#8B8D98]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 flex-1 overflow-auto">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${ui.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} /> {ui.label}
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <MiniInfo titulo="Lugares" valor={`${mesa.lugares}`} />
            <MiniInfo titulo="Pessoas" valor={mesa.pessoas ? String(mesa.pessoas) : '—'} />
            <MiniInfo titulo="Aberta há" valor={mesa.abertaHa != null ? `${mesa.abertaHa} min` : '—'} />
            <MiniInfo titulo="Garçom" valor={mesa.garcom || '—'} />
          </div>

          {aberta ? (
            <>
              {/* Itens já lançados */}
              <div className="rounded-xl border border-[#E7E5DF] bg-white overflow-hidden">
                <div className="px-3.5 py-2 bg-[#F6F5F2] border-b border-[#E7E5DF] flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#8B8D98]">Comanda</span>
                  <span className="text-[11px] text-[#A0A2AD]">{itens.reduce((s, i) => s + i.qtd, 0)} itens</span>
                </div>
                {itens.length === 0 ? (
                  <p className="px-3.5 py-6 text-center text-sm text-[#A0A2AD]">Nenhum item ainda. Use o menu rápido abaixo.</p>
                ) : (
                  <ul className="divide-y divide-[#F1F1F3]">
                    {itens.map((i) => (
                      <li key={i.nome} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#16171D] font-medium truncate">{i.nome}</p>
                          <p className="text-[11px] text-[#8B8D98]">{i.qtd} × {brl(i.preco)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm font-bold text-[#16171D] w-16 text-right">{brl(i.preco * i.qtd)}</span>
                          <button
                            onClick={() => onTirarItem(i.nome)}
                            className="h-6 w-6 rounded-md bg-[#F1F1F3] hover:bg-[#E7E5DF] text-[#8B8D98] flex items-center justify-center"
                            title="Remover uma unidade"
                          >
                            {i.qtd > 1 ? <Minus className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-3.5 py-2.5 border-t border-[#E7E5DF] flex items-center justify-between bg-[#FAFAF8]">
                  <span className="text-sm text-[#5B5D69]">Total</span>
                  <span className="text-lg font-black text-[#16171D]">{brl(mesa.consumo || 0)}</span>
                </div>
              </div>

              {/* Menu rápido */}
              {mesa.status === 'OCUPADA' && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#8B8D98] mb-1.5">Menu rápido</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MENU_RAPIDO.map((item) => (
                      <button
                        key={item.nome}
                        onClick={() => onAddItem(item)}
                        className="text-left rounded-lg border border-[#E7E5DF] bg-white px-2.5 py-2 hover:border-[#01B8FA]/40 hover:bg-[#01B8FA]/[0.04] transition-colors"
                      >
                        <p className="text-[12px] text-[#16171D] font-medium leading-tight truncate">{item.nome}</p>
                        <p className="text-[11px] text-[#8B8D98]">{brl(item.preco)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : mesa.status === 'RESERVADA' ? (
            <div className="rounded-xl border border-dashed border-[#E7E5DF] bg-[#FAFAF8] p-6 text-center">
              <LayoutGrid className="h-6 w-6 text-[#C7C9D2] mx-auto" />
              <p className="text-sm text-[#8B8D98] mt-2">Mesa reservada.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#E7E5DF] bg-[#FAFAF8] p-6 text-center">
              <LayoutGrid className="h-6 w-6 text-[#C7C9D2] mx-auto" />
              <p className="text-sm text-[#8B8D98] mt-2">Mesa livre — abra a comanda para começar a lançar.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-2">
          {mesa.status === 'LIVRE' ? (
            <button
              onClick={onAbrir}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors"
            >
              Abrir comanda
            </button>
          ) : mesa.status === 'OCUPADA' ? (
            <button
              onClick={onPedirConta}
              disabled={itens.length === 0}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#E8A317] hover:bg-[#d6960f] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Pedir a conta
            </button>
          ) : mesa.status === 'CONTA' ? (
            <button
              onClick={onFecharConta}
              className="flex-1 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#0b7d4e] hover:bg-[#0a6b43] text-white transition-colors"
            >
              Fechar conta • {brl(mesa.consumo || 0)}
            </button>
          ) : (
            <button className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#F1F1F3] text-[#5B5D69]">
              —
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function MiniInfo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-[#E7E5DF] bg-white px-3 py-2">
      <p className="text-[10px] text-[#8B8D98] uppercase tracking-wide leading-none">{titulo}</p>
      <p className="text-sm font-bold text-[#16171D] mt-1">{valor}</p>
    </div>
  );
}
