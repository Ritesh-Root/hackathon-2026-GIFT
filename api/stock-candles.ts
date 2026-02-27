import type { VercelRequest, VercelResponse } from '@vercel/node';

const YAHOO_BASE = 'https://query2.finance.yahoo.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ticker = req.query.ticker as string;
    const interval = (req.query.interval as string) || '1d';
    const range = (req.query.range as string) || '1mo';

    if (!ticker) {
        return res.status(400).json({ error: 'ticker query parameter is required' });
    }

    try {
        const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance returned ${response.status}`);
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const indicators = result?.indicators?.quote?.[0];

        if (!timestamps || !indicators) {
            throw new Error('No candle data in Yahoo response');
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

        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
        return res.status(200).json({ candles });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch candles';
        return res.status(502).json({ error: message });
    }
}
