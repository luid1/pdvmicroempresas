import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Autolimpeza em DESENVOLVIMENTO: se sobrou um service worker antigo (o antigo
// dev-sw.js do vite-plugin-pwa), ele intercepta as requisições e trava o login
// ("Entrando..." eterno) e outras telas em "carregando". Aqui removemos qualquer
// SW e caches em dev, para a máquina se curar sozinha sem limpar o navegador na mão.
// Em produção o PWA continua normal (este bloco não roda).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length) {
      regs.forEach((r) => r.unregister());
      if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      // Recarrega uma vez já sem o SW controlando a página.
      location.reload();
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
