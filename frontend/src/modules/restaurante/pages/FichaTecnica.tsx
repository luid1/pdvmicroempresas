import { useMemo, useState } from 'react';
import {
  ChefHat, Plus, Search, Trash2, Percent, TrendingUp, Scale, DollarSign,
} from 'lucide-react';

/**
 * FICHA TÉCNICA (modo Restaurante) — a "receita" de cada produto PRODUZIDO.
 *
 * A ficha lista os INSUMOS que compõem o prato e quanto de cada um ele
 * consome. Com isso o sistema sabe o CUSTO real (soma dos insumos), o CMV
 * (custo ÷ preço) e a MARGEM — a base para precificar sem prejuízo.
 *
 * Fase 2: cálculo 100% no frontend (mock), com os números já no formato
 * definitivo. No servidor, cada venda desse prato baixará os insumos do estoque.
 */

interface Insumo {
  id: number;
  nome: string;
  qtd: number;
  unidade: string;   // g, ml, un
  custoUnit: number; // R$ por unidade base (por g, ml, un)
}
interface Ficha {
  id: number;
  nome: string;
  rendimento: string;   // "1 pizza", "1 porção"
  precoVenda: number;
  insumos: Insumo[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toFixed(1)}%`;

const FICHAS_INICIAIS: Ficha[] = [
  {
    id: 1, nome: 'Pizza Calabresa (G)', rendimento: '1 pizza 35cm', precoVenda: 49.9,
    insumos: [
      { id: 11, nome: 'Massa de pizza', qtd: 250, unidade: 'g', custoUnit: 0.006 },
      { id: 12, nome: 'Molho de tomate', qtd: 120, unidade: 'ml', custoUnit: 0.008 },
      { id: 13, nome: 'Muçarela', qtd: 200, unidade: 'g', custoUnit: 0.042 },
      { id: 14, nome: 'Calabresa fatiada', qtd: 150, unidade: 'g', custoUnit: 0.038 },
      { id: 15, nome: 'Cebola', qtd: 40, unidade: 'g', custoUnit: 0.005 },
    ],
  },
  {
    id: 2, nome: 'X-Bacon Artesanal', rendimento: '1 lanche', precoVenda: 28.0,
    insumos: [
      { id: 21, nome: 'Pão brioche', qtd: 1, unidade: 'un', custoUnit: 1.80 },
      { id: 22, nome: 'Blend 180g', qtd: 180, unidade: 'g', custoUnit: 0.052 },
      { id: 23, nome: 'Bacon', qtd: 40, unidade: 'g', custoUnit: 0.061 },
      { id: 24, nome: 'Queijo cheddar', qtd: 40, unidade: 'g', custoUnit: 0.048 },
      { id: 25, nome: 'Molho da casa', qtd: 30, unidade: 'ml', custoUnit: 0.012 },
    ],
  },
  {
    id: 3, nome: 'Espaguete à Bolonhesa', rendimento: '1 porção', precoVenda: 39.9,
    insumos: [
      { id: 31, nome: 'Massa espaguete', qtd: 120, unidade: 'g', custoUnit: 0.009 },
      { id: 32, nome: 'Molho bolonhesa', qtd: 200, unidade: 'ml', custoUnit: 0.028 },
      { id: 33, nome: 'Queijo ralado', qtd: 20, unidade: 'g', custoUnit: 0.055 },
    ],
  },
];

const custoFicha = (f: Ficha) => f.insumos.reduce((s, i) => s + i.qtd * i.custoUnit, 0);
const cmv = (f: Ficha) => (f.precoVenda > 0 ? (custoFicha(f) / f.precoVenda) * 100 : 0);
const margem = (f: Ficha) => f.precoVenda - custoFicha(f);

// CMV saudável em restaurante costuma ficar entre 25% e 35%.
const corCmv = (v: number) =>
  v <= 30 ? 'text-[#2DD4A7]' : v <= 38 ? 'text-[#0E86D4]' : 'text-[#FF6B7A]';

export default function FichaTecnica() {
  const [fichas, setFichas] = useState<Ficha[]>(FICHAS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [abertaId, setAbertaId] = useState<number | null>(FICHAS_INICIAIS[0].id);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fichas.filter((f) => !q || f.nome.toLowerCase().includes(q));
  }, [fichas, busca]);

  const aberta = fichas.find((f) => f.id === abertaId) || null;

  const setPreco = (id: number, preco: number) =>
    setFichas((prev) => prev.map((f) => (f.id === id ? { ...f, precoVenda: preco } : f)));

  const removerInsumo = (fichaId: number, insumoId: number) =>
    setFichas((prev) =>
      prev.map((f) =>
        f.id === fichaId ? { ...f, insumos: f.insumos.filter((i) => i.id !== insumoId) } : f,
      ),
    );

  const resumo = useMemo(() => {
    const cmvMedio = fichas.length ? fichas.reduce((s, f) => s + cmv(f), 0) / fichas.length : 0;
    return { total: fichas.length, cmvMedio };
  }, [fichas]);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Fichas Técnicas</h1>
            <p className="text-[11px] text-[#8A90A0]">
              {resumo.total} produtos produzidos · CMV médio {pct(resumo.cmvMedio)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#8A90A0] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar prato"
              className="w-40 text-xs rounded-lg pl-8 pr-2 py-2 text-[#8A90A0] bg-[#0C0D10] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50"
            />
          </div>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors">
            <Plus className="h-3.5 w-3.5" /> Nova ficha
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Lista de fichas */}
        <div className="w-full sm:w-[340px] shrink-0 border-r border-[#23262F] overflow-auto bg-[#0C0D10]">
          {visiveis.map((f) => {
            const ativo = f.id === abertaId;
            const c = cmv(f);
            return (
              <button
                key={f.id}
                onClick={() => setAbertaId(f.id)}
                className={`w-full text-left px-4 py-3 border-b border-[#23262F] transition-colors ${
                  ativo ? 'bg-[#01B8FA]/[0.06] border-l-2 border-l-[#01B8FA]' : 'hover:bg-[#101216] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[#F7F8FA] text-sm truncate">{f.nome}</p>
                  <span className={`text-[11px] font-bold shrink-0 ${corCmv(c)}`}>{pct(c)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#8A90A0]">
                  <span>{f.insumos.length} insumos</span>
                  <span>custo {brl(custoFicha(f))}</span>
                </div>
              </button>
            );
          })}
          {visiveis.length === 0 && (
            <p className="text-center py-12 text-sm text-[#8A90A0]">Nenhuma ficha.</p>
          )}
        </div>

        {/* Detalhe da ficha */}
        <div className="flex-1 overflow-auto p-5 hidden sm:block">
          {aberta ? <DetalheFicha ficha={aberta} onPreco={setPreco} onRemover={removerInsumo} /> : (
            <div className="h-full flex items-center justify-center text-[#8A90A0] text-sm">
              Selecione uma ficha à esquerda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetalheFicha({
  ficha, onPreco, onRemover,
}: {
  ficha: Ficha;
  onPreco: (id: number, preco: number) => void;
  onRemover: (fichaId: number, insumoId: number) => void;
}) {
  const custo = custoFicha(ficha);
  const c = cmv(ficha);
  const m = margem(ficha);

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#F7F8FA]">{ficha.nome}</h2>
          <p className="text-[12px] text-[#8A90A0] flex items-center gap-1 mt-0.5">
            <Scale className="h-3.5 w-3.5" /> Rende {ficha.rendimento}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <KpiFicha icon={DollarSign} titulo="Custo do prato" valor={brl(custo)} cor="text-[#F7F8FA]" />
        <KpiFicha icon={TrendingUp} titulo="Preço de venda" valor={brl(ficha.precoVenda)} cor="text-[#01B8FA]" />
        <KpiFicha icon={Percent} titulo="CMV" valor={pct(c)} cor={corCmv(c)} />
        <KpiFicha icon={TrendingUp} titulo="Margem (R$)" valor={brl(m)} cor={m > 0 ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]'} />
      </div>

      {/* Preço editável */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3">
        <label className="text-[12px] text-[#8A90A0] font-medium">Preço de venda</label>
        <div className="flex items-center gap-1">
          <span className="text-[#8A90A0] text-sm">R$</span>
          <input
            type="number"
            step="0.10"
            value={ficha.precoVenda}
            onChange={(e) => onPreco(ficha.id, Number(e.target.value) || 0)}
            className="w-24 text-sm font-bold rounded-lg px-2 py-1.5 text-[#F7F8FA] bg-[#101216] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50"
          />
        </div>
        <p className="text-[11px] text-[#8A90A0] ml-auto">
          Ajuste o preço e veja CMV e margem mudarem na hora.
        </p>
      </div>

      {/* Insumos */}
      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">Insumos da ficha</h3>
        <div className="rounded-xl border border-[#23262F] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#0C0D10] text-[#8A90A0]">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Insumo</th>
                <th className="text-right px-3 py-2 font-medium">Qtd</th>
                <th className="text-right px-3 py-2 font-medium">Custo unit.</th>
                <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ficha.insumos.map((i) => (
                <tr key={i.id} className="border-t border-[#23262F] hover:bg-[#0C0D10]">
                  <td className="px-3 py-2 text-[#F7F8FA] font-medium">{i.nome}</td>
                  <td className="px-3 py-2 text-right text-[#8A90A0]">{i.qtd} {i.unidade}</td>
                  <td className="px-3 py-2 text-right text-[#8A90A0]">{brl(i.custoUnit)}/{i.unidade}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#F7F8FA]">{brl(i.qtd * i.custoUnit)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onRemover(ficha.id, i.id)}
                      className="text-[#5E6472] hover:text-[#FF6B7A] transition-colors"
                      title="Remover insumo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {ficha.insumos.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-[#8A90A0]">Sem insumos — adicione para calcular o custo.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#23262F] bg-[#0C0D10] font-bold">
                <td className="px-3 py-2 text-[#8A90A0]" colSpan={3}>Custo total do prato</td>
                <td className="px-3 py-2 text-right text-[#F7F8FA]">{brl(custo)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <button className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed border-[#01B8FA]/40 text-[#01B8FA] hover:bg-[#01B8FA]/[0.06] transition-colors">
          <Plus className="h-3.5 w-3.5" /> Adicionar insumo
        </button>
      </div>
    </div>
  );
}

function KpiFicha({
  icon: Icon, titulo, valor, cor,
}: { icon: React.ElementType; titulo: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl border border-[#23262F] bg-[#101216] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-[#8A90A0] uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </div>
      <p className={`text-lg font-black mt-1 ${cor}`}>{valor}</p>
    </div>
  );
}
