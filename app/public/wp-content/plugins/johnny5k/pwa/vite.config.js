import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Johnny5k',
        short_name: 'J5K',
        description: 'Your AI-powered fitness & nutrition coach',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Only cache the workout screen for offline use
        runtimeCaching: [
          {
            urlPattern: /\/workout/,
            handler: 'NetworkFirst',
            options: { cacheName: 'workout-cache', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  // API proxy during development — points to LocalWP
  server: {
    proxy: {
      '/wp-json': {
        target: 'http://johnny5k.local',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/wp-content': {
        target: 'http://johnny5k.local',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/wp-admin': {
        target: 'http://johnny5k.local',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
    },
  },
})
