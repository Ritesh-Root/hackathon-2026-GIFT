import { useState, useEffect } from 'react';
import { fetchUserHoldings, fetchAvailableBalance } from '../services/growwService';
import type { Holding, BalanceInfo } from '../services/growwService';

interface GrowwPortfolioState {
    holdings: Holding[];
    balance: BalanceInfo | null;
    loading: boolean;
    error: string | null;
}

/**
 * Custom hook to seamlessly integrate Groww Portfolio data into React components.
 * Automatically fetches available balance and holdings upon mounting.
 */
export const useGrowwPortfolio = () => {
    const [state, setState] = useState<GrowwPortfolioState>({
        holdings: [],
        balance: null,
        loading: true,
        error: null,
    });

    const loadPortfolioData = async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            // Fetch both endpoints concurrently to minimize loading time
            const [holdingsData, balanceData] = await Promise.all([
                fetchUserHoldings(),
                fetchAvailableBalance()
            ]);

            setState({
                holdings: holdingsData,
                balance: balanceData,
                loading: false,
                error: null,
            });
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error.message || 'Failed to sync with Groww Account.',
            }));
        }
    };

    useEffect(() => {
        loadPortfolioData();
    }, []);

    const refreshPortfolio = () => {
        loadPortfolioData();
    };

    return { ...state, refreshPortfolio };
};
