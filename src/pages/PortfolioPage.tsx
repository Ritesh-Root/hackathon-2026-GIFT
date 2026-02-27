import { useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuthStore } from '../store/authStore';
import { isDemoUser } from '../services/supabaseService';
import { useGrowwPortfolio } from '../hooks/useGrowwPortfolio';
import TradeExecutionModal from '../components/TradeExecutionModal';
import { usePaperStore } from '../store/paperStore';
import type { Holding } from '../store/paperStore';
import './PortfolioPage.css';

const CHART_COLORS = ['#8B5CF6', '#00E676', '#f59e0b', '#3b82f6', '#FF3B30', '#06b6d4', '#ec4899', '#84cc16'];

export default function PortfolioPage() {
    const { user } = useAuthStore();
    const isDemo = !user || isDemoUser(user.id);

    // ─────────────────────────────────────────────
    // THE SINGLE SOURCE OF TRUTH (Core Engine)
    // ─────────────────────────────────────────────
    const { holdings, executeTrade, loadDemoHoldings } = usePaperStore();
    const { balance: growwBalance, loading, error } = useGrowwPortfolio();

    // Trade modal state
    const [tradeModal, setTradeModal] = useState<{
        isOpen: boolean;
        ticker: string;
        currentPrice: number;
        actionType: 'BUY' | 'SELL';
    }>({ isOpen: false, ticker: '', currentPrice: 0, actionType: 'BUY' });

    const openTradeModal = (ticker: string, currentPrice: number, actionType: 'BUY' | 'SELL') => {
        setTradeModal({ isOpen: true, ticker, currentPrice, actionType });
    };

    const closeTradeModal = () => {
        setTradeModal(prev => ({ ...prev, isOpen: false }));
    };

    // ─────────────────────────────────────────────
    // 3. THE TRADE EXECUTION FUNCTION
    //    Mutates holdings state via the paperStore
    // ─────────────────────────────────────────────
    const handleTrade = useCallback((ticker: string, action: 'BUY' | 'SELL', quantity: number) => {
        executeTrade(ticker, ticker, quantity, tradeModal.currentPrice, action);
    }, [tradeModal.currentPrice, executeTrade]);

    // ─────────────────────────────────────────────
    // 2. DYNAMIC DERIVED STATE (THE MATH)
    //    All of these recompute instantly when
    //    `holdings` state changes after a trade.
    // ─────────────────────────────────────────────

    const totalPortfolioValue = useMemo(
        () => holdings.reduce((sum: number, h: Holding) => sum + h.shares * h.currentPrice, 0),
        [holdings]
    );

    const totalInvested = useMemo(
        () => holdings.reduce((sum: number, h: Holding) => sum + h.shares * h.avgCost, 0),
        [holdings]
    );

    const totalPnL = useMemo(() => totalPortfolioValue - totalInvested, [totalPortfolioValue, totalInvested]);

    const totalReturn = useMemo(
        () => totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0,
        [totalPnL, totalInvested]
    );

    // Asset Allocation — feeds the Donut Chart
    const assetAllocationData = useMemo(
        () => holdings.map((h: Holding, i: number) => ({
            name: h.ticker,
            value: parseFloat((h.shares * h.currentPrice).toFixed(2)),
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
        [holdings]
    );

    // Sector Distribution — feeds the Bar Chart
    const sectorDistributionData = useMemo(() => {
        const sectorMap = new Map<string, number>();
        holdings.forEach((h: Holding) => {
            const val = h.shares * h.currentPrice;
            sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + val);
        });
        return Array.from(sectorMap.entries()).map(([name, value], i) => ({
            name,
            value: totalPortfolioValue > 0 ? parseFloat(((value / totalPortfolioValue) * 100).toFixed(1)) : 0,
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
        }));
    }, [holdings, totalPortfolioValue]);

    // Risk Score — derived from concentration
    const riskScore = useMemo(() => {
        if (holdings.length === 0 || totalPortfolioValue === 0) return 0;
        const maxAllocation = Math.max(...holdings.map((h: Holding) => (h.shares * h.currentPrice / totalPortfolioValue) * 100));
        return Math.min(100, Math.round(maxAllocation * 1.5 + (holdings.length < 10 ? 15 : 0)));
    }, [holdings, totalPortfolioValue]);

    // ─────────────────────────────────────────────
    // 4. ECHART OPTIONS (REACTIVE)
    //    These rebuild when derived data changes.
    // ─────────────────────────────────────────────

    const allocationOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(22, 22, 35, 0.95)',
            borderColor: 'rgba(148, 163, 184, 0.1)',
            textStyle: { color: '#f1f5f9' },
            formatter: '{b}: {d}%',
        },
        series: [
            {
                type: 'pie',
                radius: ['45%', '75%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: { borderRadius: 6, borderColor: '#050505', borderWidth: 2 },
                label: { show: true, color: '#FAFAFA', fontSize: 11, formatter: '{b}\n{d}%' },
                emphasis: { label: { fontSize: 14, fontWeight: 'bold' } },
                data: assetAllocationData,
                animationDuration: 400,
                animationEasing: 'cubicInOut',
            },
        ],
    }), [assetAllocationData]);

    const sectorOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(20, 20, 22, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
            textStyle: { color: '#FAFAFA' },
        },
        grid: { left: '3%', right: '8%', top: '8%', bottom: '8%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { color: '#FAFAFA', formatter: '{value}%' },
            axisLine: { show: false },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        },
        yAxis: {
            type: 'category',
            data: sectorDistributionData.map((s) => s.name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#FAFAFA', fontSize: 11 },
        },
        series: [
            {
                type: 'bar',
                data: sectorDistributionData.map((s) => ({
                    value: s.value,
                    itemStyle: s.itemStyle,
                })),
                barWidth: '50%',
                label: { show: true, position: 'right', color: '#FAFAFA', fontSize: 11, formatter: '{c}%' },
                animationDuration: 400,
                animationEasing: 'cubicInOut',
            },
        ],
    }), [sectorDistributionData]);

    const riskGaugeOption = useMemo(() => ({
        backgroundColor: 'transparent',
        series: [
            {
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                radius: '90%',
                center: ['50%', '70%'],
                axisLine: {
                    lineStyle: {
                        width: 16,
                        color: [
                            [0.3, '#00E676'],
                            [0.6, '#f59e0b'],
                            [1, '#FF3B30'],
                        ],
                    },
                },
                pointer: {
                    width: 4,
                    length: '60%',
                    itemStyle: { color: '#FAFAFA' },
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: {
                    distance: -30,
                    color: '#FAFAFA',
                    fontSize: 10,
                    formatter: (value: number) => {
                        if (value === 0) return 'Low';
                        if (value === 50) return 'Med';
                        if (value === 100) return 'High';
                        return '';
                    },
                },
                title: { show: false },
                detail: {
                    valueAnimation: true,
                    formatter: '{value}',
                    color: '#FAFAFA',
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono',
                    offsetCenter: [0, '0%'],
                },
                data: [{ value: riskScore }],
            },
        ],
    }), [riskScore]);

    // ─────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────
    return (
        <div className="portfolio-page animate-fade-in">
            <div className="portfolio-header">
                <h1 className="portfolio-title">💼 Portfolio Analyzer</h1>
                <p className="portfolio-subtitle">Allocation, risk assessment, and performance tracking</p>
            </div>

            {/* Top Stats — all derived from `holdings` via useMemo */}
            <div className="portfolio-stats">
                <div className="card portfolio-stat-card">
                    <span className="portfolio-stat-label">Total Value</span>
                    <span className="portfolio-stat-value">₹{totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {growwBalance && !loading && !error && (
                    <div className="card portfolio-stat-card">
                        <span className="portfolio-stat-label">Available Balance (Groww)</span>
                        <span className="portfolio-stat-value">₹{growwBalance.availableCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                )}
                <div className="card portfolio-stat-card">
                    <span className="portfolio-stat-label">Total P&L</span>
                    <span className="portfolio-stat-value" style={{ color: totalPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="card portfolio-stat-card">
                    <span className="portfolio-stat-label">Return</span>
                    <span className="portfolio-stat-value" style={{ color: totalReturn >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                    </span>
                </div>
                <div className="card portfolio-stat-card">
                    <span className="portfolio-stat-label">Positions</span>
                    <span className="portfolio-stat-value">{holdings.length}</span>
                </div>
            </div>

            {/* Charts — all driven by useMemo-derived data */}
            <div className="portfolio-charts-grid">
                <div className="card portfolio-chart-card">
                    <h3>Asset Allocation</h3>
                    <ReactECharts option={allocationOption} style={{ height: '280px' }} notMerge={true} lazyUpdate={true} />
                </div>
                <div className="card portfolio-chart-card">
                    <h3>Risk Score</h3>
                    <ReactECharts option={riskGaugeOption} style={{ height: '200px' }} lazyUpdate={true} />
                    <p className="risk-label" style={{ color: riskScore < 40 ? 'var(--color-success)' : riskScore < 70 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {riskScore < 40 ? 'Conservative' : riskScore < 70 ? 'Moderate' : 'Aggressive'}
                    </p>
                </div>
                <div className="card portfolio-chart-card portfolio-chart-wide">
                    <h3>Sector Distribution</h3>
                    <ReactECharts option={sectorOption} style={{ height: '200px' }} notMerge={true} lazyUpdate={true} />
                </div>
            </div>

            {/* Holdings Table — interactive rows with Buy/Sell hover actions */}
            <div className="card portfolio-table-card">
                <h3>Holdings</h3>
                <div className="portfolio-table-wrapper">
                    <table className="portfolio-table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Name</th>
                                <th>Shares</th>
                                <th>Avg Cost</th>
                                <th>Price</th>
                                <th>Value</th>
                                <th>P&L</th>
                                <th>Return</th>
                                <th className="th-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        <div style={{ marginBottom: '1rem' }}>No active holdings. Try placing a paper trade!</div>
                                        {isDemo && (
                                            <button
                                                className="btn btn-primary"
                                                onClick={loadDemoHoldings}
                                            >
                                                Load Demo Portfolio
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                holdings.map((h: Holding) => {
                                    const value = h.shares * h.currentPrice;
                                    const pnl = (h.currentPrice - h.avgCost) * h.shares;
                                    const ret = ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
                                    return (
                                        <tr key={h.ticker} className="holdings-row">
                                            <td className="table-ticker">{h.ticker}</td>
                                            <td className="table-name">{h.name}</td>
                                            <td>{h.shares}</td>
                                            <td>₹{h.avgCost.toFixed(2)}</td>
                                            <td>₹{h.currentPrice.toFixed(2)}</td>
                                            <td>₹{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td style={{ color: pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                                            </td>
                                            <td style={{ color: ret >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                                            </td>
                                            <td className="td-actions">
                                                <div className="row-actions">
                                                    <button
                                                        className="action-btn action-buy"
                                                        onClick={() => openTradeModal(h.ticker, h.currentPrice, 'BUY')}
                                                    >
                                                        Buy
                                                    </button>
                                                    <button
                                                        className="action-btn action-sell"
                                                        onClick={() => openTradeModal(h.ticker, h.currentPrice, 'SELL')}
                                                    >
                                                        Sell
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Trade Execution Modal — fires handleTrade on fill */}
            <TradeExecutionModal
                isOpen={tradeModal.isOpen}
                onClose={closeTradeModal}
                ticker={tradeModal.ticker}
                currentPrice={tradeModal.currentPrice}
                actionType={tradeModal.actionType}
                onTradeExecute={handleTrade}
            />
        </div>
    );
}
