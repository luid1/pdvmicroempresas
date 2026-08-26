import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, RefreshCw, Plus, Send, Ban, CheckCircle2,
  FileStack, Receipt, Search, Printer, Undo2, X, ListChecks,
  Mail, FlaskConical, ShieldCheck,
} from 'lucide-react';
import api, { nfeApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, confirmDialog, promptDialog } from '../../../components/ui/feedback';
import { imprimirDanfe } from '../danfe';
import { PageHeader, btnGlass, btnPrimary } from '../../cadastros/ui';

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
  RASCUNHO: { label: 'Rascunho', cls: 'bg-[#16181F] text-[#8A90A0] border-[#23262F]' },
  PENDENTE_EMISSAO: { label: 'Pendente', cls: 'bg-[#FF9F45]/12 text-[#FF9F45] border-[#FF9F45]/30' },
  EMITIDO: { label: 'Emitida', cls: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/30' },
  CANCELADO: { label: 'Cancelada', cls: 'bg-[#FF6B7A]/12 text-[#FF6B7A] border-[#FF6B7A]/30' },
  DENEGADO: { label: 'Denegada', cls: 'bg-[#FF9F45]/12 text-[#FF9F45] border-[#FF9F45]/30' },
  INUTILIZADO: { label: 'Inutilizada', cls: 'bg-[#16181F] text-[#8A90A0] border-[#23262F]' },
  CONTINGENCIA: { label: 'Contingência', cls: 'bg-[#16181F] text-[#8A90A0] border-[#23262F]' },
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
  finalidade: string | null;
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
    finalidade: nfe.finalidade ?? null,
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

  // Filtro por nº da nota, chave ou cliente (client-side) + resumo derivado da lista.
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? notas.filter((n) => String(n.numero).includes(q) || (n.chave || '').includes(q) || n.cliente.toLowerCase().includes(q)) : notas;
  }, [notas, busca]);

  const resumo = useMemo(() => {
    const emitidas = filtradas.filter((n) => n.status === 'EMITIDO');
    // Notas de venda (finalidade ≠ 4) compõem o faturamento; as de devolução
    // (finalidade '4') o reduzem. Sem separar, uma devolução inflaria o emitido.
    const vendas = emitidas.filter((n) => n.finalidade !== '4');
    const devolucoesNotas = emitidas.filter((n) => n.finalidade === '4');
    const bruto = vendas.reduce((s, n) => s + n.bruto, 0);
    const valorDevolucoes = devolucoesNotas.reduce((s, n) => s + n.bruto, 0);
    return {
      totalNotas: filtradas.length,
      valorEmitido: bruto,
      valorDevolucoes,
      valorLiquido: bruto - valorDevolucoes,
      valorImpostosTotal: vendas.reduce((s, n) => s + n.impostos, 0),
      valorBrutoTotal: bruto,
    };
  }, [filtradas]);
  const temDevolucao = resumo.valorDevolucoes > 0;

  const acao = async (fn: Promise<any>, ok: string) => {
    try { await fn; toast(ok, 'success'); carregar(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Falha na operação.', 'error'); }
  };

  const emitir = async (id: string) => {
    if (!(await confirmDialog('Emitir esta NF-e para a SEFAZ?', { okLabel: 'Emitir' }))) return;
    acao(nfeApi.emitir(id), 'NF-e emitida com sucesso.');
  };

  // Envia a nota por e-mail abrindo o cliente de correio do usuário (mailto).
  // Não transmite nada pelo servidor — o próprio usuário revisa e envia.
  const enviarEmail = async (nf: any) => {
    let email = nf?.cliente?.email || '';
    if (!email) {
      const digitado = await promptDialog('E-mail do destinatário:');
      if (digitado === null) return;
      email = digitado.trim();
    }
    const numero = String(nf.numero).padStart(6, '0');
    const assunto = encodeURIComponent(`NF-e ${numero}/${nf.serie}${filialAtiva?.nome ? ` — ${filialAtiva.nome}` : ''}`);
    const corpo = encodeURIComponent(
      `Olá,\n\nSegue a referência da NF-e ${numero}/${nf.serie}.\n` +
      (nf.chaveAcesso ? `Chave de acesso: ${nf.chaveAcesso}\n` : '') +
      `Valor total: ${R$(nf.valorNfe)}\n\nAtenciosamente.`,
    );
    window.location.href = `mailto:${email}?subject=${assunto}&body=${corpo}`;
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
    <div className="flex flex-col h-full bg-[#08090A] text-[#F7F8FA]">
      <PageHeader
        icon={<Receipt className="h-4 w-4" />}
        titulo="Gestão Fiscal"
        subtitulo="Notas fiscais eletrônicas (NF-e) emitidas no faturamento"
        actions={
          <>
            <SeloSimulacao filialId={filialId} />
            <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">De
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="bg-[#101216] border border-[#23262F] rounded-lg px-2.5 py-1.5 text-sm text-[#F7F8FA] [color-scheme:dark] focus:outline-none focus:border-[#01B8FA]/60" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#8A90A0] font-semibold">Até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="bg-[#101216] border border-[#23262F] rounded-lg px-2.5 py-1.5 text-sm text-[#F7F8FA] [color-scheme:dark] focus:outline-none focus:border-[#01B8FA]/60" />
            </label>
            <button onClick={carregar} className={btnGlass}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <a href="/fiscal/emitir" className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Nova nota
            </a>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<FileStack className="h-4 w-4" />} cor="neutral" label="Notas no período" valor={loading ? null : String(resumo.totalNotas)} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} cor="emerald" label={temDevolucao ? 'Faturamento líquido' : 'Valor emitido'} valor={loading ? null : R$(temDevolucao ? resumo.valorLiquido : resumo.valorEmitido)} />
          <Kpi icon={<Receipt className="h-4 w-4" />} cor="amber" label="Impostos totais" valor={loading ? null : R$(resumo.valorImpostosTotal)} />
          {temDevolucao
            ? <Kpi icon={<Undo2 className="h-4 w-4" />} cor="rose" label="(−) Devoluções" valor={loading ? null : R$(resumo.valorDevolucoes)} />
            : <Kpi icon={<FileText className="h-4 w-4" />} cor="neutral" label="Valor bruto total" valor={loading ? null : R$(resumo.valorBrutoTotal)} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#101216] border border-[#23262F] rounded-lg overflow-hidden">
            {(['', 'RASCUNHO', 'EMITIDO', 'CANCELADO', 'DENEGADO'] as const).map(s => (
              <button key={s || 'all'} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${status === s ? 'bg-[#01B8FA]/15 text-[#01B8FA]' : 'text-[#8A90A0] hover:text-[#F7F8FA]'}`}>
                {s === '' ? 'Todas' : STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="h-4 w-4 text-[#8A90A0] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº, cliente ou chave…"
              className="bg-[#101216] border border-[#23262F] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[#F7F8FA] w-56 focus:outline-none focus:border-[#01B8FA]/60" />
          </div>
        </div>

        <div className="bg-[#101216] rounded-2xl border border-[#23262F] overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-9 bg-[#16181F] rounded animate-pulse" />)}</div>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-[#8A90A0] py-16 text-center">
              {notas.length === 0 ? 'Nenhuma NF-e no período. Fature um pedido em "Faturamento" para gerar notas.' : 'Nenhuma nota encontrada para a busca.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#0C0D10] text-xs text-[#8A90A0]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold border-b border-[#23262F]">Número / Série</th>
                  <th className="px-4 py-2.5 text-left font-semibold border-b border-[#23262F]">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold border-b border-[#23262F]">Cliente / Pedido</th>
                  <th className="px-4 py-2.5 text-right font-semibold border-b border-[#23262F]">Líquido</th>
                  <th className="px-4 py-2.5 text-right font-semibold border-b border-[#23262F]">Impostos</th>
                  <th className="px-4 py-2.5 text-right font-semibold border-b border-[#23262F]">Bruto</th>
                  <th className="px-4 py-2.5 text-left font-semibold border-b border-[#23262F]">Emissão</th>
                  <th className="px-4 py-2.5 text-right font-semibold border-b border-[#23262F]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(n => (
                  <tr key={n.id} onClick={() => abrirDetalhe(n.id)} className="border-t border-[#23262F] hover:bg-white/[0.03] cursor-pointer">
                    <td className="px-4 py-2.5 font-semibold text-[#F7F8FA] whitespace-nowrap">{n.numero}<span className="text-[#8A90A0] font-normal"> · {n.serie}</span>
                      {n.finalidade === '4' && <span className="ml-2 inline-flex items-center gap-1 align-middle rounded-full bg-[#A78BFA]/12 text-[#A78BFA] border border-[#A78BFA]/30 px-1.5 py-0.5 text-[10px] font-bold"><Undo2 className="h-3 w-3" /> Devolução</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${(STATUS_META[n.status] || STATUS_META.RASCUNHO).cls}`}>{(STATUS_META[n.status] || { label: n.status }).label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[#F7F8FA] truncate max-w-[200px]">{n.cliente}</p>
                      {n.pedidoNumero != null && <p className="text-[11px] text-[#8A90A0]">Pedido #{n.pedidoNumero}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#8A90A0]">{R$(n.liquido)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#FF9F45]">{R$(n.impostos)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#F7F8FA]">{R$(n.bruto)}</td>
                    <td className="px-4 py-2.5 text-[#8A90A0] text-xs">{dataBR(n.emissao)}</td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirDanfe(n.id)} title="Imprimir DANFE" className="p-1.5 rounded-lg text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-white/[0.05]"><Printer className="h-4 w-4" /></button>
                        {podeOperar && (n.status === 'RASCUNHO' || n.status === 'PENDENTE_EMISSAO') && (
                          <button onClick={() => emitir(n.id)} title="Emitir na SEFAZ" className="p-1.5 rounded-lg text-[#2DD4A7] hover:bg-[#2DD4A7]/15"><Send className="h-4 w-4" /></button>
                        )}
                        {podeOperar && n.status === 'EMITIDO' && (
                          <>
                            <button onClick={() => enviarCce(n.id)} title="Carta de Correção" className="p-1.5 rounded-lg text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-white/[0.05]"><FileText className="h-4 w-4" /></button>
                            <button onClick={() => devolver(n.id)} title="Devolução" className="p-1.5 rounded-lg text-[#FF9F45] hover:bg-[#FF9F45]/15"><Undo2 className="h-4 w-4" /></button>
                            <button onClick={() => cancelar(n.id)} title="Cancelar nota" className="p-1.5 rounded-lg text-[#FF6B7A] hover:bg-[#FF6B7A]/15"><Ban className="h-4 w-4" /></button>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setDetalhe(null)}>
          <div className="bg-[#101216] border border-[#23262F] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#23262F] sticky top-0 bg-[#101216] z-10">
              <h2 className="font-bold text-[#F7F8FA]">NF-e {String(detalhe.numero).padStart(6, '0')}/{detalhe.serie} · {detalhe.cliente?.razaoSocial || detalhe.destRazaoSocial || '—'}</h2>
              <button onClick={() => setDetalhe(null)} className="text-[#8A90A0] hover:text-[#F7F8FA]"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm text-[#8A90A0]">
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
                <h3 className="font-bold text-xs text-[#8A90A0] mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Duplicatas</h3>
                {detalhe.duplicatas?.length ? (
                  <div className="border border-[#23262F] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0C0D10] text-[#8A90A0]"><tr>{['Parcela', 'Vencimento', 'Valor'].map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {detalhe.duplicatas.map((d: any) => (
                          <tr key={d.id} className="border-t border-[#23262F]">
                            <td className="px-2 py-1 font-mono text-[#F7F8FA]">{d.numero}</td>
                            <td className="px-2 py-1 text-[#F7F8FA]">{dataBR(d.dataVenc)}</td>
                            <td className="px-2 py-1 text-right font-mono text-[#F7F8FA]">{R$(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-[#8A90A0]">Sem parcelas registradas.</p>}
              </div>

              {detalhe.cartasCorrecao?.length > 0 && (
                <div>
                  <h3 className="font-bold text-xs text-[#8A90A0] mb-1">Cartas de Correção (CC-e)</h3>
                  <div className="space-y-1">
                    {detalhe.cartasCorrecao.map((c: any) => (
                      <div key={c.id} className="text-xs bg-[#01B8FA]/[0.08] text-[#F7F8FA] rounded px-2 py-1">
                        <b>#{c.sequencia}</b> · {dataBR(c.dataEvento)} — {c.correcao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 border-t border-[#23262F] flex flex-wrap justify-end gap-2 sticky bottom-0 bg-[#101216]">
              <button onClick={() => abrirDanfe(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] text-sm flex items-center gap-1 hover:bg-white/[0.03] hover:text-[#F7F8FA]"><Printer className="h-4 w-4" /> DANFE</button>
              {detalhe.status === 'EMITIDO' && (
                <button onClick={() => enviarEmail(detalhe)} className="px-3 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] text-sm flex items-center gap-1 hover:bg-white/[0.03] hover:text-[#F7F8FA]"><Mail className="h-4 w-4" /> E-mail</button>
              )}
              {podeOperar && detalhe.status === 'EMITIDO' && detalhe.finalidade !== '4' && (
                <>
                  <button onClick={() => enviarCce(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] text-sm flex items-center gap-1 hover:bg-white/[0.03] hover:text-[#F7F8FA]"><FileText className="h-4 w-4" /> CC-e</button>
                  <button disabled={busy} onClick={() => devolver(detalhe.id)} className="px-3 py-2 rounded-lg border border-[#FF9F45]/40 text-[#FF9F45] text-sm flex items-center gap-1 disabled:opacity-40 hover:bg-[#FF9F45]/12"><Undo2 className="h-4 w-4" /> Devolução</button>
                  <button onClick={() => cancelar(detalhe.id)} className="px-3 py-2 rounded-lg bg-[#FF6B7A] hover:bg-[#FF6B7A]/90 text-[#2A0B0E] text-sm font-semibold flex items-center gap-1"><Ban className="h-4 w-4" /> Cancelar</button>
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
  return <div className={className}><div className="text-[10px] uppercase text-[#8A90A0] font-semibold">{label}</div><div className="font-mono text-[#F7F8FA] break-all">{value}</div></div>;
}

// Selo do ambiente de emissão — deixa explícito quando as notas NÃO têm validade
// fiscal (simulação/homologação) para ninguém confundir com produção.
function SeloSimulacao({ filialId }: { filialId: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    if (!filialId) { setD(null); return; }
    api.get('/nfe/configuracao/status', { params: { filialId } }).then(r => setD(r.data)).catch(() => setD(null));
  }, [filialId]);
  if (!d) return null;
  const producao = d.ambiente === 'PRODUCAO' && d.ativo && !d.simulacao;
  const meta = producao
    ? { cls: 'bg-[#2DD4A7]/12 text-[#2DD4A7] border-[#2DD4A7]/30', Icon: ShieldCheck, txt: 'Produção' }
    : { cls: 'bg-[#FF9F45]/12 text-[#FF9F45] border-[#FF9F45]/30', Icon: FlaskConical, txt: d.simulacao ? 'Simulação' : 'Homologação' };
  return (
    <span title={d.aviso || (d.simulacao ? 'Modo simulação: as notas não têm validade fiscal.' : '')}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
      <meta.Icon className="h-3.5 w-3.5" /> {meta.txt}
    </span>
  );
}

const CORES: Record<string, string> = {
  amber: 'bg-[#FF9F45]/12 text-[#FF9F45]',
  neutral: 'bg-[#16181F] text-[#8A90A0]',
  rose: 'bg-[#FF6B7A]/12 text-[#FF6B7A]',
  emerald: 'bg-[#2DD4A7]/12 text-[#2DD4A7]',
};
function Kpi({ icon, label, valor, cor }: { icon: any; label: string; valor: string | null; cor: string }) {
  return (
    <div className="bg-[#101216] rounded-2xl border border-[#23262F] p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${CORES[cor]}`}>{icon}</span>
        <p className="text-[10px] text-[#8A90A0] font-semibold uppercase tracking-wider truncate">{label}</p>
      </div>
      {valor === null ? <div className="h-7 w-24 bg-[#16181F] rounded animate-pulse" /> : <p className="text-2xl font-extrabold text-[#F7F8FA] tracking-tight truncate">{valor}</p>}
    </div>
  );
}
