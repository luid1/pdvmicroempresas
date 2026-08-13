import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, RefreshCw, Plus, Send, Ban, CheckCircle2,
  FileStack, Receipt, Search, Printer, Undo2, X, ListChecks,
} from 'lucide-react';
import api, { nfeApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog, promptDialog } from '../../../components/ui/feedback';
import { imprimirDanfe } from '../danfe';

/* ══════════════════════════════════════════════════════════════════════════════
   GESTÃO FISCAL — painel único das NF-e reais (tabela NFe / módulo DFe).
   Lê os faturamentos de verdade (os mesmos de "NF-e Emitidas") e consolida
   KPIs + lista + ações (emitir/cancelar). Substitui a antiga camada Invoice
   (IBS/CBS) que ficava vazia.
   ════════════════════════════════════════════════════════════════════════════ */

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const primeiroDiaAno = () => `${new Date().getFullYear()}-01-01`;
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (v: any) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

type StatusDFe = 'RASCUNHO' | 'PENDENTE_EMISSAO' | 'EMITIDO' | 'CANCELADO' | 'DENEGADO' | 'INUTILIZADO' | 'CONTINGENCIA';
const STATUS_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-slate-500/15 text-[#8B8D98] border-slate-500/30' },
  PENDENTE_EMISSAO: { label: 'Pendente', cls: 'bg-amber-500/15 text-[#a9760a] border-[#E8A317]/30' },
  EMITIDO: { label: 'Emitida', cls: 'bg-emerald-500/15 text-[#0b7d4e] border-emerald-500/30' },
  CANCELADO: { label: 'Cancelada', cls: 'bg-rose-500/15 text-[#c3352b] border-rose-500/30' },
  DENEGADO: { label: 'Denegada', cls: 'bg-amber-500/15 text-[#a9760a] border-[#E8A317]/30' },
  INUTILIZADO: { label: 'Inutilizada', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  CONTINGENCIA: { label: 'Contingência', cls: 'bg-slate-500/15 text-[#8B8D98] border-slate-500/30' },
};

interface Nota {
  id: string;
  numero: number;
  serie: string;
  status: StatusDFe;
  pedidoNumero: number | null;
  cliente: string;
  liquido: number;
  impostos: number;
  bruto: number;
  emissao: string | null;
  chave: string | null;
}

// Mapeia uma NF-e do backend para a linha exibida.
function mapNota(nfe: any): Nota {
  const impostos =
    Number(nfe.valorIcms || 0) + Number(nfe.valorIcmsSt || 0) + Number(nfe.valorIpi || 0) +
    Number(nfe.valorPis || 0) + Number(nfe.valorCofins || 0);
  return {
    id: nfe.id,
    numero: nfe.numero,
    serie: nfe.serie || '1',
    status: nfe.status,
    pedidoNumero: nfe.pedido?.numero ?? null,
    cliente: nfe.destRazaoSocial || nfe.cliente?.razaoSocial || '—',
    liquido: Number(nfe.valorProdutos || 0),
    impostos: Math.round(impostos * 100) / 100,
    bruto: Number(nfe.valorNfe || 0),
    emissao: nfe.dataEmissao || null,
    chave: nfe.chaveAcesso || null,
  };
}

export default function GestaoFiscal() {
  const { pode, filialAtiva } = useAuth() as any;
  const podeOperar = pode('/fiscal/gestao', 'EDITAR');
  const filialId = filialAtiva?.id || '';

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [ini, setIni] = useState(primeiroDiaAno());
  const [fim, setFim] = useState(hojeISO());
  const [status, setStatus] = useState<'' | StatusDFe>('');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(() => {
    if (!filialId) { setNotas([]); setLoading(false); return; }
    setLoading(true);
    const params: any = { dataInicio: ini, dataFim: fim + 'T23:59:59' };
    if (status) params.status = status;
    nfeApi.list(filialId, params)
      .then((r) => setNotas(Array.isArray(r.data) ? r.data.map(mapNota) : []))
      .catch(() => setNotas([]))
      .finally(() => setLoading(false));
  }, [filialId, ini, fim, status]);
  useEffect(() => { carregar(); }, [carregar]);

  // Filtro por nº da nota (client-side) + resumo derivado da lista.
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? notas.filter((n) => String(n.numero).includes(q) || (n.chave || '').includes(q)) : notas;
  }, [notas, busca]);

  const resumo = useMemo(() => {
    const emitidas = filtradas.filter((n) => n.status === 'EMITIDO');
    return {
      totalNotas: filtradas.length,
      valorEmitido: emitidas.reduce((s, n) => s + n.bruto, 0),
      valorImpostosTotal: filtradas.reduce((s, n) => s + n.impostos, 0),
      valorBrutoTotal: filtradas.reduce((s, n) => s + n.bruto, 0),
    };
  }, [filtradas]);

  const acao = async (fn: Promise<any>, ok: string) => {
    try { await fn; toast(ok, 'success'); carregar(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Falha na operação.', 'error'); }
  };

  const emitir = async (id: string) => {
    if (!(await confirmDialog('Emitir esta NF-e para a SEFAZ?', { okLabel: 'Emitir' }))) return;
    acao(nfeApi.emitir(id), 'NF-e emitida com sucesso.');
  };

  // Detalhe da nota (abre o modal com todas as ações).
  const abrirDetalhe = async (id: string) => {
    try { const { data } = await api.get(`/nfe/documento/${id}`); setDetalhe(data); }
    catch { toast('Não foi possível abrir a nota.', 'error'); }
  };
  const abrirDanfe = async (id: string) => {
    try { const { data } = await api.get(`/nfe/documento/${id}`); imprimirDanfe(data); }
    catch { toast('Não foi possível gerar o DANFE.', 'error'); }
  };
  const cancelar = async (id: string) => {
    const motivo = await promptDialog('Motivo do cancelamento (mín. 15 caracteres):');
    if (!motivo) return;
    try { await api.patch(`/nfe/${id}/cancelar`, { motivo }); setDetalhe(null); carregar(); toast('NF-e cancelada.', 'success'); }
    catch (e: any) { toast(e?.response?.data?.message || 'Erro ao cancelar.', 'error'); }
  };
  const enviarCce = async (id: string) => {
    const correcao = await promptDialog('Carta de Correção (CC-e) — mín. 15, máx. 1000 caracteres.');
    if (correcao === null) return;
    const texto = correcao.trim();
    if (texto.length < 15) { toast(`A correção precisa ter ao menos 15 caracteres (você digitou ${texto.length}).`, 'error'); return; }
    if (texto.length > 1000) { toast(`A correção passa de 1000 caracteres (${texto.length}).`, 'error'); return; }
    try { await api.post(`/nfe/${id}/carta-correcao`, { correcao: texto }); await abrirDetalhe(id); carregar(); toast('CC-e registrada.', 'success'); }
    catch (e: any) { toast(e?.response?.data?.message || 'Erro na CC-e.', 'error'); }
  };
  const devolver = async (id: string) => {
    if (!await confirmDialog('Gerar e emitir NF-e de Devolução (total) desta nota? A mercadoria volta ao estoque e os títulos são anulados.', { tone: 'danger', okLabel: 'Emitir devolução' })) return;
    setBusy(true);
    try {
      const { data: dev } = await api.post(`/nfe/${id}/devolucao`);
      await api.post(`/nfe/${dev.id}/devolucao/emitir`);
      setDetalhe(null); carregar();
      toast('NF-e de devolução emitida.', 'success');
    } catch (e: any) { toast(e?.response?.data?.message || 'Erro na devolução.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#16171D]">
      <div className="bg-white border-b border-[#E7E5DF] px-6 pt-4 pb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#16171D] flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#a9760a]" /> Gestão Fiscal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Notas fiscais eletrônicas (NF-e) emitidas no faturamento</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-white border border-[#E7E5DF] rounded-lg px-2.5 py-1.5 text-sm text-[#16171D]" />
            </label>
            <button onClick={carregar} className="flex items-center gap-1.5 bg-white hover:bg-[#EFEDE7] text-[#5B5D69] text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#E7E5DF]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <a href="/fiscal/emitir" className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-semibold px-3 py-1.5 rounded-lg">
              <Plus className="h-4 w-4" /> Nova nota
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<FileStack className="h-4 w-4" />} cor="neutral" label="Notas no período" valor={loading ? null : String(resumo.totalNotas)} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} cor="emerald" label="Valor emitido" valor={loading ? null : R$(resumo.valorEmitido)} />
          <Kpi icon={<Receipt className="h-4 w-4" />} cor="amber" label="Impostos totais" valor={loading ? null : R$(resumo.valorImpostosTotal)} />
          <Kpi icon={<FileText className="h-4 w-4" />} cor="neutral" label="Valor bruto total" valor={loading ? null : R$(resumo.valorBrutoTotal)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border border-[#E7E5DF] rounded-lg overflow-hidden">
            {(['', 'RASCUNHO', 'EMITIDO', 'CANCELADO', 'DENEGADO'] as const).map(s => (
              <button key={s || 'all'} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${status === s ? 'bg-amber-500/20 text-[#a9760a]' : 'text-slate-400 hover:text-[#5B5D69]'}`}>
                {s === '' ? 'Todas' : STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="h-4 w-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº da nota…"
              className="bg-white border border-[#E7E5DF] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[#16171D] w-48" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E5DF] overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-9 bg-[#F0EEE9] rounded animate-pulse" />)}</div>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-slate-500 py-16 text-center">
              {notas.length === 0 ? 'Nenhuma NF-e no período. Fature um pedido em "Faturamento" para gerar notas.' : 'Nenhuma nota encontrada para a busca.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Número / Série</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Cliente / Pedido</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Líquido</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Impostos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Bruto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Emissão</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(n => (
                  <tr key={n.id} onClick={() => abrirDetalhe(n.id)} className="border-t border-[#E7E5DF] hover:bg-[#EFEDE7] cursor-pointer">
                    <td className="px-4 py-2.5 font-semibold text-[#16171D]">{n.numero}<span className="text-slate-500 font-normal"> · {n.serie}</span></td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${(STATUS_META[n.status] || STATUS_META.RASCUNHO).cls}`}>{(STATUS_META[n.status] || { label: n.status }).label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[#5B5D69] truncate max-w-[200px]">{n.cliente}</p>
                      {n.pedidoNumero != null && <p className="text-[11px] text-slate-500">Pedido #{n.pedidoNumero}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#8B8D98]">{R$(n.liquido)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#a9760a]">{R$(n.impostos)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16171D]">{R$(n.bruto)}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{dataBR(n.emissao)}</td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirDanfe(n.id)} title="Imprimir DANFE" className="p-1.5 rounded-lg text-[#8B8D98] hover:bg-[#F6F5F2]"><Printer className="h-4 w-4" /></button>
                        {podeOperar && (n.status === 'RASCUNHO' || n.status === 'PENDENTE_EMISSAO') && (
                          <button onClick={() => emitir(n.id)} title="Emitir na SEFAZ" className="p-1.5 rounded-lg text-[#0b7d4e] hover:bg-emerald-500/15"><Send className="h-4 w-4" /></button>
                        )}
                        {podeOperar && n.status === 'EMITIDO' && (
                          <>
                            <button onClick={() => enviarCce(n.id)} title="Carta de Correção" className="p-1.5 rounded-lg text-[#8B8D98] hover:bg-[#F6F5F2]"><FileText className="h-4 w-4" /></button>
                            <button onClick={() => devolver(n.id)} title="Devolução" className="p-1.5 rounded-lg text-[#a9760a] hover:bg-amber-500/15"><Undo2 className="h-4 w-4" /></button>
                            <button onClick={() => cancelar(n.id)} title="Cancelar nota" className="p-1.5 rounded-lg text-[#c3352b] hover:bg-rose-500/15"><Ban className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detalhe da nota — DANFE / CC-e / Devolução / duplicatas */}
      {detalhe && createPortal((
        <div className="fixed inset-0 bg-[#16171D]/40 flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setDetalhe(null)}>
          <div className="bg-[#F6F5F2] backdrop-blur-2xl border border-[#E7E5DF] shadow-[0_24px_80px_-12px_rgba(22,23,29,0.18)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E5DF] sticky top-0 bg-[#F6F5F2] backdrop-blur-xl z-10">
              <h2 className="font-bold text-[#16171D]">NF-e {String(detalhe.numero).padStart(6, '0')}/{detalhe.serie} · {detalhe.cliente?.razaoSocial || detalhe.destRazaoSocial || '—'}</h2>
              <button onClick={() => setDetalhe(null)} className="text-slate-400 hover:text-[#16171D]"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm text-[#5B5D69]">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Info label="Status" value={(STATUS_META[detalhe.status] || { label: detalhe.status }).label} />
                <Info label="CFOP" value={detalhe.cfop} />
                <Info label="Natureza" value={detalhe.naturezaOperacao} />
                <Info label="Valor total" value={R$(detalhe.valorNfe)} />
                <Info label="ICMS" value={R$(detalhe.valorIcms)} />
                <Info label="PIS / COFINS" value={`${R$(detalhe.valorPis)} / ${R$(detalhe.valorCofins)}`} />
                <Info label="Emissão" value={dataBR(detalhe.dataEmissao)} />
                <Info label="Chave" value={detalhe.chaveAcesso || '—'} className="col-span-2" />
              </div>

              <div>
                <h3 className="font-bold text-xs text-[#8B8D98] mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Duplicatas</h3>
                {detalhe.duplicatas?.length ? (
                  <div className="border border-[#E7E5DF] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-white text-slate-400"><tr>{['Parcela', 'Vencimento', 'Valor'].map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {detalhe.duplicatas.map((d: any) => (
                          <tr key={d.id} className="border-t border-[#E7E5DF]">
                            <td className="px-2 py-1 font-mono">{d.numero}</td>
                            <td className="px-2 py-1">{dataBR(d.dataVenc)}</td>
                            <td className="px-2 py-1 text-right font-mono">{R$(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-slate-500">Sem parcelas registradas.</p>}
              </div>

              {detalhe.cartasCorrecao?.length > 0 && (
                <div>
                  <h3 className="font-bold text-xs text-[#8B8D98] mb-1">Cartas de Correção (CC-e)</h3>
                  <div className="space-y-1">
                    {detalhe.cartasCorrecao.map((c: any) => (
                      <div key={c.id} className="text-xs bg-[#F6F5F2] text-[#8B8D98] rounded px-2 py-1">
                        <b>#{c.sequencia}</b> · {dataBR(c.dataEvento)} — {c.correcao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 border-t border-[#E7E5DF] flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => abrirDanfe(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#E7E5DF] text-[#5B5D69] text-sm flex items-center gap-1 hover:bg-[#EFEDE7]"><Printer className="h-4 w-4" /> DANFE</button>
              {podeOperar && detalhe.status === 'EMITIDO' && detalhe.finalidade !== '4' && (
                <>
                  <button onClick={() => enviarCce(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#E7E5DF] text-[#5B5D69] text-sm flex items-center gap-1 hover:bg-[#EFEDE7]"><FileText className="h-4 w-4" /> CC-e</button>
                  <button disabled={busy} onClick={() => devolver(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#E8A317]/40 text-[#a9760a] text-sm flex items-center gap-1 disabled:opacity-40 hover:bg-[#E8A317]/12"><Undo2 className="h-4 w-4" /> Devolução</button>
                  <button onClick={() => cancelar(detalhe.id)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm flex items-center gap-1"><Ban className="h-4 w-4" /> Cancelar</button>
                </>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: any; className?: string }) {
  return <div className={className}><div className="text-[10px] uppercase text-slate-500 font-semibold">{label}</div><div className="font-mono text-[#5B5D69] break-all">{value}</div></div>;
}

const CORES: Record<string, string> = {
  amber: 'bg-[#E8A317]/12 text-[#a9760a]',
  neutral: 'bg-[#F6F5F2] text-[#8B8D98]',
  rose: 'bg-rose-400/10 text-[#c3352b]',
  emerald: 'bg-emerald-400/10 text-[#0b7d4e]',
};
function Kpi({ icon, label, valor, cor }: { icon: any; label: string; valor: string | null; cor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E5DF] p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null ? <div className="h-7 w-24 bg-[#F0EEE9] rounded animate-pulse" /> : <p className="text-2xl font-extrabold text-[#16171D] tracking-tight truncate">{valor}</p>}
    </div>
  );
}
