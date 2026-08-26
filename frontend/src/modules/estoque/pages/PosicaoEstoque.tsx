import { useState, useMemo } from 'react';
import { Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { estoqueApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useFetch } from '../../../hooks/useFetch';
import { CadastroShell, PageHeader, FilterBar, TableCard, Th, Loader, Vazio, btnGlass } from '../../cadastros/ui';

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

  return (
    <CadastroShell>
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        titulo="Posição de Estoque"
        subtitulo={filialAtiva ? `${filialAtiva.codigo} — ${filialAtiva.nome}` : 'Selecione uma filial'}
        actions={
          <button onClick={refetch} className={btnGlass}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        }
      />

      <FilterBar busca={search} onBusca={setSearch} placeholder="Buscar produto ou código...">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFiltroAlerta(!filtroAlerta)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 active:scale-[0.98] ${
              filtroAlerta ? 'bg-[#FF6B7A]/12 border-[#FF6B7A]/45 text-[#FF6B7A]' : 'bg-[#101216] border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10]'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {filtroAlerta ? 'Mostrando alertas' : 'Somente alertas'}
          </button>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="bg-[#101216] border border-[#23262F] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#8A90A0] focus:outline-none focus:border-[#01B8FA]/60 focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
          >
            <option value="descricao">Ordenar: A-Z</option>
            <option value="quantidade">Ordenar: Quantidade</option>
            <option value="diasAteVencer">Ordenar: Validade</option>
          </select>
        </div>
      </FilterBar>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Itens em estoque" valor={String(totais.produtos)} tom="ink" />
          <KpiCard label="Alerta validade" valor={String(totais.alertasValidade)} tom={totais.alertasValidade > 0 ? 'rose' : 'ink'} />
          <KpiCard label="Abaixo do mínimo" valor={String(totais.abaixoMinimo)} tom={totais.abaixoMinimo > 0 ? 'orange' : 'ink'} />
          <KpiCard label="Valor total (CMV)" valor={R$(totais.valorTotal)} tom="ink" />
        </div>

        {/* Tabela */}
        {loading ? <Loader /> : saldos.length === 0 ? (
          <Vazio icon={<Package className="h-10 w-10" />} texto="Nenhum saldo encontrado para esta filial" />
        ) : (
          <TableCard>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Produto</Th>
                <Th>Lote</Th>
                <Th>Localização</Th>
                <Th className="text-right">Qtd</Th>
                <Th className="text-right">Disponível</Th>
                <Th className="text-right">CMV Unit.</Th>
                <Th>Validade</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => {
                const rowTint = s.alertaValidade ? 'bg-[#FF6B7A]/[0.05]' : s.abaixoMinimo ? 'bg-[#FF9F45]/[0.04]' : '';
                return (
                  <tr key={s.id} className={`border-t border-[#23262F] hover:bg-white/[0.03] ${rowTint}`}>
                    <td className="px-3 py-1 font-mono text-xs text-slate-500">{s.produto.codigo}</td>
                    <td className="px-3 py-1">
                      <p className="font-semibold text-[12.5px] leading-tight text-[#F7F8FA] truncate max-w-[240px]">{s.produto.descricao}</p>
                      <p className="text-slate-500 text-[10.5px] leading-tight">{s.produto.categoria}</p>
                    </td>
                    <td className="px-3 py-1 text-xs text-slate-400 font-mono">{s.lote?.numero || '—'}</td>
                    <td className="px-3 py-1 text-xs text-[#8A90A0]">{s.localizacao ? `${s.localizacao.rua}-${s.localizacao.prateleira}` : '—'}</td>
                    <td className="px-3 py-1 text-right">
                      <span className="font-bold text-[#F7F8FA] font-mono tabular-nums">{N(s.quantidade).toFixed(2)}</span>
                      <span className="text-xs text-[#8A90A0] ml-1">{s.produto.unidadeMedida.sigla}</span>
                    </td>
                    <td className="px-3 py-1 text-right font-mono tabular-nums">
                      <span className={N(s.quantidadeDisponivel) <= 0 ? 'text-[#FF6B7A] font-semibold' : 'text-[#2DD4A7] font-semibold'}>
                        {N(s.quantidadeDisponivel).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right font-mono tabular-nums text-[#8A90A0]">{R$(N(s.custoMedio))}</td>
                    <td className="px-3 py-1">
                      {s.lote?.dataValidade ? (
                        <div>
                          <p className={`text-xs font-medium ${s.alertaValidade ? 'text-[#FF6B7A]' : 'text-[#8A90A0]'}`}>
                            {new Date(s.lote.dataValidade).toLocaleDateString('pt-BR')}
                          </p>
                          {s.diasAteVencer !== null && (
                            <p className={`text-[10px] ${s.diasAteVencer <= 0 ? 'text-[#FF6B7A] font-bold' : s.alertaValidade ? 'text-[#FF9F45]' : 'text-slate-500'}`}>
                              {s.diasAteVencer <= 0 ? 'VENCIDO' : `${s.diasAteVencer}d restantes`}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex flex-col gap-1 items-start">
                        {s.alertaValidade && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF6B7A] bg-[#FF6B7A]/12 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-2.5 w-2.5" /> VENCENDO
                          </span>
                        )}
                        {s.abaixoMinimo && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF9F45] bg-[#FF9F45]/12 px-1.5 py-0.5 rounded">
                            ↓ MÍNIMO
                          </span>
                        )}
                        {!s.alertaValidade && !s.abaixoMinimo && (
                          <span className="text-[10px] text-[#2DD4A7] font-semibold">OK</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
      </div>
    </CadastroShell>
  );
}

function KpiCard({ label, valor, tom }: { label: string; valor: string; tom: 'ink' | 'rose' | 'orange' }) {
  const cor = tom === 'rose' ? 'text-[#FF6B7A]' : tom === 'orange' ? 'text-[#FF9F45]' : 'text-[#F7F8FA]';
  return (
    <div className="bg-[#16181F] border border-[#23262F] rounded-2xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[#8A90A0] font-semibold">{label}</p>
      <p className={`text-[23px] font-bold mt-1 font-mono tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}
