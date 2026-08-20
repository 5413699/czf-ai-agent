import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['assets/images/tomato-primary.svg'],
      manifest: {
        name: '番茄自习室',
        short_name: '番茄自习室',
        description: '把专注节奏、任务进度与 AI 拆解放在同一个安静的工作空间。',
        theme_color: '#f8fafc',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: '/#/focus',
        scope: '/',
        lang: 'zh-CN',
        categories: ['productivity', 'education'],
        icons: [
          {
            src: '/assets/images/tomato-primary.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['assets/audio/**/*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'audio' || url.pathname.startsWith('/assets/audio/'),
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'tomato-study-room-audio',
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8123' },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
