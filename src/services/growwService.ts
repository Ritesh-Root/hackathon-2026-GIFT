// growwService.ts
// Official Groww Trading API Service Layer Wrapper
// Simulates live API integration using Vite proxy to bypass CORS.

const GROWW_API_BASE = '/api/groww';
const API_KEY = import.meta.env.VITE_GROWW_API_KEY || 'demo_key_123';
const API_SECRET = import.meta.env.VITE_GROWW_API_SECRET_KEY || '';

/**
 * Common Headers required for Groww API
 */
const getHeaders = () => ({
    'Authorization': `Bearer ${API_KEY}`,
    'X-API-VERSION': '1.0',
    'X-API-SECRET': API_SECRET,
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
    timestamp: string;
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
 * Fetches the real-time LTP, open, high, low, and close for a specific stock.
 */
export const fetchLiveQuote = async (ticker: string): Promise<LiveQuote> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/market/quote/${ticker}`, {
            method: 'GET',
            headers: getHeaders(),
        });

        if (!response.ok) throw new Error(`Failed to fetch quote for ${ticker}`);
        const data = await response.json();
        return data as LiveQuote;
    } catch (error) {
        console.error(`[Groww API] Error fetching live quote for ${ticker}:`, error);
        throw error;
    }
};

/**
 * Fetches the top 5 bid/ask orders (Order Book) for advanced trading insights.
 */
export const fetchMarketDepth = async (ticker: string): Promise<MarketDepth> => {
    try {
        const response = await fetch(`${GROWW_API_BASE}/market/depth/${ticker}`, {
            method: 'GET',
            headers: getHeaders(),
        });

        if (!response.ok) throw new Error(`Failed to fetch market depth for ${ticker}`);
        const data = await response.json();
        return data as MarketDepth;
    } catch (error) {
        console.error(`[Groww API] Error fetching market depth for ${ticker}:`, error);
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
            headers: getHeaders(),
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
            headers: getHeaders(),
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
            headers: getHeaders(),
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
            headers: getHeaders(),
        });

        if (!response.ok) throw new Error(`Failed to cancel order ${orderId}`);
        const data = await response.json();
        return data as OrderResponse;
    } catch (error) {
        console.error(`[Groww API] Error canceling order ${orderId}:`, error);
        throw error;
    }
};
