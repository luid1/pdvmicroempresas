import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

/**
 * Sistema de feedback interno (substitui alert/confirm/prompt do navegador).
 *  - toast(msg, tone?)         → notificação que some sozinha
 *  - confirmDialog(msg, opts?) → Promise<boolean>
 *  - promptDialog(msg, def?)   → Promise<string | null>
 * Basta montar <FeedbackHost /> uma vez (no AppShell).
 */

type Tone = 'info' | 'success' | 'error';
type DialogKind = 'confirm' | 'prompt';
interface DialogReq {
  id: number; kind: DialogKind; message: string; defaultValue?: string;
  tone?: 'default' | 'danger'; okLabel?: string; resolve: (v: any) => void;
}
interface ToastItem { id: number; message: string; tone: Tone; }

let seq = 0;
let dialogQueue: DialogReq[] = [];
let toasts: ToastItem[] = [];
let notifyDialogs: ((d: DialogReq[]) => void) | null = null;
let notifyToasts: ((t: ToastItem[]) => void) | null = null;

function pushDialog(r: Omit<DialogReq, 'id' | 'resolve'>): Promise<any> {
  return new Promise((resolve) => {
    dialogQueue = [...dialogQueue, { ...r, id: ++seq, resolve } as DialogReq];
    notifyDialogs?.(dialogQueue);
  });
}

export function confirmDialog(message: string, opts?: { tone?: 'danger'; okLabel?: string }): Promise<boolean> {
  return pushDialog({ kind: 'confirm', message, ...opts });
}
export function promptDialog(message: string, defaultValue = ''): Promise<string | null> {
  return pushDialog({ kind: 'prompt', message, defaultValue });
}
export function toast(message: string, tone: Tone = 'info') {
  const id = ++seq;
  toasts = [...toasts, { id, message, tone }];
  notifyToasts?.(toasts);
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); notifyToasts?.(toasts); }, 4000);
}

const TONE_STYLE: Record<Tone, { border: string; icon: JSX.Element }> = {
  info: { border: 'border-sky-500', icon: <Info className="h-4 w-4 text-sky-400" /> },
  success: { border: 'border-emerald-500', icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" /> },
  error: { border: 'border-rose-500', icon: <XCircle className="h-4 w-4 text-rose-400" /> },
};

export function FeedbackHost() {
  const [dialogs, setDialogs] = useState<DialogReq[]>([]);
  const [ts, setTs] = useState<ToastItem[]>([]);
  useEffect(() => {
    notifyDialogs = setDialogs; notifyToasts = setTs;
    return () => { notifyDialogs = null; notifyToasts = null; };
  }, []);

  const cur = dialogs[0];
  const fechar = (val: any) => {
    cur?.resolve(val);
    dialogQueue = dialogQueue.slice(1);
    setDialogs(dialogQueue);
  };

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[200] space-y-2 w-80 max-w-[90vw]">
        {ts.map((t) => (
          <div key={t.id} className={`bg-[#0E141F]/90 backdrop-blur-xl border-l-4 ${TONE_STYLE[t.tone].border} border-y border-r border-white/[0.08] rounded-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] px-3 py-2.5 flex items-start gap-2 animate-[fadeIn_.15s_ease-out]`}>
            <div className="mt-0.5 shrink-0">{TONE_STYLE[t.tone].icon}</div>
            <p className="text-sm text-slate-100 flex-1">{t.message}</p>
            <button onClick={() => { toasts = toasts.filter((x) => x.id !== t.id); notifyToasts?.(toasts); }} className="text-slate-500 hover:text-slate-300 transition-colors duration-200"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Dialog (confirm / prompt) */}
      {cur && <DialogView key={cur.id} req={cur} onClose={fechar} />}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}

function DialogView({ req, onClose }: { req: DialogReq; onClose: (v: any) => void }) {
  const [val, setVal] = useState(req.defaultValue || '');
  const danger = req.tone === 'danger';
  const okBtn = danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(req.kind === 'prompt' ? null : false);
      if (e.key === 'Enter' && req.kind === 'confirm') onClose(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[210] p-4 animate-fade-in" onClick={() => onClose(req.kind === 'prompt' ? null : false)}>
      <div className="bg-[#0E141F]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_0_rgba(0,0,0,0.6)] w-full max-w-md animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-start gap-3">
          {danger && <div className="h-9 w-9 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5" /></div>}
          <div className="flex-1 pt-0.5">
            <p className="text-sm text-slate-100 whitespace-pre-line">{req.message}</p>
            {req.kind === 'prompt' && (
              <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onClose(val); }}
                className="mt-3 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500" />
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
          <button onClick={() => onClose(req.kind === 'prompt' ? null : false)} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.08] transition-all duration-300 active:scale-[0.98]">Cancelar</button>
          <button onClick={() => onClose(req.kind === 'prompt' ? val : true)} className={`px-5 py-2 rounded-lg text-white text-sm font-bold transition-all duration-300 active:scale-[0.98] ${okBtn}`}>{req.okLabel || 'Confirmar'}</button>
        </div>
      </div>
    </div>
  );
}
