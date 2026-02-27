import { fetchFromYahoo } from './_lib/yahoo-auth';

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Vercel Edge Function: /api/stock-quote?ticker=RELIANCE.NS
 * Returns current price data with cookie+crumb authenticated Yahoo Finance access.
 */
export default async function handler(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'ticker query parameter is required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const response = await fetchFromYahoo(
            `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`
        );

        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            throw new Error('No data found for ticker');
        }

        const meta = result.meta;
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

        return new Response(JSON.stringify(quote), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}
