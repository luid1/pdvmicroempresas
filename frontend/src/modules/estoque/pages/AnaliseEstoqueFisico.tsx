import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Printer, Download, X, ChevronRight, Search, AlertTriangle, TrendingDown, BarChart3, SlidersHorizontal, Package, Coins, PackageX, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { toast, confirmDialog } from '../../../components/ui/feedback';
import { PageHeader, btnGlass, btnPrimary } from '../../cadastros/ui';

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
  idDfe: string;
  nomeCliente: string;
  natureza: string;
  observacoes: string;
  dataHoraVenda: string;
  dataEntrega: string;
  qtdeApuracao: number;
  unidadeApuracao: string;
  vlrTotalVenda: number;
  qtdeConvertida: number;
  unidadeConvertida: string;
  precoMedio: number;
  status: number;
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

// ─── Dados mock (produtos reais do NewOxxy) ──────
const TODOS_PRODUTOS: ProdutoEstoque[] = [
  { id:'1',  codigo:'ALHOC',   descricao:'ALHO',                   familia:'BCA', grupo:'Alhos',   saldoInicial:0,       entradas:233.810, ordensCompra:0,       saidas:-85.500,   saldoFinal:148.310, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:12.13, valorAtualEstoque:1799.00 },
  { id:'2',  codigo:'ALPD',    descricao:'ALHO DESCASCADO',        familia:'BCA', grupo:'Alhos',   saldoInicial:0,       entradas:21.900,  ordensCompra:200.000, saidas:-100.000,  saldoFinal:121.900, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:13.00, valorAtualEstoque:1584.70 },
  { id:'3',  codigo:'BAT25',   descricao:'BATATA ASTERIX',         familia:'BCA', grupo:'Batatas', saldoInicial:0,       entradas:147.850, ordensCompra:360.000, saidas:-228.000,  saldoFinal:279.850, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:6.25,  valorAtualEstoque:1749.06 },
  { id:'4',  codigo:'BATB25',  descricao:'BATATA BOLINHA',         familia:'BCA', grupo:'Batatas', saldoInicial:0,       entradas:167.600, ordensCompra:288.000, saidas:-282.000,  saldoFinal:173.600, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:3.75,  valorAtualEstoque:651.00 },
  { id:'5',  codigo:'BATN',    descricao:'BATATA LAVADA',          familia:'BCA', grupo:'Batatas', saldoInicial:0,       entradas:21.550,  ordensCompra:240.000, saidas:-408.300,  saldoFinal:146.750, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:5.42,  valorAtualEstoque:-795.39 },
  { id:'6',  codigo:'BATFLO',  descricao:'BATATA LAVADA FLORAO',   familia:'BCA', grupo:'Batatas', saldoInicial:0,       entradas:151.900, ordensCompra:120.000, saidas:-110.000,  saldoFinal:161.900, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:6.02,  valorAtualEstoque:974.64 },
  { id:'7',  codigo:'BATM',    descricao:'BATATA MARQUISE CESAR',  familia:'BCA', grupo:'Batatas', saldoInicial:0,       entradas:-78.000, ordensCompra:0,       saidas:0,         saldoFinal:-78.000, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:6.37,  valorAtualEstoque:-496.86 },
  { id:'8',  codigo:'CEBGRA3', descricao:'CEBOLA CX3',            familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:124.000, ordensCompra:0,       saidas:-75.000,   saldoFinal:49.000,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.71,  valorAtualEstoque:230.79 },
  { id:'9',  codigo:'CEBGRA4', descricao:'CEBOLA CX4',            familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:-285.550,ordensCompra:950.000, saidas:-838.900,  saldoFinal:-174.450,undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.21,  valorAtualEstoque:-734.43 },
  { id:'10', codigo:'CEBECHA', descricao:'CEBOLA ECHALOTE',        familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:53.000,  ordensCompra:0,       saidas:-0.500,    saldoFinal:52.500,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:7.36,  valorAtualEstoque:386.40 },
  { id:'11', codigo:'CEBOPI',  descricao:'CEBOLA PIRULITO',        familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:3.600,   ordensCompra:0,       saidas:0,         saldoFinal:3.600,   undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.00,  valorAtualEstoque:14.40 },
  { id:'12', codigo:'CEBR',    descricao:'CEBOLA ROXA CX3',       familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:692.300, ordensCompra:380.000, saidas:-112.450,  saldoFinal:959.850, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:5.79,  valorAtualEstoque:5557.53 },
  { id:'13', codigo:'CRX',     descricao:'CEBOLA ROXA CX4',       familia:'BCA', grupo:'Cebolas', saldoInicial:0,       entradas:61.400,  ordensCompra:76.000,  saidas:-62.000,   saldoFinal:75.400,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.74,  valorAtualEstoque:357.40 },
  { id:'14', codigo:'COS',     descricao:'COCO SECO',              familia:'BCA', grupo:'Raizes', saldoInicial:0,       entradas:43.880,  ordensCompra:0,       saidas:-1.330,    saldoFinal:42.550,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:3.23,  valorAtualEstoque:137.64 },
  { id:'15', codigo:'MANDV',   descricao:'MANDIOCA A VACUO',       familia:'BCA', grupo:'Raizes', saldoInicial:0,       entradas:49.000,  ordensCompra:0,       saidas:-5.000,    saldoFinal:44.000,  undEstoque:'PC', contagemFisica:null, diferencaEstoque:0, precoCusto:4.90,  valorAtualEstoque:215.60 },
  { id:'16', codigo:'ABAC',    descricao:'ABACATE',                familia:'Fruta', grupo:'Nacional',  saldoInicial:143.30, entradas:180.00, ordensCompra:0, saidas:-130.65, saldoFinal:192.65, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:8.50, valorAtualEstoque:1637.53 },
  { id:'17', codigo:'AVO',     descricao:'ABACATE AVOCADO',        familia:'Fruta', grupo:'Importada', saldoInicial:37.73,  entradas:0,      ordensCompra:0, saidas:-2.00,   saldoFinal:35.73,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:12.00, valorAtualEstoque:428.76 },
  { id:'18', codigo:'BNAN',    descricao:'BANANA NANICA',          familia:'Fruta', grupo:'Tropical',  saldoInicial:338.12, entradas:400.00, ordensCompra:0, saidas:-799.44, saldoFinal:-61.32, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:3.50, valorAtualEstoque:-214.62 },
  { id:'19', codigo:'BAN',     descricao:'BANANA PRATA',           familia:'Fruta', grupo:'Tropical',  saldoInicial:53.55,  entradas:395.00, ordensCompra:0, saidas:-419.45, saldoFinal:149.80, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:5.20, valorAtualEstoque:778.96 },
  { id:'20', codigo:'MANGP20', descricao:'MANGA PALMER',           familia:'Fruta', grupo:'Tropical',  saldoInicial:114.53, entradas:716.00, ordensCompra:0, saidas:-445.19, saldoFinal:385.35, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.80, valorAtualEstoque:1849.68 },
  { id:'21', codigo:'MAMF',    descricao:'MAMAO FORMOSA',          familia:'Fruta', grupo:'Tropical',  saldoInicial:-88.65, entradas:700.00, ordensCompra:0, saidas:-486.10, saldoFinal:113.25, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.20, valorAtualEstoque:475.65 },
  { id:'22', codigo:'KIWI',    descricao:'KIWI',                   familia:'Fruta', grupo:'Importada', saldoInicial:51.00,  entradas:0,      ordensCompra:0, saidas:-25.78,  saldoFinal:25.28,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:18.00, valorAtualEstoque:455.04 },
  { id:'23', codigo:'LIM',     descricao:'LIMAO TAITI',            familia:'Citricos', grupo:'Limão', saldoInicial:200.00, entradas:500.00, ordensCompra:0, saidas:-450.00, saldoFinal:250.00, undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:3.80, valorAtualEstoque:950.00 },
  { id:'24', codigo:'LARG',    descricao:'LARANJA PERA',           familia:'Citricos', grupo:'Laranja', saldoInicial:80.00,  entradas:300.00, ordensCompra:0, saidas:-320.00, saldoFinal:60.00,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:2.50, valorAtualEstoque:150.00 },
  { id:'25', codigo:'ABOBI',   descricao:'ABOBRINHA ITALIANA',     familia:'Legumes', grupo:'Outros', saldoInicial:45.00,  entradas:120.00, ordensCompra:0, saidas:-98.00,  saldoFinal:67.00,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:6.50, valorAtualEstoque:435.50 },
  { id:'26', codigo:'ALFAC',   descricao:'ALFACE CRESPA',          familia:'Verdura', grupo:'Folhosas', saldoInicial:30.00,  entradas:80.00,  ordensCompra:0, saidas:-95.00,  saldoFinal:15.00,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:4.20, valorAtualEstoque:63.00 },
  { id:'27', codigo:'RUCUL',   descricao:'RUCULA',                 familia:'Verdura', grupo:'Folhosas', saldoInicial:12.00,  entradas:40.00,  ordensCompra:0, saidas:-38.00,  saldoFinal:14.00,  undEstoque:'KG', contagemFisica:null, diferencaEstoque:0, precoCusto:8.00, valorAtualEstoque:112.00 },
];

// ─── Mock movimentações do BAT25 ─────────────────
const MOCK_MOVIMENTACOES: Record<string, Movimentacao[]> = {
  '3': [
    { idDfe:'Id Venda: 1616...', nomeCliente:'SENAC PENHA',            natureza:'NFe Padrao', observacoes:'PESAR',  dataHoraVenda:'26/06/2026 07:07:58', dataEntrega:'27/06/2026', qtdeApuracao:5.000,  unidadeApuracao:'KG', vlrTotalVenda:67.20,  qtdeConvertida:0.208, unidadeConvertida:'SC', precoMedio:322.612, status:1 },
    { idDfe:'Id Venda: 1616...', nomeCliente:'MERCEARIA AMAURI',       natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 09:33:21', dataEntrega:'27/06/2026', qtdeApuracao:20.000, unidadeApuracao:'KG', vlrTotalVenda:220.00, qtdeConvertida:0.833, unidadeConvertida:'SC', precoMedio:264.011, status:1 },
    { idDfe:'Id Venda: 1616...', nomeCliente:'DEMOISELLE BISTRO',      natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 09:56:34', dataEntrega:'27/06/2026', qtdeApuracao:10.000, unidadeApuracao:'KG', vlrTotalVenda:134.40, qtdeConvertida:0.417, unidadeConvertida:'SC', precoMedio:322.534, status:1 },
    { idDfe:'Id Venda: 1616...', nomeCliente:'HOTEL MARCO PANINI',     natureza:'NFe Padrao', observacoes:'NOIVA',  dataHoraVenda:'26/06/2026 10:16:35', dataEntrega:'29/06/2026', qtdeApuracao:8.000,  unidadeApuracao:'KG', vlrTotalVenda:93.60,  qtdeConvertida:0.333, unidadeConvertida:'SC', precoMedio:280.828, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'103700',                 natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 10:47:00', dataEntrega:'29/06/2026', qtdeApuracao:12.000, unidadeApuracao:'KG', vlrTotalVenda:109.92, qtdeConvertida:0.500, unidadeConvertida:'SC', precoMedio:219.840, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'LE VILLE',               natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 11:10:23', dataEntrega:'27/06/2026', qtdeApuracao:50.000, unidadeApuracao:'KG', vlrTotalVenda:548.50, qtdeConvertida:2.083, unidadeConvertida:'SC', precoMedio:263.284, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'EL PUNTO URUGUAYO',      natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 11:18:48', dataEntrega:'27/06/2026', qtdeApuracao:3.000,  unidadeApuracao:'KG', vlrTotalVenda:35.88,  qtdeConvertida:0.125, unidadeConvertida:'SC', precoMedio:287.040, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'HOSPITAL IPIRANGA MOGI', natureza:'NFe Padrao', observacoes:'NOIVA',  dataHoraVenda:'26/06/2026 11:36:04', dataEntrega:'27/06/2026', qtdeApuracao:10.000, unidadeApuracao:'KG', vlrTotalVenda:70.00,  qtdeConvertida:0.417, unidadeConvertida:'SC', precoMedio:167.987, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'RASCAL JK',              natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 11:47:09', dataEntrega:'27/06/2026', qtdeApuracao:20.000, unidadeApuracao:'KG', vlrTotalVenda:183.20, qtdeConvertida:0.833, unidadeConvertida:'SC', precoMedio:219.849, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'SCANDAL RESTAURANTE',    natureza:'NFe Padrao', observacoes:'NOIVA',  dataHoraVenda:'26/06/2026 12:26:05', dataEntrega:'29/06/2026', qtdeApuracao:5.000,  unidadeApuracao:'KG', vlrTotalVenda:48.50,  qtdeConvertida:0.208, unidadeConvertida:'SC', precoMedio:232.837, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'RASCAL JK',              natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 12:40:26', dataEntrega:'29/06/2026', qtdeApuracao:20.000, unidadeApuracao:'KG', vlrTotalVenda:183.20, qtdeConvertida:0.833, unidadeConvertida:'SC', precoMedio:219.849, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'MAREMONTI CAMPO BELO',   natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 14:44:39', dataEntrega:'29/06/2026', qtdeApuracao:10.000, unidadeApuracao:'KG', vlrTotalVenda:85.90,  qtdeConvertida:0.417, unidadeConvertida:'SC', precoMedio:206.144, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'103700',                 natureza:'NFe Padrao', observacoes:'',       dataHoraVenda:'26/06/2026 13:39:57', dataEntrega:'27/06/2026', qtdeApuracao:15.000, unidadeApuracao:'KG', vlrTotalVenda:137.40, qtdeConvertida:0.625, unidadeConvertida:'SC', precoMedio:219.840, status:1 },
    { idDfe:'Id Venda: 1617...', nomeCliente:'TERRACO ITALIA RESTAUR...', natureza:'NFe Padrao', observacoes:'NOIVA', dataHoraVenda:'26/06/2026 14:49:11', dataEntrega:'27/06/2026', qtdeApuracao:40.000, unidadeApuracao:'KG', vlrTotalVenda:450.40, qtdeConvertida:1.667, unidadeConvertida:'SC', precoMedio:270.235, status:1 },
  ],
};

// ─── Formatação ──────────────────────────────────
const fmtN = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const negClass = (v: number) => v < 0 ? 'text-red-600' : '';
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
  const cellInp = 'w-full text-right font-mono text-[11px] px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.04] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400/40 focus:border-sky-400/60';

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
          className="w-full text-right font-mono text-[11px] px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/60 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
        />
      );
    }
    const vazio = valor === null || valor === undefined;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditCell({ id, campo }); }}
        className={`w-full text-right font-mono px-1.5 py-0.5 rounded hover:bg-sky-400/10 hover:ring-1 hover:ring-sky-400/25 transition-all duration-150 ${alerta && (valor || 0) > 0 ? 'text-amber-300 font-semibold' : ''}`}
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
            <button onClick={() => handleExecutar()} disabled={processando} className={btnPrimary + ' bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'}>
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20 transition-all duration-300 active:scale-[0.98] disabled:opacity-30 disabled:bg-white/[0.04] disabled:text-slate-500 disabled:shadow-none"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              {faturando ? 'Faturando…' : 'Faturar Quebra'}
              {pendentes.length > 0 && !faturando && <span className="bg-white/25 rounded-full px-1.5 py-0.5 text-[10px] leading-none">{pendentes.length}</span>}
            </button>
          </>
        }
      />

      {/* ── Alerta colapsado: produtos a repor / em falta ── */}
      {aRepor.length > 0 && (
        <div className="bg-amber-500/[0.06] border-b border-amber-400/15 px-5 py-1.5 shrink-0 flex items-center gap-2 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300 font-semibold">
            {emFalta > 0 && <><span className="text-rose-300">{emFalta} em falta</span> · </>}
            {aRepor.length} produto(s) a repor
          </span>
          <button onClick={() => setDrawerRepor(true)} className="ml-auto text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-2 decoration-amber-400/40">
            Ver lista
          </button>
        </div>
      )}

      {/* ── Corpo ── */}
      <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <KpiCard icon={<Package className="h-4 w-4" />} label="Itens" value={String(totais.count)} />
          <KpiCard icon={<Coins className="h-4 w-4" />} label="Valor do Estoque" value={`R$ ${fmtR(totais.valorTotal)}`} accent />
          <KpiCard icon={<PackageX className="h-4 w-4" />} label="Em Falta" value={String(emFalta)} tone={emFalta > 0 ? 'rose' : undefined} />
          <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Perda / Quebra" value={`R$ ${fmtR(totais.valorPerdido)}`} tone={totais.valorPerdido > 0 ? 'amber' : undefined} />
        </div>

        {/* FilterBar — busca + chips + filtros avançados */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar por código ou descrição..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/60 transition-all duration-300" />
          </div>
          {familia !== '<Todas>' && <span className="inline-flex items-center gap-1 bg-sky-500/15 text-sky-300 px-2.5 py-1 rounded-lg text-xs font-semibold">{familia}<button onClick={() => handleFamiliaChange('<Todas>')}><X className="h-3 w-3" /></button></span>}
          {grupo !== '<Todas>' && <span className="inline-flex items-center gap-1 bg-violet-500/15 text-violet-300 px-2.5 py-1 rounded-lg text-xs font-semibold">{grupo}<button onClick={() => setGrupo('<Todas>')}><X className="h-3 w-3" /></button></span>}
          {confFisica && <span className="bg-amber-500/15 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-semibold">Conferência física</span>}
          <button onClick={() => setFiltros(true)} className={btnGlass + ' ml-auto'}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>

        {/* ── Grade em card de vidro ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="flex-1 overflow-auto">
        {!executado && !processando ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-slate-700" />
              <p className="text-sm font-medium">Clique em <strong className="text-emerald-400">Executar</strong> para carregar a análise de estoque</p>
              <p className="text-xs text-slate-600 mt-1">Selecione os filtros desejados e clique no botão verde</p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: 1300 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#11161f] border-b border-white/[0.08]">
                <th className="sticky left-0 z-20 bg-[#11161f] px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Código</th>
                <th className="sticky left-24 z-20 bg-[#11161f] px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap min-w-[180px]">Descrição</th>
                <th className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-16">Família</th>
                <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Saldo Inicial</th>
                <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Entrada</th>
                <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Chão</th>
                {!semOrdCompra && (
                  <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Ordem de Compra</th>
                )}
                <th className="px-2 py-1.5 text-right font-semibold text-amber-300/80 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-20">Quebra</th>
                <th className="px-2 py-1.5 text-right font-semibold text-emerald-300/80 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Saldo Final</th>
                <th className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-12">Und</th>
                {confFisica && (
                  <>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-24">Contagem Física</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-28">Diferença</th>
                  </>
                )}
                <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide border-r border-white/[0.06] whitespace-nowrap w-20">Preço Custo</th>
                <th className="px-2 py-1.5 text-right font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap w-28">Valor Estoque</th>
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
                    className={`group border-b border-white/[0.04] cursor-pointer transition-colors ${sel ? 'bg-sky-500/15 text-sky-100' : 'hover:bg-white/[0.03]'}`}
                    title="Duplo clique para ver movimentações"
                  >
                    <td className={`sticky left-0 z-10 px-2 py-1 border-r border-white/[0.05] ${sel ? 'bg-sky-500/[0.18]' : 'bg-[#0c1119] group-hover:bg-[#131a26]'}`}>
                      <div className="flex items-center gap-1">
                        <ChevronRight className={`h-3 w-3 shrink-0 ${sel ? 'text-sky-200/70' : 'text-slate-600'}`} />
                        <span className={`font-semibold ${sel ? 'text-sky-100' : 'text-sky-300'}`}>{p.codigo}</span>
                      </div>
                    </td>
                    <td className={`sticky left-24 z-10 px-2 py-1 border-r border-white/[0.05] ${sel ? 'bg-sky-500/[0.18] text-sky-100' : 'bg-[#0c1119] group-hover:bg-[#131a26] text-slate-200'}`}>{p.descricao}</td>
                    <td className="px-2 py-1 border-r border-white/[0.05] text-slate-400">{p.familia}</td>
                    <td className={`px-2 py-1 border-r border-white/[0.05] text-right font-mono ${sel ? '' : p.saldoInicial < 0 ? 'text-rose-400' : 'text-slate-300'}`} title="Calculado pelo sistema (não editável)">{fmtN(p.saldoInicial)}</td>
                    <td className="px-1 py-0.5 border-r border-white/[0.05]" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="entradas" valor={p.entradas ?? 0} commit={(v) => setCampo(p.id, 'entradas', v)} />
                    </td>
                    <td className="px-1 py-0.5 border-r border-white/[0.05]" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="chao" valor={p.chao ?? 0} commit={(v) => setCampo(p.id, 'chao', v)} />
                    </td>
                    {!semOrdCompra && (
                      <td className={`px-2 py-1 border-r border-white/[0.05] text-right font-mono ${sel ? '' : 'text-slate-500'}`} title="Já incluído na Entrada (informativo)">{p.ordensCompra ? fmtN(p.ordensCompra) : '—'}</td>
                    )}
                    <td className="px-1 py-0.5 border-r border-white/[0.05]" onClick={e => e.stopPropagation()}>
                      <EditNum id={p.id} campo="quebra" valor={p.quebra ?? 0} commit={(v) => setCampo(p.id, 'quebra', v)} alerta />
                    </td>
                    <td className={`px-2 py-1 border-r border-white/[0.05] text-right font-mono font-bold ${sel ? 'text-white' : p.saldoFinal < 0 ? 'text-rose-400' : 'text-emerald-300'}`}>{fmtN(p.saldoFinal)}</td>
                    <td className="px-2 py-1 border-r border-white/[0.05] text-slate-400">{p.undEstoque}</td>
                    {confFisica && (
                      <>
                        <td className="px-1 py-0.5 border-r border-white/[0.05]" onClick={e => e.stopPropagation()}>
                          <EditNum id={p.id} campo="contagemFisica" valor={p.contagemFisica} commit={(v) => handleContagemChange(p.id, v)} placeholder="0,000" />
                        </td>
                        <td className={`px-2 py-1 border-r border-white/[0.05] text-right font-mono font-bold ${sel ? '' : p.diferencaEstoque < 0 ? 'text-rose-400' : p.diferencaEstoque > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {p.contagemFisica !== null ? fmtN(p.diferencaEstoque) : '—'}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1 border-r border-white/[0.05] text-right font-mono text-slate-400">{fmtR(p.precoCusto)}</td>
                    <td className={`px-2 py-1 text-right font-mono font-semibold ${sel ? '' : negClass(p.valorAtualEstoque)}`}>{fmtR(p.valorAtualEstoque)}</td>
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
      <div className="shrink-0 bg-white/[0.02] backdrop-blur-xl border-t border-white/[0.06] px-4 py-2 flex items-center justify-between text-slate-300">
        <span className="flex items-center gap-3">
          Registros encontrados: <strong>{totais.count}</strong>
          {totais.valorPerdido > 0 && (
            <span className="inline-flex items-center gap-1 bg-rose-600/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[11px] font-semibold">
              <TrendingDown className="h-3 w-3" /> Valor perdido: R$ {fmtR(totais.valorPerdido)}
            </span>
          )}
        </span>
        <div className="flex gap-8 font-mono text-[11px]">
          <span className={negClass(totais.saldoFinal)}>{fmtN(totais.saldoFinal)}</span>
          <span className={totais.diferenca !== 0 ? (totais.diferenca < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold') : ''}>{fmtN(totais.diferenca)}</span>
          <span className={`font-bold ${negClass(totais.valorTotal)}`}>{fmtR(totais.valorTotal)}</span>
        </div>
      </div>
        </div>
      </div>

      {/* ── Modal "Processando..." ── */}
      {processando && createPortal((
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] animate-backdrop">
          <div className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] p-6 w-80 text-center animate-modal">
            <p className="text-xs text-gray-500">Análise de Estoque</p>
            <p className="text-sm text-gray-600 mt-1">Processando...</p>
            <p className="text-xl font-bold text-gray-900 mt-2">Aguarde...</p>
            <p className="text-xs text-gray-500 mt-2">Produto: <strong>{prodProcessando}</strong></p>
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mt-3" />
            <button onClick={() => setProcessando(false)} className="mt-4 px-4 py-1 bg-gray-200 border border-gray-400 rounded text-xs text-gray-700 hover:bg-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      ), document.body)}

      {/* ── Modal Detalhamento do Registro ── */}
      {detalheAberto && createPortal((
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 animate-backdrop">
          <div className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-modal">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02] shrink-0">
              <span className="text-xs font-semibold text-gray-700">⊞ Detalhamento do Registro</span>
              <button onClick={() => setDetalheAberto(null)} className="text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Código do Produto</span>
                <span className="border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 rounded font-mono font-bold">{detalheAberto.codigo}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Descrição do Produto</span>
                <span className="border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 rounded font-semibold">{detalheAberto.descricao}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Quantidade Total</span>
                <span className="border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 rounded font-mono">{fmtN(Math.abs(detalheAberto.saidas))}</span>
                <span className="font-bold">{detalheAberto.undEstoque}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Saldo Atual</span>
                <span className="bg-sky-500 text-white px-3 py-1 rounded font-bold font-mono text-sm">
                  {fmtN(detalheAberto.saldoFinal)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-gray-200 border-b border-gray-400">
                  <tr>
                    {['Id DFe/Pedido','Nome/Razão Social','Natureza de Operação','Observações','Data/Hora Venda','Data Entrega','Qtde Apuração','Unidade','Vlr Total Venda','Qtde Conv.','Und Conv.','Preço Médio','Status'].map(h => (
                      <th key={h} className="px-2 py-1 text-left font-semibold text-gray-700 border-r border-gray-300 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(MOCK_MOVIMENTACOES[detalheAberto.id] || []).map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-white/[0.03]">
                      <td className="px-2 py-1 border-r border-white/[0.05] text-sky-300 whitespace-nowrap">{m.idDfe}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] whitespace-nowrap font-medium">{m.nomeCliente}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05]">{m.natureza}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] text-orange-600 font-bold">{m.observacoes}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] font-mono whitespace-nowrap">{m.dataHoraVenda}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] font-mono">{m.dataEntrega}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] text-right font-mono font-bold">{fmtN(m.qtdeApuracao)}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05]">{m.unidadeApuracao}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] text-right font-mono">{fmtR(m.vlrTotalVenda)}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] text-right font-mono">{m.qtdeConvertida.toFixed(3)}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05]">{m.unidadeConvertida}</td>
                      <td className="px-2 py-1 border-r border-white/[0.05] text-right font-mono">{fmtR(m.precoMedio)}</td>
                      <td className="px-2 py-1 text-center">{m.status}</td>
                    </tr>
                  ))}
                  {!(MOCK_MOVIMENTACOES[detalheAberto.id] || []).length && (
                    <tr><td colSpan={13} className="px-4 py-6 text-center text-gray-400 italic">Nenhuma movimentação para este produto.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 bg-gray-100 border-t border-gray-300 px-4 py-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">Registros Encontrados: <strong>{(MOCK_MOVIMENTACOES[detalheAberto.id] || []).length}</strong></span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const movs = MOCK_MOVIMENTACOES[detalheAberto.id] || [];
                    const csv = 'Id DFe;Cliente;Natureza;Obs;Data Venda;Data Entrega;Qtde;Und;Vlr Total;Preco Medio\n' +
                      movs.map(m => `${m.idDfe};${m.nomeCliente};${m.natureza};${m.observacoes};${m.dataHoraVenda};${m.dataEntrega};${fmtN(m.qtdeApuracao)};${m.unidadeApuracao};${fmtR(m.vlrTotalVenda)};${fmtR(m.precoMedio)}`).join('\n');
                    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `movimentacoes_${detalheAberto.codigo}_${hoje()}.csv`; a.click();
                  }}
                  className="px-3 py-1 bg-white border border-gray-400 rounded hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-1"
                >
                  <Download className="h-3 w-3" /> Exportar
                </button>
                <button onClick={() => setDetalheAberto(null)} className="px-4 py-1 bg-sky-500 text-white rounded font-medium hover:bg-sky-400">
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Modal Filtros ── */}
      {filtrosAberto && createPortal((
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setFiltros(false)}>
          <div className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] w-full max-w-lg animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <h2 className="font-bold text-white text-sm flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-sky-300" /> Filtros</h2>
              <button onClick={() => setFiltros(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
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
                  <label className="flex items-center gap-1.5 text-slate-300 text-sm cursor-pointer"><input type="radio" name="undf" checked={undApuracao === 'Estoque'} onChange={() => setUndApuracao('Estoque')} className="accent-sky-500" /> Estoque</label>
                  <label className="flex items-center gap-1.5 text-slate-300 text-sm cursor-pointer"><input type="radio" name="undf" checked={undApuracao === 'Principal'} onChange={() => setUndApuracao('Principal')} className="accent-sky-500" /> Principal</label>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.06]">
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer pt-2"><input type="checkbox" checked={confFisica} onChange={e => setConfFisica(e.target.checked)} className="accent-sky-500" /> Conferência Física (mostra colunas de contagem)</label>
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer"><input type="checkbox" checked={semOrdCompra} onChange={e => setSemOrdCompra(e.target.checked)} className="accent-sky-500" /> Não mostrar Ordens de Compra</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
              <button onClick={() => setFiltros(false)} className={btnGlass}>Fechar</button>
              <button onClick={() => { setFiltros(false); handleExecutar(); }} className={btnPrimary + ' bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'}>Aplicar filtros</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ── Drawer Reposição ── */}
      {drawerRepor && createPortal((
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/50 animate-fade-in" onClick={() => setDrawerRepor(false)}>
          <div className="w-full max-w-md h-full bg-[#0E141F]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] sticky top-0 bg-[#0E141F]/95 backdrop-blur-xl">
              <h2 className="font-bold text-white text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Produtos a repor <span className="text-slate-500 font-normal">({aRepor.length})</span></h2>
              <button onClick={() => setDrawerRepor(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-1.5">
              {aRepor.map((p: any) => (
                <div key={p.produtoId} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${p.negativo ? 'bg-rose-500/[0.08] border-rose-500/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{p.descricao}</p>
                    <p className="text-[11px] text-slate-500">disp. {p.disponivel}{p.negativo && ` · comprar ${p.sugestaoCompra}`}</p>
                  </div>
                  {p.negativo && <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full shrink-0">FALTA</span>}
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
  const cor = tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : accent ? 'text-sky-200' : 'text-white';
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-sky-300/70">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums ${cor}`}>{value}</p>
    </div>
  );
}

const fLbl = 'block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1';
const fInp = 'w-full border border-white/[0.08] bg-white/[0.04] text-slate-100 text-sm px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-sky-400/60';
