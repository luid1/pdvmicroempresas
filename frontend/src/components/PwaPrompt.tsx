import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Camada de UI do PWA (canto inferior direito):
 *   • "App pronto para uso offline"  — confirma que o cache foi montado.
 *   • "Nova versão disponível"       — botão para atualizar sem recarregar
 *                                       sozinho no meio de uma venda.
 *   • "Instalar o Lumin PDV"         — usa o beforeinstallprompt do navegador
 *                                       para instalar como app na máquina.
 *
 * Tudo em estilos inline (independe do Tailwind) e no tema escuro do sistema.
 */
export default function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      // Revalida o service worker de tempos em tempos (novas versões no servidor).
      // 30 min é suficiente para um PDV que fica aberto o dia todo.
      console.log('[PWA] service worker registrado:', url);
    },
    onRegisterError(err) {
      console.error('[PWA] falha ao registrar o service worker:', err);
    },
  });

  // ── Instalação (beforeinstallprompt) ──────────────────────────────
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true);

  const instalar = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } finally {
      setInstallEvt(null);
    }
  };

  const showInstall = !!installEvt && !installed && !isStandalone;
  if (!offlineReady && !needRefresh && !showInstall) return null;

  return (
    <div style={wrap}>
      {needRefresh && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={dot} />
            <strong style={{ fontSize: 14 }}>Nova versão disponível</strong>
          </div>
          <p style={msg}>Atualize para receber as últimas melhorias. Sua tela recarrega ao confirmar.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={btnSolid} onClick={() => updateServiceWorker(true)}>Atualizar agora</button>
            <button style={btnGhost} onClick={() => setNeedRefresh(false)}>Depois</button>
          </div>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={dot} />
            <strong style={{ fontSize: 14 }}>Pronto para uso offline</strong>
          </div>
          <p style={msg}>O Lumin PDV já abre mesmo sem internet.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={btnGhost} onClick={() => setOfflineReady(false)}>Entendi</button>
          </div>
        </div>
      )}

      {showInstall && !needRefresh && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={dot} />
            <strong style={{ fontSize: 14 }}>Instalar o Lumin PDV</strong>
          </div>
          <p style={msg}>Instale como aplicativo para abrir em tela cheia e mais rápido.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={btnSolid} onClick={instalar}>Instalar</button>
            <button style={btnGhost} onClick={() => setInstallEvt(null)}>Agora não</button>
          </div>
        </div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 320,
};
const card: React.CSSProperties = {
  background: 'rgba(17,24,39,0.92)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: '16px 18px',
  color: '#f8fafc',
  boxShadow: '0 20px 50px -20px rgba(0,0,0,0.7)',
  backdropFilter: 'blur(12px)',
  fontFamily: 'Inter, system-ui, sans-serif',
};
const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: '#34d399',
  boxShadow: '0 0 12px #34d399',
  flex: 'none',
};
const msg: React.CSSProperties = { margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: '#cbd5e1' };
const btnSolid: React.CSSProperties = {
  background: '#34d399',
  color: '#06251a',
  border: 'none',
  borderRadius: 10,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
