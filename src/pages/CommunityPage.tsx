import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import {
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    unsubscribeFromMessages,
    isDemoUser,
    type DbMessage,
} from '../services/supabaseService';
import type { RealtimeChannel } from '@supabase/supabase-js';
import './CommunityPage.css';

interface Message {
    id: string;
    user: string;
    avatar: string;
    text: string;
    timestamp: Date;
}

// Demo fallback messages (used when not authenticated or in demo mode)
const DEMO_MESSAGES: Message[] = [
    { id: '1', user: 'AlphaTrader', avatar: '🦁', text: 'Just went long on MSFT after that Azure AI earnings beat. Copilot attach rates are insane 🚀', timestamp: new Date(Date.now() - 3600000 * 2) },
    { id: '2', user: 'BearishBob', avatar: '🐻', text: 'GOOGL antitrust ruling has me worried. Might trim my position before the verdict.', timestamp: new Date(Date.now() - 3600000 * 1.5) },
    { id: '3', user: 'QuantQueen', avatar: '👑', text: 'Running backtests on momentum strategies — TSLA showing a classic oversold bounce setup on the 200-day MA. RSI at 32.', timestamp: new Date(Date.now() - 3600000) },
    { id: '4', user: 'DividendDave', avatar: '💰', text: 'Anyone else adding AMZN here? Bedrock growth + advertising revenue is a monster combo.', timestamp: new Date(Date.now() - 1800000) },
    { id: '5', user: 'NeuralNet99', avatar: '🤖', text: 'The AI prediction model here called AAPL bullish with 72% confidence. I agree — iPhone cycle + Services revenue compound.', timestamp: new Date(Date.now() - 600000) },
];

function dbToMessage(db: DbMessage): Message {
    return {
        id: db.id,
        user: db.username,
        avatar: db.avatar,
        text: db.text,
        timestamp: new Date(db.created_at),
    };
}

export default function CommunityPage() {
    const { user } = useAuthStore();
    const isDemo = !user || isDemoUser(user.id);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [onlineCount] = useState(Math.floor(Math.random() * 50) + 120);
    const [isLive, setIsLive] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const loadedIdsRef = useRef<Set<string>>(new Set());

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load messages + subscribe to realtime
    useEffect(() => {
        if (isDemo) {
            setMessages(DEMO_MESSAGES);
            return;
        }

        let cancelled = false;

        // Load existing messages
        fetchMessages(100).then((dbMessages) => {
            if (cancelled) return;
            const mapped = dbMessages.map(dbToMessage);
            mapped.forEach((m) => loadedIdsRef.current.add(m.id));
            setMessages(mapped.length > 0 ? mapped : DEMO_MESSAGES);
            setIsLive(true);
        });

        // Subscribe to new messages in realtime
        const channel = subscribeToMessages((newMsg) => {
            // Avoid duplicates (our own message might arrive via both insert + subscription)
            if (loadedIdsRef.current.has(newMsg.id)) return;
            loadedIdsRef.current.add(newMsg.id);
            setMessages((prev) => [...prev, dbToMessage(newMsg)]);
        });
        channelRef.current = channel;

        return () => {
            cancelled = true;
            if (channelRef.current) {
                unsubscribeFromMessages(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [isDemo]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput('');

        if (isDemo || !user) {
            // Demo mode: just add locally
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    user: 'You',
                    avatar: '👤',
                    text,
                    timestamp: new Date(),
                },
            ]);
            return;
        }

        // Real mode: write to Supabase (will also arrive via Realtime subscription)
        const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader';
        const sent = await sendMessage(user.id, username, '👤', text);

        if (sent) {
            // Add immediately for responsiveness, track ID to deduplicate
            loadedIdsRef.current.add(sent.id);
            setMessages((prev) => [...prev, dbToMessage(sent)]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (d: Date) => {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const currentUsername = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';

    return (
        <div className="community-page animate-fade-in">
            <div className="community-header">
                <div>
                    <h1 className="community-title">💬 Community Trading Floor</h1>
                    <p className="community-subtitle">Share insights with fellow traders in real-time</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {isLive && (
                        <span className="badge badge-bullish" style={{ fontSize: 11 }}>
                            ⚡ LIVE
                        </span>
                    )}
                    {isDemo && (
                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                            Demo Mode
                        </span>
                    )}
                    <div className="community-online">
                        <span className="online-dot" />
                        <span className="online-count">{onlineCount} online</span>
                    </div>
                </div>
            </div>

            <div className="community-chat glass">
                <div className="community-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`community-msg ${msg.user === currentUsername ? 'community-msg--self' : ''} animate-fade-in`}>
                            <div className="community-msg-avatar">{msg.avatar}</div>
                            <div className="community-msg-body">
                                <div className="community-msg-header">
                                    <span className="community-msg-user">{msg.user}</span>
                                    <span className="community-msg-time">{formatTime(msg.timestamp)}</span>
                                </div>
                                <p className="community-msg-text">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                <div className="community-input-area">
                    <input
                        className="input community-input"
                        type="text"
                        placeholder="Share your market insights..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim()}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
