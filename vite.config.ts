import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// De app draait op https://<gebruiker>.github.io/recepten_app/, dus alle assets
// moeten met dat pad worden opgevraagd. Lokaal draaien werkt met hetzelfde pad.
const BASE = '/recepten_app/';

export default defineConfig({
  base: BASE,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Recepten',
        short_name: 'Recepten',
        description: 'Persoonlijk kookboek: kiezen, boodschappen doen en koken.',
        lang: 'nl',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f4f8',
        theme_color: '#1f4e9c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: `${BASE}index.html`,
        // Let op: api.github.com staat hier bewust NIET bij. Antwoorden op
        // geauthenticeerde verzoeken mogen nooit in de Cache Storage belanden,
        // want daar zou het token indirect in terecht kunnen komen. De sync
        // bewaart receptdata zelf al in IndexedDB.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*\.(?:webp|png|jpe?g)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'recept-fotos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
