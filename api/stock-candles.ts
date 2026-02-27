export const config = { runtime: 'edge' };

/**
 * Yahoo Finance now requires session-based authentication (cookie + crumb)
 * for their v8 chart API. This is the same approach used by popular libraries
 * like Python's yfinance and Node's yahoo-finance2.
 *
 * No user API key is needed — the authentication is session-based.
 */

const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Extract cookie name=value pairs from a Response. */
function getCookies(res: Response): string {
    if (typeof res.headers.getSetCookie === 'function') {
        return res.headers
            .getSetCookie()
            .map((c: string) => c.split(';')[0])
            .join('; ');
    }
    const raw = res.headers.get('set-cookie') || '';
    return raw
        .split(/,\s*(?=[A-Za-z0-9_]+=)/)
        .map((c) => c.split(';')[0].trim())
        .filter((c) => c.includes('='))
        .join('; ');
}

/** Fetch Yahoo Finance chart JSON with automatic cookie+crumb auth. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchYahooChart(ticker: string, interval: string, range: string): Promise<any> {
    const encodedTicker = encodeURIComponent(ticker);
    const params = `interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;

    // --- Attempt 1: direct fetch (works when Yahoo doesn't require auth) ---
    for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
        try {
            const res = await fetch(
                `https://${host}/v8/finance/chart/${encodedTicker}?${params}`,
                { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } },
            );
            if (res.ok) {
                const json = await res.json();
                if (json?.chart?.result?.[0]) return json;
            }
        } catch { /* try next */ }
    }

    // --- Attempt 2: cookie + crumb authentication ---
    const cookieRes = await fetch('https://fc.yahoo.com/', {
        redirect: 'manual',
        headers: { 'User-Agent': BROWSER_UA },
    });
    const cookies = getCookies(cookieRes);
    if (!cookies) throw new Error('Failed to obtain Yahoo Finance session cookies');

    const crumbRes = await fetch(
        'https://query2.finance.yahoo.com/v1/test/getcrumb',
        { headers: { 'User-Agent': BROWSER_UA, Cookie: cookies } },
    );
    if (!crumbRes.ok) throw new Error(`Yahoo Finance crumb request failed: ${crumbRes.status}`);
    const crumb = await crumbRes.text();

    for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
        try {
            const res = await fetch(
                `https://${host}/v8/finance/chart/${encodedTicker}?${params}&crumb=${encodeURIComponent(crumb)}`,
                { headers: { 'User-Agent': BROWSER_UA, Cookie: cookies, Accept: 'application/json' } },
            );
            if (res.ok) {
                const json = await res.json();
                if (json?.chart?.result?.[0]) return json;
            }
        } catch { /* try next host */ }
    }

    throw new Error('All Yahoo Finance endpoints failed');
}

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
        const data = await fetchYahooChart(ticker, interval, range);
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
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
