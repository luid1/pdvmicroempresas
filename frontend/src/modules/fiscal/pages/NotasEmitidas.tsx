import { toast, confirmDialog, promptDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileText, RefreshCw, Printer, Ban, Mail, Undo2, X, ListChecks, Search } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { imprimirDanfe } from '../danfe';
import { PageHeader, btnGlass, TableCard, Th, Loader, Vazio } from '../../cadastros/ui';
import SeloSimulacao from '../../../components/ui/SeloSimulacao';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const STATUS_COR: Record<string, string> = {
  EMITIDO: 'bg-[#2DD4A7]/12 text-[#2DD4A7]',
  RASCUNHO: 'bg-[#16181F] border border-[#23262F] text-[#8A90A0]',
  PENDENTE_EMISSAO: 'bg-[#FF9F45]/12 text-[#FF9F45]',
  CANCELADO: 'bg-[#FF6B7A]/12 text-[#FF6B7A]',
  REJEITADO: 'bg-[#FF6B7A]/12 text-[#FF6B7A]',
};

export default function NotasEmitidas() {
  const { filialAtiva } = useAuth();
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  // Filtros
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    const params: any = {};
    if (statusFiltro) params.status = statusFiltro;
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim + 'T23:59:59';
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
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        }
      />

      <SeloSimulacao detalhe="notas geradas em simulação — sem transmissão à SEFAZ. CC-e e devolução também são simuladas." />

      {/* Barra de filtros */}
      <div className="bg-[#0C0D10] border-b border-[#23262F] px-5 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A90A0]" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por chave, nº ou cliente..."
            className="w-full border border-[#23262F] bg-[#101216] text-[#F7F8FA] rounded-lg pl-8 pr-3 py-1.5 text-sm placeholder:text-[#8A90A0] focus:outline-none focus:border-[#01B8FA]/60" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">De
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border border-[#23262F] bg-[#101216] text-[#F7F8FA] rounded px-2 py-1.5 text-sm [color-scheme:dark] focus:outline-none focus:border-[#01B8FA]/60" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">Até
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border border-[#23262F] bg-[#101216] text-[#F7F8FA] rounded px-2 py-1.5 text-sm [color-scheme:dark] focus:outline-none focus:border-[#01B8FA]/60" />
        </label>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className="border border-[#23262F] bg-[#101216] text-[#F7F8FA] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#01B8FA]/60">
          <option value="">Todos os status</option>
          {['EMITIDO', 'CANCELADO', 'RASCUNHO', 'PENDENTE_EMISSAO', 'DENEGADO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { setBusca(''); setDataInicio(''); setDataFim(''); setStatusFiltro(''); }}
          className="text-xs text-[#8A90A0] hover:text-[#F7F8FA] underline">Limpar</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <Loader />
        ) : notasFiltradas.length === 0 ? (
          <Vazio icon={<FileText className="h-10 w-10" />} texto="Nenhuma NF-e encontrada com os filtros atuais." />
        ) : (
          <TableCard>
            <thead>
              <tr>
                <Th>Nº/Série</Th>
                <Th>Tipo</Th>
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Chave de acesso</Th>
                <Th className="text-right">Valor</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map(n => (
                <tr key={n.id} className="group border-t border-[#23262F] hover:bg-white/[0.03] cursor-pointer transition-colors" onClick={() => abrirDetalhe(n.id)}>
                  <td className="px-3 py-1 font-bold text-[#F7F8FA] whitespace-nowrap">{String(n.numero).padStart(6, '0')}/{n.serie}</td>
                  <td className="px-3 py-1 text-xs">{n.finalidade === '4' ? <span className="text-[#FF9F45] font-bold">DEVOLUÇÃO</span> : <span className="text-[#8A90A0]">Venda</span>}</td>
                  <td className="px-3 py-1 text-[#8A90A0]">{n.pedido?.numero ? `nº ${n.pedido.numero}` : '—'}</td>
                  <td className="px-3 py-1 font-semibold text-[#F7F8FA]">{n.cliente?.razaoSocial}</td>
                  <td className="px-3 py-1 font-mono text-[11px] text-[#8A90A0] max-w-[260px] truncate">{n.chaveAcesso || '—'}</td>
                  <td className="px-3 py-1 text-right font-mono font-bold text-[#F7F8FA]">{R$(n.valorNfe)}</td>
                  <td className="px-3 py-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[n.status] || 'bg-[#16181F] border border-[#23262F] text-[#8A90A0]'}`}>{n.status}</span>
                    {n._count?.cartasCorrecao > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#01B8FA]/12 text-[#01B8FA]">CC-e {n._count.cartasCorrecao}</span>}
                  </td>
                  <td className="px-3 py-1 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => abrirDanfe(n.id)} className="text-[#8A90A0] hover:text-[#01B8FA] p-1" title="Imprimir DANFE"><Printer className="h-4 w-4" /></button>
                    {n.status === 'EMITIDO' && n.finalidade !== '4' && <>
                      <button onClick={() => enviarCce(n.id)} className="text-[#8A90A0] hover:text-[#01B8FA] p-1" title="Carta de Correção"><FileText className="h-4 w-4" /></button>
                      <button onClick={() => devolver(n.id)} className="text-[#8A90A0] hover:text-[#FF9F45] p-1" title="Devolução"><Undo2 className="h-4 w-4" /></button>
                      <button onClick={() => cancelar(n.id)} className="text-[#8A90A0] hover:text-[#FF6B7A] p-1" title="Cancelar"><Ban className="h-4 w-4" /></button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {/* Modal de detalhe da nota */}
      {detalhe && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setDetalhe(null)}>
          <div className="bg-[#101216] border border-[#23262F] shadow-[0_24px_80px_0_rgba(0,0,0,0.55)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#23262F] sticky top-0 bg-[#101216] z-10">
              <h2 className="font-bold text-[#F7F8FA] text-sm">NF-e {String(detalhe.numero).padStart(6, '0')}/{detalhe.serie} · {detalhe.cliente?.razaoSocial}</h2>
              <button onClick={() => setDetalhe(null)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10] transition-all"><X className="h-4 w-4" /></button>
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
                <h3 className="font-bold text-xs text-[#8A90A0] mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Desdobramento financeiro (duplicatas)</h3>
                {detalhe.duplicatas?.length ? (
                  <div className="border border-[#23262F] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0C0D10] text-[#8A90A0]"><tr>{['Parcela', 'Vencimento', 'Valor'].map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {detalhe.duplicatas.map((d: any) => (
                          <tr key={d.id} className="border-t border-[#23262F]">
                            <td className="px-2 py-1 font-mono text-[#F7F8FA]">{d.numero}</td>
                            <td className="px-2 py-1 text-[#8A90A0]">{dt(d.dataVenc)}</td>
                            <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-[#8A90A0]">Sem parcelas registradas.</p>}
              </div>

              {/* Cartas de correção */}
              {detalhe.cartasCorrecao?.length > 0 && (
                <div>
                  <h3 className="font-bold text-xs text-[#8A90A0] mb-1">Cartas de Correção (CC-e)</h3>
                  <div className="space-y-1">
                    {detalhe.cartasCorrecao.map((c: any) => (
                      <div key={c.id} className="text-xs bg-[#01B8FA]/[0.08] border border-[#01B8FA]/20 text-[#8A90A0] rounded px-2 py-1">
                        <b className="text-[#F7F8FA]">#{c.sequencia}</b> · {dt(c.dataEvento)} — {c.correcao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#23262F] flex flex-wrap justify-end gap-2 sticky bottom-0 bg-[#101216]">
              <button onClick={() => abrirDanfe(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10] text-sm flex items-center gap-1 transition-all"><Printer className="h-4 w-4" /> DANFE</button>
              <button onClick={() => enviarEmail(detalhe)} className="px-3 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10] text-sm flex items-center gap-1 transition-all"><Mail className="h-4 w-4" /> Enviar e-mail</button>
              {detalhe.status === 'EMITIDO' && detalhe.finalidade !== '4' && <>
                <button onClick={() => enviarCce(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#01B8FA]/30 text-[#01B8FA] hover:bg-[#01B8FA]/10 text-sm flex items-center gap-1 transition-all"><FileText className="h-4 w-4" /> CC-e</button>
                <button disabled={busy} onClick={() => devolver(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#FF9F45]/30 text-[#FF9F45] hover:bg-[#FF9F45]/10 text-sm flex items-center gap-1 disabled:opacity-40 transition-all"><Undo2 className="h-4 w-4" /> Devolução</button>
                <button onClick={() => cancelar(detalhe.id)} className="px-3 py-2 rounded-lg bg-[#FF6B7A] hover:brightness-110 text-[#2A0B0E] text-sm font-semibold flex items-center gap-1 transition-all"><Ban className="h-4 w-4" /> Cancelar</button>
              </>}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: any; className?: string }) {
  return <div className={className}><div className="text-[10px] uppercase text-[#8A90A0] font-semibold">{label}</div><div className="font-mono text-[#F7F8FA] break-all">{value}</div></div>;
}
