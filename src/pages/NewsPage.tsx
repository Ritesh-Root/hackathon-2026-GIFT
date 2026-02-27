import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { getAvailableTickers } from '../services/marketService';
import { useLiveStock } from '../hooks/useLiveStock';
import DataSourceBadge from '../components/DataSourceBadge';
import fallbackNews from '../data/fallback_news.json';
import './NewsPage.css';

interface NewsArticle {
    id: number;
    headline: string;
    source: string;
    datetime: string;
    summary: string;
    ticker: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    sentimentScore: number;
    url: string;
}

export default function NewsPage() {
    const tickers = ['ALL', ...getAvailableTickers()];
    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const [selectedTicker, setSelectedTicker] = useState(getAvailableTickers()[0]);
    const [news] = useState<NewsArticle[]>(fallbackNews.news as NewsArticle[]);

    // ── Live stock data via shared hook ──
    const { candles, source, lastUpdated, isLoading } = useLiveStock(selectedTicker);

    // Drastic Event Alert System State
    const [hasDrasticEvent, setHasDrasticEvent] = useState(false);

    // Simulated Real-Time Push Notification
    useEffect(() => {
        const timer = setTimeout(() => {
            setHasDrasticEvent(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    const drasticEventData = {
        type: "CRITICAL",
        headline: "Global Tech Outage Detected",
        impact: "High Volatility in IT Services (TCS, INFY)",
        action: "Consider hedging IT exposure."
    };

    // Filter news by ticker
    const filteredNews = selectedFilter === 'ALL'
        ? news
        : news.filter((n) => n.ticker === selectedFilter);

    // Get sentiment events for the chart overlay
    const sentimentEvents = news
        .filter((n) => n.ticker === selectedTicker)
        .map((n) => ({
            date: n.datetime.split('T')[0],
            sentiment: n.sentiment,
            score: n.sentimentScore,
            headline: n.headline,
        }));

    // Build ECharts option with sentiment markers
    const chartOption = useMemo(() => {
        if (!candles || candles.length === 0) return {};

        const dates = candles.map((p) => p.date);
        const ohlc = candles.map((p) => [p.open, p.close, p.low, p.high]);

        // Create marker points for sentiment events
        const markPoints = sentimentEvents
            .map((event) => {
                const idx = dates.indexOf(event.date);
                if (idx === -1) return null;
                return {
                    name: event.headline.substring(0, 40) + '...',
                    coord: [idx, event.sentiment === 'bullish'
                        ? candles[idx].high + 1
                        : candles[idx].low - 1],
                    value: event.sentiment === 'bullish' ? '▲' : '▼',
                    itemStyle: {
                        color: event.sentiment === 'bullish' ? '#10b981' : '#ef4444',
                    },
                    symbolSize: 28,
                    symbol: event.sentiment === 'bullish' ? 'triangle' : 'pin',
                };
            })
            .filter(Boolean);

        return {
            backgroundColor: '#12121a',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(22, 22, 35, 0.95)',
                borderColor: 'rgba(148, 163, 184, 0.1)',
                textStyle: { color: '#f1f5f9', fontSize: 12 },
            },
            grid: { left: '8%', right: '4%', top: '8%', bottom: '15%' },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
                axisLabel: { color: '#64748b', fontSize: 10 },
                splitLine: { show: false },
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
                    markPoint: {
                        data: markPoints,
                        label: {
                            show: true,
                            formatter: '{b}',
                            fontSize: 9,
                            color: '#f1f5f9',
                        },
                    },
                },
            ],
        };
    }, [candles, selectedTicker, sentimentEvents]);

    const formatTime = (dt: string) => {
        const d = new Date(dt);
        const now = new Date();
        const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
        if (diffH < 24) return `${diffH}h ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="news-page animate-fade-in">
            {/* Drastic Event Alert System */}
            <div className={`drastic-event-banner ${hasDrasticEvent ? 'visible' : ''}`}>
                <div className="drastic-event-content">
                    <div className="drastic-event-icon-wrapper">
                        <AlertTriangle className="drastic-event-icon" size={24} />
                    </div>
                    <div className="drastic-event-text">
                        <div className="drastic-event-header">
                            <span className="drastic-event-type">{drasticEventData.type}</span>
                            <span className="drastic-event-headline">{drasticEventData.headline}</span>
                        </div>
                        <p className="drastic-event-impact">
                            {drasticEventData.impact} <span className="drastic-event-action-text">{drasticEventData.action}</span>
                        </p>
                    </div>
                    <div className="drastic-event-actions">
                        <button className="drastic-event-btn">Review Portfolio Risk</button>
                        <button className="drastic-event-close" onClick={() => setHasDrasticEvent(false)} aria-label="Dismiss alert">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="news-header">
                <h1 className="news-title">📰 Financial News Intelligence</h1>
                <p className="news-subtitle">
                    Live sentiment analysis overlaid on price action
                </p>
            </div>

            {/* Chart with sentiment markers */}
            <div className="news-chart-section">
                <div className="news-chart-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h2 className="section-title">Sentiment Overlay — {selectedTicker}</h2>
                        <DataSourceBadge source={source} lastUpdated={lastUpdated} />
                    </div>
                    <div className="news-chart-tickers">
                        {getAvailableTickers().map((t) => (
                            <button
                                key={t}
                                className={`predict-ticker-btn ${selectedTicker === t ? 'predict-ticker-btn--active' : ''}`}
                                onClick={() => setSelectedTicker(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="news-chart-container">
                    {isLoading && !candles ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 350 }}>
                            <div className="spinner" />
                        </div>
                    ) : (
                        <ReactECharts
                            option={chartOption}
                            style={{ height: '350px', width: '100%' }}
                            opts={{ renderer: 'canvas' }}
                            notMerge={true}
                        />
                    )}
                </div>
                <div className="news-chart-legend">
                    <span className="legend-item legend-bullish">▲ Bullish News Event</span>
                    <span className="legend-item legend-bearish">▼ Bearish News Event</span>
                </div>
            </div>

            {/* News Feed */}
            <div className="news-feed-section">
                <div className="news-feed-header">
                    <h2 className="section-title">Latest News</h2>
                    <div className="news-feed-filters">
                        {tickers.map((t) => (
                            <button
                                key={t}
                                className={`news-filter-btn ${selectedFilter === t ? 'news-filter-btn--active' : ''}`}
                                onClick={() => setSelectedFilter(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="news-feed-grid">
                    {filteredNews.map((article) => (
                        <article key={article.id} className="card news-card animate-fade-in">
                            <div className="news-card-top">
                                <span className={`badge ${article.sentiment === 'bullish' ? 'badge-bullish' : article.sentiment === 'bearish' ? 'badge-bearish' : 'badge-neutral'}`}>
                                    {article.sentiment === 'bullish' ? '▲ Bullish' : article.sentiment === 'bearish' ? '▼ Bearish' : '— Neutral'}
                                </span>
                                <span className="news-card-score" style={{
                                    color: article.sentimentScore > 0 ? 'var(--color-bullish)' : 'var(--color-bearish)',
                                }}>
                                    {article.sentimentScore > 0 ? '+' : ''}{(article.sentimentScore * 100).toFixed(0)}%
                                </span>
                            </div>
                            <h3 className="news-card-headline">{article.headline}</h3>
                            <p className="news-card-summary">{article.summary}</p>
                            <div className="news-card-meta">
                                <span className="news-card-source">{article.source}</span>
                                <span className="news-card-dot">·</span>
                                <span className="news-card-time">{formatTime(article.datetime)}</span>
                                <span className="news-card-dot">·</span>
                                <span className="news-card-ticker">{article.ticker}</span>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
