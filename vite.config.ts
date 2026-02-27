import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Plugin to prevent Vite dev server from processing the Vercel API directory
function excludeVercelApi(): Plugin {
  return {
    name: 'exclude-vercel-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'API routes are only available in production (Vercel)' }));
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excludeVercelApi()],
  server: {
    proxy: {
      // Proxy Yahoo Finance API calls through the Vite dev server (bypasses CORS)
      '/yahoo-finance': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-finance/, ''),
        secure: true,
      },
    },
    watch: {
      // Ignore Vercel serverless function directory in dev mode
      ignored: ['**/api/**'],
    },
  },
})
