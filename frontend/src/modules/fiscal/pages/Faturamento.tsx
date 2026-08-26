import { toast } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, RefreshCw, FileText, Printer, Check, AlertTriangle, Loader2, ShieldCheck, X, XCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { imprimirDanfe } from '../danfe';
import { PageHeader, btnGlass } from '../../cadastros/ui';
import SeloSimulacao from '../../../components/ui/SeloSimulacao';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Faturamento() {
  const { filialAtiva } = useAuth();
  const [data, setData] = useState(hojeISO());
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; erros: string[] } | null>(null);
  const [andamento, setAndamento] = useState<string>('');
  const [conferindo, setConferindo] = useState<any | null>(null); // pedido em conferência
  const [validacao, setValidacao] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [carregandoConf, setCarregandoConf] = useState(false);

  const carregar = useCallback(() => {
    if (!filialAtiva) return;
    setLoading(true);
    api.get('/pedidos', { params: { filialId: filialAtiva.id, status: 'SEPARADO', dataInicio: data, dataFim: data } })
      .then(r => { setPedidos(r.data); setSel(new Set()); })
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, [filialAtiva?.id, data]);
  useEffect(() => { carregar(); }, [carregar]);

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(sel.size === pedidos.length ? new Set() : new Set(pedidos.map(p => p.id)));

  // Fatura um pedido: gera NF-e + emite (mock SEFAZ). Devolve a NF-e emitida.
  const faturarUm = async (pedidoId: string) => {
    const { data: nfe } = await api.post(`/nfe/gerar-de-pedido/${pedidoId}`, { filialId: filialAtiva!.id });
    await api.post(`/nfe/${nfe.id}/emitir`);
    const { data: full } = await api.get(`/nfe/documento/${nfe.id}`);
    return full;
  };

  const faturarSelecionados = async () => {
    if (sel.size === 0 || processando) return;
    setProcessando(true); setResultado(null);
    const ids = Array.from(sel);
    let ok = 0; const erros: string[] = []; let ultima: any = null;
    for (let i = 0; i < ids.length; i++) {
      const p = pedidos.find(x => x.id === ids[i]);
      setAndamento(`Faturando ${i + 1}/${ids.length} — ${p?.cliente?.nomeFantasia || p?.cliente?.razaoSocial || ''}`);
      try { ultima = await faturarUm(ids[i]); ok++; }
      catch (e: any) { erros.push(`${p?.cliente?.razaoSocial || ids[i]}: ${e.response?.data?.message || 'erro'}`); }
    }
    setAndamento('');
    setProcessando(false);
    setResultado({ ok, erros });
    carregar();
    if (ok === 1 && ultima) imprimirDanfe(ultima); // 1 só → já abre a DANFE
  };

  const conferir = async (pedido: any) => {
    setConferindo(pedido); setValidacao(null); setPreview(null); setCarregandoConf(true);
    try {
      const [v, p] = await Promise.all([
        api.get(`/fiscal/validar/${pedido.id}`),
        api.get(`/fiscal/preview/${pedido.id}`),
      ]);
      setValidacao(v.data); setPreview(p.data);
    } catch { /* ignore */ }
    finally { setCarregandoConf(false); }
  };

  const faturarLinha = async (pedidoId: string) => {
    if (processando) return;
    setProcessando(true); setResultado(null);
    try { const nfe = await faturarUm(pedidoId); carregar(); imprimirDanfe(nfe); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro ao faturar.'); }
    finally { setProcessando(false); }
  };

  const totalSel = pedidos.filter(p => sel.has(p.id)).reduce((s, p) => s + Number(p.valorTotal || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Receipt className="h-4 w-4" />}
        titulo="Faturamento"
        subtitulo={`${pedidos.length} pedido(s) liberado(s) p/ faturamento`}
        actions={
          <>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="bg-[#101216] border border-[#23262F] rounded-lg px-3 py-1.5 text-xs text-[#F7F8FA] [color-scheme:dark] focus:outline-none focus:border-[#01B8FA]/60" />
            <button onClick={carregar} className={btnGlass}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
          </>
        }
      />

      <SeloSimulacao detalhe="gera a NF-e e baixa estoque + conta a receber, mas não transmite para a SEFAZ." />


      {/* Barra de ação em lote */}
      <div className="bg-[#0C0D10] border-b border-[#23262F] px-5 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm text-[#8A90A0]">
          {sel.size > 0 ? <><b className="text-[#F7F8FA]">{sel.size}</b> selecionado(s) · total {R$(totalSel)}</> : 'Selecione pedidos para faturar em lote'}
        </span>
        <button onClick={faturarSelecionados} disabled={sel.size === 0 || processando}
          className="flex items-center gap-2 bg-[#01B8FA] hover:bg-[#01B8FA]/90 text-[#04121A] rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-40">
          {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {processando ? 'Faturando…' : `Faturar selecionados (${sel.size})`}
        </button>
      </div>

      {processando && andamento && <div className="px-5 py-2 text-xs text-[#FF9F45] bg-[#FF9F45]/10 border-b border-[#FF9F45]/20">{andamento}</div>}
      {resultado && (
        <div className={`px-5 py-2 text-xs border-b ${resultado.erros.length ? 'bg-[#FF9F45]/10 border-[#FF9F45]/20 text-[#FF9F45]' : 'bg-[#2DD4A7]/10 border-[#2DD4A7]/20 text-[#2DD4A7]'}`}>
          <b>{resultado.ok}</b> faturado(s) com sucesso{resultado.erros.length > 0 && <> · <b>{resultado.erros.length}</b> com erro: {resultado.erros.join(' · ')}</>}.
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin h-6 w-6 border-2 border-[#01B8FA] border-t-transparent rounded-full" /></div>
        ) : pedidos.length === 0 ? (
          <div className="text-center text-[#8A90A0] py-16">
            <Receipt className="h-10 w-10 mx-auto mb-2 text-[#23262F]" />
            Nenhum pedido liberado para faturamento nesta data. Separe pedidos na Operacional primeiro.
          </div>
        ) : (
          <div className="bg-[#101216] rounded-xl border border-[#23262F] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="w-10 px-3 py-1.5 bg-[#0C0D10] border-b border-[#23262F]"><input type="checkbox" checked={sel.size === pedidos.length && pedidos.length > 0} onChange={toggleAll} className="accent-[#01B8FA] h-4 w-4" /></th>
                  {['Nº', 'Cliente', 'Itens', 'Peso (kg)', 'Valor', ''].map(h => <th key={h} className="px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] bg-[#0C0D10] border-b border-[#23262F] whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} className={`border-t border-[#23262F] ${sel.has(p.id) ? 'bg-[#01B8FA]/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                    <td className="px-3 py-2"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="accent-[#01B8FA] h-4 w-4" /></td>
                    <td className="px-3 py-2 font-bold text-[#01B8FA]">{p.numero}</td>
                    <td className="px-3 py-2 font-semibold text-[#F7F8FA]">{p.cliente?.nomeFantasia || p.cliente?.razaoSocial}</td>
                    <td className="px-3 py-2 text-center text-[#F7F8FA]">{p._count?.itens ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#F7F8FA]">{(Number(p.pesoTotal) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-[#F7F8FA]">{R$(p.valorTotal)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => conferir(p)} disabled={processando}
                          className="flex items-center gap-1 bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10] rounded px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">
                          <ShieldCheck className="h-3.5 w-3.5" /> Conferir
                        </button>
                        <button onClick={() => faturarLinha(p.id)} disabled={processando}
                          className="flex items-center gap-1 bg-[#01B8FA] hover:bg-[#01B8FA]/90 text-[#04121A] rounded px-3 py-1.5 text-xs font-bold disabled:opacity-40">
                          <Check className="h-3.5 w-3.5" /> Faturar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-[#8A90A0] mt-3 flex items-center gap-1"><Printer className="h-3 w-3" /> Ao faturar, a DANFE (modo teste) abre para impressão. As notas ficam em "NF-e Emitidas".</p>
      </div>

      {/* Modal de conferência: checklist anti-erro + preview de impostos */}
      {conferindo && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setConferindo(null)}>
          <div className="bg-[#101216] border border-[#23262F] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#23262F] sticky top-0 bg-[#101216] z-10">
              <h2 className="font-bold text-[#F7F8FA] flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#01B8FA]" /> Conferência — Pedido {conferindo.numero} · {conferindo.cliente?.nomeFantasia || conferindo.cliente?.razaoSocial}</h2>
              <button onClick={() => setConferindo(null)}><X className="h-5 w-5 text-[#8A90A0] hover:text-[#F7F8FA]" /></button>
            </div>

            {carregandoConf ? (
              <div className="flex justify-center py-16"><div className="animate-spin h-6 w-6 border-2 border-[#01B8FA] border-t-transparent rounded-full" /></div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-[#F7F8FA]">Validação anti-erro</h3>
                    {validacao && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${validacao.podeFaturar ? 'bg-[#2DD4A7]/12 text-[#2DD4A7]' : 'bg-[#FF6B7A]/12 text-[#FF6B7A]'}`}>
                        {validacao.podeFaturar ? 'Liberado para faturar' : `${validacao.bloqueios} bloqueio(s)`}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {validacao?.checks.map((c: any) => (
                      <div key={c.id} className={`flex items-start gap-2 text-sm px-2 py-1 rounded ${c.ok ? '' : c.severidade === 'BLOQUEIO' ? 'bg-[#FF6B7A]/10' : 'bg-[#FF9F45]/10'}`}>
                        {c.ok ? <CheckCircle2 className="h-4 w-4 text-[#2DD4A7] mt-0.5 shrink-0" /> : c.severidade === 'BLOQUEIO' ? <XCircle className="h-4 w-4 text-[#FF6B7A] mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-[#FF9F45] mt-0.5 shrink-0" />}
                        <div className="flex-1">
                          <span className={c.ok ? 'text-[#8A90A0]' : 'font-semibold text-[#F7F8FA]'}>{c.label}</span>
                          {c.detalhe && <span className="text-xs text-[#8A90A0] ml-1">— {c.detalhe}</span>}
                        </div>
                        {!c.ok && <span className={`text-[10px] font-bold ${c.severidade === 'BLOQUEIO' ? 'text-[#FF6B7A]' : 'text-[#FF9F45]'}`}>{c.severidade}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview de impostos */}
                {preview && (
                  <div>
                    <h3 className="font-bold text-sm text-[#F7F8FA] mb-2">Impostos calculados <span className="text-xs font-normal text-[#8A90A0]">({preview.contexto.interestadual ? 'interestadual' : 'interna'} · {preview.contexto.ufOrigem}→{preview.contexto.ufDestino}{preview.contexto.consumidorFinal ? ' · consumidor final' : ''})</span></h3>
                    <div className="border border-[#23262F] rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0C0D10] text-[#8A90A0]">
                          <tr>{['Item', 'NCM', 'CFOP', 'CST', 'Vlr', 'ICMS', 'PIS', 'COFINS'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.itens.map((it: any, i: number) => (
                            <tr key={i} className="border-t border-[#23262F]">
                              <td className="px-2 py-1 font-semibold text-[#F7F8FA] max-w-[180px] truncate">{it.descricao}</td>
                              <td className="px-2 py-1 font-mono text-[#F7F8FA]">{it.ncm}</td>
                              <td className="px-2 py-1 font-mono text-[#F7F8FA]">{it.cfop}</td>
                              <td className="px-2 py-1 font-mono text-[#F7F8FA]">{it.cstCsosn}</td>
                              <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(it.valorTotal)}</td>
                              <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(it.valorIcms)}</td>
                              <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(it.valorPis)}</td>
                              <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(it.valorCofins)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#0C0D10] font-bold text-[#F7F8FA]">
                          <tr className="border-t border-[#23262F]">
                            <td className="px-2 py-1.5" colSpan={5}>Totais — ST {R$(preview.totais.valorIcmsSt)} · IPI {R$(preview.totais.valorIpi)} · DIFAL {R$(preview.totais.valorDifal)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{R$(preview.totais.valorIcms)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{R$(preview.totais.valorPis)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{R$(preview.totais.valorCofins)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 py-3 border-t border-[#23262F] flex justify-end gap-2 sticky bottom-0 bg-[#101216]">
              <button onClick={() => setConferindo(null)} className="px-4 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] text-sm hover:bg-white/[0.03] hover:text-[#F7F8FA]">Fechar</button>
              <button
                disabled={!validacao?.podeFaturar || processando}
                onClick={async () => { const id = conferindo.id; setConferindo(null); await faturarLinha(id); }}
                className="px-5 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#01B8FA]/90 text-[#04121A] font-bold text-sm disabled:opacity-40">
                Faturar este pedido
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
