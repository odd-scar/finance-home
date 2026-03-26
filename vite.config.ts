import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Finance Home',
        short_name: 'Finance',
        description: 'Your personal finance dashboard',
        theme_color: '#6366f1',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache app shell for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Stock quote proxy — network first, stale-while-revalidate fallback
            urlPattern: /\/api\/quote(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stock-quote-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    host: true, // allows access from phone on same WiFi
  },
})
