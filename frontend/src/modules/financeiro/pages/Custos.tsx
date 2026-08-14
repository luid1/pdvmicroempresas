import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, CalendarRange, Coins, FileSpreadsheet, Percent,
  RefreshCw, Search, TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { custosApi } from '../../../services/api';
import { PageHeader } from '../../cadastros/ui';

const moeda = (valor: number) => (Number(valor) || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});
const numero = (valor: number) => (Number(valor) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const percentual = (valor: number) => `${(Number(valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => {
  const data = new Date();
  data.setDate(1);
  return data.toISOString().slice(0, 10);
};

interface ProdutoMargem {
  produtoId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  qtdVendida: number;
  precoMedioVenda: number;
  custoComposto: number;
  aquisicao: number;
  frete: number;
  chapa: number;
  receita: number;
  custoTotal: number;
  lucroBruto: number;
  margemPct: number;
}

interface MargemResposta {
  kpis: { cmv: number; receitaTotal: number; perdas: number; lucroBruto: number; margemMediaPct: number };
  produtos: ProdutoMargem[];
}

interface ProdutoCliente {
  codigo: string;
  descricao: string;
  qtd: number;
  venda: number;
  cmv: number;
  lucroBruto: number;
  margemPct: number;
}

interface ClienteRentabilidade {
  clienteId: string;
  nome: string;
  receita: number;
  custos: number;
  resultado: number;
  margemPct: number;
  peso: number;
  produtos: ProdutoCliente[];
}

interface RentabilidadeResposta {
  clientes: ClienteRentabilidade[];
  totais: { receita: number; custos: number; resultado: number; peso: number; clientes: number; produtos: number; margemPct: number };
}

interface ProdutoComposicao {
  produtoId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  estoqueKg: number;
  precoVenda: number;
  kgPorUn: number;
  aquisicao: number;
  frete: number;
  chapa: number;
  composto: number;
  margem: number;
}

interface ComposicaoResposta {
  freteKg: number;
  chapaCaixa: number;
  produtos: ProdutoComposicao[];
}

type Aba = 'margem' | 'rentabilidade' | 'composicao';

function baixarCsv(nome: string, cabecalho: string[], linhas: Array<Array<string | number>>) {
  const escapar = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`;
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${nome}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Custos() {
  const { filialAtiva } = useAuth();
  const [aba, setAba] = useState<Aba>('margem');
  const [dataIni, setDataIni] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [margem, setMargem] = useState<MargemResposta | null>(null);
  const [rentabilidade, setRentabilidade] = useState<RentabilidadeResposta | null>(null);
  const [composicao, setComposicao] = useState<ComposicaoResposta | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!filialAtiva?.id) return;
    setLoading(true);
    setErro('');
    try {
      const params = { dataIni, dataFim };
      const [margemResp, rentabilidadeResp, composicaoResp] = await Promise.all([
        custosApi.margem(filialAtiva.id, params),
        custosApi.rentabilidade(filialAtiva.id, params),
        custosApi.composicao(filialAtiva.id),
      ]);
      setMargem(margemResp.data);
      setRentabilidade(rentabilidadeResp.data);
      setComposicao(composicaoResp.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível carregar os dados de custos.');
    } finally {
      setLoading(false);
    }
  }, [filialAtiva?.id, dataIni, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const produtosMargem = useMemo(() => (margem?.produtos || []).filter((p) =>
    !termo || p.codigo.toLocaleLowerCase('pt-BR').includes(termo) || p.descricao.toLocaleLowerCase('pt-BR').includes(termo)
  ), [margem?.produtos, termo]);
  const clientes = useMemo(() => (rentabilidade?.clientes || []).filter((c) =>
    !termo || c.nome.toLocaleLowerCase('pt-BR').includes(termo)
  ), [rentabilidade?.clientes, termo]);
  const produtosComposicao = useMemo(() => (composicao?.produtos || []).filter((p) =>
    !termo || p.codigo.toLocaleLowerCase('pt-BR').includes(termo) || p.descricao.toLocaleLowerCase('pt-BR').includes(termo)
  ), [composicao?.produtos, termo]);

  const exportar = () => {
    if (aba === 'margem') {
      baixarCsv('custos_margem_produtos', ['Código', 'Produto', 'Unidade', 'Qtd. vendida', 'Receita', 'CMV', 'Lucro bruto', 'Margem'],
        produtosMargem.map((p) => [p.codigo, p.descricao, p.unidade, p.qtdVendida, p.receita, p.custoTotal, p.lucroBruto, p.margemPct]));
    } else if (aba === 'rentabilidade') {
      baixarCsv('rentabilidade_clientes', ['Cliente', 'Receita', 'Custos', 'Resultado', 'Margem', 'Peso kg', 'Produtos'],
        clientes.map((c) => [c.nome, c.receita, c.custos, c.resultado, c.margemPct, c.peso, c.produtos.length]));
    } else {
      baixarCsv('composicao_custos', ['Código', 'Produto', 'Unidade', 'Aquisição', 'Frete', 'Chapa', 'Custo composto', 'Preço de venda', 'Margem'],
        produtosComposicao.map((p) => [p.codigo, p.descricao, p.unidade, p.aquisicao, p.frete, p.chapa, p.composto, p.precoVenda, p.margem]));
    }
  };

  const kpis = margem?.kpis;

  return (
    <div className="flex h-full flex-col text-[#202123]">
      <PageHeader
        icon={<Coins className="h-4 w-4" />}
        titulo="Custos & Margem"
        subtitulo="Dados calculados a partir de estoque, movimentações e NF-e emitidas"
        actions={<>
          <label className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#5F6065]">
            De <input type="date" value={dataIni} max={dataFim} onChange={(e) => setDataIni(e.target.value)} className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs" />
          </label>
          <label className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#5F6065]">
            Até <input type="date" value={dataFim} min={dataIni} onChange={(e) => setDataFim(e.target.value)} className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs" />
          </label>
          <button onClick={exportar} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" /> Exportar</button>
          <button onClick={carregar} disabled={loading} className="btn-primary">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </>}
      />

      <div className="border-b border-[#E5E7EB] bg-white px-5 py-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-[#F3F4F6] p-1">
          {([
            ['margem', 'Margem por produto', Percent],
            ['rentabilidade', 'Rentabilidade por cliente', Users],
            ['composicao', 'Composição do custo', Calculator],
          ] as const).map(([chave, rotulo, Icon]) => (
            <button key={chave} onClick={() => setAba(chave)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${aba === chave ? 'bg-white text-[#0B6F5C] shadow-sm' : 'text-[#5F6065] hover:text-[#202123]'}`}>
              <Icon className="h-3.5 w-3.5" /> {rotulo}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[230px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8F94]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou cliente..." className="input py-1.5 pl-9" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {!filialAtiva && <Estado texto="Selecione uma filial para consultar custos e margens." />}
        {erro && <div className="rounded-xl border border-[#E0483D]/25 bg-[#E0483D]/[0.08] px-4 py-3 text-sm text-[#c3352b]">{erro}</div>}

        {filialAtiva && aba === 'margem' && <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Receita faturada" valor={moeda(kpis?.receitaTotal || 0)} icon={<TrendingUp />} />
            <Kpi label="CMV" valor={moeda(kpis?.cmv || 0)} icon={<Coins />} />
            <Kpi label="Lucro bruto" valor={moeda(kpis?.lucroBruto || 0)} icon={<TrendingUp />} positivo={(kpis?.lucroBruto || 0) >= 0} />
            <Kpi label="Margem média" valor={percentual(kpis?.margemMediaPct || 0)} icon={<Percent />} positivo={(kpis?.margemMediaPct || 0) >= 0} />
            <Kpi label="Perdas" valor={moeda(kpis?.perdas || 0)} icon={<TrendingDown />} alerta={(kpis?.perdas || 0) > 0} />
          </div>
          <Tabela cabecalhos={['Produto', 'Qtd. vendida', 'Preço médio', 'Custo composto', 'Receita', 'CMV', 'Lucro bruto', 'Margem']} vazio={!loading && produtosMargem.length === 0}>
            {produtosMargem.map((p) => <tr key={p.produtoId}>
              <Td><span className="font-mono text-[10px] text-[#8E8F94]">{p.codigo}</span><br />{p.descricao}</Td>
              <Td direita>{numero(p.qtdVendida)} {p.unidade}</Td><Td direita>{moeda(p.precoMedioVenda)}</Td><Td direita>{moeda(p.custoComposto)}</Td>
              <Td direita>{moeda(p.receita)}</Td><Td direita>{moeda(p.custoTotal)}</Td>
              <Td direita classe={p.lucroBruto < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}>{moeda(p.lucroBruto)}</Td>
              <Td direita classe={p.margemPct < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}>{percentual(p.margemPct)}</Td>
            </tr>)}
          </Tabela>
        </>}

        {filialAtiva && aba === 'rentabilidade' && <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Clientes no período" valor={numero(rentabilidade?.totais.clientes || 0)} icon={<Users />} />
            <Kpi label="Receita" valor={moeda(rentabilidade?.totais.receita || 0)} icon={<TrendingUp />} />
            <Kpi label="Resultado" valor={moeda(rentabilidade?.totais.resultado || 0)} icon={<Coins />} positivo={(rentabilidade?.totais.resultado || 0) >= 0} />
            <Kpi label="Margem" valor={percentual(rentabilidade?.totais.margemPct || 0)} icon={<Percent />} positivo={(rentabilidade?.totais.margemPct || 0) >= 0} />
          </div>
          <Tabela cabecalhos={['Cliente', 'Produtos', 'Peso', 'Receita', 'Custos', 'Resultado', 'Margem']} vazio={!loading && clientes.length === 0}>
            {clientes.map((c) => <tr key={c.clienteId}>
              <Td>{c.nome}</Td><Td direita>{c.produtos.length}</Td><Td direita>{numero(c.peso)} kg</Td>
              <Td direita>{moeda(c.receita)}</Td><Td direita>{moeda(c.custos)}</Td>
              <Td direita classe={c.resultado < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}>{moeda(c.resultado)}</Td>
              <Td direita classe={c.margemPct < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}>{percentual(c.margemPct)}</Td>
            </tr>)}
          </Tabela>
        </>}

        {filialAtiva && aba === 'composicao' && <>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-4 py-3 text-xs text-[#5F6065] flex gap-6">
            <span>Frete operacional/kg: <strong className="text-[#202123]">{moeda(composicao?.freteKg || 0)}</strong></span>
            <span>Chapa por caixa: <strong className="text-[#202123]">{moeda(composicao?.chapaCaixa || 0)}</strong></span>
          </div>
          <Tabela cabecalhos={['Produto', 'Unidade', 'Aquisição', 'Frete', 'Chapa', 'Custo composto', 'Preço de venda', 'Margem']} vazio={!loading && produtosComposicao.length === 0}>
            {produtosComposicao.map((p) => <tr key={p.produtoId}>
              <Td><span className="font-mono text-[10px] text-[#8E8F94]">{p.codigo}</span><br />{p.descricao}</Td><Td>{p.unidade}</Td>
              <Td direita>{moeda(p.aquisicao)}</Td><Td direita>{moeda(p.frete)}</Td><Td direita>{moeda(p.chapa)}</Td>
              <Td direita classe="font-semibold">{moeda(p.composto)}</Td><Td direita>{moeda(p.precoVenda)}</Td>
              <Td direita classe={p.margem < 0 ? 'text-[#c3352b]' : 'text-[#0b7d4e]'}>{percentual(p.margem)}</Td>
            </tr>)}
          </Tabela>
        </>}
      </div>
    </div>
  );
}

function Kpi({ label, valor, icon, positivo, alerta }: { label: string; valor: string; icon: React.ReactNode; positivo?: boolean; alerta?: boolean }) {
  const cor = alerta ? 'text-[#A15C07] bg-[#D97706]/10' : positivo === false ? 'text-[#c3352b] bg-[#E0483D]/10' : 'text-[#0B6F5C] bg-[#0F8A72]/10';
  return <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(31,31,31,0.04)]">
    <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${cor}`}>{icon}</div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8E8F94]">{label}</p>
    <p className="font-num mt-1 truncate text-xl font-bold text-[#202123]">{valor}</p>
  </div>;
}

function Tabela({ cabecalhos, children, vazio }: { cabecalhos: string[]; children: React.ReactNode; vazio: boolean }) {
  return <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(31,31,31,0.04)]">
    <table className="w-full min-w-[900px] text-[12px]">
      <thead className="bg-[#F3F4F6]"><tr>{cabecalhos.map((c, i) => <th key={c} className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#8E8F94] ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#E5E7EB]">{children}</tbody>
    </table>
    {vazio && <Estado texto="Nenhum dado real encontrado para o período e a filial selecionados." />}
  </div>;
}

function Td({ children, direita, classe = '' }: { children: React.ReactNode; direita?: boolean; classe?: string }) {
  return <td className={`px-3 py-2.5 ${direita ? 'text-right font-num' : 'text-left'} ${classe}`}>{children}</td>;
}

function Estado({ texto }: { texto: string }) {
  return <div className="flex min-h-32 items-center justify-center gap-2 px-6 py-10 text-sm text-[#8E8F94]">
    <CalendarRange className="h-5 w-5" /> {texto}
  </div>;
}
