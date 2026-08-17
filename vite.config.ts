import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

import pkg from './package.json' with { type: 'json' }

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Mirrors the `paths` block in tsconfig.app.json. Vitest reads this file too,
  // so tests resolve the same aliases the app does.
  resolve: {
    alias: {
      '#views': resolvePath('./app/views'),
      '#components': resolvePath('./app/components'),
      '#hooks': resolvePath('./app/hooks'),
      '#utils': resolvePath('./app/utils'),
      '#lib': resolvePath('./app/lib'),
      '#store': resolvePath('./app/store'),
      '#root': resolvePath('./app/Root'),
      '#types': resolvePath('./app/types.ts'),
    },
  },
  test: {
    // Installs the IndexedDB polyfill before any module under test loads.
    setupFiles: ['./tests/setup.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Rent Register',
        short_name: 'Rent Register',
        description: 'Track rent, tenants, and bills across your houses.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EFE7D6',
        theme_color: '#7A1F2E',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Google Fonts stylesheets — non-critical enhancement.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // Google Fonts webfont files.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
