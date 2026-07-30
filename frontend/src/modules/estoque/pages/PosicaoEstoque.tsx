import { useState, useMemo } from 'react';
import { Package, Search, AlertTriangle, Filter, RefreshCw, ArrowUpDown } from 'lucide-react';
import { estoqueApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useFetch } from '../../../hooks/useFetch';
import { PageHeader, btnGlass } from '../../cadastros/ui';

const R$ = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const N = (v: any) => Number(v || 0);

interface SaldoItem {
  id: string;
  quantidade: number;
  quantidadeDisponivel: number;
  quantidadeReservada: number;
  custoMedio: number;
  diasAteVencer: number | null;
  alertaValidade: boolean;
  abaixoMinimo: boolean;
  produto: { codigo: string; descricao: string; categoria: string; estoqueMinimo: number; unidadeMedida: { sigla: string } };
  lote?: { numero: string; dataValidade: string };
  localizacao?: { rua: string; bloco: string; prateleira: string };
}

export default function PosicaoEstoque() {
  const { filialAtiva } = useAuth();
  const [search, setSearch] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState(false);
  const [sortField, setSortField] = useState<'descricao' | 'quantidade' | 'diasAteVencer'>('descricao');

  const { data, loading, refetch } = useFetch<SaldoItem[]>(
    () => filialAtiva ? estoqueApi.posicao(filialAtiva.id) : Promise.resolve({ data: [] }),
    [filialAtiva?.id],
  );

  const saldos = useMemo(() => {
    let list = data || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.produto.descricao.toLowerCase().includes(q) ||
        s.produto.codigo.toLowerCase().includes(q),
      );
    }
    if (filtroAlerta) list = list.filter((s) => s.alertaValidade || s.abaixoMinimo);
    return [...list].sort((a, b) => {
      if (sortField === 'quantidade') return N(b.quantidade) - N(a.quantidade);
      if (sortField === 'diasAteVencer') return (a.diasAteVencer ?? 999) - (b.diasAteVencer ?? 999);
      return a.produto.descricao.localeCompare(b.produto.descricao);
    });
  }, [data, search, filtroAlerta, sortField]);

  const totais = useMemo(() => ({
    produtos: saldos.length,
    alertasValidade: saldos.filter((s) => s.alertaValidade).length,
    abaixoMinimo: saldos.filter((s) => s.abaixoMinimo).length,
    valorTotal: saldos.reduce((acc, s) => acc + N(s.quantidade) * N(s.custoMedio), 0),
  }), [saldos]);

  const Sort = ({ field }: { field: typeof sortField }) => (
    <button onClick={() => setSortField(field)} className={`inline-flex items-center gap-1 hover:text-sky-600 ${sortField === field ? 'text-sky-600' : ''}`}>
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Package className="h-4 w-4" />}
        titulo="Posição de Estoque"
        subtitulo={filialAtiva ? `${filialAtiva.codigo} — ${filialAtiva.nome}` : 'Selecione uma filial'}
        actions={
          <button onClick={refetch} className={btnGlass}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Itens em estoque</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totais.produtos}</p>
        </div>
        <div className={`card p-4 ${totais.alertasValidade > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <p className="text-xs text-gray-500">⚠ Alerta Validade</p>
          <p className={`text-2xl font-bold mt-1 ${totais.alertasValidade > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {totais.alertasValidade}
          </p>
        </div>
        <div className={`card p-4 ${totais.abaixoMinimo > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
          <p className="text-xs text-gray-500">Abaixo do mínimo</p>
          <p className={`text-2xl font-bold mt-1 ${totais.abaixoMinimo > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {totais.abaixoMinimo}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Valor total (CMV)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{R$(totais.valorTotal)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9 w-64 text-sm"
            placeholder="Buscar produto ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setFiltroAlerta(!filtroAlerta)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            filtroAlerta ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {filtroAlerta ? 'Mostrando alertas' : 'Somente alertas'}
        </button>
        <select
          className="input text-sm w-44"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
        >
          <option value="descricao">Ordenar: A-Z</option>
          <option value="quantidade">Ordenar: Quantidade</option>
          <option value="diasAteVencer">Ordenar: Validade</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lote</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Localização</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qtd</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Disponível</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CMV Unit.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Validade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {saldos.map((s) => {
                  const rowAlert = s.alertaValidade ? 'bg-red-50/60' : s.abaixoMinimo ? 'bg-amber-50/40' : '';
                  return (
                    <tr key={s.id} className={`hover:brightness-[0.98] transition-all ${rowAlert}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.produto.codigo}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.produto.descricao}</p>
                        <p className="text-xs text-gray-400">{s.produto.categoria}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{s.lote?.numero || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {s.localizacao ? `${s.localizacao.rua}-${s.localizacao.prateleira}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-900">{N(s.quantidade).toFixed(2)}</span>
                        <span className="text-xs text-gray-400 ml-1">{s.produto.unidadeMedida.sigla}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${N(s.quantidadeDisponivel) <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {N(s.quantidadeDisponivel).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{R$(N(s.custoMedio))}</td>
                      <td className="px-4 py-3">
                        {s.lote?.dataValidade ? (
                          <div>
                            <p className={`text-xs font-medium ${s.alertaValidade ? 'text-red-600' : 'text-gray-600'}`}>
                              {new Date(s.lote.dataValidade).toLocaleDateString('pt-BR')}
                            </p>
                            {s.diasAteVencer !== null && (
                              <p className={`text-[10px] ${s.diasAteVencer <= 0 ? 'text-red-500 font-bold' : s.alertaValidade ? 'text-orange-500' : 'text-gray-400'}`}>
                                {s.diasAteVencer <= 0 ? 'VENCIDO' : `${s.diasAteVencer}d restantes`}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {s.alertaValidade && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="h-2.5 w-2.5" /> VENCENDO
                            </span>
                          )}
                          {s.abaixoMinimo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              ↓ MÍNIMO
                            </span>
                          )}
                          {!s.alertaValidade && !s.abaixoMinimo && (
                            <span className="text-[10px] text-emerald-600 font-medium">OK</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {saldos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Nenhum saldo encontrado para esta filial.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
