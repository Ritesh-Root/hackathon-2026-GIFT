import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Lightweight quote endpoint — returns only current price data.
 * Designed to be polled every 5–10 seconds.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { ticker } = await req.json();

        if (!ticker) {
            return new Response(JSON.stringify({ error: 'Ticker is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Use range=1d&interval=1m to get the latest quote from meta
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.statusText}`);
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
