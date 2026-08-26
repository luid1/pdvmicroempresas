import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Printer, Download, X, ChevronRight, AlertTriangle, TrendingDown, BarChart3, SlidersHorizontal, Package, Coins, PackageX, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { PageHeader, SearchField, btnGlass, btnPrimary } from '../../cadastros/ui';

// ─── Tipos ───────────────────────────────────────
interface ProdutoEstoque {
  id: string;
  codigo: string;
  descricao: string;
  familia: string;
  grupo: string;
  saldoInicial: number;
  entradas: number;
  chao?: number;
  ordensCompra: number;
  quebra?: number;
  quebraReal?: number; // já baixado no estoque (movimentações AVARIA/PERDA reais)
  saidas: number;
  saldoFinal: number;
  undEstoque: string;
  contagemFisica: number | null;
  diferencaEstoque: number;
  precoCusto: number;
  valorAtualEstoque: number;
}

interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  saldoAnterior: number;
  saldoFinal: number;
  custoUnitario?: number | null;
  dataMovimento: string;
  observacoes?: string | null;
  lote?: { numero: string; dataValidade?: string | null } | null;
  usuario?: { nome: string } | null;
  localizacao?: { rua?: string | null; prateleira?: string | null } | null;
}

// ─── Famílias e Grupos do NewOxxy ────────────────
const FAMILIAS = [
  '<Todas>', 'BCA', 'Chas e Temperos', 'Citricos', 'Congelados',
  'Diversos', 'Embalado', 'Embalagem', 'Flores e Plantas', 'Folhagem',
  'Fruta', 'Legumes', 'Ovos', 'Processados', 'Verdura',
];

const GRUPOS: Record<string, string[]> = {
  '<Todas>': ['<Todas>'],
  'BCA':     ['<Todas>', 'Batatas', 'Cebolas', 'Alhos', 'Raizes'],
  'Fruta':   ['<Todas>', 'Tropical', 'Nacional', 'Importada'],
  'Citricos':['<Todas>', 'Limão', 'Laranja', 'Outros'],
  'Legumes': ['<Todas>', 'Folhosos', 'Raízes', 'Outros'],
  'Verdura': ['<Todas>', 'Folhosas', 'Temperos'],
};

const TIPOS_ITEM = [
  '00-Mercadoria para Revenda',
  '01-Matéria Prima',
  '02-Embalagem',
  '03-Produto em Processo',
  '04-Produto Acabado',
  '05-Subproduto',
  '06-Produto Intermediário',
  '10-Outros Insumos',
];

// ─── Formatação ──────────────────────────────────
const fmtN = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const negClass = (v: number) => v < 0 ? 'text-[#FF6B7A]' : '';
const hoje = () => new Date().toISOString().split('T')[0];

// ─── Exportar CSV ────────────────────────────────
function exportarCSV(produtos: ProdutoEstoque[]) {
  const header = 'Código;Descrição;Família;Saldo Inicial;Entradas;Ordens Compra;Saídas;Saldo Final;Unidade;Contagem;Diferença;Preço Custo;Valor Estoque\n';
  const rows = produtos.map(p =>
    `${p.codigo};${p.descricao};${p.familia};${fmtN(p.saldoInicial)};${fmtN(p.entradas)};${fmtN(p.ordensCompra)};${fmtN(p.saidas)};${fmtN(p.saldoFinal)};${p.undEstoque};${p.contagemFisica ?? ''};${fmtN(p.diferencaEstoque)};${fmtR(p.precoCusto)};${fmtR(p.valorAtualEstoque)}`
  ).join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analise_estoque_${hoje()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Imprimir ────────────────────────────────────
function imprimirRelatorio(produtos: ProdutoEstoque[], dataIni: string, dataFim: string) {
  const html = `<!DOCTYPE html><html><head><title>Movimentação de Estoque</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; }
  .header { text-align: center; margin-bottom: 10px; }
  .header h2 { margin: 0; font-size: 14px; }
  .header p { margin: 2px 0; font-size: 11px; color: #333; }
  .titulo { background: #444; color: white; text-align: center; padding: 6px; font-size: 13px; font-weight: bold; margin: 10px 0; }
  .info { font-size: 10px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #f0f0f0; border: 1px solid #999; padding: 3px 4px; text-align: left; font-weight: bold; }
  td { border: 1px solid #ccc; padding: 2px 4px; }
  .r { text-align: right; font-family: monospace; }
  .neg { color: red; }
  .bold { font-weight: bold; }
  @media print { button { display: none; } }
</style></head><body>
<div class="header">
  <h2>HETROS IMP. E EXP. LTDA</h2>
  <p>AV DOUTOR GASTAO VIDIGAL, SN - PAV HFC BOX 19</p>
  <p>05316-900 - VILA LEOPOLDINA SAO PAULO-SP</p>
</div>
<div class="titulo">Movimentação de Estoque</div>
<div class="info"><strong>1001 - HETROS</strong><br/>Período: ${dataIni} até ${dataFim}</div>
<table>
<thead><tr>
  <th>Produto</th><th>Descrição</th><th>Unidade</th><th>Tipo Prod</th>
  <th>Saldo Inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo Final</th>
</tr></thead><tbody>
${produtos.map(p => `<tr>
  <td>${p.codigo}</td><td>${p.descricao}</td><td>${p.undEstoque}</td><td>${p.familia}</td>
  <td class="r ${p.saldoInicial < 0 ? 'neg' : ''}">${fmtN(p.saldoInicial)}</td>
  <td class="r ${p.entradas < 0 ? 'neg' : ''}">${fmtN(p.entradas)}</td>
  <td class="r ${p.saidas < 0 ? 'neg' : ''}">${fmtN(p.saidas)}</td>
  <td class="r bold ${p.saldoFinal < 0 ? 'neg' : ''}">${fmtN(p.saldoFinal)}</td>
</tr>`).join('')}
</tbody></table>
<p style="margin-top:10px;font-size:9px;color:#666;">Emissão: ${new Date().toLocaleString('pt-BR')} — Registros: ${produtos.length}</p>
<script>window.print();</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Componente principal ────────────────────────
export default function AnaliseEstoqueFisico() {
  const { filialAtiva } = useAuth();

  // Filtros
  const [aRepor, setARepor] = useState<any[]>([]);
  useEffect(() => {
    if (!filialAtiva) return;
    api.get(`/estoque/${filialAtiva.id}/a-comprar`).then(r => setARepor(r.data)).catch(() => setARepor([]));
  }, [filialAtiva?.id]);

  const [dataIni, setDataIni]       = useState(hoje());
  const [dataFim, setDataFim]       = useState(hoje());
  const [tipoItem, setTipoItem]     = useState('00-Mercadoria para Revenda');
  const [familia, setFamilia]       = useState('<Todas>');
  const [grupo, setGrupo]           = useState('<Todas>');
  const [cd, setCd]                 = useState('1 - HETROS');
  const [undApuracao, setUndApuracao] = useState('Estoque');
  const [confFisica, setConfFisica] = useState(false);
  const [semOrdCompra, setSemOrdCompra] = useState(false);
  const [busca, setBusca]           = useState('');

  // UI do redesenho
  const [editCell, setEditCell]       = useState<{ id: string; campo: string } | null>(null);
  const [filtrosAberto, setFiltros]   = useState(false);
  const [drawerRepor, setDrawerRepor] = useState(false);

  // Estado da grade
  const [produtos, setProdutos]       = useState<ProdutoEstoque[]>([]);
  const [executado, setExecutado]     = useState(false);
  const [processando, setProcessando] = useState(false);
  const [prodProcessando, setProdProcessando] = useState('');

  // Seleção e detalhe
  const [selId, setSelId]               = useState<string | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<ProdutoEstoque | null>(null);
  const [movimentacoesDetalhe, setMovimentacoesDetalhe] = useState<Movimentacao[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState('');

  // O detalhe usa o mesmo extrato real da tela de Movimentações, filtrado pelo
  // produto e período selecionados. Não reutiliza mais registros demonstrativos.
  useEffect(() => {
    if (!filialAtiva || !detalheAberto) {
      setMovimentacoesDetalhe([]);
      setErroDetalhe('');
      return;
    }

    let ativo = true;
    setCarregandoDetalhe(true);
    setErroDetalhe('');
    api.get(`/estoque/${filialAtiva.id}/movimentacoes`, {
      params: {
        produtoId: detalheAberto.id,
        dataInicio: dataIni,
        dataFim: `${dataFim}T23:59:59`,
      },
    })
      .then((res) => { if (ativo) setMovimentacoesDetalhe(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {
        if (ativo) {
          setMovimentacoesDetalhe([]);
          setErroDetalhe('Não foi possível carregar o histórico real deste produto.');
        }
      })
      .finally(() => { if (ativo) setCarregandoDetalhe(false); });

    return () => { ativo = false; };
  }, [filialAtiva?.id, detalheAberto?.id, dataIni, dataFim]);

  // Grupos disponíveis para a família selecionada
  const gruposDisponiveis = useMemo(() =>
    GRUPOS[familia] || ['<Todas>'],
  [familia]);

  // Reset grupo ao trocar família
  const handleFamiliaChange = (f: string) => {
    setFamilia(f);
    setGrupo('<Todas>');
  };

  // ── Persistência dos valores editados (localStorage) ────────
  const EDITS_KEY = 'hetros_analise_estoque_edits';
  const loadEdits = (): Record<string, any> => { try { return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}'); } catch { return {}; } };
  const saveEdit = (id: string, patch: Record<string, any>) => {
    const all = loadEdits(); all[id] = { ...(all[id] || {}), ...patch };
    localStorage.setItem(EDITS_KEY, JSON.stringify(all));
  };
  // Entrada já inclui a Ordem de Compra → OC não é somada de novo aqui
  const calcSaldo = (p: any) => (p.saldoInicial || 0) + (p.entradas || 0) + (p.chao || 0) - (p.quebra || 0);

  // Mapeia uma linha da API (dados reais) para a linha da tela, aplicando os valores salvos
  const mapLinha = (r: any, edits: Record<string, any>): ProdutoEstoque => {
    const e = edits[r.id] || {};
    // Quebra única: soma o que já foi baixado como PERDA + AVARIA no sistema
    const quebraBase = (r.perdasReal || 0) + (r.quebraReal || 0);
    const base = {
      entradas: (r.entradas || 0) + (r.ordensCompra || 0), // Entrada já soma a Ordem de Compra
      chao: 0, quebra: quebraBase,
      contagemFisica: null as number | null, ...e,
      saldoInicial: r.saldoInicial,     // sempre do sistema (não editável)
      ordensCompra: r.ordensCompra || 0, // informativo (não editável), já incluso na Entrada
    };
    const saldoFinal = calcSaldo(base);
    return {
      id: r.id, codigo: r.codigo, descricao: r.descricao, familia: r.familia, grupo: r.grupo, undEstoque: r.undEstoque,
      saldoInicial: base.saldoInicial, entradas: base.entradas, chao: base.chao || 0, ordensCompra: base.ordensCompra,
      quebra: base.quebra || 0,
      quebraReal: quebraBase, // baseline já baixado (PERDA + AVARIA)
      saidas: r.saidas, saldoFinal,
      precoCusto: r.precoCusto, valorAtualEstoque: saldoFinal * (r.precoCusto || 0),
      contagemFisica: base.contagemFisica ?? null,
      diferencaEstoque: base.contagemFisica != null ? (base.contagemFisica as number) - saldoFinal : 0,
    };
  };

  // ── Executar: busca os dados REAIS do backend ────────
  const handleExecutar = async (comAnimacao = true) => {
    if (!filialAtiva) return;
    if (comAnimacao) { setProcessando(true); setExecutado(false); setProdutos([]); }
    try {
      const { data } = await api.get(`/estoque/${filialAtiva.id}/analise`, { params: { dataIni, dataFim } });
      const edits = loadEdits();
      const lista = (data as any[])
        .filter(r => (familia === '<Todas>' || r.familia === familia) && (grupo === '<Todas>' || r.grupo === grupo))
        .map(r => mapLinha(r, edits));
      const finish = () => { setProdutos(lista); setProcessando(false); setExecutado(true); setProdProcessando(''); };
      if (comAnimacao) { setProdProcessando(lista[0]?.descricao || '...'); window.setTimeout(finish, 700); }
      else finish();
    } catch { setProcessando(false); setExecutado(true); setProdutos([]); }
  };

  // Carrega automaticamente ao abrir / trocar de filial
  useEffect(() => { handleExecutar(false); }, [filialAtiva?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contagem física: editar valor ──────────────
  const handleContagemChange = (id: string, valor: string) => {
    const num = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    saveEdit(id, { contagemFisica: num });
    setProdutos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const contagem = num;
      const diferenca = contagem !== null ? contagem - p.saldoFinal : 0;
      return { ...p, contagemFisica: contagem, diferencaEstoque: diferenca };
    }));
  };

  // ── Edita um campo e RECALCULA o Saldo Final sozinho ──────────
  // Saldo Final = Saldo Inicial + Entrada + Chão − Quebra
  const setCampo = (id: string, campo: 'entradas' | 'chao' | 'quebra', valor: string) => {
    const v = valor === '' ? 0 : parseFloat(valor.replace(',', '.')) || 0;
    saveEdit(id, { [campo]: v }); // salva pra não perder ao recarregar
    setProdutos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const np = { ...p, [campo]: v };
      const saldoFinal = (np.saldoInicial || 0) + (np.entradas || 0) + (np.chao || 0) - (np.quebra || 0);
      const valorAtualEstoque = saldoFinal * (np.precoCusto || 0);
      const diferencaEstoque = np.contagemFisica !== null ? (np.contagemFisica as number) - saldoFinal : 0;
      return { ...np, saldoFinal, valorAtualEstoque, diferencaEstoque };
    }));
  };
  const cellInp = 'w-full text-right font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#23262F] bg-[#0C0D10] text-[#F7F8FA] focus:outline-none focus:ring-1 focus:ring-[#01B8FA]/40 focus:border-[#01B8FA]/40';

  // Célula editável por clique: mostra o número limpo; vira input só no clique.
  const isEditing = (id: string, campo: string) => editCell?.id === id && editCell?.campo === campo;
  const EditNum = ({ id, campo, valor, commit, placeholder, alerta }: { id: string; campo: string; valor: number | null; commit: (v: string) => void; placeholder?: string; alerta?: boolean }) => {
    if (isEditing(id, campo)) {
      return (
        <input
          autoFocus type="number" step="0.001"
          defaultValue={valor ?? ''}
          placeholder={placeholder}
          onBlur={(e) => { commit(e.target.value); setEditCell(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCell(null); }}
          className="w-full text-right font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#01B8FA]/12 border border-[#01B8FA]/40 text-[#F7F8FA] focus:outline-none focus:ring-1 focus:ring-[#01B8FA]/40"
        />
      );
    }
    const vazio = valor === null || valor === undefined;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditCell({ id, campo }); }}
        className={`w-full text-right font-mono px-1.5 py-0.5 rounded text-[#C7CCD6] hover:bg-[#01B8FA]/12 hover:ring-1 hover:ring-[#01B8FA]/25 transition-all duration-150 ${alerta && (valor || 0) > 0 ? '!text-[#FF9F45] font-semibold' : ''}`}
      >
        {vazio ? <span className="text-slate-600">{placeholder || '—'}</span> : fmtN(valor as number)}
      </button>
    );
  };

  const emFalta = useMemo(() => aRepor.filter((p: any) => p.negativo).length, [aRepor]);

  // ── Faturar quebra: gera a baixa REAL no estoque (AVARIA) ──────
  // "Delta" = o que foi digitado além do que já estava baixado (quebraReal),
  // então clicar de novo não duplica a baixa.
  const deltaQuebra = (p: ProdutoEstoque) => Math.max(0, (p.quebra || 0) - (p.quebraReal || 0));
  // Linhas com quebra ainda não baixada
  const pendentes = useMemo(
    () => produtos.filter(p => deltaQuebra(p) > 0),
    [produtos],
  );
  // Valor perdido a faturar (só o delta pendente) — em R$
  const valorPendente = useMemo(
    () => pendentes.reduce((s, p) => s + deltaQuebra(p) * (p.precoCusto || 0), 0),
    [pendentes],
  );
  const [faturando, setFaturando] = useState(false);

  const handleFaturarQuebra = async () => {
    if (!filialAtiva || pendentes.length === 0) return;
    const qtdTot = pendentes.reduce((s, p) => s + deltaQuebra(p), 0);
    const ok = await confirmDialog(
      `Faturar ${pendentes.length} item(ns) com quebra?\n\n` +
      `Total a baixar: ${fmtN(qtdTot)} · Valor perdido: R$ ${fmtR(valorPendente)}\n\n` +
      `Isso gera a baixa REAL no estoque (AVARIA) e não pode ser desfeito por aqui.`,
      { tone: 'danger', okLabel: 'Faturar quebra' },
    );
    if (!ok) return;
    setFaturando(true);
    try {
      const edits = loadEdits();
      for (const p of pendentes) {
        const dq = deltaQuebra(p);
        if (dq > 0) await api.post('/estoque/ajuste', {
          filialId: filialAtiva.id, produtoId: p.id, tipo: 'AVARIA',
          quantidade: dq, custoUnitario: p.precoCusto || 0, observacoes: 'Análise de Estoque Físico — quebra',
        });
        // Limpa o valor manual salvo: o total real passa a vir do backend (quebraReal)
        if (edits[p.id]) { delete edits[p.id].quebra; delete edits[p.id].perdas; }
      }
      localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
      const perdido = valorPendente;
      await handleExecutar(false); // recarrega com as baixas já refletidas
      toast(`Quebra faturada · valor perdido R$ ${fmtR(perdido)}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Erro ao faturar a quebra', 'error');
    } finally {
      setFaturando(false);
    }
  };

  // Filtrar por busca
  const produtosFiltrados = useMemo(() => {
    if (!busca) return produtos;
    const q = busca.toLowerCase();
    return produtos.filter(p =>
      p.codigo.toLowerCase().includes(q) ||
      p.descricao.toLowerCase().includes(q)
    );
  }, [produtos, busca]);

  // Totais
  const totais = useMemo(() => ({
    count: produtosFiltrados.length,
    saldoFinal: produtosFiltrados.reduce((s, p) => s + p.saldoFinal, 0),
    diferenca:  produtosFiltrados.reduce((s, p) => s + p.diferencaEstoque, 0),
    valorTotal: produtosFiltrados.reduce((s, p) => s + p.valorAtualEstoque, 0),
    // Valor perdido (quebra) × custo — inclui o que já foi baixado e o pendente
    valorPerdido: produtosFiltrados.reduce((s, p) => s + (p.quebra || 0) * (p.precoCusto || 0), 0),
  }), [produtosFiltrados]);

  return (
    <div className="flex flex-col h-full text-xs select-none overflow-hidden">

      <PageHeader
        icon={<BarChart3 className="h-4 w-4" />}
        titulo="Análise de Estoque Físico"
        subtitulo="Contagem, quebra e faturamento de perdas"
        actions={
          <>
            <button onClick={() => handleExecutar()} disabled={processando} className={btnPrimary + ' !bg-[#2DD4A7] hover:!bg-[#26BE95] !text-[#04121A] shadow-[0_6px_18px_rgba(45,212,167,0.28)]'}>
              {processando ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Executar
            </button>
            <button onClick={() => imprimirRelatorio(produtosFiltrados, dataIni, dataFim)} disabled={!executado} className={btnGlass}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </button>
            <button onClick={() => exportarCSV(produtosFiltrados)} disabled={!executado} className={btnGlass}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button
              onClick={handleFaturarQuebra}
              disabled={!executado || faturando || pendentes.length === 0}
              title={pendentes.length === 0 ? 'Digite valores em Quebra para faturar' : `Baixar ${pendentes.length} item(ns) — R$ ${fmtR(valorPendente)} perdido`}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FF6B7A] hover:bg-[#FF8391] text-[#2A0A0F] shadow-[0_6px_18px_rgba(255,107,122,0.28)] transition-all duration-300 active:scale-[0.98] disabled:opacity-30 disabled:bg-[#16181F] disabled:text-slate-500 disabled:shadow-none"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              {faturando ? 'Faturando…' : 'Faturar Quebra'}
              {pendentes.length > 0 && !faturando && <span className="bg-black/25 rounded-full px-1.5 py-0.5 text-[10px] leading-none">{pendentes.length}</span>}
            </button>
          </>
        }
      />

      {/* ── Alerta colapsado: produtos a repor / em falta ── */}
      {aRepor.length > 0 && (
        <div className="bg-[#FF9F45]/[0.06] border-b border-[#FF9F45]/30 px-5 py-1.5 shrink-0 flex items-center gap-2 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 text-[#FF9F45] shrink-0" />
          <span className="text-[#FF9F45] font-semibold">
            {emFalta > 0 && <><span className="text-[#FF6B7A]">{emFalta} em falta</span> · </>}
            {aRepor.length} produto(s) a repor
          </span>
          <button onClick={() => setDrawerRepor(true)} className="ml-auto text-[#FF9F45] hover:text-[#FFB86B] font-semibold underline underline-offset-2 decoration-[#FF9F45]/40">
            Ver lista
          </button>
        </div>
      )}

      {/* ── Corpo ── */}
      <div className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto p-5 gap-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <KpiCard icon={<Package className="h-4 w-4" />} label="Itens" value={String(totais.count)} />
          <KpiCard icon={<Coins className="h-4 w-4" />} label="Valor do Estoque" value={`R$ ${fmtR(totais.valorTotal)}`} accent />
          <KpiCard icon={<PackageX className="h-4 w-4" />} label="Em Falta" value={String(emFalta)} tone={emFalta > 0 ? 'rose' : undefined} />
          <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Perda / Quebra" value={`R$ ${fmtR(totais.valorPerdido)}`} tone={totais.valorPerdido > 0 ? 'amber' : undefined} />
        </div>

        {/* Busca + chips + filtros avançados */}
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchField busca={busca} onBusca={setBusca} placeholder="Filtrar por código ou descrição..." className="sm:max-w-[520px] sm:flex-1" />
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 sm:justify-end sm:overflow-visible sm:pb-0">
            {familia !== '<Todas>' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#01B8FA]/12 px-2.5 py-1 text-xs font-semibold text-[#01B8FA]">{familia}<button onClick={() => handleFamiliaChange('<Todas>')} aria-label="Remover filtro de família"><X className="h-3 w-3" /></button></span>}
            {grupo !== '<Todas>' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#16181F] border border-[#23262F] px-2.5 py-1 text-xs font-semibold text-[#8A90A0]">{grupo}<button onClick={() => setGrupo('<Todas>')} aria-label="Remover filtro de grupo"><X className="h-3 w-3" /></button></span>}
            {confFisica && <span className="shrink-0 rounded-full bg-[#01B8FA]/12 px-2.5 py-1 text-xs font-semibold text-[#01B8FA]">Conferência física</span>}
            <button onClick={() => setFiltros(true)} className={btnGlass + ' ml-auto shrink-0'}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            </button>
          </div>
        </div>

        {/* ── Grade em card de vidro ── */}
        <div className="flex flex-col overflow-hidden bg-[#101216] rounded-2xl border border-[#23262F] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="overflow-x-auto">
        {!executado && !processando ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-slate-700" />
              <p className="text-sm font-medium">Clique em <strong className="text-[#2DD4A7]">Executar</strong> para carregar a análise de estoque</p>
              <p className="text-xs text-slate-600 mt-1">Selecione os filtros desejados e clique no botão verde</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-[12px]" style={{ minWidth: 1300 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0C0D10] border-b border-[#23262F]">
                <th className="sticky left-0 z-20 bg-[#0C0D10] px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Código</th>
                <th className="sticky left-24 z-20 bg-[#0C0D10] px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap min-w-[180px]">Descrição</th>
                <th className="px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-28">Família</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Saldo Inicial</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Entrada</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Chão</th>
                {!semOrdCompra && (
                  <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Ordem de Compra</th>
                )}
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-20">Quebra</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Saldo Final</th>
                <th className="px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-12">Und</th>
                {confFisica && (
                  <>
                    <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-24">Contagem Física</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-28">Diferença</th>
                  </>
                )}
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-20">Preço Custo</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap w-28">Valor Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map(p => {
                const sel = selId === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    onDoubleClick={() => setDetalheAberto(p)}
                    className={`group border-t border-[#23262F] cursor-pointer transition-colors ${sel ? 'bg-[#01B8FA]/12 text-[#01B8FA]' : 'hover:bg-white/[0.03]'}`}
                    title="Duplo clique para ver movimentações"
                  >
                    <td className={`sticky left-0 z-10 px-3 py-1 ${sel ? 'bg-[#01B8FA]/[0.14]' : 'bg-[#101216] group-hover:bg-[#16181F]'}`}>
                      <div className="flex items-center gap-1">
                        <ChevronRight className={`h-3 w-3 shrink-0 ${sel ? 'text-[#01B8FA]/70' : 'text-slate-600'}`} />
                        <span className={`font-mono ${sel ? 'text-[#01B8FA]' : 'text-[#8A90A0]'}`}>{p.codigo}</span>
                      </div>
                    </td>
                    <td className={`sticky left-24 z-10 px-3 py-1 font-semibold ${sel ? 'bg-[#01B8FA]/[0.14] text-[#01B8FA]' : 'bg-[#101216] group-hover:bg-[#16181F] text-[#F7F8FA]'}`}>{p.descricao}</td>
                    <td className="px-3 py-1">{p.familia ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16181F] border border-[#23262F] text-[#8A90A0] whitespace-nowrap">{p.familia}</span> : <span className="text-slate-600">—</span>}</td>
                    <td className={`px-3 py-1 text-right font-mono ${sel ? '' : p.saldoInicial < 0 ? 'text-[#FF6B7A]' : 'text-[#8A90A0]'}`} title="Calculado pelo sistema (não editável)">{fmtN(p.saldoInicial)}</td>
                    <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="entradas" valor={p.entradas ?? 0} commit={(v) => setCampo(p.id, 'entradas', v)} />
                    </td>
                    <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="chao" valor={p.chao ?? 0} commit={(v) => setCampo(p.id, 'chao', v)} />
                    </td>
                    {!semOrdCompra && (
                      <td className={`px-3 py-1 text-right font-mono ${sel ? '' : 'text-slate-500'}`} title="Já incluído na Entrada (informativo)">{p.ordensCompra ? fmtN(p.ordensCompra) : '—'}</td>
                    )}
                    <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="quebra" valor={p.quebra ?? 0} commit={(v) => setCampo(p.id, 'quebra', v)} alerta />
                    </td>
                    <td className={`px-3 py-1 text-right font-mono font-bold ${sel ? 'text-[#F7F8FA]' : p.saldoFinal < 0 ? 'text-[#FF6B7A]' : 'text-[#2DD4A7]'}`}>{fmtN(p.saldoFinal)}</td>
                    <td className="px-3 py-1 text-slate-400">{p.undEstoque}</td>
                    {confFisica && (
                      <>
                        <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                          <EditNum id={p.id} campo="contagemFisica" valor={p.contagemFisica} commit={(v) => handleContagemChange(p.id, v)} placeholder="0,000" />
                        </td>
                        <td className={`px-3 py-1 text-right font-mono font-bold ${sel ? '' : p.diferencaEstoque < 0 ? 'text-[#FF6B7A]' : p.diferencaEstoque > 0 ? 'text-[#2DD4A7]' : 'text-slate-500'}`}>
                          {p.contagemFisica !== null ? fmtN(p.diferencaEstoque) : '—'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-1 text-right font-mono text-slate-400">{fmtR(p.precoCusto)}</td>
                    <td className={`px-3 py-1 text-right font-mono font-semibold ${sel ? '' : negClass(p.valorAtualEstoque)}`}>{fmtR(p.valorAtualEstoque)}</td>
                  </tr>
                );
              })}
              {executado && produtosFiltrados.length === 0 && (
                <tr><td colSpan={15} className="px-4 py-8 text-center text-gray-400 italic">Nenhum item encontrado!</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Rodapé com totais ── */}
      <div className="shrink-0 bg-[#0C0D10] border-t border-[#23262F] px-4 py-2 flex items-center justify-between text-[#8A90A0]">
        <span className="flex items-center gap-3">
          Registros encontrados: <strong className="text-[#F7F8FA]">{totais.count}</strong>
          {totais.valorPerdido > 0 && (
            <span className="inline-flex items-center gap-1 bg-[#FF6B7A]/12 text-[#FF6B7A] border border-[#FF6B7A]/40 px-2 py-0.5 rounded text-[11px] font-semibold">
              <TrendingDown className="h-3 w-3" /> Valor perdido: R$ {fmtR(totais.valorPerdido)}
            </span>
          )}
        </span>
        <div className="flex gap-8 font-mono text-[11px] text-[#F7F8FA]">
          <span className={negClass(totais.saldoFinal)}>{fmtN(totais.saldoFinal)}</span>
          <span className={totais.diferenca !== 0 ? (totais.diferenca < 0 ? 'text-[#FF6B7A] font-bold' : 'text-[#2DD4A7] font-bold') : ''}>{fmtN(totais.diferenca)}</span>
          <span className={`font-bold ${negClass(totais.valorTotal)}`}>{fmtR(totais.valorTotal)}</span>
        </div>
      </div>
        </div>
      </div>

      {/* ── Modal "Processando..." ── */}
      {processando && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] animate-backdrop">
          <div className="bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] p-6 w-80 text-center animate-modal">
            <p className="text-xs text-[#8A90A0]">Análise de Estoque</p>
            <p className="text-sm text-[#8A90A0] mt-1">Processando...</p>
            <p className="text-xl font-bold text-[#F7F8FA] mt-2">Aguarde...</p>
            <p className="text-xs text-[#8A90A0] mt-2">Produto: <strong className="text-[#F7F8FA]">{prodProcessando}</strong></p>
            <div className="animate-spin h-6 w-6 border-2 border-[#01B8FA] border-t-transparent rounded-full mx-auto mt-3" />
            <button onClick={() => setProcessando(false)} className="mt-4 px-4 py-1 bg-[#16181F] border border-[#23262F] rounded text-xs text-[#8A90A0] hover:bg-[#0C0D10] hover:text-[#F7F8FA] transition-all">
              Cancelar
            </button>
          </div>
        </div>
      ), document.body)}

      {/* ── Modal Detalhamento do Registro ── */}
      {detalheAberto && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop">
          <div className="bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-modal">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#23262F] bg-[#0C0D10] shrink-0">
              <span className="text-xs font-semibold text-[#F7F8FA]">⊞ Detalhamento do Registro</span>
              <button onClick={() => setDetalheAberto(null)} className="text-slate-500 hover:text-[#F7F8FA] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-[#23262F] bg-[#0C0D10] flex flex-wrap items-center gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#8A90A0]">Código do Produto</span>
                <span className="border border-[#23262F] bg-[#16181F] text-[#F7F8FA] px-2 py-0.5 rounded font-mono font-bold">{detalheAberto.codigo}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8A90A0]">Descrição do Produto</span>
                <span className="border border-[#23262F] bg-[#16181F] text-[#F7F8FA] px-2 py-0.5 rounded font-semibold">{detalheAberto.descricao}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8A90A0]">Quantidade Total</span>
                <span className="border border-[#23262F] bg-[#16181F] text-[#F7F8FA] px-2 py-0.5 rounded font-mono">{fmtN(Math.abs(detalheAberto.saidas))}</span>
                <span className="font-bold text-[#F7F8FA]">{detalheAberto.undEstoque}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8A90A0]">Saldo Atual</span>
                <span className="bg-[#01B8FA] text-[#04121A] px-3 py-1 rounded font-bold font-mono text-sm">
                  {fmtN(detalheAberto.saldoFinal)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-[12px] text-[#C7CCD6]">
                <thead className="sticky top-0 bg-[#0C0D10] border-b border-[#23262F]">
                  <tr>
                    {['Data/Hora','Tipo','Quantidade','Saldo anterior','Saldo final','Custo unitário','Lote','Usuário','Observações'].map(h => (
                      <th key={h} className="px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesDetalhe.map((m) => (
                    <tr key={m.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                      <td className="px-3 py-1 font-mono whitespace-nowrap">{new Date(m.dataMovimento).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-1 font-semibold">{m.tipo.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-1 text-right font-mono font-bold">{fmtN(Number(m.quantidade))}</td>
                      <td className="px-3 py-1 text-right font-mono">{fmtN(Number(m.saldoAnterior))}</td>
                      <td className="px-3 py-1 text-right font-mono">{fmtN(Number(m.saldoFinal))}</td>
                      <td className="px-3 py-1 text-right font-mono">{m.custoUnitario ? `R$ ${fmtR(Number(m.custoUnitario))}` : '—'}</td>
                      <td className="px-3 py-1">{m.lote?.numero || '—'}</td>
                      <td className="px-3 py-1">{m.usuario?.nome || '—'}</td>
                      <td className="px-3 py-1">{m.observacoes || '—'}</td>
                    </tr>
                  ))}
                  {carregandoDetalhe && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Carregando histórico real…</td></tr>
                  )}
                  {!carregandoDetalhe && !movimentacoesDetalhe.length && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 italic">{erroDetalhe || 'Nenhuma movimentação real para este produto no período.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 bg-[#0C0D10] border-t border-[#23262F] px-4 py-2 flex items-center justify-between text-xs">
              <span className="text-[#8A90A0]">Registros reais encontrados: <strong className="text-[#F7F8FA]">{movimentacoesDetalhe.length}</strong></span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const csv = 'Data/Hora;Tipo;Quantidade;Saldo anterior;Saldo final;Custo unitario;Lote;Usuario;Observacoes\n' +
                      movimentacoesDetalhe.map(m => [
                        new Date(m.dataMovimento).toLocaleString('pt-BR'),
                        m.tipo,
                        fmtN(Number(m.quantidade)),
                        fmtN(Number(m.saldoAnterior)),
                        fmtN(Number(m.saldoFinal)),
                        fmtR(Number(m.custoUnitario || 0)),
                        m.lote?.numero || '',
                        m.usuario?.nome || '',
                        (m.observacoes || '').replace(/;/g, ','),
                      ].join(';')).join('\n');
                    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `movimentacoes_${detalheAberto.codigo}_${hoje()}.csv`; a.click();
                  }}
                  className="px-3 py-1 bg-[#101216] border border-[#23262F] rounded hover:bg-[#0C0D10] text-[#8A90A0] hover:text-[#F7F8FA] font-medium flex items-center gap-1 transition-all"
                >
                  <Download className="h-3 w-3" /> Exportar
                </button>
                <button onClick={() => setDetalheAberto(null)} className="px-4 py-1 bg-[#01B8FA] text-[#04121A] rounded font-medium hover:bg-[#22D3EE] transition-all">
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Modal Filtros ── */}
      {filtrosAberto && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setFiltros(false)}>
          <div className="bg-[#101216] backdrop-blur-2xl border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] w-full max-w-lg animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#23262F]">
              <h2 className="font-bold text-[#F7F8FA] text-sm flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#01B8FA]" /> Filtros</h2>
              <button onClick={() => setFiltros(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#F7F8FA] hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={fLbl}>De</label><input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className={fInp + ' font-mono [color-scheme:dark]'} /></div>
                <div><label className={fLbl}>Até</label><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={fInp + ' font-mono [color-scheme:dark]'} /></div>
              </div>
              <div><label className={fLbl}>Tipo de item</label><select value={tipoItem} onChange={e => setTipoItem(e.target.value)} className={fInp}>{TIPOS_ITEM.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={fLbl}>Família</label><select value={familia} onChange={e => handleFamiliaChange(e.target.value)} className={fInp}>{FAMILIAS.map(f => <option key={f}>{f}</option>)}</select></div>
                <div><label className={fLbl}>Grupo</label><select value={grupo} onChange={e => setGrupo(e.target.value)} className={fInp}>{gruposDisponiveis.map(g => <option key={g}>{g}</option>)}</select></div>
              </div>
              <div><label className={fLbl}>Centro de Distribuição</label><select value={cd} onChange={e => setCd(e.target.value)} className={fInp}><option>1 - HETROS</option></select></div>
              <div>
                <label className={fLbl}>Unidade de Apuração</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-[#8A90A0] text-sm cursor-pointer"><input type="radio" name="undf" checked={undApuracao === 'Estoque'} onChange={() => setUndApuracao('Estoque')} className="accent-[#01B8FA]" /> Estoque</label>
                  <label className="flex items-center gap-1.5 text-[#8A90A0] text-sm cursor-pointer"><input type="radio" name="undf" checked={undApuracao === 'Principal'} onChange={() => setUndApuracao('Principal')} className="accent-[#01B8FA]" /> Principal</label>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 border-t border-[#23262F]">
                <label className="flex items-center gap-2 text-[#8A90A0] text-sm cursor-pointer pt-2"><input type="checkbox" checked={confFisica} onChange={e => setConfFisica(e.target.checked)} className="accent-[#01B8FA]" /> Conferência Física (mostra colunas de contagem)</label>
                <label className="flex items-center gap-2 text-[#8A90A0] text-sm cursor-pointer"><input type="checkbox" checked={semOrdCompra} onChange={e => setSemOrdCompra(e.target.checked)} className="accent-[#01B8FA]" /> Não mostrar Ordens de Compra</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#23262F]">
              <button onClick={() => setFiltros(false)} className={btnGlass}>Fechar</button>
              <button onClick={() => { setFiltros(false); handleExecutar(); }} className={btnPrimary}>Aplicar filtros</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Drawer Reposição ── */}
      {drawerRepor && createPortal((
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerRepor(false)}>
          <div className="w-full max-w-md h-full bg-[#101216] backdrop-blur-2xl border-l border-[#23262F] shadow-2xl overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#23262F] sticky top-0 bg-[#101216] backdrop-blur-xl">
              <h2 className="font-bold text-[#F7F8FA] text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#FF9F45]" /> Produtos a repor <span className="text-slate-500 font-normal">({aRepor.length})</span></h2>
              <button onClick={() => setDrawerRepor(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#F7F8FA] hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-1.5">
              {aRepor.map((p: any) => (
                <div key={p.produtoId} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${p.negativo ? 'bg-rose-500/[0.08] border-rose-500/20' : 'bg-[#16181F] border-[#23262F]'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F7F8FA] text-sm font-medium truncate">{p.descricao}</p>
                    <p className="text-[11px] text-slate-500">disp. {p.disponivel}{p.negativo && ` · comprar ${p.sugestaoCompra}`}</p>
                  </div>
                  {p.negativo && <span className="text-[10px] font-bold text-[#FF6B7A] bg-rose-500/15 px-2 py-0.5 rounded-full shrink-0">FALTA</span>}
                </div>
              ))}
              {aRepor.length === 0 && <p className="text-slate-500 text-sm text-center py-8">Nada a repor.</p>}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

// Card de KPI — número oversized (padrão do ERP)
function KpiCard({ icon, label, value, accent, tone }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; tone?: 'rose' | 'amber' }) {
  const cor = tone === 'rose' ? 'text-[#FF6B7A]' : tone === 'amber' ? 'text-[#FF9F45]' : accent ? 'text-[#01B8FA]' : 'text-[#F7F8FA]';
  return (
    <div className="bg-[#16181F] rounded-2xl border border-[#23262F] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-[#01B8FA]/70">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums ${cor}`}>{value}</p>
    </div>
  );
}

const fLbl = 'block text-[10px] font-semibold text-[#8A90A0] uppercase tracking-wide mb-1';
const fInp = 'w-full border border-[#23262F] bg-[#101216] text-[#F7F8FA] text-sm px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#01B8FA]/60';
