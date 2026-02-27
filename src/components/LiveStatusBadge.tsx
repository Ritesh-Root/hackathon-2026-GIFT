import { useState, useEffect, useRef } from 'react';
import { fetchQuote } from '../services/marketService';
import './LiveStatusBadge.css';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

const HEALTH_CHECK_TICKER = 'RELIANCE.NS';
const HEALTH_CHECK_INTERVAL_MS = 30_000; // Re-check every 30s

export default function LiveStatusBadge() {
    const [status, setStatus] = useState<ConnectionStatus>('checking');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const checkConnection = async () => {
            try {
                const result = await fetchQuote(HEALTH_CHECK_TICKER);
                if (!mountedRef.current) return;
                setStatus(result ? 'connected' : 'disconnected');
            } catch {
                if (!mountedRef.current) return;
                setStatus('disconnected');
            }
        };

        checkConnection();
        timerRef.current = setInterval(checkConnection, HEALTH_CHECK_INTERVAL_MS);

        return () => {
            mountedRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const isLive = status === 'connected';
    const isChecking = status === 'checking';

    return (
        <div className={`live-status-badge ${isLive ? 'lsb-live' : 'lsb-disconnected'} ${isChecking ? 'lsb-checking' : ''}`}>
            <span className="lsb-dot" />
            <span className="lsb-text">
                {isChecking
                    ? 'Connecting…'
                    : isLive
                        ? 'Live: Connected to Exchange'
                        : 'Live: Disconnected'}
            </span>
        </div>
    );
}
