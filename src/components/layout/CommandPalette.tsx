import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Command, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { useLiveStock } from '../../hooks/useLiveStock';
import DataSourceBadge from '../DataSourceBadge';
import './CommandPalette.css';

/** Sub-component that shows live quote + sparkline for a searched ticker */
function StockQuickView({ ticker, onClose }: { ticker: string; onClose: () => void }) {
    const navigate = useNavigate();
    const { quote, candles, source, lastUpdated, isLoading } = useLiveStock(ticker);

    const closes = useMemo(() => candles?.map(c => c.close) ?? [], [candles]);

    const price = quote?.price ?? 0;
    const change = quote?.change ?? 0;
    const changePercent = quote?.changePercent ?? 0;
    const isPositive = change >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';

    const sparklineOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: { show: false },
        grid: { top: 5, bottom: 5, left: -10, right: -10 },
        xAxis: { show: false, type: 'category' as const, data: closes.map((_, i) => i) },
        yAxis: { show: false, type: 'value' as const, min: 'dataMin' },
        series: [
            {
                data: closes,
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { color, width: 2 },
                areaStyle: {
                    color: {
                        type: 'linear' as const,
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: color + '66' },
                            { offset: 1, color: color + '00' },
                        ],
                    },
                },
            },
        ],
    }), [closes, color]);

    const displayTicker = ticker.replace('.NS', '').replace('.BO', '');

    if (isLoading && !quote) {
        return (
            <div className="stock-quick-view-card animate-slide-up" style={{ padding: 32, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Fetching live data for {displayTicker}...</span>
            </div>
        );
    }

    return (
        <div className="stock-quick-view-card animate-slide-up">
            <div className="sqv-header">
                <div className="sqv-title">
                    <h3>{displayTicker}</h3>
                    <span className="sqv-exchange">NSE</span>
                    <DataSourceBadge source={source} lastUpdated={lastUpdated} />
                </div>
                <div className="sqv-price-info">
                    <span className="sqv-price">₹{price.toFixed(2)}</span>
                    <span className={`sqv-change ${isPositive ? 'pos' : 'neg'}`}>
                        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                </div>
            </div>

            <div className="sqv-body">
                {closes.length > 0 ? (
                    <ReactECharts
                        option={sparklineOption}
                        style={{ height: '60px', width: '100%' }}
                        opts={{ renderer: 'canvas' }}
                        notMerge={true}
                        lazyUpdate={true}
                    />
                ) : (
                    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
                        No chart data available
                    </div>
                )}
            </div>

            <div className="sqv-footer">
                <button className="btn-ghost sqv-btn">
                    <Plus size={16} /> Add to Watchlist
                </button>
                <button
                    className="btn-glow sqv-btn-primary"
                    onClick={() => {
                        localStorage.setItem('demo_target_ticker', ticker);
                        onClose();
                        navigate('/dashboard/predict');
                    }}
                >
                    🤖 Analyze with AI
                </button>
            </div>
        </div>
    );
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [resolvedTicker, setResolvedTicker] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle Keyboard Shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when modal opens, reset on close
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
            setResolvedTicker(null);
        }
    }, [isOpen]);

    // Debounce: resolve ticker 600ms after user stops typing
    useEffect(() => {
        if (query.trim().length < 2) {
            setResolvedTicker(null);
            return;
        }

        const timer = setTimeout(() => {
            const raw = query.trim().toUpperCase();
            const ticker = raw.includes('.') ? raw : `${raw}.NS`;
            setResolvedTicker(ticker);
        }, 600);

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="command-palette-wrapper">
            {/* The Trigger in Navbar */}
            <button className="search-trigger" onClick={() => setIsOpen(true)}>
                <Search size={18} className="search-icon" />
                <span className="search-placeholder">Search stocks, news, or ask AI...</span>
                <kbd className="search-shortcut"><Command size={12} />K</kbd>
            </button>

            {/* The Overlay Modal */}
            {isOpen && (
                <div className="cmd-modal-overlay animate-fade-in" onClick={() => setIsOpen(false)}>
                    <div className="cmd-palette-box" onClick={e => e.stopPropagation()}>

                        {/* Search Input Area */}
                        <div className="cmd-input-container">
                            <Search size={24} className="cmd-search-icon" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="cmd-input"
                                placeholder="Type a ticker like 'RELIANCE' or 'ITC'..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <button className="cmd-close-btn" onClick={() => setIsOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Live Stock Quick View */}
                        {resolvedTicker && (
                            <div className="cmd-results-area">
                                <StockQuickView
                                    ticker={resolvedTicker}
                                    onClose={() => setIsOpen(false)}
                                />
                            </div>
                        )}

                        {/* Suggestions when empty */}
                        {!resolvedTicker && query.trim() === '' && (
                            <div className="cmd-suggestions">
                                <span className="cmd-suggestion-label">Suggested</span>
                                <div className="cmd-suggestion-tags">
                                    <span className="tag" onClick={() => setQuery('RELIANCE')}>RELIANCE</span>
                                    <span className="tag" onClick={() => setQuery('HDFCBANK')}>HDFCBANK</span>
                                    <span className="tag" onClick={() => setQuery('TCS')}>TCS</span>
                                    <span className="tag" onClick={() => setQuery('INFY')}>INFY</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
