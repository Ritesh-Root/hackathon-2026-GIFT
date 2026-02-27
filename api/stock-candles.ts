export const config = { runtime: 'edge' };

interface CandlePoint {
    date: string;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');
    const interval = url.searchParams.get('interval') || '1d';
    const range = url.searchParams.get('range') || '1mo';

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'ticker query parameter is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GIFT-App/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance API returned ${response.status}`);
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];

        if (!result) {
            throw new Error('No data found for ticker');
        }

        const timestamps = result.timestamp;
        const indicators = result.indicators?.quote?.[0];

        if (!timestamps || !indicators) {
            throw new Error('Missing OHLCV data');
        }

        const candles: CandlePoint[] = timestamps
            .map((ts: number, i: number) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                time: new Date(ts * 1000).toISOString(),
                open: indicators.open?.[i] ?? 0,
                high: indicators.high?.[i] ?? 0,
                low: indicators.low?.[i] ?? 0,
                close: indicators.close?.[i] ?? 0,
                volume: indicators.volume?.[i] ?? 0,
            }))
            .filter((c: CandlePoint) => c.close !== 0);

        return new Response(JSON.stringify({
            ticker,
            interval,
            range,
            candles,
            timestamp: new Date().toISOString(),
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
