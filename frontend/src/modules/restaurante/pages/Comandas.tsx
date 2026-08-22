import { useMemo, useState } from 'react';
import { ClipboardCheck, Search, Users, Clock, Plus } from 'lucide-react';

/**
 * COMANDAS (modo Restaurante) — lista de contas abertas no salão e balcão.
 *
 * Fase 1: mock frontend. Cada comanda reúne os itens consumidos por uma mesa
 * ou cliente de balcão. No servidor, a comanda vira a fonte que alimenta a
 * cozinha (KDS) e o fechamento de conta.
 */

type Origem = 'MESA' | 'BALCAO' | 'DELIVERY';

interface Comanda {
  id: number;
  codigo: string;
  origem: Origem;
  referencia: string;   // "Mesa 3", "Cliente balcão", "Delivery #204"
  garcom?: string;
  itens: number;
  pessoas?: number;
  abertaHa: number;     // minutos
  total: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ORIGEM_UI: Record<Origem, { label: string; chip: string }> = {
  MESA:     { label: 'Mesa',     chip: 'bg-[#01B8FA]/12 text-[#0678a0] border-[#01B8FA]/25' },
  BALCAO:   { label: 'Balcão',   chip: 'bg-emerald-500/12 text-[#0b7d4e] border-emerald-400/25' },
  DELIVERY: { label: 'Delivery', chip: 'bg-amber-500/12 text-[#a9760a] border-[#E8A317]/30' },
};

const COMANDAS_INICIAIS: Comanda[] = [
  { id: 1, codigo: 'CMD-0031', origem: 'MESA', referencia: 'Mesa 3', garcom: 'Maria', itens: 8, pessoas: 4, abertaHa: 72, total: 214.9 },
  { id: 2, codigo: 'CMD-0032', origem: 'MESA', referencia: 'Mesa 7', garcom: 'Ana', itens: 5, pessoas: 2, abertaHa: 58, total: 132.0 },
  { id: 3, codigo: 'CMD-0033', origem: 'BALCAO', referencia: 'Cliente balcão', itens: 2, abertaHa: 6, total: 34.5 },
  { id: 4, codigo: 'CMD-0034', origem: 'MESA', referencia: 'Mesa 1', garcom: 'João', itens: 3, pessoas: 2, abertaHa: 34, total: 88.5 },
  { id: 5, codigo: 'CMD-0035', origem: 'DELIVERY', referencia: 'Delivery #204', itens: 3, abertaHa: 5, total: 61.9 },
  { id: 6, codigo: 'CMD-0036', origem: 'MESA', referencia: 'Mesa 5', garcom: 'João', itens: 4, pessoas: 5, abertaHa: 12, total: 46.0 },
];

const FILTROS: { id: Origem | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'MESA', label: 'Mesas' },
  { id: 'BALCAO', label: 'Balcão' },
  { id: 'DELIVERY', label: 'Delivery' },
];

export default function Comandas() {
  const [comandas] = useState<Comanda[]>(COMANDAS_INICIAIS);
  const [filtro, setFiltro] = useState<Origem | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

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
      <div className="bg-white border-b border-[#E5E7EB] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-[#0678a0]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Comandas abertas</h1>
            <p className="text-[11px] text-[#8B8D98]">
              {comandas.length} abertas · {brl(totalAberto)} em consumo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#A0A2AD] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código ou mesa"
              className="w-40 text-xs rounded-lg pl-8 pr-2 py-2 text-[#5B5D69] bg-[#F6F5F2] border border-[#E7E5DF] focus:outline-none focus:border-[#01B8FA]/50"
            />
          </div>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors">
            <Plus className="h-3.5 w-3.5" /> Nova comanda
          </button>
        </div>
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

      {/* Lista */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-w-[1400px]">
          {visiveis.map((c) => {
            const ui = ORIGEM_UI[c.origem];
            return (
              <button
                key={c.id}
                className="text-left rounded-2xl border border-[#E7E5DF] bg-white p-4 hover:border-[#01B8FA]/40 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[#A0A2AD] font-mono">{c.codigo}</p>
                    <h3 className="text-base font-black text-[#16171D] leading-tight">{c.referencia}</h3>
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${ui.chip}`}>
                    {ui.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#8B8D98]">
                  <span className="flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> {c.itens} itens</span>
                  {c.pessoas && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.pessoas}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.abertaHa} min</span>
                </div>

                <div className="mt-3 pt-3 border-t border-[#E7E5DF] flex items-center justify-between">
                  {c.garcom
                    ? <span className="text-[11px] text-[#A0A2AD]">Garçom: {c.garcom}</span>
                    : <span className="text-[11px] text-[#A0A2AD]">Balcão</span>}
                  <span className="text-lg font-black text-[#16171D]">{brl(c.total)}</span>
                </div>
              </button>
            );
          })}
          {visiveis.length === 0 && (
            <div className="col-span-full text-center py-16 text-[#A0A2AD] text-sm">
              Nenhuma comanda neste filtro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
