import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Gauge, RefreshCw, Send, Search as SearchIcon, Ban, CheckCircle2,
  AlertTriangle, Clock, XCircle, RotateCw, Loader2, FileText, ShieldCheck,
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
  EMITIDO: { label: 'Autorizada', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  PENDENTE_EMISSAO: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  CONTINGENCIA: { label: 'Contingência', cls: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-200 text-gray-600', icon: FileText },
  CANCELADO: { label: 'Cancelada', cls: 'bg-red-100 text-red-700', icon: Ban },
  DENEGADO: { label: 'Denegada', cls: 'bg-red-100 text-red-700', icon: XCircle },
  INUTILIZADO: { label: 'Inutilizada', cls: 'bg-gray-200 text-gray-600', icon: XCircle },
};

type Doc = {
  id: string;
  modelo: string;
  serie: number;
  numero: number;
  status: string;
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
};

type Resumo = { emitidas: number; pendentes: number; canceladas: number; denegadas: number };

const PENDENTE = ['PENDENTE_EMISSAO', 'CONTINGENCIA', 'RASCUNHO'];

export default function MonitorFiscal() {
  const { filialAtiva } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [resumo, setResumo] = useState<Resumo>({ emitidas: 0, pendentes: 0, canceladas: 0, denegadas: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id da linha em ação
  const [reprocessando, setReprocessando] = useState(false);
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
    { label: 'Autorizadas', valor: resumo.emitidas, cls: 'text-emerald-600', icon: CheckCircle2, filtro: 'EMITIDO' },
    { label: 'Pendentes', valor: resumo.pendentes, cls: 'text-amber-600', icon: Clock, filtro: 'PENDENTE_EMISSAO' },
    { label: 'Canceladas', valor: resumo.canceladas, cls: 'text-red-600', icon: Ban, filtro: 'CANCELADO' },
    { label: 'Denegadas', valor: resumo.denegadas, cls: 'text-red-600', icon: XCircle, filtro: 'DENEGADO' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F7F8]">
      <PageHeader
        icon={<Gauge className="h-5 w-5" />}
        titulo="Monitor Fiscal"
        subtitulo="Situação real das NFC-e no SEFAZ, pendências e reenvio"
        actions={
          <>
            <label className="mr-1 hidden items-center gap-1.5 text-xs text-[#5F6065] sm:flex" title="Atualiza o status do SEFAZ automaticamente a cada 25s">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-3.5 w-3.5 accent-[#0F8A72]" />
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
      <div className="grid grid-cols-2 gap-3 px-5 py-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const ativo = status === c.filtro;
          return (
            <button
              key={c.label}
              onClick={() => setStatus(ativo ? '' : c.filtro || '')}
              className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-left transition-all ${
                ativo ? 'border-[#0F8A72] ring-2 ring-[#0F8A72]/15' : 'border-[#E5E7EB] hover:border-[#0F8A72]/40'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-[#8E8F94]">{c.label}</div>
                <div className={`text-2xl font-bold tabular-nums ${c.cls}`}>{c.valor}</div>
              </div>
              <Icon className={`h-6 w-6 ${c.cls} opacity-70`} />
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2.5 border-y border-[#E5E7EB] bg-white px-5 py-2.5 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-[380px] sm:flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8F94]" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar por nº, chave de acesso ou CPF/CNPJ..."
            className="h-9 w-full rounded-full border border-[#DDE1E5] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0F8A72]/60 focus:ring-4 focus:ring-[#0F8A72]/10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-[#DDE1E5] bg-white px-3 text-[13px] outline-none focus:border-[#0F8A72]/60"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="h-9 rounded-lg border border-[#DDE1E5] bg-white px-3 text-[13px] outline-none focus:border-[#0F8A72]/60"
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
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#0F8A72]" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8F94]">
            <ShieldCheck className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum documento fiscal no período.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs uppercase tracking-wide text-[#8E8F94]">
              <tr className="border-b border-[#E5E7EB]">
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
                const st = STATUS[d.status] || { label: d.status, cls: 'bg-gray-200 text-gray-600', icon: FileText };
                const StIcon = st.icon;
                const pendente = PENDENTE.includes(d.status);
                const emAcao = busy === d.id;
                return (
                  <tr key={d.id} className="border-b border-[#F0F2F3] align-top hover:bg-[#FAFAFA]">
                    <td className="px-2 py-2.5">
                      <div className="font-semibold text-[#202123]">#{d.numero}</div>
                      <div className="text-xs text-[#8E8F94]">Série {d.serie}</div>
                      {d.chaveAcesso && (
                        <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-[#B0B1B5]" title={fmtChave(d.chaveAcesso)}>
                          {fmtChave(d.chaveAcesso)}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                      {d.pendenciaMotivo && (
                        <div className="mt-1 max-w-[240px] text-[11px] leading-tight text-amber-600" title={d.pendenciaMotivo}>
                          {d.pendenciaMotivo.length > 80 ? d.pendenciaMotivo.slice(0, 80) + '…' : d.pendenciaMotivo}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-[#5F6065]">{dtHora(d.dataEmissao || d.createdAt)}</td>
                    <td className="px-2 py-2.5 text-[#5F6065]">{d.destCnpjCpf || <span className="text-[#B0B1B5]">—</span>}</td>
                    <td className="px-2 py-2.5">
                      {d.pedidoNumero ? (
                        <span className="text-[#5F6065]">
                          #{d.pedidoNumero}
                          {d.pedidoEstornado && (
                            <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">ESTORNADA</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#B0B1B5]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums text-[#202123]">{R$(d.valorNfe)}</td>
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
                          <button onClick={() => cancelar(d)} disabled={emAcao} className={`${btnGlass} !text-red-600 hover:!bg-red-50`} title="Cancelar no SEFAZ">
                            <Ban className="h-3.5 w-3.5" /> Cancelar
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
    </div>
  );
}
