import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { localChartApiPlugin } from './dev/localChartApi.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    localChartApiPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/yahoo-api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/chart/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'かぶポケ - 株の計算＆NISAシミュレーター',
        short_name: 'かぶポケ',
        description:
          'デイトレOCO即算・リアルタイムVWAPチャート・ナンピン計算・新NISAシミュレーター',
        theme_color: '#10b981',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'ja',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          recharts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
