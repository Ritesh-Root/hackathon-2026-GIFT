import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ──
export interface Holding {
    ticker: string;
    name: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
    sector: string;
}

export interface PaperStoreState {
    balance: number;
    holdings: Holding[];

    // Actions
    executeTrade: (
        ticker: string,
        name: string,
        quantity: number,
        price: number,
        action: 'BUY' | 'SELL',
        sector?: string
    ) => { success: boolean; message: string };

    updateHoldingPrices: (prices: Record<string, number>) => void;
    resetWallet: () => void;
    loadDemoHoldings: () => void;
}

const INITIAL_BALANCE = 1_000_000;

export const usePaperStore = create<PaperStoreState>()(
    persist(
        (set, get) => ({
            balance: INITIAL_BALANCE,
            holdings: [],

            executeTrade: (ticker, name, quantity, price, action, sector = 'Unknown') => {
                const state = get();
                const totalValue = quantity * price;

                if (action === 'BUY') {
                    if (state.balance < totalValue) {
                        return { success: false, message: 'Insufficient buying power' };
                    }

                    set((state) => {
                        const existing = state.holdings.find(h => h.ticker === ticker);
                        let newHoldings = [...state.holdings];

                        if (existing) {
                            const newShares = existing.shares + quantity;
                            const newAvgCost = ((existing.shares * existing.avgCost) + totalValue) / newShares;
                            newHoldings = newHoldings.map(h =>
                                h.ticker === ticker
                                    ? { ...h, shares: newShares, avgCost: newAvgCost, currentPrice: price }
                                    : h
                            );
                        } else {
                            newHoldings.push({
                                ticker,
                                name,
                                shares: quantity,
                                avgCost: price,
                                currentPrice: price,
                                sector
                            });
                        }

                        return {
                            balance: state.balance - totalValue,
                            holdings: newHoldings
                        };
                    });

                    return { success: true, message: `Successfully bought ${quantity} shares of ${ticker}` };
                }

                if (action === 'SELL') {
                    const existing = state.holdings.find(h => h.ticker === ticker);
                    if (!existing || existing.shares < quantity) {
                        return { success: false, message: 'Insufficient shares to sell' };
                    }

                    set((state) => {
                        let newHoldings = [...state.holdings];
                        const newShares = existing.shares - quantity;

                        if (newShares === 0) {
                            newHoldings = newHoldings.filter(h => h.ticker !== ticker);
                        } else {
                            newHoldings = newHoldings.map(h =>
                                h.ticker === ticker
                                    ? { ...h, shares: newShares, currentPrice: price }
                                    : h
                            );
                        }

                        return {
                            balance: state.balance + totalValue,
                            holdings: newHoldings
                        };
                    });

                    return { success: true, message: `Successfully sold ${quantity} shares of ${ticker}` };
                }

                return { success: false, message: 'Invalid action' };
            },

            updateHoldingPrices: (prices) => {
                set((state) => ({
                    holdings: state.holdings.map(h => ({
                        ...h,
                        currentPrice: prices[h.ticker] ?? h.currentPrice
                    }))
                }));
            },

            resetWallet: () => {
                set({ balance: INITIAL_BALANCE, holdings: [] });
            },

            loadDemoHoldings: () => {
                set({
                    balance: 345000,
                    holdings: [
                        { ticker: 'RELIANCE.NS', name: 'Reliance Industries', shares: 100, avgCost: 2800, currentPrice: 2845.50, sector: 'Energy' },
                        { ticker: 'TCS.NS', name: 'Tata Consultancy Services', shares: 50, avgCost: 3900, currentPrice: 3980.20, sector: 'Technology' },
                        { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', shares: 200, avgCost: 1400, currentPrice: 1425.10, sector: 'Financials' },
                        { ticker: 'INFY.NS', name: 'Infosys', shares: 150, avgCost: 1500, currentPrice: 1540.80, sector: 'Technology' },
                        { ticker: 'SBIN.NS', name: 'State Bank of India', shares: 300, avgCost: 800, currentPrice: 812.30, sector: 'Financials' }
                    ]
                });
            }
        }),
        {
            name: 'antigravity-paper-wallet',
        }
    )
);
