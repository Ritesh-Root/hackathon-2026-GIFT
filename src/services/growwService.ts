// growwService.ts
// Official Groww Trading API Service Layer Wrapper
// Simulates live API integration using Vite proxy to bypass CORS.

const GROWW_API_BASE = '/api/groww';
const API_KEY = import.meta.env.VITE_GROWW_API_KEY || '';
const API_SECRET = import.meta.env.VITE_GROWW_API_SECRET_KEY || '';

/**
 * Authenticated headers for portfolio / order endpoints (require Groww API credentials).
 */
const getAuthHeaders = () => ({
    'Authorization': `Bearer ${API_KEY}`,
    'X-API-VERSION': '1.0',
    'X-API-SECRET': API_SECRET,
    'Content-Type': 'application/json',
});

/**
 * Minimal headers for public market-data endpoints (quotes, candles).
 * Sending invalid auth tokens causes Groww to reject otherwise-public requests.
 */
const getPublicHeaders = () => ({
    'Content-Type': 'application/json',
});

// --- TypeScript Interfaces for expected responses ---

export interface LiveQuote {
    ticker: string;
    ltp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    previousClose?: number;
    dayChange?: number;
    dayChangePerc?: number;
    volume?: number;
    timestamp: string;
}

export interface GrowwCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface OrderBookEntry {
    price: number;
    quantity: number;
    orders: number;
}

export interface MarketDepth {
    ticker: string;
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    timestamp: string;
}

export interface Holding {
    stockName: string;
    ticker: string;
    quantity: number;
    averageBuyPrice: number;
    currentValue: number;
    ltp: number;
}

export interface BalanceInfo {
    availableCash: number;
    utilizedMargin: number;
    totalBalance: number;
    currency: string;
}

export interface OrderResponse {
    orderId: string;
    ticker: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
    timestamp: string;
    message?: string;
}

// --- 1. Market Data Engine ---

/**
 * Converts a ticker (e.g. "RELIANCE.NS") to Groww's NSE symbol format ("RELIANCE").
 */
const toGrowwSymbol = (ticker: string): string =>
    ticker.replace(/\.NS$/i, '').toUpperCase();

/**
 * Fetches the real-time LTP, open, high, low, and close for a specific stock
 * using Groww's stock data API.
 */
export const fetchLiveQuote = async (ticker: string): Promise<LiveQuote> => {
    const symbol = toGrowwSymbol(ticker);
    try {
        const response = await fetch(
            `${GROWW_API_BASE}/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/${symbol}`,
            { method: 'GET', headers: getPublicHeaders() }
        );

        if (!response.ok) throw new Error(`Failed to fetch quote for ${symbol}`);
        const data = await response.json();
        return {
            ticker: symbol,
            ltp: data.ltp ?? data.lastTradedPrice ?? 0,
            open: data.open ?? 0,
            high: data.high ?? 0,
            low: data.low ?? 0,
            close: data.close ?? 0,
            previousClose: data.previousClose ?? data.prevDayClose ?? 0,
            dayChange: data.dayChange ?? 0,
            dayChangePerc: data.dayChangePerc ?? 0,
            volume: data.volume ?? data.totalTradedVolume ?? 0,
            timestamp: data.ts ?? new Date().toISOString(),
        } as LiveQuote;
    } catch (error) {
        console.error(`[Groww API] Error fetching live quote for ${symbol}:`, error);
        throw error;
    }
};

/**
 * Fetches the top 5 bid/ask orders (Order Book) for advanced trading insights.
 */
export const fetchMarketDepth = async (ticker: string): Promise<MarketDepth> => {
    const symbol = toGrowwSymbol(ticker);
    try {
        const response = await fetch(`${GROWW_API_BASE}/market/depth/${symbol}`, {
            method: 'GET',
            headers: getPublicHeaders(),
        });

        if (!response.ok) throw new Error(`Failed to fetch market depth for ${symbol}`);
        const data = await response.json();
        return data as MarketDepth;
    } catch (error) {
        console.error(`[Groww API] Error fetching market depth for ${symbol}:`, error);
        throw error;
    }
};

/**
 * Fetches OHLCV candle data from Groww's charting service.
 * Converts range/interval params to Groww's date-based format.
 */
export const fetchGrowwCandles = async (
    ticker: string,
    intervalMinutes: number = 1440,
    rangeDays: number = 30
): Promise<GrowwCandle[]> => {
    const symbol = toGrowwSymbol(ticker);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - rangeDays);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    try {
        const response = await fetch(
            `${GROWW_API_BASE}/charting_service/v2/chart/exchange/NSE/segment/CASH/${symbol}` +
            `?endDate=${fmt(endDate)}&intervalInMinutes=${intervalMinutes}&startDate=${fmt(startDate)}`,
            { method: 'GET', headers: getPublicHeaders() }
        );

        if (!response.ok) throw new Error(`Failed to fetch candles for ${symbol}`);
        const data = await response.json();

        // Groww returns candles as arrays: [timestamp, open, high, low, close, volume]
        const raw = data.candles ?? data.chartData ?? [];
        const candles: GrowwCandle[] = raw.map(
            (c: number[]) => {
                // Detect seconds vs milliseconds: timestamps > 1e12 are in ms
                const ts = c[0] > 1e12 ? Math.floor(c[0] / 1000) : c[0];
                return {
                    timestamp: ts,
                    open: c[1],
                    high: c[2],
                    low: c[3],
                    close: c[4],
                    volume: c[5] ?? 0,
                };
            }
        );

        return candles;
    } catch (error) {
        console.error(`[Groww API] Error fetching candles for ${symbol}:`, error);
        throw error;
    }
};

// --- 2. Portfolio & Account Sync ---

/**
 * Retrieves the user's actual Demat account holdings.
 */
export const fetchUserHoldings = async (): Promise<Holding[]> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/portfolio/holdings`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch user holdings');
        const data = await response.json();
        return data.holdings as Holding[];
    } catch (error) {
        console.error('[Groww API] Error fetching user holdings:', error);
        throw error;
    }
};

/**
 * Retrieves the current cash balance available for trading.
 */
export const fetchAvailableBalance = async (): Promise<BalanceInfo> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/account/balance`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch available balance');
        const data = await response.json();
        return data as BalanceInfo;
    } catch (error) {
        console.error('[Groww API] Error fetching available balance:', error);
        throw error;
    }
};

// --- 3. Order Execution (The Heavy Hitter) ---

/**
 * Sends a live market order to the exchange.
 */
export const placeMarketOrder = async (
    ticker: string,
    quantity: number,
    action: 'BUY' | 'SELL'
): Promise<OrderResponse> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/order/place`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ticker,
                quantity,
                action,
                orderType: 'MARKET'
            }),
        });

        if (!response.ok) throw new Error('Failed to place market order');
        const data = await response.json();
        return data as OrderResponse;
    } catch (error) {
        console.error(`[Groww API] Error placing ${action} order for ${ticker}:`, error);
        throw error;
    }
};

/**
 * Cancels a pending order.
 */
export const cancelOrder = async (orderId: string): Promise<OrderResponse> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/order/cancel/${orderId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error(`Failed to cancel order ${orderId}`);
        const data = await response.json();
        return data as OrderResponse;
    } catch (error) {
        console.error(`[Groww API] Error canceling order ${orderId}:`, error);
        throw error;
    }
};
