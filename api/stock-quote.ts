import type { VercelRequest, VercelResponse } from '@vercel/node';

const YAHOO_BASE = 'https://query2.finance.yahoo.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ticker = req.query.ticker as string;
    if (!ticker) {
        return res.status(400).json({ error: 'ticker query parameter is required' });
    }

    try {
        const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance returned ${response.status}`);
        }

        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;

        if (!meta?.regularMarketPrice) {
            throw new Error('No price data in Yahoo response');
        }

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

        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
        return res.status(200).json(quote);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch quote';
        return res.status(502).json({ error: message });
    }
}
