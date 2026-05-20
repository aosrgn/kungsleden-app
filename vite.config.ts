import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/kungsleden-app/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Kungsleden Planning',
        short_name: 'Kungsleden',
        description: 'Hemavan → Abisko thru-hike planner',
        theme_color: '#0a3d2e',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: '/kungsleden-app/',
        scope: '/kungsleden-app/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  define: {
    __COMMIT_SHA__: JSON.stringify(process.env.VITE_COMMIT_SHA ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(process.env.VITE_BUILD_TIME ?? new Date().toISOString()),
  },
})
