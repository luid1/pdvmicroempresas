import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Undo2, RefreshCw, X, Trash2, PackageMinus, Search } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../../components/ui/feedback';
import { devolucoesCompraApi, fornecedoresApi, produtosApi, entradasApi } from '../../../services/api';
import { CadastroShell, TopBar, TableCard, Th, Loader, Vazio, FAB } from '../../cadastros/ui';

interface Devolucao {
  id: string;
  numero: number;
  fornecedorId: string;
  fornecedorNome: string;
  entradaId: string | null;
  motivo: string | null;
  valorTotal: number;
  status: string;
  createdAt: string;
  itens: { id: string; descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
}

const brl = (v: any) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (s: string) => new Date(s).toLocaleDateString('pt-BR');

export default function DevolucoesCompra() {
  const { pode } = useAuth();
  const podeOperar = pode('/wms/devolucoes-compra', 'CRIAR') || pode('/wms/entradas', 'EDITAR');

  const [lista, setLista] = useState<Devolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    devolucoesCompraApi.list()
      .then((r) => setLista(r.data || []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <CadastroShell>
      <TopBar icon={<Undo2 className="h-5 w-5" />} titulo="Devoluções ao Fornecedor"
        subtitulo="Devolve mercadoria de uma compra: baixa o estoque e reduz/estorna o título a pagar da entrada."
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-1.5 rounded-lg text-[#8A90A0] text-sm"><RefreshCw className={`h-4 w-4 text-[#01B8FA] ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>} />
      {podeOperar && <FAB onClick={() => setCriando(true)} label="Nova devolução" />}

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<Undo2 className="h-10 w-10" />} texto="Nenhuma devolução registrada. Clique em Nova devolução para registrar." /> : (
          <TableCard>
            <thead><tr>
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Fornecedor</Th>
              <Th>Motivo</Th>
              <Th className="text-center">Itens</Th>
              <Th className="text-right">Valor</Th>
              <Th className="text-center">Status</Th>
            </tr></thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                  <td className="px-3 py-1 text-[#8A90A0] font-mono">#{d.numero}</td>
                  <td className="px-3 py-1 text-slate-400">{dataBr(d.createdAt)}</td>
                  <td className="px-3 py-1 font-semibold text-[#F7F8FA]">{d.fornecedorNome}</td>
                  <td className="px-3 py-1 text-slate-400">{d.motivo || '—'}</td>
                  <td className="px-3 py-1 text-center text-[#8A90A0]">{d.itens?.length ?? 0}</td>
                  <td className="px-3 py-1 text-right text-[#F7F8FA] tabular-nums font-semibold font-mono">{brl(d.valorTotal)}</td>
                  <td className="px-3 py-1 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status === 'CONFIRMADA' ? 'bg-[#2DD4A7]/12 text-[#2DD4A7]' : 'bg-[#16181F] text-[#8A90A0]'}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {criando && <ModalDevolucao onClose={() => setCriando(false)} onDone={() => { setCriando(false); carregar(); }} />}
    </CadastroShell>
  );
}

interface LinhaItem { produtoId: string; descricao: string; quantidade: string; valorUnitario: string; loteId?: string }

function ModalDevolucao({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { filiais, filialAtiva } = useAuth();
  const [filialId, setFilialId] = useState(filialAtiva?.id || '');
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [fornecedorId, setFornecedorId] = useState('');
  const [entradaId, setEntradaId] = useState('');
  const [entradas, setEntradas] = useState<any[]>([]);
  const [motivo, setMotivo] = useState('');
  const [itens, setItens] = useState<LinhaItem[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Busca de produto para adicionar
  const [buscaProd, setBuscaProd] = useState('');
  const [produtos, setProdutos] = useState<any[]>([]);

  useEffect(() => {
    fornecedoresApi.list().then((r) => setFornecedores(r.data?.items || r.data || [])).catch(() => setFornecedores([]));
  }, []);

  // Carrega entradas do fornecedor selecionado (para prefill opcional)
  useEffect(() => {
    if (!fornecedorId) { setEntradas([]); return; }
    entradasApi.list({ search: '' }).then((r) => {
      const all = r.data?.items || r.data || [];
      setEntradas(all.filter((e: any) => e.fornecedorId === fornecedorId));
    }).catch(() => setEntradas([]));
  }, [fornecedorId]);

  useEffect(() => {
    const q = buscaProd.trim();
    if (q.length < 2) { setProdutos([]); return; }
    const t = setTimeout(() => {
      produtosApi.list({ search: q, take: 12 }).then((r) => setProdutos(r.data?.items || r.data || [])).catch(() => setProdutos([]));
    }, 250);
    return () => clearTimeout(t);
  }, [buscaProd]);

  const carregarEntrada = async (id: string) => {
    setEntradaId(id);
    if (!id) return;
    try {
      const r = await entradasApi.get(id);
      const e = r.data;
      if (e?.fornecedorId) setFornecedorId(e.fornecedorId);
      const linhas: LinhaItem[] = (e.itens || []).filter((it: any) => it.produtoId).map((it: any) => ({
        produtoId: it.produtoId,
        descricao: it.descricao,
        quantidade: String(it.quantidade),
        valorUnitario: String(it.valorUnitario),
      }));
      setItens(linhas);
    } catch { toast('Falha ao carregar a entrada.', 'error'); }
  };

  const addProduto = (p: any) => {
    if (itens.some((i) => i.produtoId === p.id)) { setBuscaProd(''); setProdutos([]); return; }
    setItens((prev) => [...prev, { produtoId: p.id, descricao: p.descricao, quantidade: '1', valorUnitario: String(p.precoCusto || 0) }]);
    setBuscaProd(''); setProdutos([]);
  };

  const setLinha = (idx: number, campo: keyof LinhaItem, valor: string) =>
    setItens((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  const removerLinha = (idx: number) => setItens((prev) => prev.filter((_, i) => i !== idx));

  const total = itens.reduce((s, l) => s + (parseFloat(l.quantidade.replace(',', '.')) || 0) * (parseFloat(l.valorUnitario.replace(',', '.')) || 0), 0);

  const confirmar = async () => {
    if (!filialId) { toast('Selecione a filial.', 'error'); return; }
    if (!fornecedorId) { toast('Selecione o fornecedor.', 'error'); return; }
    if (itens.length === 0) { toast('Adicione ao menos um item.', 'error'); return; }
    const itensDto = itens.map((l) => ({
      produtoId: l.produtoId,
      descricao: l.descricao,
      quantidade: parseFloat(l.quantidade.replace(',', '.')) || 0,
      valorUnitario: parseFloat(l.valorUnitario.replace(',', '.')) || 0,
      loteId: l.loteId,
    }));
    if (itensDto.some((i) => i.quantidade <= 0)) { toast('Quantidade dos itens deve ser positiva.', 'error'); return; }
    setSalvando(true);
    try {
      await devolucoesCompraApi.create({
        filialId,
        fornecedorId,
        entradaId: entradaId || undefined,
        motivo: motivo || undefined,
        itens: itensDto,
      });
      toast('Devolução registrada. Estoque baixado e título ajustado.', 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao registrar devolução.', 'error');
    } finally { setSalvando(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-backdrop p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto bg-[#101216] border border-[#23262F] rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] p-5 animate-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-[#F7F8FA] flex items-center gap-2"><PackageMinus className="h-5 w-5 text-[#01B8FA]" /> Nova devolução ao fornecedor</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-white/[0.06] text-slate-400 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-slate-400">Filial</span>
            <select value={filialId} onChange={e => setFilialId(e.target.value)}
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]">
              <option value="">Selecione…</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Fornecedor</span>
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]">
              <option value="">Selecione…</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
            </select>
          </label>
        </div>

        {entradas.length > 0 && (
          <label className="block mb-3">
            <span className="text-xs text-slate-400">Entrada de origem (opcional — prefill de itens + estorno do título)</span>
            <select value={entradaId} onChange={e => carregarEntrada(e.target.value)}
              className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]">
              <option value="">Sem vínculo</option>
              {entradas.map((e) => <option key={e.id} value={e.id}>NF {e.numeroNf || e.id.slice(0, 8)} — {brl(e.valorTotal)}</option>)}
            </select>
          </label>
        )}

        <label className="block mb-3">
          <span className="text-xs text-slate-400">Motivo</span>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Avaria, divergência, validade…"
            className="mt-1 w-full bg-[#101216] border border-[#23262F] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]" />
        </label>

        {/* Adicionar produto */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Adicionar produto por nome ou código…"
            className="w-full bg-[#101216] border border-[#23262F] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#01B8FA]" />
          {produtos.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto bg-[#101216] border border-[#23262F] rounded-lg shadow-xl">
              {produtos.map((pr) => (
                <button key={pr.id} type="button" onClick={() => addProduto(pr)} className="w-full text-left px-3 py-2 text-sm text-[#F7F8FA] hover:bg-white/[0.04]">
                  <span className="font-mono text-xs text-slate-500">{pr.codigo}</span> {pr.descricao}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#23262F] overflow-hidden mb-3">
          <table className="w-full text-sm">
            <thead className="bg-[#0C0D10] text-[11px] uppercase text-[#8A90A0]">
              <tr>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2 w-24">Qtde</th>
                <th className="text-right px-3 py-2 w-28">Custo un.</th>
                <th className="text-right px-3 py-2 w-28">Total</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nenhum item.</td></tr>
              ) : itens.map((l, idx) => {
                const tot = (parseFloat(l.quantidade.replace(',', '.')) || 0) * (parseFloat(l.valorUnitario.replace(',', '.')) || 0);
                return (
                  <tr key={idx} className="border-t border-[#23262F]">
                    <td className="px-3 py-2 text-[#F7F8FA]">{l.descricao}</td>
                    <td className="px-3 py-2 text-right">
                      <input value={l.quantidade} onChange={e => setLinha(idx, 'quantidade', e.target.value)}
                        className="w-20 bg-[#101216] border border-[#23262F] rounded px-2 py-1 text-right text-[#F7F8FA] font-mono focus:outline-none focus:border-[#01B8FA]" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input value={l.valorUnitario} onChange={e => setLinha(idx, 'valorUnitario', e.target.value)}
                        className="w-24 bg-[#101216] border border-[#23262F] rounded px-2 py-1 text-right text-[#F7F8FA] font-mono focus:outline-none focus:border-[#01B8FA]" />
                    </td>
                    <td className="px-3 py-2 text-right text-[#F7F8FA] tabular-nums font-mono">{brl(tot)}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removerLinha(idx)} className="h-7 w-7 rounded hover:bg-rose-500/10 text-[#FF6B7A] flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total da devolução</span>
          <span className="text-lg font-bold text-[#F7F8FA] tabular-nums font-mono">{brl(total)}</span>
        </div>

        <button onClick={confirmar} disabled={salvando} className="mt-4 w-full flex items-center justify-center gap-2 bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] font-bold py-2.5 rounded-lg shadow-[0_6px_18px_rgba(1,184,250,0.28)] transition-all disabled:opacity-40">
          <Undo2 className="h-4 w-4" /> Registrar devolução
        </button>
      </div>
    </div>
  ), document.body);
}
