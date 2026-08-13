import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, User, Clock, ChevronRight, X } from 'lucide-react';
import { auditoriaApi } from '../../../services/api';
import { CadastroShell, TopBar, FilterBar, Chips, TableCard, Th, Loader, Vazio } from '../../cadastros/ui';

interface LogRow {
  id: string;
  modulo: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  usuario: string;
  usuarioEmail: string | null;
  ip: string | null;
  dadosAntes: any;
  dadosDepois: any;
  createdAt: string;
}

const ACAO_COR: Record<string, string> = {
  CREATE: 'bg-emerald-500/15 text-[#0b7d4e]',
  UPDATE: 'bg-cyan-500/15 text-[#0e7490]',
  DELETE: 'bg-rose-500/15 text-[#c3352b]',
  EMITIR: 'bg-violet-500/15 text-[#5a4fd0]',
  CANCELAR: 'bg-amber-500/15 text-[#a9760a]',
  LOGIN: 'bg-slate-500/15 text-[#8B8D98]',
  LOGOUT: 'bg-slate-500/15 text-slate-400',
};
const acaoCor = (a: string) => ACAO_COR[a?.toUpperCase()] || 'bg-slate-500/15 text-[#8B8D98]';

function quando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogsAuditoria() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modulo, setModulo] = useState('TODOS');
  const [sel, setSel] = useState<LogRow | null>(null);

  const carregar = () => {
    setLoading(true);
    auditoriaApi.logs()
      .then((r) => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };
  useEffect(carregar, []);

  const modulos = useMemo(() => {
    const set = Array.from(new Set(logs.map((l) => l.modulo).filter(Boolean)));
    return [{ value: 'TODOS', label: 'Todos' }, ...set.map((m) => ({ value: m, label: m }))];
  }, [logs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return logs.filter((l) => {
      if (modulo !== 'TODOS' && l.modulo !== modulo) return false;
      if (!q) return true;
      return [l.usuario, l.acao, l.entidade, l.entidadeId, l.modulo]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [logs, busca, modulo]);

  return (
    <CadastroShell>
      <TopBar
        icon={<ShieldCheck className="h-4 w-4" />}
        titulo="Logs de Auditoria"
        subtitulo={`${filtrados.length} evento(s) — trilha imutável do sistema`}
        extra={
          <button onClick={carregar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F5F2] border border-[#E7E5DF] text-[#8B8D98] hover:bg-[#F6F5F2] transition-all duration-300 active:scale-[0.98]">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        }
      />
      <FilterBar busca={busca} onBusca={setBusca} placeholder="Buscar por usuário, ação, entidade ou ID...">
        <Chips value={modulo} onChange={setModulo} options={modulos} />
      </FilterBar>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <Loader rows={10} />
        ) : filtrados.length === 0 ? (
          <Vazio icon={<ShieldCheck className="h-10 w-10" />} texto="Nenhum evento de auditoria registrado ainda." />
        ) : (
          <TableCard>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Usuário</Th>
                <Th>Módulo</Th>
                <Th>Ação</Th>
                <Th>Entidade</Th>
                <Th className="text-right">IP</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} className="border-t border-[#E7E5DF] cursor-pointer" onClick={() => setSel(l)}>
                  <td className="px-3 py-2 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-600" />{quando(l.createdAt)}</span>
                  </td>
                  <td className="px-3 py-2 text-[#5B5D69]">
                    <span className="inline-flex items-center gap-1.5"><User className="h-3 w-3 text-slate-500" />{l.usuario}</span>
                  </td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{l.modulo}</span></td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${acaoCor(l.acao)}`}>{l.acao}</span></td>
                  <td className="px-3 py-2 text-[#8B8D98]">
                    {l.entidade}
                    {l.entidadeId && <span className="text-slate-600 font-mono text-[10px] ml-1.5">#{String(l.entidadeId).slice(0, 8)}</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 font-mono text-[11px]">{l.ip || '—'}</td>
                  <td className="px-3 py-2 text-slate-600"><ChevronRight className="h-3.5 w-3.5" /></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {sel && <DetalheLog log={sel} onClose={() => setSel(null)} />}
    </CadastroShell>
  );
}

function DetalheLog({ log, onClose }: { log: LogRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#16171D]/40 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white backdrop-blur-2xl border-l border-[#E7E5DF] shadow-2xl overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E5DF] sticky top-0 bg-white backdrop-blur-xl">
          <h2 className="font-bold text-[#16171D] text-sm">Detalhe do evento</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#5B5D69] hover:bg-[#F6F5F2]"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Usuário" valor={log.usuario} />
            <Info label="E-mail" valor={log.usuarioEmail || '—'} />
            <Info label="Módulo" valor={log.modulo} />
            <Info label="Ação" valor={log.acao} />
            <Info label="Entidade" valor={log.entidade} />
            <Info label="ID afetado" valor={log.entidadeId || '—'} />
            <Info label="IP" valor={log.ip || '—'} />
            <Info label="Quando" valor={quando(log.createdAt)} />
          </div>
          {log.dadosAntes != null && <Json titulo="Antes" dados={log.dadosAntes} />}
          {log.dadosDepois != null && <Json titulo="Depois" dados={log.dadosDepois} />}
        </div>
      </div>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-[#5B5D69] break-words">{valor}</p>
    </div>
  );
}

function Json({ titulo, dados }: { titulo: string; dados: any }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{titulo}</p>
      <pre className="bg-[#F6F5F2] border border-[#E7E5DF] rounded-lg p-3 text-[11px] text-[#8B8D98] overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(dados, null, 2)}
      </pre>
    </div>
  );
}
