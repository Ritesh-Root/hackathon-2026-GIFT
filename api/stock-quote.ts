export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'ticker query parameter is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GIFT-App/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance API returned ${response.status}`);
        }

        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;

        if (!meta?.regularMarketPrice) {
            throw new Error('No price data found');
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

        return new Response(JSON.stringify(quote), {
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
