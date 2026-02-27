import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const YAHOO_BASE = 'https://query2.finance.yahoo.com';

/**
 * Vite plugin that mirrors the Vercel API routes during local development.
 * Handles /api/stock-quote and /api/stock-candles so the frontend code
 * works identically in dev and production.
 */
function yahooFinanceApi(): Plugin {
  return {
    name: 'yahoo-finance-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/stock-')) return next();

        const url = new URL(req.url, 'http://localhost');
        const ticker = url.searchParams.get('ticker');

        if (!ticker) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ticker query parameter is required' }));
          return;
        }

        try {
          if (req.url.startsWith('/api/stock-quote')) {
            const yahooUrl = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
            const resp = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
            const data: any = await resp.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (!meta?.regularMarketPrice) throw new Error('No price data');

            const quote = {
              price: meta.regularMarketPrice,
              previousClose: meta.previousClose ?? meta.regularMarketPrice,
              change: meta.regularMarketPrice - (meta.previousClose ?? meta.regularMarketPrice),
              changePercent: meta.previousClose
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
                : 0,
              volume: meta.regularMarketVolume ?? 0,
              dayHigh: meta.regularMarketDayHigh ?? meta.regularMarketPrice,
              dayLow: meta.regularMarketDayLow ?? meta.regularMarketPrice,
              timestamp: new Date().toISOString(),
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(quote));
          } else if (req.url.startsWith('/api/stock-candles')) {
            const interval = url.searchParams.get('interval') || '1d';
            const range = url.searchParams.get('range') || '1mo';
            const yahooUrl = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
            const resp = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
            const data: any = await resp.json();
            const result = data?.chart?.result?.[0];
            const timestamps = result?.timestamp;
            const indicators = result?.indicators?.quote?.[0];
            if (!timestamps || !indicators) throw new Error('No candle data');

            const candles = timestamps
              .map((ts: number, i: number) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                time: new Date(ts * 1000).toISOString(),
                open: indicators.open?.[i] ?? 0,
                high: indicators.high?.[i] ?? 0,
                low: indicators.low?.[i] ?? 0,
                close: indicators.close?.[i] ?? 0,
                volume: indicators.volume?.[i] ?? 0,
              }))
              .filter((c: { close: number }) => c.close !== 0);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ candles }));
          } else {
            next();
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [yahooFinanceApi(), react()],
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
  },
})
