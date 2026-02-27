import { useState, useEffect, useMemo } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import {
    getAvailableTickers,
    getAIPrediction,
    type AIPrediction,
} from '../services/marketService';
import { useLiveStock } from '../hooks/useLiveStock';
import DataSourceBadge from '../components/DataSourceBadge';
import { useAuthStore } from '../store/authStore';
import {
    savePrediction,
    fetchUserPredictions,
    isDemoUser,
    type DbPrediction,
} from '../services/supabaseService';
import './PredictPage.css';

type UserPrediction = 'BULLISH' | 'BEARISH' | null;

const CopilotInsightCard = () => {
    return (
        <div className="copilot-insight-card animate-fade-in">
            <div className="copilot-insight-header">
                <div className="copilot-insight-icon-wrapper">
                    <Bot className="copilot-insight-icon" size={20} />
                </div>
                <h3 className="copilot-insight-title">Copilot Insight</h3>
                <Sparkles className="copilot-insight-sparkle" size={16} />
            </div>
            <div className="copilot-insight-body">
                <p><strong>AI Confidence: 82% Bullish.</strong> Sentiment analysis detects positive momentum in the tech sector.</p>
            </div>
            <div className="copilot-insight-cta">
                <p>Do you agree with the Copilot? Make your call below.</p>
            </div>
        </div>
    );
};

const PredictionOutcomeModal = ({
    status,
    userPrediction,
    aiPrediction,
    onClose
}: {
    status: 'idle' | 'loading' | 'revealed';
    userPrediction: UserPrediction;
    aiPrediction: AIPrediction | null;
    onClose: () => void;
}) => {
    if (status === 'idle') return null;

    const isWinner = userPrediction === aiPrediction?.direction;
    const actualDir = aiPrediction?.direction === 'BULLISH' ? 'Bullish' : 'Bearish';
    const userDir = userPrediction === 'BULLISH' ? 'Bullish' : 'Bearish';

    return (
        <div className="outcome-modal-overlay animate-fade-in">
            <div className="outcome-modal-content">
                {status === 'loading' ? (
                    <div className="outcome-loading">
                        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }}></div>
                        <h2 style={{ marginTop: 24, color: '#FAFAFA' }}>Fast-forwarding market data...</h2>
                    </div>
                ) : (
                    <div className="outcome-revealed">
                        <h2 className={`outcome-title ${isWinner ? 'outcome-win' : 'outcome-lose'}`}>
                            {isWinner ? 'Target Hit! +₹10,000' : 'Trade Closed. -₹5,000'}
                        </h2>

                        <div className="outcome-explanation">
                            <h4>AI Explanation</h4>
                            <p>
                                {isWinner
                                    ? `You predicted ${userDir}, and the market agreed. The AI's positive sentiment analysis on recent earnings was highly accurate, driving a successful trade setup.`
                                    : `You predicted ${userDir}, but the market went ${actualDir}. While initial news sentiment was favorable, an unexpected macroeconomic report caused a sudden reversal. The AI has adjusted its risk parameters.`
                                }
                            </p>
                        </div>

                        <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 24, width: '100%' }}>
                            Continue
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function PredictPage() {
    const { user } = useAuthStore();
    const isDemo = !user || isDemoUser(user.id);
    const initialTickers = useMemo(() => getAvailableTickers(), []);

    const [tickers, setTickers] = useState<string[]>(initialTickers);
    const [selectedTicker, setSelectedTicker] = useState(tickers[0]);

    // Check for target ticker from Command Palette
    useEffect(() => {
        const targetTicker = localStorage.getItem('demo_target_ticker');

        if (targetTicker) {
            setSelectedTicker(targetTicker);

            setTickers(prev => {
                if (!prev.includes(targetTicker)) {
                    return [targetTicker, ...prev];
                }
                return prev;
            });

            localStorage.removeItem('demo_target_ticker');
        }
    }, []);

    const [searchInput, setSearchInput] = useState('');
    const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
    const [userPrediction, setUserPrediction] = useState<UserPrediction>(null);
    const [showResult, setShowResult] = useState(false);
    const [outcomeStatus, setOutcomeStatus] = useState<'idle' | 'loading' | 'revealed'>('idle');
    const [history, setHistory] = useState<DbPrediction[]>([]);

    type TimeframeType = '1D' | '1W' | '1M';
    const [timeframe, setTimeframe] = useState<TimeframeType>('1M');

    // Mappings for Yahoo Finance API
    const tfMapping: Record<TimeframeType, { interval: string; range: string }> = {
        '1D': { interval: '5m', range: '1d' },
        '1W': { interval: '1h', range: '5d' },
        '1M': { interval: '1d', range: '1mo' },
    };

    // ── Live stock data via shared hook ──
    const { quote, candles, source, lastUpdated, isLoading } = useLiveStock(
        selectedTicker,
        tfMapping[timeframe].interval,
        tfMapping[timeframe].range
    );

    // Reset prediction state when ticker changes
    useEffect(() => {
        setUserPrediction(null);
        setShowResult(false);
        setAiPrediction(null);
        setOutcomeStatus('idle');
    }, [selectedTicker]);

    // Load prediction history
    useEffect(() => {
        if (!isDemo && user) {
            fetchUserPredictions(user.id, 10).then(setHistory);
        }
    }, [isDemo, user]);

    const handleUserPredict = async (direction: UserPrediction) => {
        setUserPrediction(direction);
        setOutcomeStatus('loading');
        setShowResult(false);

        const [pred] = await Promise.all([
            getAIPrediction(selectedTicker),
            new Promise(r => setTimeout(r, 2000))
        ]);

        setAiPrediction(pred);
        setOutcomeStatus('revealed');
        setShowResult(true);

        // Save to Supabase (non-blocking)
        if (pred && direction && !isDemo && user) {
            const isCorrectResult = direction === pred.direction;
            savePrediction({
                user_id: user.id,
                ticker: selectedTicker,
                user_prediction: direction,
                ai_prediction: pred.direction,
                ai_confidence: pred.confidence,
                ai_reasoning: pred.reasoning,
                is_correct: isCorrectResult,
            }).then(() => {
                fetchUserPredictions(user.id, 10).then(setHistory);
            });
        }
    };

    // Build the ECharts candlestick option from hook data
    const chartOption = useMemo(() => {
        if (!candles || candles.length === 0) return {};

        const dates = candles.map((p) => p.date);
        const ohlc = candles.map((p) => [p.open, p.close, p.low, p.high]);
        const volumes = candles.map((p, i) => ({
            value: p.volume,
            itemStyle: {
                color: candles[i].close >= candles[i].open
                    ? 'rgba(16, 185, 129, 0.5)'
                    : 'rgba(239, 68, 68, 0.5)',
            },
        }));

        return {
            backgroundColor: '#12121a',
            animation: true,
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(22, 22, 35, 0.95)',
                borderColor: 'rgba(148, 163, 184, 0.1)',
                textStyle: { color: '#f1f5f9', fontSize: 12 },
            },
            grid: [
                { left: '8%', right: '4%', top: '8%', height: '55%' },
                { left: '8%', right: '4%', top: '72%', height: '18%' },
            ],
            xAxis: [
                {
                    type: 'category',
                    data: dates,
                    axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
                    axisLabel: { color: '#64748b', fontSize: 10 },
                    splitLine: { show: false },
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: dates,
                    axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
                    axisLabel: { show: false },
                    splitLine: { show: false },
                },
            ],
            yAxis: [
                {
                    scale: true,
                    axisLine: { show: false },
                    axisLabel: { color: '#64748b', fontSize: 10 },
                    splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.06)' } },
                },
                {
                    scale: true,
                    gridIndex: 1,
                    axisLine: { show: false },
                    axisLabel: { show: false },
                    splitLine: { show: false },
                },
            ],
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
                {
                    name: 'Volume',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: volumes,
                },
            ],
        };
    }, [candles, selectedTicker]);

    const isCorrect = userPrediction && aiPrediction
        ? userPrediction === aiPrediction.direction
        : null;

    const currentPrice = quote?.price ?? 0;
    const change = quote?.change ?? 0;
    const changePercent = quote?.changePercent ?? 0;

    return (
        <div className="predict-page animate-fade-in">
            {/* Header */}
            <div className="predict-header">
                <div>
                    <h1 className="predict-title">🎯 Stock Prediction Playground</h1>
                    <p className="predict-subtitle">
                        Make your call, then see how AI sees it. Test your market intuition.
                    </p>
                </div>
                <DataSourceBadge source={source} lastUpdated={lastUpdated} />
            </div>

            {/* Stock Selector & Search */}
            <div className="predict-selector-container">
                <div className="predict-selector">
                    {tickers.map((ticker) => (
                        <button
                            key={ticker}
                            className={`predict-ticker-btn ${selectedTicker === ticker ? 'predict-ticker-btn--active' : ''}`}
                            onClick={() => setSelectedTicker(ticker)}
                        >
                            <span className="ticker-symbol">{ticker}</span>
                            {selectedTicker === ticker && quote && (
                                <span
                                    className={`ticker-price-badge ${change >= 0 ? 'badge-bullish' : 'badge-bearish'}`}
                                >
                                    ₹{currentPrice.toFixed(2)}{' '}
                                    {change >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <form className="predict-search-form" onSubmit={(e) => {
                    e.preventDefault();
                    const t = searchInput.trim().toUpperCase();
                    if (!t) return;
                    const formatted = t.includes('.') ? t : `${t}.NS`;
                    if (!tickers.includes(formatted)) {
                        setTickers(prev => [...prev, formatted]);
                    }
                    setSelectedTicker(formatted);
                    setSearchInput('');
                }}>
                    <input
                        type="text"
                        placeholder="Search NSE Ticker (e.g. ITC, ZOMATO)..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="input predict-search-input"
                    />
                    <button type="submit" className="btn btn-primary" disabled={!searchInput.trim()}>
                        Search
                    </button>
                </form>
            </div>

            {/* Main Content Grid */}
            <div className="predict-grid">
                {/* Candlestick Chart */}
                <div className="predict-chart-container">
                    <div className="predict-chart-header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="timeframe-selector" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
                            {(['1D', '1W', '1M'] as TimeframeType[]).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: timeframe === tf ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                        color: timeframe === tf ? '#c4b5fd' : '#94a3b8',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    {isLoading && !candles ? (
                        <div className="predict-chart-loading">
                            <div className="spinner" />
                            <span>Loading chart data...</span>
                        </div>
                    ) : (
                        <ReactECharts
                            option={chartOption}
                            style={{ height: '420px', width: '100%' }}
                            opts={{ renderer: 'canvas' }}
                            notMerge={true}
                            lazyUpdate={true}
                        />
                    )}
                </div>

                {/* Prediction Panel */}
                <div className="predict-panel">
                    <CopilotInsightCard />

                    <div className="card predict-action-card">
                        <h3 className="predict-action-title">Your Prediction</h3>
                        <p className="predict-action-desc">
                            Where will <strong>{selectedTicker}</strong> go in the next 2 weeks?
                        </p>
                        <div className="predict-buttons">
                            <button
                                className={`predict-btn predict-btn-bull ${userPrediction === 'BULLISH' ? 'predict-btn--selected' : ''}`}
                                onClick={() => handleUserPredict('BULLISH')}
                                disabled={outcomeStatus !== 'idle'}
                            >
                                <span className="predict-btn-icon">📈</span>
                                <span>Bullish</span>
                            </button>
                            <button
                                className={`predict-btn predict-btn-bear ${userPrediction === 'BEARISH' ? 'predict-btn--selected' : ''}`}
                                onClick={() => handleUserPredict('BEARISH')}
                                disabled={outcomeStatus !== 'idle'}
                            >
                                <span className="predict-btn-icon">📉</span>
                                <span>Bearish</span>
                            </button>
                        </div>
                    </div>



                    {showResult && aiPrediction && (
                        <div className="predict-result animate-fade-in">
                            <div className={`predict-match-banner ${isCorrect ? 'predict-match--correct' : 'predict-match--wrong'}`}>
                                <span className="match-icon">{isCorrect ? '🎉' : '🤔'}</span>
                                <span className="match-text">
                                    {isCorrect
                                        ? 'Great call! You agree with the AI.'
                                        : 'Different view — AI sees it the other way.'}
                                </span>
                            </div>

                            <div className="card predict-ai-card">
                                <div className="ai-card-header">
                                    <h3>AI Analysis</h3>
                                    <span className={`badge ${aiPrediction.direction === 'BULLISH' ? 'badge-bullish' : 'badge-bearish'}`}>
                                        {aiPrediction.direction}
                                    </span>
                                </div>

                                <div className="ai-confidence">
                                    <div className="ai-confidence-label">
                                        <span>Confidence</span>
                                        <span className="ai-confidence-value">
                                            {(aiPrediction.confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="ai-confidence-bar">
                                        <div
                                            className="ai-confidence-fill"
                                            style={{
                                                width: `${aiPrediction.confidence * 100}%`,
                                                background: aiPrediction.direction === 'BULLISH'
                                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                    : 'linear-gradient(90deg, #ef4444, #f87171)',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="ai-target">
                                    <span className="ai-target-label">Target Price</span>
                                    <span className="ai-target-value">₹{aiPrediction.targetPrice.toFixed(2)}</span>
                                    <span className="ai-target-timeframe">({aiPrediction.timeframe})</span>
                                </div>

                                <div className="ai-reasoning">
                                    <h4>Why?</h4>
                                    <p>{aiPrediction.reasoning}</p>
                                </div>

                                <div className="ai-signals">
                                    <h4>Technical Signals</h4>
                                    <div className="ai-signals-list">
                                        {aiPrediction.technicalSignals.map((signal, i) => (
                                            <span key={i} className="badge badge-neutral">
                                                {signal}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Prediction History (real users only) */}
            {
                !isDemo && history.length > 0 && (
                    <div className="card" style={{ marginTop: 24 }}>
                        <h3 style={{ marginBottom: 12 }}>📊 Your Prediction History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {history.slice(0, 5).map((p) => (
                                <div key={p.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '8px 12px', borderRadius: 8,
                                    background: 'rgba(148, 163, 184, 0.05)',
                                }}>
                                    <span style={{ fontWeight: 600 }}>{p.ticker}</span>
                                    <span className={`badge ${p.user_prediction === 'BULLISH' ? 'badge-bullish' : 'badge-bearish'}`}
                                        style={{ fontSize: 11 }}>
                                        You: {p.user_prediction}
                                    </span>
                                    <span className={`badge ${p.ai_prediction === 'BULLISH' ? 'badge-bullish' : 'badge-bearish'}`}
                                        style={{ fontSize: 11 }}>
                                        AI: {p.ai_prediction}
                                    </span>
                                    <span style={{ fontSize: 12, color: p.is_correct ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {p.is_correct ? '✓ Match' : '✗ Differ'}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#64748b' }}>
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            <PredictionOutcomeModal
                status={outcomeStatus}
                userPrediction={userPrediction}
                aiPrediction={aiPrediction}
                onClose={() => setOutcomeStatus('idle')}
            />
        </div >
    );
}
