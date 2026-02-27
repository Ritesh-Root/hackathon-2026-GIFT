import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Bot, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { getAvailableTickers, getAIPrediction, type AIPrediction } from '../services/marketService';
import { useLiveStock } from '../hooks/useLiveStock';
import DataSourceBadge from '../components/DataSourceBadge';
import { usePaperStore } from '../store/paperStore';
import './PaperTradeSim.css';

export default function PaperTradeSim() {
    const { balance, executeTrade } = usePaperStore();
    const initialTickers = useMemo(() => getAvailableTickers(), []);
    const [tickers, setTickers] = useState<string[]>(initialTickers);
    const [selectedTicker, setSelectedTicker] = useState(tickers[0]);
    const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [sharesInput, setSharesInput] = useState<number>(1);
    const [tradeMessage, setTradeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [searchInput, setSearchInput] = useState('');

    // ── Live stock data via shared hook ──
    const { quote, candles, source, lastUpdated, isLoading } = useLiveStock(selectedTicker);

    // Fetch AI insight when ticker changes
    useEffect(() => {
        setAiPrediction(null);
        setTradeMessage(null);
        setLoadingAI(true);
        getAIPrediction(selectedTicker).then((pred) => {
            setAiPrediction(pred);
            setLoadingAI(false);
        });
    }, [selectedTicker]);

    // Estimated order value for the footer
    const orderValue = quote ? quote.price * sharesInput : 0;

    const handleTrade = (type: 'BUY' | 'SELL') => {
        if (!quote || sharesInput <= 0) return;

        const result = executeTrade(
            selectedTicker,
            selectedTicker.split('.')[0], // Fallback name
            sharesInput,
            quote.price,
            type,
            'Equities'
        );

        if (!result.success) {
            setTradeMessage({
                type: 'error',
                text: `⚠️ ${result.message}`
            });
        } else {
            setTradeMessage({
                type: 'success',
                text: `✅ ${result.message}`
            });
            setSharesInput(1);
        }

        setTimeout(() => setTradeMessage(null), 4000);
    };

    const chartOption = useMemo(() => {
        if (!candles || candles.length === 0) return {};
        const dates = candles.map((p) => p.date);
        const ohlc = candles.map((p) => [p.open, p.close, p.low, p.high]);

        return {
            backgroundColor: 'transparent',
            animation: false,
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(22, 22, 35, 0.95)',
                borderColor: 'rgba(148, 163, 184, 0.1)',
                textStyle: { color: '#f1f5f9', fontSize: 12 },
            },
            grid: { left: '10%', right: '5%', top: '10%', bottom: '15%' },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
                axisLabel: { color: '#64748b', fontSize: 10 },
            },
            yAxis: {
                scale: true,
                axisLine: { show: false },
                axisLabel: { color: '#64748b', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.06)' } },
            },
            series: [
                {
                    name: selectedTicker,
                    type: 'candlestick',
                    data: ohlc,
                    itemStyle: {
                        color: '#10b981',
                        color0: '#ef4444',
                        borderColor: '#10b981',
                        borderColor0: '#ef4444',
                    },
                },
            ],
        };
    }, [candles, selectedTicker]);

    const currentPrice = quote?.price ?? 0;
    const change = quote?.change ?? 0;
    const changePercent = quote?.changePercent ?? 0;

    return (
        <div className="paper-trade-sim animate-fade-in card">
            <div className="paper-trade-header">
                <h3 className="paper-trade-title">📈 Practice Paper Trading</h3>
                <p className="paper-trade-subtitle">Put your newly acquired skills to the test with real market data.</p>
            </div>

            <div className="paper-trade-controls">
                <div className="paper-trade-selector">
                    {tickers.slice(0, 5).map((ticker) => (
                        <button
                            key={ticker}
                            className={`pt-ticker-btn ${selectedTicker === ticker ? 'pt-ticker-btn--active' : ''}`}
                            onClick={() => setSelectedTicker(ticker)}
                        >
                            {ticker}
                        </button>
                    ))}
                </div>
                <form className="pt-search-form" onSubmit={(e) => {
                    e.preventDefault();
                    const t = searchInput.trim().toUpperCase();
                    if (!t) return;
                    const formatted = t.includes('.') ? t : `${t}.NS`;
                    if (!tickers.includes(formatted)) {
                        setTickers(prev => [formatted, ...prev]);
                    }
                    setSelectedTicker(formatted);
                    setSearchInput('');
                }}>
                    <input
                        type="text"
                        placeholder="Search NSE..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="input pt-search-input"
                    />
                    <button type="submit" className="btn btn-primary" disabled={!searchInput.trim()}>Go</button>
                </form>
            </div>

            <div className="paper-trade-grid">
                <div className="pt-chart-area">
                    {isLoading && !candles ? (
                        <div className="pt-loading">Loading market data...</div>
                    ) : (
                        <ReactECharts option={chartOption} style={{ height: '300px', width: '100%' }} />
                    )}
                </div>

                <div className="pt-action-area">
                    {quote && (
                        <div className="pt-current-price">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="pt-price-label">Current Price</span>
                                <DataSourceBadge source={source} lastUpdated={lastUpdated} />
                            </div>
                            <div className="pt-price-value">
                                ₹{currentPrice.toFixed(2)}
                                <span className={`pt-price-change ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {change >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="pt-assistant-card">
                        <div className="pt-assistant-header">
                            <Bot size={16} className="text-secondary" />
                            <span>Copilot Suggestion</span>
                            <Sparkles size={14} className="text-accent ml-auto" />
                        </div>
                        {loadingAI ? (
                            <div className="pt-assistant-body loading-text">Analyzing technicals...</div>
                        ) : aiPrediction ? (
                            <div className="pt-assistant-body">
                                <strong>{aiPrediction.direction}</strong> ({Math.round(aiPrediction.confidence * 100)}% confidence). {aiPrediction.reasoning.substring(0, 80)}...
                            </div>
                        ) : (
                            <div className="pt-assistant-body">Select a stock for analysis.</div>
                        )}
                    </div>

                    <div className="pt-trade-box">
                        <div className="pt-shares-input">
                            <label>Shares to Trade</label>
                            <input
                                type="number"
                                min="1"
                                value={sharesInput}
                                onChange={(e) => setSharesInput(parseInt(e.target.value) || 0)}
                                className="input"
                            />
                        </div>

                        {/* Order Value Preview */}
                        {quote && sharesInput > 0 && (
                            <div className="pt-order-preview">
                                <span className="pt-order-preview-label">Order Value</span>
                                <span className="pt-order-preview-value">
                                    ₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}

                        <div className="pt-trade-buttons">
                            <button className="btn btn-success pt-btn-buy" onClick={() => handleTrade('BUY')} disabled={!quote || isLoading}>
                                <TrendingUp size={16} /> Buy
                            </button>
                            <button className="btn btn-danger pt-btn-sell" onClick={() => handleTrade('SELL')} disabled={!quote || isLoading}>
                                <TrendingDown size={16} /> Short
                            </button>
                        </div>

                        {tradeMessage && (
                            <div className={`pt-msg animate-fade-in ${tradeMessage.type === 'error' ? 'pt-msg-error' : 'pt-msg-success'}`}>
                                {tradeMessage.text}
                            </div>
                        )}
                    </div>

                    {/* ── Live Wallet Footer ── */}
                    <div className="pt-wallet-footer">
                        <span className="pt-wallet-label">Paper Balance</span>
                        <span className="pt-wallet-value">
                            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
