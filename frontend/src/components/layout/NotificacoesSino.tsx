import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, Info, AlertOctagon, Loader2 } from 'lucide-react';
import { notificacoesApi } from '../../services/api';

interface Notificacao {
  id: string;
  tipo: string;
  severidade: 'INFO' | 'AVISO' | 'CRITICO';
  titulo: string;
  mensagem: string;
  link?: string | null;
  lida: boolean;
  createdAt: string;
}

const POLL_MS = 60_000;

function iconePorSeveridade(sev: Notificacao['severidade']) {
  if (sev === 'CRITICO') return { Icon: AlertOctagon, cor: 'text-[#E0483D]' };
  if (sev === 'AVISO') return { Icon: AlertTriangle, cor: 'text-[#2348C7]' };
  return { Icon: Info, cor: 'text-[#8E8F94]' };
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export default function NotificacoesSino() {
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ bottom: 12, left: 12 });
  const navigate = useNavigate();

  const atualizarContador = useCallback(async () => {
    try {
      const r = await notificacoesApi.naoLidas();
      setNaoLidas(r.data?.naoLidas ?? 0);
    } catch {
      /* silencioso: contador não deve quebrar o header */
    }
  }, []);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await notificacoesApi.list({ limit: 30 });
      setItens(r.data ?? []);
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Polling do contador
  useEffect(() => {
    atualizarContador();
    const t = setInterval(atualizarContador, POLL_MS);
    return () => clearInterval(t);
  }, [atualizarContador]);

  const abrir = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const PANEL_W = 320; // w-80
      const openUp = r.top > window.innerHeight / 2; // sino no rodapé → abre p/ cima
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 12));
      setPos(openUp
        ? { bottom: Math.max(12, window.innerHeight - r.top + 8), left }
        : { top: r.bottom + 8, left });
    }
    setAberto(true);
    carregarLista();
  }, [carregarLista]);

  // Fechar ao clicar fora / ESC
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  const marcarLida = async (n: Notificacao) => {
    if (!n.lida) {
      try {
        await notificacoesApi.marcarLida(n.id);
        setItens((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
        setNaoLidas((c) => Math.max(0, c - 1));
      } catch {
        /* ignora */
      }
    }
  };

  const abrirNotificacao = async (n: Notificacao) => {
    await marcarLida(n);
    setAberto(false);
    if (n.link) navigate(n.link);
  };

  const marcarTodas = async () => {
    try {
      await notificacoesApi.marcarTodasLidas();
      setItens((prev) => prev.map((x) => ({ ...x, lida: true })));
      setNaoLidas(0);
    } catch {
      /* ignora */
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="relative p-1.5 text-[#8A90A0] hover:text-white hover:bg-white/[0.06] rounded-lg transition-all duration-300 active:scale-[0.95]"
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#E0483D] text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(224,72,61,0.5)]">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[65]" onClick={() => setAberto(false)} />
            <div
              className="fixed z-[66] w-80 max-h-[70vh] flex flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-[0_16px_48px_0_rgba(22,23,29,0.18)] animate-fade-in"
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#E5E7EB]">
                <p className="text-[12px] font-semibold text-[#202123]">Notificações</p>
                <button
                  onClick={marcarTodas}
                  disabled={naoLidas === 0}
                  className="flex items-center gap-1 text-[10px] text-[#8E8F94] hover:text-[#2348C7] disabled:opacity-40 disabled:hover:text-[#8E8F94] transition-colors"
                >
                  <CheckCheck className="h-3 w-3" /> Marcar todas
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {carregando ? (
                  <div className="flex items-center justify-center py-8 text-[#8E8F94]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : itens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-[#8E8F94]">
                    <Bell className="h-6 w-6 mb-2 opacity-40" />
                    <p className="text-[11px]">Nenhuma notificação.</p>
                  </div>
                ) : (
                  itens.map((n) => {
                    const { Icon, cor } = iconePorSeveridade(n.severidade);
                    return (
                      <button
                        key={n.id}
                        onClick={() => abrirNotificacao(n)}
                        className={`w-full text-left flex gap-2.5 px-3 py-2.5 border-b border-[#E5E7EB] hover:bg-[#F7F7F8] transition-colors ${n.lida ? 'opacity-60' : ''}`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-semibold text-[#202123] truncate flex-1">{n.titulo}</p>
                            {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-[#2F5FE0] shrink-0" />}
                          </div>
                          <p className="text-[10px] text-[#5F6065] leading-snug line-clamp-2">{n.mensagem}</p>
                          <p className="text-[9px] text-[#8E8F94] mt-0.5">{tempoRelativo(n.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
