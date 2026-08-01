import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    VitePWA({
      // 'prompt': a new build is downloaded but HELD until the user taps Update,
      // so the field data never changes underfoot without an explicit action.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      workbox: {
        // precache the bundled trip data too, so the route works fully offline
        globPatterns: ['**/*.{js,wasm,css,html,ico,png,svg,webmanifest,csv,geojson}'],
      },
      manifest: {
        id: '/',
        name: 'Kungsleden Planning',
        short_name: 'Kungsleden',
        description: 'Hemavan → Abisko thru-hike planner',
        theme_color: '#0a3d2e',
        background_color: '#f4f1ea',
        // 'browser' (not 'standalone'): iOS 18 breaks geolocation in standalone PWAs
        // (always code=1). Browser mode keeps Safari's chrome but restores location.
        display: 'browser',
        start_url: '/',
        scope: '/',
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
