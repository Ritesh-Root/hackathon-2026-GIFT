import { fetchFromYahoo } from './_lib/yahoo-auth';

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Vercel Edge Function: /api/stock-candles?ticker=RELIANCE.NS&interval=1d&range=1mo
 * Returns OHLCV candlestick data with cookie+crumb authenticated Yahoo Finance access.
 */
export default async function handler(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');
    const interval = url.searchParams.get('interval') || '1d';
    const range = url.searchParams.get('range') || '1mo';

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'ticker query parameter is required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const response = await fetchFromYahoo(
            `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
        );

        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            throw new Error('No data found for ticker');
        }

        const timestamps = result.timestamp;
        const indicators = result.indicators?.quote?.[0];

        if (!timestamps || !indicators) {
            throw new Error('Missing OHLCV data');
        }

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

        return new Response(
            JSON.stringify({
                ticker,
                interval,
                range,
                candles,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            }
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}
