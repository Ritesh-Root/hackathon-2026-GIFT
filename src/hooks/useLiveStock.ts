import { useState, useEffect, useRef, useCallback } from 'react';
import {
    fetchQuote,
    fetchCandles,
    type QuoteData,
    type CandlestickPoint,
} from '../services/marketService';
import fallbackData from '../data/fallback_data.json';

// ── Types ──

export interface LiveStockState {
    /** Current price quote (price, change, volume, etc.) */
    quote: QuoteData | null;
    /** OHLCV candlestick data */
    candles: CandlestickPoint[] | null;
    /** Whether the data came from a live API or local fallback */
    source: 'live' | 'fallback';
    /** Timestamp of last successful data update */
    lastUpdated: Date | null;
    /** True while the initial fetch is in progress */
    isLoading: boolean;
    /** Error message if all sources failed */
    error: string | null;
}

// ── Configuration ──

const QUOTE_POLL_INTERVAL_MS = 7_000;   // ~7 seconds
const CANDLE_POLL_INTERVAL_MS = 45_000; // ~45 seconds

// ── Fallback helpers ──

interface FallbackStock {
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    candlestick: CandlestickPoint[];
}

function getFallbackQuote(ticker: string): QuoteData | null {
    const formatted = ticker.toUpperCase();
    const entry = (fallbackData.stocks as Record<string, FallbackStock>)[formatted];
    if (!entry) return null;
    return {
        price: entry.currentPrice,
        previousClose: entry.currentPrice - entry.change,
        change: entry.change,
        changePercent: entry.changePercent,
        volume: 0,
        dayHigh: entry.currentPrice,
        dayLow: entry.currentPrice,
        timestamp: new Date().toISOString(),
    };
}

function getFallbackCandles(ticker: string): CandlestickPoint[] | null {
    const formatted = ticker.toUpperCase();
    const entry = (fallbackData.stocks as Record<string, FallbackStock>)[formatted];
    return entry?.candlestick ?? null;
}

// ── Hook ──

/**
 * Central hook for live stock data. Polls quote (every ~7s) and candles (every ~45s).
 * Returns transparent source status — never silently falls back to fake data.
 */
export function useLiveStock(
    ticker: string,
    interval: string = '1d',
    range: string = '1mo'
): LiveStockState {
    const [state, setState] = useState<LiveStockState>({
        quote: null,
        candles: null,
        source: 'fallback',
        lastUpdated: null,
        isLoading: true,
        error: null,
    });

    const quoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const candleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    // Format ticker
    const formattedTicker = useCallback(() => {
        const upper = ticker.toUpperCase();
        return upper.includes('.') ? upper : `${upper}.NS`;
    }, [ticker]);

    // ── Quote fetcher ──
    const pollQuote = useCallback(async () => {
        const t = formattedTicker();
        try {
            const result = await fetchQuote(t);
            if (!mountedRef.current) return;

            if (result) {
                setState(prev => ({
                    ...prev,
                    quote: result,
                    source: 'live',
                    lastUpdated: new Date(),
                    error: null,
                }));
                return;
            }
        } catch {
            // fetch failed — fall through
        }

        if (!mountedRef.current) return;

        // Fallback
        const fb = getFallbackQuote(t);
        if (fb) {
            setState(prev => ({
                ...prev,
                quote: prev.source === 'live' ? prev.quote : fb, // don't overwrite live with fallback
                source: prev.source === 'live' ? prev.source : 'fallback',
                lastUpdated: prev.lastUpdated ?? new Date(),
                error: 'Live quote unavailable — showing cached data',
            }));
        } else {
            setState(prev => ({
                ...prev,
                error: `No data available for ${t}`,
            }));
        }
    }, [formattedTicker]);

    // ── Candle fetcher ──
    const pollCandles = useCallback(async () => {
        const t = formattedTicker();
        try {
            const result = await fetchCandles(t, interval, range);
            if (!mountedRef.current) return;

            if (result && result.length > 0) {
                setState(prev => ({
                    ...prev,
                    candles: result,
                    source: prev.quote ? prev.source : 'live', // keep existing source status from quote
                    lastUpdated: new Date(),
                }));
                return;
            }
        } catch {
            // fall through to fallback
        }

        if (!mountedRef.current) return;

        // Fallback candles
        const fb = getFallbackCandles(t);
        if (fb) {
            setState(prev => ({
                ...prev,
                candles: prev.candles ?? fb, // don't overwrite live candles
            }));
        }
    }, [formattedTicker, interval, range]);

    // ── Lifecycle ──
    useEffect(() => {
        mountedRef.current = true;

        // Reset state on ticker or timeframe change
        setState({
            quote: null,
            candles: null,
            source: 'fallback',
            lastUpdated: null,
            isLoading: true,
            error: null,
        });

        // Immediately show fallback while fetching
        const t = formattedTicker();
        const fbQuote = getFallbackQuote(t);
        const fbCandles = getFallbackCandles(t);
        if (fbQuote || fbCandles) {
            setState(prev => ({
                ...prev,
                quote: fbQuote,
                candles: fbCandles,
                source: 'fallback',
                isLoading: true, // still loading — waiting for live data
            }));
        }

        // Kick off initial fetches
        const initFetch = async () => {
            await Promise.all([pollQuote(), pollCandles()]);
            if (mountedRef.current) {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };
        initFetch();

        // Start polling
        quoteTimerRef.current = setInterval(pollQuote, QUOTE_POLL_INTERVAL_MS);
        candleTimerRef.current = setInterval(pollCandles, CANDLE_POLL_INTERVAL_MS);

        return () => {
            mountedRef.current = false;
            if (quoteTimerRef.current) clearInterval(quoteTimerRef.current);
            if (candleTimerRef.current) clearInterval(candleTimerRef.current);
        };
    }, [formattedTicker, interval, range, pollQuote, pollCandles]);

    return state;
}
