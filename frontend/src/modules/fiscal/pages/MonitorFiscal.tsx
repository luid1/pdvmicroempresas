import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Gauge, RefreshCw, Send, Search as SearchIcon, Ban, CheckCircle2,
  AlertTriangle, Clock, XCircle, RotateCw, Loader2, FileText, ShieldCheck,
  Undo2, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { nfceApi } from '../../../services/api';
import { toast, confirmDialog, promptDialog } from '../../../components/ui/feedback';
import { PageHeader, btnGlass } from '../../cadastros/ui';

const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dtHora = (v: any) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const fmtChave = (c?: string | null) => {
  const d = (c || '').replace(/\D/g, '');
  return d.length === 44 ? d.replace(/(\d{4})(?=\d)/g, '$1 ').trim() : c || '—';
};

// Rótulo + cor de cada status fiscal (modelo 65).
const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  EMITIDO: { label: 'Autorizada', cls: 'bg-[#2DD4A7]/12 text-[#2DD4A7]', icon: CheckCircle2 },
  PENDENTE_EMISSAO: { label: 'Pendente', cls: 'bg-[#FF9F45]/12 text-[#FF9F45]', icon: Clock },
  CONTINGENCIA: { label: 'Contingência', cls: 'bg-[#FF9F45]/12 text-[#FF9F45]', icon: AlertTriangle },
  RASCUNHO: { label: 'Rascunho', cls: 'bg-[#16181F] border border-[#23262F] text-[#8A90A0]', icon: FileText },
  CANCELADO: { label: 'Cancelada', cls: 'bg-[#FF6B7A]/12 text-[#FF6B7A]', icon: Ban },
  DENEGADO: { label: 'Denegada', cls: 'bg-[#FF6B7A]/12 text-[#FF6B7A]', icon: XCircle },
  INUTILIZADO: { label: 'Inutilizada', cls: 'bg-[#16181F] border border-[#23262F] text-[#8A90A0]', icon: XCircle },
};

// Selo do status DERIVADO de devolução — interno do Lumin (não é status SEFAZ).
// Cor própria (violeta) para diferenciar de autorizada (verde) e cancelada (vermelho).
const SITUACAO: Record<string, { label: string; cls: string; icon: any }> = {
  DEVOLVIDA: { label: 'Devolvida', cls: 'bg-[#B98AFF]/12 text-[#B98AFF]', icon: Undo2 },
  DEVOLUCAO_PARCIAL: { label: 'Devolução parcial', cls: 'bg-[#B98AFF]/12 text-[#B98AFF]', icon: Undo2 },
  DEVOLUCAO: { label: 'Devolução', cls: 'bg-[#8A90A0]/12 text-[#8A90A0]', icon: Undo2 },
};

type DevRef = { id: string; numero: number; serie?: number; modelo?: string; valor?: number; chaveAcesso?: string | null; dataEmissao?: string | null; motivo?: string | null };

type Doc = {
  id: string;
  modelo: string;
  serie: number;
  numero: number;
  status: string;
  finalidade?: string;
  tipoOperacao?: string;
  chaveAcesso: string | null;
  protocolo: string | null;
  destCnpjCpf: string | null;
  valorNfe: number;
  qrCode: string | null;
  urlConsulta: string | null;
  pendenciaMotivo: string | null;
  baixaPendente: boolean;
  dataEmissao: string | null;
  dataCancelamento: string | null;
  createdAt: string;
  pedidoId: string | null;
  pedidoNumero: number | null;
  pedidoStatus: string | null;
  pedidoEstornado: boolean;
  // Status derivado de devolução (o status fiscal real continua em `status`).
  situacao: 'DEVOLVIDA' | 'DEVOLUCAO_PARCIAL' | 'DEVOLUCAO' | null;
  devolvida: boolean;
  valorDevolvido: number;
  valorLiquido: number;
  devolucoes: DevRef[];
  nfeReferenciada: DevRef | null;
};

type Resumo = { emitidas: number; pendentes: number; canceladas: number; denegadas: number; devolvidas: number };

const PENDENTE = ['PENDENTE_EMISSAO', 'CONTINGENCIA', 'RASCUNHO'];

export default function MonitorFiscal() {
  const { filialAtiva } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [resumo, setResumo] = useState<Resumo>({ emitidas: 0, pendentes: 0, canceladas: 0, denegadas: 0, devolvidas: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id da linha em ação
  const [reprocessando, setReprocessando] = useState(false);
  const [devolverDoc, setDevolverDoc] = useState<Doc | null>(null); // modal de devolução
  // Filtros
  const [status, setStatus] = useState('');
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const [m, r] = await Promise.all([
          nfceApi.monitor({ filialId: filialAtiva?.id, status: status || undefined, busca: busca || undefined, dias }),
          nfceApi.resumo(filialAtiva?.id),
        ]);
        setDocs(m.data);
        setResumo(r.data);
      } catch {
        if (!silencioso) toast('Falha ao carregar o Monitor Fiscal.', 'error');
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [filialAtiva?.id, status, dias, busca],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Auto-atualização: o status real chega do SEFAZ de forma assíncrona, então
  // revalidamos periodicamente para o fiscal ver a nota "virar" autorizada.
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => carregar(true), 25000);
    return () => clearInterval(t);
  }, [autoRefresh, carregar]);

  function onBusca(v: string) {
    setBusca(v);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(() => carregar(), 400);
  }

  async function transmitir(d: Doc) {
    setBusy(d.id);
    try {
      const { data } = await nfceApi.transmitir(d.id);
      toast(
        data?.status === 'EMITIDA' || data?.status === 'EMITIDO'
          ? `NFC-e #${d.numero} autorizada.`
          : `NFC-e #${d.numero}: ${data?.status || 'processando'}.`,
        data?.status?.startsWith('EMITID') ? 'success' : 'info',
      );
      await carregar(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao transmitir.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function consultar(d: Doc) {
    setBusy(d.id);
    try {
      const { data } = await nfceApi.consultar(d.id);
      const st = data?.status || data?.autorizado;
      toast(`SEFAZ: ${typeof st === 'string' ? st : data?.autorizado ? 'autorizada' : 'processando'}.`, 'info');
      await carregar(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao consultar o SEFAZ.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function cancelar(d: Doc) {
    const motivo = await promptDialog('Motivo do cancelamento (mín. 15 caracteres):');
    if (motivo === null) return;
    if (motivo.trim().length < 15) {
      toast('O motivo precisa de ao menos 15 caracteres.', 'error');
      return;
    }
    setBusy(d.id);
    try {
      await nfceApi.cancelar(d.id, motivo.trim());
      toast(`NFC-e #${d.numero} cancelada.`, 'success');
      await carregar(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao cancelar.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function reprocessar() {
    if (!(await confirmDialog('Reenviar ao SEFAZ todas as notas pendentes/contingência desta filial?'))) return;
    setReprocessando(true);
    try {
      const { data } = await nfceApi.reprocessar(filialAtiva?.id);
      toast(`Reprocessadas ${data?.total ?? 0}: ${data?.emitidas ?? 0} autorizadas, ${data?.pendentes ?? 0} ainda pendentes.`, 'success');
      await carregar(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao reprocessar.', 'error');
    } finally {
      setReprocessando(false);
    }
  }

  const cards: { label: string; valor: number; cls: string; icon: any; filtro?: string }[] = [
    { label: 'Autorizadas', valor: resumo.emitidas, cls: 'text-[#2DD4A7]', icon: CheckCircle2, filtro: 'EMITIDO' },
    { label: 'Pendentes', valor: resumo.pendentes, cls: 'text-[#FF9F45]', icon: Clock, filtro: 'PENDENTE_EMISSAO' },
    { label: 'Canceladas', valor: resumo.canceladas, cls: 'text-[#FF6B7A]', icon: Ban, filtro: 'CANCELADO' },
    { label: 'Denegadas', valor: resumo.denegadas, cls: 'text-[#FF6B7A]', icon: XCircle, filtro: 'DENEGADO' },
    { label: 'Devolvidas', valor: resumo.devolvidas, cls: 'text-[#B98AFF]', icon: Undo2, filtro: 'DEVOLVIDA' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0C0D10]">
      <PageHeader
        icon={<Gauge className="h-5 w-5" />}
        titulo="Monitor Fiscal"
        subtitulo="Situação real das NFC-e no SEFAZ, pendências e reenvio"
        actions={
          <>
            <label className="mr-1 hidden items-center gap-1.5 text-xs text-[#8A90A0] sm:flex" title="Atualiza o status do SEFAZ automaticamente a cada 25s">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-3.5 w-3.5 accent-[#01B8FA]" />
              Auto
            </label>
            <button onClick={() => carregar()} disabled={loading} className={btnGlass}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button onClick={reprocessar} disabled={reprocessando} className={btnGlass} title="Reenvia todas as notas pendentes/contingência">
              {reprocessando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />} Reprocessar pendentes
            </button>
          </>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 px-5 py-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          const ativo = status === c.filtro;
          return (
            <button
              key={c.label}
              onClick={() => setStatus(ativo ? '' : c.filtro || '')}
              className={`flex items-center justify-between rounded-xl border bg-[#101216] px-4 py-3 text-left transition-all ${
                ativo ? 'border-[#01B8FA] ring-2 ring-[#01B8FA]/15' : 'border-[#23262F] hover:border-[#01B8FA]/40'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-[#8A90A0]">{c.label}</div>
                <div className={`text-2xl font-bold tabular-nums ${c.cls}`}>{c.valor}</div>
              </div>
              <Icon className={`h-6 w-6 ${c.cls} opacity-70`} />
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2.5 border-y border-[#23262F] bg-[#0C0D10] px-5 py-2.5 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-[380px] sm:flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A90A0]" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar por nº, chave de acesso ou CPF/CNPJ..."
            className="h-9 w-full rounded-full border border-[#23262F] bg-[#101216] pl-9 pr-3 text-[13px] text-[#F7F8FA] placeholder:text-[#8A90A0] outline-none focus:border-[#01B8FA]/60 focus:ring-4 focus:ring-[#01B8FA]/10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-[#23262F] bg-[#101216] px-3 text-[13px] text-[#F7F8FA] [color-scheme:dark] outline-none focus:border-[#01B8FA]/60"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
          {/* Status derivado (interno do Lumin) */}
          <option value="DEVOLVIDA">Devolvida</option>
        </select>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="h-9 rounded-lg border border-[#23262F] bg-[#101216] px-3 text-[13px] text-[#F7F8FA] [color-scheme:dark] outline-none focus:border-[#01B8FA]/60"
        >
          <option value={1}>Hoje</option>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#01B8FA]" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8A90A0]">
            <ShieldCheck className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum documento fiscal no período.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs uppercase tracking-wide text-[#8A90A0]">
              <tr className="border-b border-[#23262F]">
                <th className="px-2 py-2">Nº / Série</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Emissão</th>
                <th className="px-2 py-2">Consumidor</th>
                <th className="px-2 py-2">Venda</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const st = STATUS[d.status] || { label: d.status, cls: 'bg-[#16181F] border border-[#23262F] text-[#8A90A0]', icon: FileText };
                const StIcon = st.icon;
                const sit = d.situacao ? SITUACAO[d.situacao] : null;
                const SitIcon = sit?.icon;
                const pendente = PENDENTE.includes(d.status);
                const emAcao = busy === d.id;
                return (
                  <tr key={d.id} className="border-b border-[#23262F] align-top hover:bg-white/[0.03] transition-colors">
                    <td className="px-2 py-2.5">
                      <div className="font-semibold text-[#F7F8FA]">#{d.numero}</div>
                      <div className="text-xs text-[#8A90A0]">Série {d.serie}</div>
                      {d.chaveAcesso && (
                        <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-[#8A90A0]" title={fmtChave(d.chaveAcesso)}>
                          {fmtChave(d.chaveAcesso)}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {sit && SitIcon ? (
                        <>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${sit.cls}`}>
                            <SitIcon className="h-3 w-3" /> {sit.label}
                          </span>
                          {/* Mantém o status FISCAL real visível para auditoria. */}
                          <div className="mt-0.5 text-[10px] text-[#8A90A0]">Fiscal: {st.label}</div>
                        </>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                          <StIcon className="h-3 w-3" /> {st.label}
                        </span>
                      )}
                      {(d.situacao === 'DEVOLVIDA' || d.situacao === 'DEVOLUCAO_PARCIAL') && (
                        <div className="mt-1 text-[11px] leading-tight text-[#B98AFF]">
                          Devolvido {R$(d.valorDevolvido)}
                          {d.devolucoes?.length ? ` · NF-e ${d.devolucoes.map((x) => '#' + x.numero).join(', ')}` : ''}
                        </div>
                      )}
                      {d.situacao === 'DEVOLUCAO' && d.nfeReferenciada && (
                        <div className="mt-1 text-[11px] leading-tight text-[#8A90A0]">Estorna NF-e #{d.nfeReferenciada.numero}</div>
                      )}
                      {d.pendenciaMotivo && (
                        <div className="mt-1 max-w-[240px] text-[11px] leading-tight text-[#FF9F45]" title={d.pendenciaMotivo}>
                          {d.pendenciaMotivo.length > 80 ? d.pendenciaMotivo.slice(0, 80) + '…' : d.pendenciaMotivo}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-[#8A90A0]">{dtHora(d.dataEmissao || d.createdAt)}</td>
                    <td className="px-2 py-2.5 text-[#8A90A0]">{d.destCnpjCpf || <span className="text-slate-600">—</span>}</td>
                    <td className="px-2 py-2.5">
                      {d.pedidoNumero ? (
                        <span className="text-[#8A90A0]">
                          #{d.pedidoNumero}
                          {d.pedidoEstornado && (
                            <span className="ml-1 rounded bg-[#FF6B7A]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#FF6B7A]">ESTORNADA</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums text-[#F7F8FA]">
                      {d.devolvida ? (
                        <div>
                          <div className="text-[11px] text-[#8A90A0] line-through">{R$(d.valorNfe)}</div>
                          <div className="text-[#B98AFF]" title="Faturamento líquido após a devolução">{R$(d.valorLiquido)}</div>
                        </div>
                      ) : (
                        R$(d.valorNfe)
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {pendente && (
                          <button onClick={() => transmitir(d)} disabled={emAcao} className={btnGlass} title="Reenviar ao SEFAZ">
                            {emAcao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Transmitir
                          </button>
                        )}
                        {(d.status === 'EMITIDO' || pendente) && (
                          <button onClick={() => consultar(d)} disabled={emAcao} className={btnGlass} title="Consultar status real no SEFAZ">
                            <SearchIcon className="h-3.5 w-3.5" /> Consultar
                          </button>
                        )}
                        {d.status === 'EMITIDO' && (
                          <button onClick={() => cancelar(d)} disabled={emAcao} className={`${btnGlass} !text-[#FF6B7A] hover:!bg-[#FF6B7A]/10`} title="Cancelar no SEFAZ">
                            <Ban className="h-3.5 w-3.5" /> Cancelar
                          </button>
                        )}
                        {d.status === 'EMITIDO' && d.finalidade !== '4' && d.situacao !== 'DEVOLVIDA' && (
                          <button onClick={() => setDevolverDoc(d)} disabled={emAcao} className={`${btnGlass} !text-[#B98AFF] hover:!bg-[#B98AFF]/10`} title="Registrar devolução (estorno fiscal) — total ou parcial">
                            <Undo2 className="h-3.5 w-3.5" /> Devolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {devolverDoc && (
        <DevolverModal
          doc={devolverDoc}
          onClose={() => setDevolverDoc(null)}
          onDone={() => {
            setDevolverDoc(null);
            carregar(true);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal de devolução (estorno fiscal) de uma NFC-e autorizada. Mantém as quantidades
 * cheias por padrão (devolução total) e permite reduzi-las por item (devolução parcial).
 * Ao confirmar, gera + emite a NF-e de devolução no backend; a nota original continua
 * EMITIDO (auditoria) e passa a ser tratada como devolvida (fora do faturamento líquido).
 */
function DevolverModal({ doc, onClose, onDone }: { doc: Doc; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itens, setItens] = useState<{ id: string; descricao: string; max: number; qtd: number; valorUnitario: number }[]>([]);
  const [existentes, setExistentes] = useState<DevRef[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await nfceApi.documento(doc.id);
        if (!vivo) return;
        const lista = (data?.itens || []).map((it: any) => ({
          id: it.id,
          descricao: it.descricao || it.produto?.descricao || 'Item',
          max: Number(it.quantidade) || 0,
          qtd: Number(it.quantidade) || 0,
          valorUnitario: Number(it.valorUnitario) || 0,
        }));
        setItens(lista);
        setExistentes(data?.devolucoesInfo || []);
      } catch {
        toast('Falha ao carregar os itens da nota.', 'error');
        onClose();
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [doc.id]);

  const totalDev = itens.reduce((s, it) => s + it.qtd * it.valorUnitario, 0);
  const algum = itens.some((it) => it.qtd > 0);
  const parcial = itens.length > 0 && !itens.every((it) => it.qtd === it.max);

  function setQtd(id: string, v: number) {
    setItens((arr) => arr.map((it) => (it.id === id ? { ...it, qtd: Math.max(0, Math.min(it.max, v)) } : it)));
  }

  async function confirmar() {
    if (!algum) {
      toast('Informe ao menos uma quantidade para devolver.', 'error');
      return;
    }
    const ok = await confirmDialog(
      `Registrar devolução ${parcial ? 'PARCIAL' : 'TOTAL'} da NFC-e #${doc.numero}? Isso gera e emite uma NF-e de devolução (estorno fiscal); a nota sai do faturamento líquido, mas continua no histórico como autorizada.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      const sel = itens.filter((it) => it.qtd > 0).map((it) => ({ itemNfeId: it.id, quantidade: it.qtd }));
      await nfceApi.devolver(doc.id, sel);
      toast(`Devolução da NFC-e #${doc.numero} emitida.`, 'success');
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Falha ao registrar a devolução.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[#23262F] bg-[#101216] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#23262F] px-5 py-3.5">
          <div className="flex items-center gap-2 text-[#F7F8FA]">
            <Undo2 className="h-4 w-4 text-[#B98AFF]" />
            <span className="font-semibold">Devolver NFC-e #{doc.numero}</span>
          </div>
          <button onClick={onClose} className="text-[#8A90A0] hover:text-[#F7F8FA]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#01B8FA]" />
            </div>
          ) : (
            <>
              <p className="mb-3 text-[12px] leading-relaxed text-[#8A90A0]">
                Ajuste as quantidades para uma devolução parcial, ou mantenha o total para devolver a nota inteira. A nota original continua <b className="text-[#F7F8FA]">autorizada</b> (auditoria); o Lumin passa a tratá-la como devolvida e não a soma no faturamento líquido.
              </p>

              {existentes.length > 0 && (
                <div className="mb-3 rounded-lg border border-[#B98AFF]/25 bg-[#B98AFF]/10 px-3 py-2 text-[11px] text-[#B98AFF]">
                  Já existe devolução: {existentes.map((x) => `NF-e #${x.numero} (${R$(x.valor)})`).join(', ')}.
                </div>
              )}

              <table className="w-full text-[12px]">
                <thead className="text-left text-[10px] uppercase tracking-wide text-[#8A90A0]">
                  <tr className="border-b border-[#23262F]">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-center">Vendido</th>
                    <th className="py-1.5 text-center">Devolver</th>
                    <th className="py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it) => (
                    <tr key={it.id} className="border-b border-[#23262F]/60">
                      <td className="py-1.5 pr-2 text-[#F7F8FA]">{it.descricao}</td>
                      <td className="py-1.5 text-center tabular-nums text-[#8A90A0]">{it.max}</td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={it.max}
                          step="any"
                          value={it.qtd}
                          onChange={(e) => setQtd(it.id, Number(e.target.value))}
                          className="h-7 w-16 rounded border border-[#23262F] bg-[#0C0D10] px-2 text-center text-[12px] text-[#F7F8FA] outline-none focus:border-[#B98AFF]/60"
                        />
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-[#F7F8FA]">{R$(it.qtd * it.valorUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#23262F] px-5 py-3.5">
          <div className="text-[12px] text-[#8A90A0]">
            Total a devolver: <span className="font-semibold text-[#B98AFF]">{R$(totalDev)}</span>
            {!loading && (
              <span className="ml-2 rounded-full bg-[#B98AFF]/12 px-2 py-0.5 text-[10px] font-semibold text-[#B98AFF]">
                {parcial ? 'PARCIAL' : 'TOTAL'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className={btnGlass}>
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={saving || loading || !algum}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#B98AFF] px-3 py-1.5 text-[13px] font-semibold text-[#04121A] hover:bg-[#B98AFF]/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Confirmar devolução
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
