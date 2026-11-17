import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Nom du dépôt GitHub = sous-répertoire GitHub Pages.
// https://redwan-omari.github.io/carte-exercices-conduite/
const BASE = '/carte-exercices-conduite/'

export default defineConfig(({ mode }) => ({
  base: BASE,
  // `npm run dev:phone` : HTTPS local (certificat de test) accessible sur le Wi-Fi,
  // pour tester le GPS et l'appareil photo sur un vrai téléphone.
  server: mode === 'phone' ? { host: true, port: 5173 } : undefined,
  build: {
    // supabase-js + React + Leaflet tiennent dans un seul fichier (~180 ko gzip).
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    mode === 'phone' && basicSsl({ name: 'carte-exercices-conduite-dev' }),
    VitePWA({
      registerType: 'autoUpdate',
      // Enregistrement fait par src/lib/pwa.ts (rechargement auto, sauf pendant une saisie).
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: BASE,
        name: 'Carte des exercices de conduite',
        short_name: 'Exercices conduite',
        description:
          "Carte collaborative des lieux d'exercices de conduite, partagée en temps réel entre collègues.",
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Photos aériennes et plan IGN (Géoplateforme) : consultés récemment => disponibles hors ligne.
            urlPattern: /^https:\/\/data\.geopf\.fr\/wmts\?.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ign-tiles',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Les appels Supabase (API, auth, realtime, photos) ne sont JAMAIS mis en cache.
        ],
      },
    }),
  ],
}))
