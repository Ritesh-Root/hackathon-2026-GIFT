import { useEffect, useState } from 'react';
import './DataSourceBadge.css';

interface DataSourceBadgeProps {
    source: 'live' | 'fallback';
    lastUpdated: Date | null;
}

export default function DataSourceBadge({ source, lastUpdated }: DataSourceBadgeProps) {
    const [relativeTime, setRelativeTime] = useState('');

    useEffect(() => {
        const update = () => {
            if (!lastUpdated) {
                setRelativeTime('—');
                return;
            }
            const diffMs = Date.now() - lastUpdated.getTime();
            const diffS = Math.floor(diffMs / 1000);

            if (diffS < 5) setRelativeTime('just now');
            else if (diffS < 60) setRelativeTime(`${diffS}s ago`);
            else if (diffS < 3600) setRelativeTime(`${Math.floor(diffS / 60)}m ago`);
            else setRelativeTime(`${Math.floor(diffS / 3600)}h ago`);
        };

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [lastUpdated]);

    const isLive = source === 'live';

    return (
        <span className={`data-source-badge ${isLive ? 'dsb-live' : 'dsb-fallback'}`}>
            <span className="dsb-dot" />
            <span className="dsb-label">{isLive ? 'Live' : 'Delayed'}</span>
            <span className="dsb-time">{relativeTime}</span>
        </span>
    );
}
