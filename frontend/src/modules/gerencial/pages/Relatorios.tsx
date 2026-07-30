import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Download, TrendingUp, Package, Trophy, Scale, Loader2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../../components/ui/feedback';
import { relatoriosApi } from '../../../services/api';

type Aba = 'abc' | 'giro' | 'ranking' | 'aging';

const brl = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: any, d = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: any) => `${(Number(v) || 0).toFixed(1)}%`;

function isoHoje() {
  return new Date().toISOString().slice(0, 10);
}
function isoMenos(dias: number) {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

// Exporta um array de objetos para CSV (separador ; para o Excel pt-BR).
function exportarCSV(nome: string, colunas: { chave: string; titulo: string }[], linhas: any[]) {
  if (!linhas.length) {
    toast('Nada para exportar.', 'info');
    return;
  }
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = colunas.map((c) => esc(c.titulo)).join(';');
  const corpo = linhas
    .map((l) => colunas.map((c) => esc(l[c.chave])).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + head + '\n' + corpo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}-${isoHoje()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'abc', label: 'Curva ABC', icon: TrendingUp },
  { id: 'giro', label: 'Giro de Estoque', icon: Package },
  { id: 'ranking', label: 'Rankings', icon: Trophy },
  { id: 'aging', label: 'Aging Financeiro', icon: Scale },
];

export default function Relatorios() {
  const { filialAtiva } = useAuth();
  const [aba, setAba] = useState<Aba>('abc');
  const [de, setDe] = useState(isoMenos(30));
  const [ate, setAte] = useState(isoHoje());
  const [loading, setLoading] = useState(false);

  const [abcTipo, setAbcTipo] = useState<'produto' | 'cliente'>('produto');
  const [abc, setAbc] = useState<any>(null);
  const [giro, setGiro] = useState<any>(null);
  const [rankTipo, setRankTipo] = useState<'vendedor' | 'cliente' | 'produto'>('vendedor');
  const [ranking, setRanking] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);

  const filialId = filialAtiva?.id;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (aba === 'abc') {
        const r = await relatoriosApi.curvaABC({ tipo: abcTipo, de, ate, filialId });
        setAbc(r.data);
      } else if (aba === 'giro') {
        const r = await relatoriosApi.giroEstoque({ de, ate, filialId });
        setGiro(r.data);
      } else if (aba === 'ranking') {
        const r = await relatoriosApi.ranking({ tipo: rankTipo, de, ate, filialId });
        setRanking(r.data);
      } else {
        const r = await relatoriosApi.agingFinanceiro({ filialId });
        setAging(r.data);
      }
    } catch {
      toast('Falha ao carregar o relatório.', 'error');
    } finally {
      setLoading(false);
    }
  }, [aba, abcTipo, rankTipo, de, ate, filialId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-sky-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Relatórios Gerenciais</h1>
            <p className="text-[11px] text-slate-500">Curva ABC, giro, rankings e posição financeira</p>
          </div>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ABAS.map((a) => {
          const Icon = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                ativo
                  ? 'bg-sky-400/[0.14] border-sky-400/30 text-sky-200'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {a.label}
            </button>
          );
        })}
      </div>

      {/* Filtros de período (ABC, giro e ranking usam; aging é posição atual) */}
      {aba !== 'aging' && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <label className="text-[10px] text-slate-500">
            De
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="block mt-1 text-xs rounded-lg px-2 py-1.5 text-slate-200 bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-sky-400/50"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Até
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="block mt-1 text-xs rounded-lg px-2 py-1.5 text-slate-200 bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-sky-400/50"
            />
          </label>
          {aba === 'abc' && (
            <label className="text-[10px] text-slate-500">
              Dimensão
              <select
                value={abcTipo}
                onChange={(e) => setAbcTipo(e.target.value as any)}
                className="block mt-1 text-xs rounded-lg px-2 py-1.5 text-slate-200 bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-sky-400/50"
              >
                <option value="produto">Por produto</option>
                <option value="cliente">Por cliente</option>
              </select>
            </label>
          )}
          {aba === 'ranking' && (
            <label className="text-[10px] text-slate-500">
              Ranking de
              <select
                value={rankTipo}
                onChange={(e) => setRankTipo(e.target.value as any)}
                className="block mt-1 text-xs rounded-lg px-2 py-1.5 text-slate-200 bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-sky-400/50"
              >
                <option value="vendedor">Vendedores</option>
                <option value="cliente">Clientes</option>
                <option value="produto">Produtos</option>
              </select>
            </label>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {aba === 'abc' && <PainelABC dados={abc} tipo={abcTipo} />}
          {aba === 'giro' && <PainelGiro dados={giro} />}
          {aba === 'ranking' && <PainelRanking dados={ranking} tipo={rankTipo} />}
          {aba === 'aging' && <PainelAging dados={aging} />}
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{titulo}</p>
      <p className={`text-base font-bold mt-0.5 ${cor || 'text-white'}`}>{valor}</p>
    </div>
  );
}

const CLASSE_COR: Record<string, string> = {
  A: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25',
  B: 'text-amber-300 bg-amber-500/15 border-amber-400/25',
  C: 'text-slate-400 bg-white/[0.05] border-white/10',
};

function PainelABC({ dados, tipo }: { dados: any; tipo: string }) {
  if (!dados) return null;
  const exportar = () =>
    exportarCSV(
      `curva-abc-${tipo}`,
      [
        { chave: 'posicao', titulo: 'Posição' },
        { chave: 'rotulo', titulo: tipo === 'produto' ? 'Produto' : 'Cliente' },
        { chave: 'quantidade', titulo: 'Quantidade' },
        { chave: 'valor', titulo: 'Faturamento' },
        { chave: 'percentual', titulo: '% do total' },
        { chave: 'percentualAcumulado', titulo: '% acumulado' },
        { chave: 'classe', titulo: 'Classe' },
      ],
      dados.itens,
    );
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Kpi titulo="Faturamento total" valor={brl(dados.total)} cor="text-sky-300" />
        <Kpi titulo="Classe A" valor={`${dados.resumo.A.itens} • ${brl(dados.resumo.A.valor)}`} cor="text-emerald-300" />
        <Kpi titulo="Classe B" valor={`${dados.resumo.B.itens} • ${brl(dados.resumo.B.valor)}`} cor="text-amber-300" />
        <Kpi titulo="Classe C" valor={`${dados.resumo.C.itens} • ${brl(dados.resumo.C.valor)}`} cor="text-slate-300" />
      </div>
      <BotaoExportar onClick={exportar} />
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.03] text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">{tipo === 'produto' ? 'Produto' : 'Cliente'}</th>
              <th className="text-right px-3 py-2 font-medium">Qtd</th>
              <th className="text-right px-3 py-2 font-medium">Faturamento</th>
              <th className="text-right px-3 py-2 font-medium">% total</th>
              <th className="text-right px-3 py-2 font-medium">% acum.</th>
              <th className="text-center px-3 py-2 font-medium">Classe</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((i: any) => (
              <tr key={i.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-slate-500">{i.posicao}</td>
                <td className="px-3 py-1.5 text-slate-200 truncate max-w-[280px]">{i.rotulo}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{num(i.quantidade, 2)}</td>
                <td className="px-3 py-1.5 text-right text-slate-200">{brl(i.valor)}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{pct(i.percentual)}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{pct(i.percentualAcumulado)}</td>
                <td className="px-3 py-1.5 text-center">
                  <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${CLASSE_COR[i.classe]}`}>
                    {i.classe}
                  </span>
                </td>
              </tr>
            ))}
            {dados.itens.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-600">Sem vendas no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PainelGiro({ dados }: { dados: any }) {
  if (!dados) return null;
  const exportar = () =>
    exportarCSV(
      'giro-estoque',
      [
        { chave: 'rotulo', titulo: 'Produto' },
        { chave: 'consumo', titulo: 'Consumo (período)' },
        { chave: 'saldoAtual', titulo: 'Saldo atual' },
        { chave: 'giroAnualizado', titulo: 'Giro anualizado' },
        { chave: 'coberturaDias', titulo: 'Cobertura (dias)' },
        { chave: 'parado', titulo: 'Parado' },
      ],
      dados.itens.map((i: any) => ({ ...i, parado: i.parado ? 'Sim' : 'Não', coberturaDias: i.coberturaDias ?? '∞' })),
    );
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Kpi titulo="Itens analisados" valor={num(dados.resumo.totalItens)} />
        <Kpi titulo="Itens parados" valor={num(dados.resumo.parados)} cor="text-rose-300" />
        <Kpi titulo="Período (dias)" valor={num(dados.dias)} />
      </div>
      <BotaoExportar onClick={exportar} />
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.03] text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Produto</th>
              <th className="text-right px-3 py-2 font-medium">Consumo</th>
              <th className="text-right px-3 py-2 font-medium">Saldo</th>
              <th className="text-right px-3 py-2 font-medium">Giro anual</th>
              <th className="text-right px-3 py-2 font-medium">Cobertura</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((i: any) => (
              <tr key={i.produtoId} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-slate-200 truncate max-w-[280px]">{i.rotulo}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{num(i.consumo, 2)}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{num(i.saldoAtual, 2)}</td>
                <td className="px-3 py-1.5 text-right text-slate-200">{num(i.giroAnualizado, 2)}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">{i.coberturaDias === null ? '∞' : `${i.coberturaDias} d`}</td>
                <td className="px-3 py-1.5 text-center">
                  {i.parado ? (
                    <span className="inline-block px-1.5 py-0.5 rounded border border-rose-400/25 bg-rose-500/15 text-rose-300 text-[10px] font-bold">Parado</span>
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded border border-emerald-400/25 bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">Ativo</span>
                  )}
                </td>
              </tr>
            ))}
            {dados.itens.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-600">Sem dados de estoque.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PainelRanking({ dados, tipo }: { dados: any; tipo: string }) {
  if (!dados) return null;
  const temTicket = tipo !== 'produto';
  const exportar = () =>
    exportarCSV(
      `ranking-${tipo}`,
      [
        { chave: 'posicao', titulo: 'Posição' },
        { chave: 'rotulo', titulo: tipo },
        { chave: 'valor', titulo: 'Faturamento' },
        ...(temTicket
          ? [{ chave: 'pedidos', titulo: 'Pedidos' }, { chave: 'ticketMedio', titulo: 'Ticket médio' }]
          : [{ chave: 'quantidade', titulo: 'Quantidade' }]),
      ],
      dados.itens.map((i: any, idx: number) => ({ posicao: i.posicao ?? idx + 1, ...i })),
    );
  return (
    <div>
      <BotaoExportar onClick={exportar} />
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.03] text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium capitalize">{tipo}</th>
              <th className="text-right px-3 py-2 font-medium">Faturamento</th>
              {temTicket ? (
                <>
                  <th className="text-right px-3 py-2 font-medium">Pedidos</th>
                  <th className="text-right px-3 py-2 font-medium">Ticket médio</th>
                </>
              ) : (
                <th className="text-right px-3 py-2 font-medium">Quantidade</th>
              )}
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((i: any, idx: number) => (
              <tr key={i.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-slate-500">{i.posicao ?? idx + 1}</td>
                <td className="px-3 py-1.5 text-slate-200 truncate max-w-[280px]">{i.rotulo}</td>
                <td className="px-3 py-1.5 text-right text-slate-200">{brl(i.valor)}</td>
                {temTicket ? (
                  <>
                    <td className="px-3 py-1.5 text-right text-slate-400">{num(i.pedidos)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-400">{brl(i.ticketMedio)}</td>
                  </>
                ) : (
                  <td className="px-3 py-1.5 text-right text-slate-400">{num(i.quantidade, 2)}</td>
                )}
              </tr>
            ))}
            {dados.itens.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-600">Sem vendas no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PainelAging({ dados }: { dados: any }) {
  if (!dados) return null;
  const faixas = [
    { chave: 'aVencer', label: 'A vencer' },
    { chave: 'd1_30', label: '1–30 dias' },
    { chave: 'd31_60', label: '31–60 dias' },
    { chave: 'd61_90', label: '61–90 dias' },
    { chave: 'd90mais', label: '90+ dias' },
  ];
  const exportar = () =>
    exportarCSV(
      'aging-financeiro',
      [{ chave: 'faixa', titulo: 'Faixa' }, { chave: 'receber', titulo: 'A receber' }, { chave: 'pagar', titulo: 'A pagar' }],
      [
        ...faixas.map((f) => ({ faixa: f.label, receber: dados.aReceber[f.chave], pagar: dados.aPagar[f.chave] })),
        { faixa: 'TOTAL', receber: dados.aReceber.total, pagar: dados.aPagar.total },
      ],
    );
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Kpi titulo="Total a receber" valor={brl(dados.aReceber.total)} cor="text-emerald-300" />
        <Kpi titulo="Total a pagar" valor={brl(dados.aPagar.total)} cor="text-rose-300" />
        <Kpi titulo="Saldo líquido" valor={brl(dados.saldoLiquido)} cor={dados.saldoLiquido >= 0 ? 'text-sky-300' : 'text-rose-300'} />
      </div>
      <BotaoExportar onClick={exportar} />
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.03] text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Faixa de vencimento</th>
              <th className="text-right px-3 py-2 font-medium">A receber</th>
              <th className="text-right px-3 py-2 font-medium">A pagar</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f) => (
              <tr key={f.chave} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-slate-300">{f.label}</td>
                <td className="px-3 py-1.5 text-right text-emerald-300/90">{brl(dados.aReceber[f.chave])}</td>
                <td className="px-3 py-1.5 text-right text-rose-300/90">{brl(dados.aPagar[f.chave])}</td>
              </tr>
            ))}
            <tr className="border-t border-white/10 font-bold bg-white/[0.02]">
              <td className="px-3 py-2 text-slate-200">Total</td>
              <td className="px-3 py-2 text-right text-emerald-300">{brl(dados.aReceber.total)}</td>
              <td className="px-3 py-2 text-right text-rose-300">{brl(dados.aPagar.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BotaoExportar({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end mb-2">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/[0.12] border border-emerald-400/25 text-emerald-200 hover:bg-emerald-500/[0.2] transition-all"
      >
        <Download className="h-3.5 w-3.5" /> Exportar CSV
      </button>
    </div>
  );
}
