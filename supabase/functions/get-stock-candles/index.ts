import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * OHLCV candle data endpoint.
 * Accepts `interval` (5m, 1m, 1d) and `range` (1d, 5d, 1mo).
 * Designed to be polled every 30–60 seconds.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { ticker, interval = '1d', range = '1mo' } = await req.json();

        if (!ticker) {
            return new Response(JSON.stringify({ error: 'Ticker is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.statusText}`);
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

        return new Response(JSON.stringify({
            ticker,
            interval,
            range,
            candles,
            timestamp: new Date().toISOString(),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
