import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePaperStore } from '../store/paperStore';
import './TradeExecutionModal.css';

interface TradeExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticker: string;
    currentPrice: number;
    actionType: 'BUY' | 'SELL';
    /** Optional callback to notify parents AFTER successful store execution */
    onTradeExecute?: (ticker: string, action: 'BUY' | 'SELL', quantity: number) => void;
}

type OrderType = 'MARKET' | 'LIMIT';
type ExecutionState = 'idle' | 'routing' | 'filled' | 'error';

export default function TradeExecutionModal({
    isOpen,
    onClose,
    ticker,
    currentPrice,
    actionType,
    onTradeExecute,
}: TradeExecutionModalProps) {
    const { balance, holdings, executeTrade } = usePaperStore();
    const [orderType, setOrderType] = useState<OrderType>('MARKET');
    const [quantity, setQuantity] = useState<string>('');
    const [execState, setExecState] = useState<ExecutionState>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const isBuy = actionType === 'BUY';
    const parsedQty = parseFloat(quantity) || 0;
    const estimatedCost = parsedQty * currentPrice;

    // Check available shares for SELL validation
    const ownedShares = useMemo(() => {
        const holding = holdings.find(h => h.ticker === ticker);
        return holding ? holding.shares : 0;
    }, [holdings, ticker]);

    // Validation flags for UI
    const canAffordBuy = isBuy && estimatedCost <= balance;
    const canAffordSell = !isBuy && parsedQty <= ownedShares;
    const isReadyToExecute = parsedQty > 0 && (isBuy ? canAffordBuy : canAffordSell);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setOrderType('MARKET');
            setExecState('idle');
            setErrorMessage('');
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && execState === 'idle') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose, execState]);

    const handleExecute = useCallback(() => {
        if (!isReadyToExecute) return;
        setExecState('routing');
        setErrorMessage('');

        setTimeout(() => {
            const result = executeTrade(
                ticker,
                ticker, // Fallback name if undefined
                parsedQty,
                currentPrice,
                actionType,
                'Equities' // Assume standard equities logic for slip
            );

            if (result.success) {
                setExecState('filled');

                if (onTradeExecute) {
                    onTradeExecute(ticker, actionType, parsedQty);
                }

                setTimeout(() => {
                    onClose();
                }, 1200);
            } else {
                setExecState('error');
                setErrorMessage(result.message);
                setTimeout(() => setExecState('idle'), 3000);
            }
        }, 800);
    }, [isReadyToExecute, executeTrade, ticker, parsedQty, currentPrice, actionType, onClose, onTradeExecute]);

    if (!isOpen) return null;

    return (
        <div className="trade-modal-overlay" onClick={execState === 'idle' ? onClose : undefined}>
            <div
                className={`trade-modal-card ${execState === 'filled' ? 'trade-modal-success' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="trade-modal-header">
                    <div className="trade-modal-header-left">
                        <span className={`trade-modal-action-badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
                            {actionType}
                        </span>
                        <h2 className="trade-modal-ticker">{ticker}</h2>
                    </div>
                    <button className="trade-modal-close" onClick={onClose} aria-label="Close modal">
                        ✕
                    </button>
                </div>

                <div className="trade-modal-price-row">
                    <span className="trade-modal-price-label">Market Price</span>
                    <span className="trade-modal-price-value">₹{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {/* ── Order Type Toggle ── */}
                <div className="trade-modal-order-toggle">
                    <button
                        className={`trade-toggle-pill ${orderType === 'MARKET' ? 'trade-toggle-active' : ''}`}
                        onClick={() => setOrderType('MARKET')}
                    >
                        Market
                    </button>
                    <button
                        className={`trade-toggle-pill ${orderType === 'LIMIT' ? 'trade-toggle-active' : ''}`}
                        onClick={() => setOrderType('LIMIT')}
                    >
                        Limit
                    </button>
                </div>

                {/* ── Quantity Input ── */}
                <div className="trade-modal-quantity-section">
                    <label className="trade-modal-qty-label">Quantity</label>
                    <input
                        type="number"
                        className="trade-modal-qty-input"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        min="1"
                        autoFocus
                        disabled={execState !== 'idle'}
                    />
                </div>

                {/* ── Estimated Cost ── */}
                <div className="trade-modal-estimate">
                    <span className="trade-modal-estimate-label">
                        {isBuy ? 'Estimated Cost' : 'Estimated Value'}
                    </span>
                    <span className="trade-modal-estimate-value">
                        ₹{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                {/* ── Validation & Error Messages ── */}
                <div className="trade-modal-validation" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px', fontSize: '0.85rem' }}>
                    {isBuy ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: canAffordBuy ? '#94a3b8' : '#ef4444' }}>
                            <span>Buying Power:</span>
                            <span>{canAffordBuy ? `₹${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Insufficient Funds'}</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: canAffordSell ? '#94a3b8' : '#ef4444' }}>
                            <span>Shares Owned:</span>
                            <span>{canAffordSell ? ownedShares : 'Insufficient Shares'}</span>
                        </div>
                    )}

                    {execState === 'error' && (
                        <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '8px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* ── Execution Button ── */}
                <button
                    className={`trade-modal-execute-btn ${isBuy ? 'exec-buy' : 'exec-sell'} ${execState !== 'idle' ? 'exec-processing' : ''}`}
                    onClick={handleExecute}
                    disabled={execState !== 'idle' || !isReadyToExecute}
                >
                    {execState === 'idle' && (
                        <>
                            {isBuy ? 'Buy' : 'Sell'} {ticker}
                        </>
                    )}
                    {execState === 'routing' && (
                        <span className="exec-routing">
                            <span className="exec-spinner" />
                            Routing to Exchange...
                        </span>
                    )}
                    {execState === 'filled' && (
                        <span className="exec-filled">✅ Order Filled</span>
                    )}
                </button>

                <p className="trade-modal-disclaimer">
                    Orders are routed via Groww Trading API. Market orders execute at best available price.
                </p>
            </div>
        </div>
    );
}
