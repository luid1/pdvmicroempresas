import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' — não recarrega sozinho no meio de uma venda; avisa e deixa
      // o operador atualizar quando quiser (crítico para um PDV).
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'icon.svg'],
      // Permite testar o PWA em `npm run dev` (porta 3013) sem precisar buildar.
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Lumin PDV — Frente de Caixa',
        short_name: 'Lumin PDV',
        description: 'Frente de caixa e gestão do seu mercado. Abra e venda de onde estiver.',
        lang: 'pt-BR',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/pdv',
        categories: ['business', 'productivity', 'shopping'],
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: SPA — qualquer rota cai no index cacheado quando offline.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Leituras da API: online busca o dado fresco; offline serve o último
            // cacheado (catálogo, produtos, etc.). POST/PUT não são cacheados.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lumin-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fontes do Google (Inter) — cacheadas para abrir offline com a tipografia certa.
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'lumin-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3013,
    // Libera acesso externo via túnel (localtunnel/ngrok/cloudflare) para demonstração
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.trycloudflare.com'],
    proxy: {
      '/api': { target: 'http://localhost:3012', changeOrigin: true },
    },
  },
  // Servidor de PRODUÇÃO (npm run build + npm run preview) — usado para demonstrar via túnel
  preview: {
    port: 3015,
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.trycloudflare.com'],
    proxy: {
      '/api': { target: 'http://localhost:3012', changeOrigin: true },
    },
  },
});
