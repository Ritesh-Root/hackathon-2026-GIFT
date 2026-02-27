// ── Types ──

export interface CandlestickPoint {
    date: string;
    time?: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
}

export interface QuoteData {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
    dayHigh: number;
    dayLow: number;
    timestamp: string;
}

export interface StockData {
    name: string;
    sector: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    candlestick: CandlestickPoint[];
}

export interface AIPrediction {
    direction: 'BULLISH' | 'BEARISH';
    confidence: number;
    targetPrice: number;
    reasoning: string;
    technicalSignals: string[];
    timeframe: string;
}

// ── Ticker List ──

const dynamicPredictions: Record<string, AIPrediction> = {};

export function getAvailableTickers(): string[] {
    return ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'SBIN.NS'];
}

// ── Quote Fetcher (used by useLiveStock) ──

/**
 * Fetches current price quote directly from Yahoo Finance proxy.
 */
export async function fetchQuote(ticker: string): Promise<QuoteData | null> {
    try {
        const url = `/yahoo-finance/v8/finance/chart/${ticker}?interval=1m&range=1d`;
        const response = await fetch(url);

        if (response.ok) {
            const json = await response.json();
            const meta = json?.chart?.result?.[0]?.meta;

            if (meta?.regularMarketPrice) {
                const quote: QuoteData = {
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
                console.log(`✅ [Quote] Yahoo Proxy: ${ticker} → ₹${quote.price}`);
                return quote;
            }
        }
    } catch (err) {
        console.warn(`⚠️ [Quote] Yahoo Proxy failed for ${ticker}:`, err);
    }

    return null;
}

// ── Candle Fetcher (used by useLiveStock) ──

/**
 * Fetches OHLCV candle data directly from Yahoo Finance proxy.
 */
export async function fetchCandles(
    ticker: string,
    interval: string = '1d',
    range: string = '1mo'
): Promise<CandlestickPoint[] | null> {
    try {
        const url = `/yahoo-finance/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
        const response = await fetch(url);

        if (response.ok) {
            const json = await response.json();
            const result = json?.chart?.result?.[0];
            const timestamps = result?.timestamp;
            const indicators = result?.indicators?.quote?.[0];

            if (timestamps && indicators) {
                const candles: CandlestickPoint[] = timestamps
                    .map((ts: number, i: number) => ({
                        date: new Date(ts * 1000).toISOString().split('T')[0],
                        time: new Date(ts * 1000).toISOString(),
                        open: indicators.open?.[i] ?? 0,
                        high: indicators.high?.[i] ?? 0,
                        low: indicators.low?.[i] ?? 0,
                        close: indicators.close?.[i] ?? 0,
                        volume: indicators.volume?.[i] ?? 0,
                    }))
                    .filter((c: CandlestickPoint) => c.close !== 0);

                console.log(`✅ [Candles] Yahoo Proxy: ${ticker} → ${candles.length} candles`);
                return candles;
            }
        }
    } catch (err) {
        console.warn(`⚠️ [Candles] Yahoo Proxy failed for ${ticker}:`, err);
    }

    return null;
}

// ── AI Prediction (kept — uses its own internal fetch) ──

import { getAIPredictionFromGroq, isGroqAvailable } from './groqService';

/**
 * Returns the AI prediction for a given ticker.
 * Fetches its own stock data internally via the split fetchers.
 */
export async function getAIPrediction(ticker: string): Promise<AIPrediction | null> {
    const upperTicker = ticker.toUpperCase();
    const formattedTicker = upperTicker.includes('.') ? upperTicker : `${upperTicker}.NS`;

    // Fetch candles for the AI to analyze
    const candles = await fetchCandles(formattedTicker, '1d', '1mo');
    const quote = await fetchQuote(formattedTicker);

    if (!candles || !quote) return null;

    const currentPrice = quote.price;
    const change = quote.change;

    // Try live Groq if API key is available
    if (isGroqAvailable()) {
        const closes = candles.map((c) => c.close);
        try {
            const groqResult = await getAIPredictionFromGroq(
                formattedTicker,
                currentPrice,
                closes
            );
            if (groqResult) return groqResult;
        } catch (err) {
            console.warn('Groq prediction failed, using fallback:', err);
        }
    }

    // Fallback logic for demo
    if (!dynamicPredictions[formattedTicker]) {
        dynamicPredictions[formattedTicker] = {
            direction: change >= 0 ? 'BULLISH' : 'BEARISH',
            confidence: 0.75,
            targetPrice: currentPrice * (change >= 0 ? 1.05 : 0.95),
            reasoning: `Based on the latest ${change >= 0 ? 'uptrend' : 'downtrend'}, the stock is showing ${change >= 0 ? 'strength' : 'weakness'} in the daily chart.`,
            technicalSignals: [change >= 0 ? 'Momentum Bullish' : 'Price Action Bearish', 'Volume Analysis'],
            timeframe: '1 Week'
        };
    }

    return dynamicPredictions[formattedTicker];
}
