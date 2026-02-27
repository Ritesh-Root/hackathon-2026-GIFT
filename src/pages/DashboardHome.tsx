import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Link } from 'react-router-dom';
import { getAvailableTickers } from '../services/marketService';
import { useLiveStock } from '../hooks/useLiveStock';
import DataSourceBadge from '../components/DataSourceBadge';
import './DashboardHome.css';

// ── Per-ticker card that uses the shared hook ──
function TickerCard({ ticker }: { ticker: string }) {
    const { quote, candles, source, lastUpdated, isLoading } = useLiveStock(ticker);

    const closes = useMemo(
        () => candles?.map((c) => c.close) ?? [],
        [candles]
    );

    const change = quote?.change ?? 0;
    const changePercent = quote?.changePercent ?? 0;
    const price = quote?.price ?? 0;
    const color = change >= 0 ? '#10b981' : '#ef4444';

    const sparkOption = useMemo(() => ({
        backgroundColor: 'transparent',
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: { show: false, type: 'category' as const, data: closes.map((_, i) => i) },
        yAxis: { show: false, type: 'value' as const, scale: true },
        series: [
            {
                type: 'line',
                data: closes,
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 1.5, color },
                areaStyle: {
                    color: {
                        type: 'linear' as const,
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: color + '30' },
                            { offset: 1, color: color + '00' },
                        ],
                    },
                },
            },
        ],
    }), [closes, color]);

    if (isLoading && !quote) {
        return (
            <div className="ticker-reel-item" style={{ minWidth: '160px', height: '60px', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', opacity: 0.5 }}></div>
            </div>
        );
    }

    return (
        <Link to="/dashboard/predict" className="ticker-reel-item">
            <div className="ticker-reel-info">
                <span className="ticker-reel-symbol">{ticker}</span>
                <span className="ticker-reel-price">₹{price.toFixed(2)}</span>
            </div>
            {closes.length > 0 && (
                <ReactECharts
                    option={sparkOption}
                    style={{ height: '40px', width: '100px' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                    lazyUpdate={true}
                />
            )}
            <span
                className="ticker-reel-change"
                style={{ color: change >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
                {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
            <DataSourceBadge source={source} lastUpdated={lastUpdated} />
        </Link>
    );
}

import { usePaperStore } from '../store/paperStore';
import type { Holding } from '../store/paperStore';

export default function DashboardHome() {
    const tickers = useMemo(() => getAvailableTickers(), []);

    // ── Bind to Core Engine ──
    const { holdings, balance } = usePaperStore();

    const totalPortfolioValue = useMemo(
        () => holdings.reduce((sum: number, h: Holding) => sum + h.shares * h.currentPrice, 0) + balance,
        [holdings, balance]
    );

    const totalInvested = useMemo(
        () => holdings.reduce((sum: number, h: Holding) => sum + h.shares * h.avgCost, 0),
        [holdings]
    );

    const totalPnL = useMemo(() => totalPortfolioValue - balance - totalInvested, [totalPortfolioValue, balance, totalInvested]);

    const totalReturn = useMemo(
        () => totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0,
        [totalPnL, totalInvested]
    );

    return (
        <div className="dashboard-home animate-fade-in">
            {/* Header */}
            <div className="dashboard-home-header">
                <h1 className="dashboard-home-title">
                    Good{getGreeting()}, <span className="gradient-text">Investor</span>
                </h1>
                <p className="dashboard-home-subtitle">
                    Here's your financial intelligence overview
                </p>
            </div>

            {/* Market Ticker Reel */}
            <div className="ticker-reel">
                {tickers.map((ticker) => (
                    <TickerCard key={ticker} ticker={ticker} />
                ))}
            </div>

            {/* Quick Stats */}
            <div className="dashboard-stats-grid">
                <div className="card dashboard-stat-card stat-highlight">
                    <div className="stat-icon">💼</div>
                    <div className="stat-content">
                        <span className="stat-value">₹{totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="stat-label">Net Liq Value (Balance + Holdings)</span>
                        <span className="stat-change" style={{ color: totalPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalReturn.toFixed(2)}%)
                        </span>
                    </div>
                </div>
                <div className="card dashboard-stat-card">
                    <div className="stat-icon">💵</div>
                    <div className="stat-content">
                        <span className="stat-value">₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="stat-label">Available Buying Power</span>
                    </div>
                </div>
                <div className="card dashboard-stat-card">
                    <div className="stat-icon">📚</div>
                    <div className="stat-content">
                        <span className="stat-value">37%</span>
                        <span className="stat-label">Learning Progress</span>
                    </div>
                </div>
                <div className="card dashboard-stat-card">
                    <div className="stat-icon">🤖</div>
                    <div className="stat-content">
                        <span className="stat-value">Connected</span>
                        <span className="stat-label">AI Copilot</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-quick-actions">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                    <Link to="/dashboard/predict" className="card quick-action-card">
                        <span className="quick-action-emoji">🎯</span>
                        <span className="quick-action-title">Make a Prediction</span>
                        <span className="quick-action-desc">Test your market intuition against AI</span>
                    </Link>
                    <Link to="/dashboard/advisor" className="card quick-action-card">
                        <span className="quick-action-emoji">🤖</span>
                        <span className="quick-action-title">Ask AI Advisor</span>
                        <span className="quick-action-desc">Get personalized strategy with action cards</span>
                    </Link>
                    <Link to="/dashboard/news" className="card quick-action-card">
                        <span className="quick-action-emoji">📰</span>
                        <span className="quick-action-title">Market News</span>
                        <span className="quick-action-desc">Live sentiment analysis on your holdings</span>
                    </Link>
                    <Link to="/dashboard/portfolio" className="card quick-action-card">
                        <span className="quick-action-emoji">💼</span>
                        <span className="quick-action-title">Portfolio</span>
                        <span className="quick-action-desc">Allocation, risk gauge & sector analysis</span>
                    </Link>
                    <Link to="/dashboard/learn" className="card quick-action-card">
                        <span className="quick-action-emoji">📚</span>
                        <span className="quick-action-title">Learn Finance</span>
                        <span className="quick-action-desc">6 modules with quizzes & progress tracking</span>
                    </Link>
                    <Link to="/dashboard/community" className="card quick-action-card">
                        <span className="quick-action-emoji">💬</span>
                        <span className="quick-action-title">Trading Floor</span>
                        <span className="quick-action-desc">Chat with fellow traders in real-time</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return ' Morning';
    if (hour < 17) return ' Afternoon';
    return ' Evening';
}
