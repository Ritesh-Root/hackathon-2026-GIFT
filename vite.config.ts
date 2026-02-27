import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Yahoo Finance API calls through the Vite dev server (bypasses CORS)
      '/yahoo-finance': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-finance/, ''),
        secure: true,
      },
      // Proxy Groww API calls through the Vite dev server (bypasses CORS)
      '/api/groww': {
        target: 'https://groww.in/v1/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groww/, ''),
        secure: true,
      },
    },
  },
})
