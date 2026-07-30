import { toast, confirmDialog, promptDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileText, RefreshCw, Printer, Ban, Mail, Undo2, X, ListChecks, Search } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { imprimirDanfe } from '../danfe';
import { PageHeader, btnGlass } from '../../cadastros/ui';
import SeloSimulacao from '../../../components/ui/SeloSimulacao';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

const STATUS_COR: Record<string, string> = {
  EMITIDO: 'bg-emerald-100 text-emerald-700',
  RASCUNHO: 'bg-gray-200 text-gray-600',
  PENDENTE_EMISSAO: 'bg-amber-100 text-amber-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REJEITADO: 'bg-red-100 text-red-700',
};

export default function NotasEmitidas() {
  const { filialAtiva } = useAuth();
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    const params: any = {};
    if (statusFiltro) params.status = statusFiltro;
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    api.get(`/nfe/${filialAtiva.id}`, { params }).then(r => setNotas(r.data)).catch(() => setNotas([])).finally(() => setLoading(false));
  }, [filialAtiva?.id, statusFiltro, dataInicio, dataFim]);
  useEffect(() => { carregar(); }, [carregar]);

  // Busca global client-side (chave, número ou cliente)
  const notasFiltradas = notas.filter(n => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (n.chaveAcesso || '').toLowerCase().includes(q)
      || String(n.numero).includes(q)
      || (n.cliente?.razaoSocial || '').toLowerCase().includes(q)
      || (n.cliente?.cnpjCpf || '').includes(q);
  });

  const abrirDetalhe = async (id: string) => {
    const { data } = await api.get(`/nfe/documento/${id}`);
    setDetalhe(data);
  };
  const abrirDanfe = async (id: string) => {
    const { data } = await api.get(`/nfe/documento/${id}`);
    imprimirDanfe(data);
  };
  const cancelar = async (id: string) => {
    const motivo = await promptDialog('Motivo do cancelamento (mín. 15 caracteres):');
    if (!motivo) return;
    try { await api.patch(`/nfe/${id}/cancelar`, { motivo }); setDetalhe(null); carregar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro ao cancelar.'); }
  };
  const enviarCce = async (id: string) => {
    const correcao = await promptDialog(
      'Carta de Correção (CC-e) — regra da SEFAZ: mínimo 15, máximo 1000 caracteres.\nEx.: "Corrigir o endereço de entrega do destinatário para Rua X, nº 100."',
    );
    if (correcao === null) return; // cancelou
    const texto = correcao.trim();
    if (texto.length < 15) { toast(`A correção precisa ter ao menos 15 caracteres (você digitou ${texto.length}).`, 'error'); return; }
    if (texto.length > 1000) { toast(`A correção passa de 1000 caracteres (${texto.length}).`, 'error'); return; }
    try { await api.post(`/nfe/${id}/carta-correcao`, { correcao: texto }); await abrirDetalhe(id); carregar(); toast('CC-e registrada (modo teste).', 'success'); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro na CC-e.', 'error'); }
  };
  const devolver = async (id: string) => {
    if (!await confirmDialog('Gerar e emitir Nota Fiscal de Devolução (total) desta NF-e? A mercadoria volta ao estoque e os títulos são anulados.')) return;
    setBusy(true);
    try {
      const { data: dev } = await api.post(`/nfe/${id}/devolucao`);
      await api.post(`/nfe/${dev.id}/devolucao/emitir`);
      setDetalhe(null); carregar();
      toast('NF-e de devolução emitida (modo teste).');
    } catch (e: any) { toast(e.response?.data?.message || 'Erro na devolução.'); }
    finally { setBusy(false); }
  };
  const enviarEmail = (n: any) => toast(`Modo teste: enviaria XML + DANFE para ${n.cliente?.email || 'o e-mail do cliente'}.`);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<FileText className="h-4 w-4" />}
        titulo="NF-e Emitidas"
        subtitulo={`${notasFiltradas.length} de ${notas.length} nota(s)`}
        actions={
          <button onClick={carregar} className={btnGlass}>
            <RefreshCw className="h-3.5 w-3.5 text-sky-400" /> Atualizar
          </button>
        }
      />

      <SeloSimulacao detalhe="notas geradas em simulação — sem transmissão à SEFAZ. CC-e e devolução também são simuladas." />

      {/* Barra de filtros */}
      <div className="bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.06] px-5 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por chave, nº ou cliente..."
            className="w-full border border-white/[0.08] bg-white/[0.04] text-slate-100 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-sky-400/60" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">De
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">Até
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </label>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
          <option value="">Todos os status</option>
          {['EMITIDO', 'CANCELADO', 'RASCUNHO', 'PENDENTE_EMISSAO', 'DENEGADO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { setBusca(''); setDataInicio(''); setDataFim(''); setStatusFiltro(''); }}
          className="text-xs text-gray-500 hover:text-gray-700 underline">Limpar</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full" /></div>
        ) : notasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 py-16"><FileText className="h-10 w-10 mx-auto mb-2 text-gray-200" /> Nenhuma NF-e encontrada com os filtros atuais.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-xs text-gray-600">
                <tr>{['Nº/Série', 'Tipo', 'Pedido', 'Cliente', 'Chave de acesso', 'Valor', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {notasFiltradas.map(n => (
                  <tr key={n.id} className="border-t border-gray-100 hover:bg-sky-50/40 cursor-pointer" onClick={() => abrirDetalhe(n.id)}>
                    <td className="px-3 py-2 font-bold text-gray-800">{String(n.numero).padStart(6, '0')}/{n.serie}</td>
                    <td className="px-3 py-2 text-xs">{n.finalidade === '4' ? <span className="text-orange-600 font-bold">DEVOLUÇÃO</span> : 'Venda'}</td>
                    <td className="px-3 py-2 text-gray-500">{n.pedido?.numero ? `nº ${n.pedido.numero}` : '—'}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{n.cliente?.razaoSocial}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500 max-w-[260px] truncate">{n.chaveAcesso || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{R$(n.valorNfe)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[n.status] || 'bg-gray-100'}`}>{n.status}</span>
                      {n._count?.cartasCorrecao > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">CC-e {n._count.cartasCorrecao}</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrirDanfe(n.id)} className="text-gray-400 hover:text-sky-600 p-1" title="Imprimir DANFE"><Printer className="h-4 w-4" /></button>
                      {n.status === 'EMITIDO' && n.finalidade !== '4' && <>
                        <button onClick={() => enviarCce(n.id)} className="text-gray-400 hover:text-blue-600 p-1" title="Carta de Correção"><FileText className="h-4 w-4" /></button>
                        <button onClick={() => devolver(n.id)} className="text-gray-400 hover:text-orange-600 p-1" title="Devolução"><Undo2 className="h-4 w-4" /></button>
                        <button onClick={() => cancelar(n.id)} className="text-gray-400 hover:text-red-600 p-1" title="Cancelar"><Ban className="h-4 w-4" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalhe da nota */}
      {detalhe && createPortal((
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setDetalhe(null)}>
          <div className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 sticky top-0 bg-[#0E141F]/95 backdrop-blur-xl z-10">
              <h2 className="font-bold text-gray-900">NF-e {String(detalhe.numero).padStart(6, '0')}/{detalhe.serie} · {detalhe.cliente?.razaoSocial}</h2>
              <button onClick={() => setDetalhe(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Info label="Status" value={detalhe.status} />
                <Info label="CFOP" value={detalhe.cfop} />
                <Info label="Natureza" value={detalhe.naturezaOperacao} />
                <Info label="Valor total" value={R$(detalhe.valorNfe)} />
                <Info label="ICMS" value={R$(detalhe.valorIcms)} />
                <Info label="PIS/COFINS" value={`${R$(detalhe.valorPis)} / ${R$(detalhe.valorCofins)}`} />
                <Info label="Emissão" value={dt(detalhe.dataEmissao)} />
                <Info label="Chave" value={detalhe.chaveAcesso || '—'} className="col-span-2" />
              </div>

              {/* Parcelas / duplicatas */}
              <div>
                <h3 className="font-bold text-xs text-gray-700 mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Desdobramento financeiro (duplicatas)</h3>
                {detalhe.duplicatas?.length ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-600"><tr>{['Parcela', 'Vencimento', 'Valor'].map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {detalhe.duplicatas.map((d: any) => (
                          <tr key={d.id} className="border-t border-gray-100">
                            <td className="px-2 py-1 font-mono">{d.numero}</td>
                            <td className="px-2 py-1">{dt(d.dataVenc)}</td>
                            <td className="px-2 py-1 text-right font-mono">{R$(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-gray-400">Sem parcelas registradas.</p>}
              </div>

              {/* Cartas de correção */}
              {detalhe.cartasCorrecao?.length > 0 && (
                <div>
                  <h3 className="font-bold text-xs text-gray-700 mb-1">Cartas de Correção (CC-e)</h3>
                  <div className="space-y-1">
                    {detalhe.cartasCorrecao.map((c: any) => (
                      <div key={c.id} className="text-xs bg-blue-50 rounded px-2 py-1">
                        <b>#{c.sequencia}</b> · {dt(c.dataEvento)} — {c.correcao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/10 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-[#0E141F]/95 backdrop-blur-xl">
              <button onClick={() => abrirDanfe(detalhe.id)} className="px-3 py-2 rounded-lg border text-gray-600 text-sm flex items-center gap-1"><Printer className="h-4 w-4" /> DANFE</button>
              <button onClick={() => enviarEmail(detalhe)} className="px-3 py-2 rounded-lg border text-gray-600 text-sm flex items-center gap-1"><Mail className="h-4 w-4" /> Enviar e-mail</button>
              {detalhe.status === 'EMITIDO' && detalhe.finalidade !== '4' && <>
                <button onClick={() => enviarCce(detalhe.id)} className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> CC-e</button>
                <button disabled={busy} onClick={() => devolver(detalhe.id)} className="px-3 py-2 rounded-lg border border-orange-300 text-orange-700 text-sm flex items-center gap-1 disabled:opacity-40"><Undo2 className="h-4 w-4" /> Devolução</button>
                <button onClick={() => cancelar(detalhe.id)} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm flex items-center gap-1"><Ban className="h-4 w-4" /> Cancelar</button>
              </>}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: any; className?: string }) {
  return <div className={className}><div className="text-[10px] uppercase text-gray-400 font-semibold">{label}</div><div className="font-mono text-gray-800 break-all">{value}</div></div>;
}
