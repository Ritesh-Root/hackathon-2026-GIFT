import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'

// ── Yahoo Finance auth for dev server ──

const YF_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let yfCookie: string | null = null
let yfCrumb: string | null = null
let yfExpiry = 0

async function getYahooAuth(): Promise<{ cookie: string; crumb: string }> {
    const now = Date.now()
    if (yfCookie && yfCrumb && now < yfExpiry) {
        return { cookie: yfCookie, crumb: yfCrumb }
    }

    const sessionRes = await fetch('https://fc.yahoo.com', {
        redirect: 'manual',
        headers: { 'User-Agent': YF_USER_AGENT },
    })

    const raw = sessionRes.headers.get('set-cookie') ?? ''
    const cookieParts = raw
        .split(/,(?!\s\d)/)
        .map((c) => c.split(';')[0].trim())
        .filter((c) => c.includes('='))
    const cookie = cookieParts.join('; ')
    if (!cookie) throw new Error('No Yahoo session cookie')

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { Cookie: cookie, 'User-Agent': YF_USER_AGENT },
    })
    const crumb = await crumbRes.text()
    if (!crumb || crumb.includes('<!DOCTYPE')) throw new Error('Invalid crumb')

    yfCookie = cookie
    yfCrumb = crumb
    yfExpiry = now + 300_000
    return { cookie, crumb }
}

async function fetchFromYahoo(path: string): Promise<Response> {
    const { cookie, crumb } = await getYahooAuth()
    const sep = path.includes('?') ? '&' : '?'
    const url = `https://query2.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(crumb)}`
    const res = await fetch(url, {
        headers: { Cookie: cookie, 'User-Agent': YF_USER_AGENT },
    })
    if (res.status === 401) {
        yfCookie = null
        yfCrumb = null
        yfExpiry = 0
        const auth = await getYahooAuth()
        return fetch(
            `https://query2.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(auth.crumb)}`,
            { headers: { Cookie: auth.cookie, 'User-Agent': YF_USER_AGENT } },
        )
    }
    return res
}

// ── Vite plugin: serve /api/* routes in dev ──

function yahooFinanceApiPlugin(): Plugin {
    return {
        name: 'yahoo-finance-api',
        configureServer(server) {
            server.middlewares.use(
                async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                    const reqUrl = new URL(req.url ?? '/', 'http://localhost')

                    if (reqUrl.pathname === '/api/stock-quote') {
                        await handleStockQuote(reqUrl, res)
                    } else if (reqUrl.pathname === '/api/stock-candles') {
                        await handleStockCandles(reqUrl, res)
                    } else {
                        next()
                    }
                },
            )
        },
    }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
}

async function handleStockQuote(reqUrl: URL, res: ServerResponse) {
    const ticker = reqUrl.searchParams.get('ticker')
    if (!ticker) return sendJson(res, 400, { error: 'ticker is required' })

    try {
        const yfRes = await fetchFromYahoo(
            `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
        )
        if (!yfRes.ok) throw new Error(`Yahoo API ${yfRes.status}`)
        const data = await yfRes.json() as Record<string, unknown>
        const chart = data['chart'] as Record<string, unknown> | undefined
        const results = chart?.['result'] as Array<Record<string, unknown>> | undefined
        const meta = results?.[0]?.['meta'] as Record<string, number> | undefined
        if (!meta?.['regularMarketPrice']) throw new Error('No quote data')

        const price = meta['regularMarketPrice']
        const prevClose = meta['previousClose'] ?? price
        sendJson(res, 200, {
            price,
            previousClose: prevClose,
            change: price - prevClose,
            changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
            volume: meta['regularMarketVolume'] ?? 0,
            dayHigh: meta['regularMarketDayHigh'] ?? price,
            dayLow: meta['regularMarketDayLow'] ?? price,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        sendJson(res, 500, { error: String(err) })
    }
}

async function handleStockCandles(reqUrl: URL, res: ServerResponse) {
    const ticker = reqUrl.searchParams.get('ticker')
    const interval = reqUrl.searchParams.get('interval') || '1d'
    const range = reqUrl.searchParams.get('range') || '1mo'
    if (!ticker) return sendJson(res, 400, { error: 'ticker is required' })

    try {
        const yfRes = await fetchFromYahoo(
            `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
        )
        if (!yfRes.ok) throw new Error(`Yahoo API ${yfRes.status}`)
        const data = await yfRes.json() as Record<string, unknown>
        const chart = data['chart'] as Record<string, unknown> | undefined
        const results = chart?.['result'] as Array<Record<string, unknown>> | undefined
        const result = results?.[0]
        const timestamps = result?.['timestamp'] as number[] | undefined
        const quotes = result?.['indicators'] as Record<string, unknown> | undefined
        const quoteArr = quotes?.['quote'] as Array<Record<string, number[]>> | undefined
        const indicators = quoteArr?.[0]
        if (!timestamps || !indicators) throw new Error('No candle data')

        const candles = timestamps
            .map((ts: number, i: number) => {
                const d = new Date(ts * 1000)
                return {
                    date: d.toISOString().split('T')[0],
                    time: d.toISOString(),
                    open: indicators['open']?.[i] ?? 0,
                    high: indicators['high']?.[i] ?? 0,
                    low: indicators['low']?.[i] ?? 0,
                    close: indicators['close']?.[i] ?? 0,
                    volume: indicators['volume']?.[i] ?? 0,
                }
            })
            .filter((c: { close: number }) => c.close !== 0)

        sendJson(res, 200, { ticker, interval, range, candles, timestamp: new Date().toISOString() })
    } catch (err) {
        sendJson(res, 500, { error: String(err) })
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), yahooFinanceApiPlugin()],
    server: {
        proxy: {
            // Legacy proxy kept for backward compatibility — new code uses /api/* routes
            '/yahoo-finance': {
                target: 'https://query2.finance.yahoo.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/yahoo-finance/, ''),
                secure: true,
            },
        },
    },
})
