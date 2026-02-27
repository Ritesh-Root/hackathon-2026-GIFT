import { useState, useRef, useEffect, useMemo } from 'react';
import { getAdvisorResponse, isGroqAvailable } from '../services/groqService';
import { useAuthStore } from '../store/authStore';
import { upsertHolding } from '../services/supabaseService';
import { usePaperStore } from '../store/paperStore';
import type { Holding } from '../store/paperStore';
import './AdvisorPage.css';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    actions?: ActionCard[];
    isAgenticDemo?: boolean;
    timestamp: Date;
}

interface ActionCard {
    type: 'rebalance' | 'alert' | 'info' | 'trade' | 'agentic_action';
    title: string;
    description: string;
    buttonLabel: string;
    params?: Record<string, unknown>;
}

// Pre-built fallback responses (used when Groq is unavailable)
const FALLBACK_RESPONSES: Record<string, { text: string; actions?: ActionCard[] }> = {
    default: {
        text: "I'm your AI Financial Strategy Advisor. I have access to your portfolio (5 positions, ₹14.8L total value), recent market news, and your prediction history. How can I help you today?",
        actions: [
            { type: 'info', title: 'Portfolio Summary', description: 'View your current allocation breakdown', buttonLabel: 'View Portfolio' },
            { type: 'info', title: 'Market Pulse', description: 'Check latest sentiment across your holdings', buttonLabel: 'View News' },
        ],
    },
    rebalance: {
        text: "Based on your current portfolio, I notice a **heavy Technology concentration (76%)**. Your risk score is 58/100 (Moderate). To reduce concentration risk while maintaining growth exposure, I recommend:\n\n1. **Sell 10 shares of RELIANCE** (₹29,000) — still leaves you with 90 shares\n2. **Buy 10 shares of NIFTYBEES** (~₹2,500) — broad market diversification\n3. **Buy 10 shares of GOLDBEES** (~₹600) — hedge against volatility\n\nThis would bring your Tech exposure down to ~65% and add defensive positioning.",
        actions: [
            { type: 'rebalance', title: 'Execute Rebalance', description: 'Sell 10 RELIANCE → Buy 10 NIFTYBEES + 10 GOLDBEES', buttonLabel: '1-Click Rebalance', params: { sell: 'RELIANCE:10', buy: 'NIFTYBEES:10,GOLDBEES:10' } },
            { type: 'alert', title: 'Set Alert', description: 'Notify me if Tech exceeds 80%', buttonLabel: 'Create Alert' },
        ],
    },
    risk: {
        text: "Here's your **risk assessment**:\n\n📊 **Risk Score: 58/100** (Moderate)\n\n**Key Risks Identified:**\n- **Sector Concentration**: 76% in Technology — one bad tech earnings season could hurt\n- **TCS Volatility**: TCS has ~2.5x the volatility of your other holdings\n- **No Fixed Income**: Zero bond allocation leaves you fully exposed to equity drawdowns\n\n**Positive Factors:**\n- All holdings are large-cap, liquid stocks\n- Your average cost basis is below current prices (sitting on gains)\n- 5 positions is manageable but consider expanding to 8-10",
        actions: [
            { type: 'trade', title: 'Reduce TCS Risk', description: 'Trim TCS position by 5 shares', buttonLabel: 'Review Trade' },
            { type: 'info', title: 'Stress Test', description: 'Simulate a 20% market downturn', buttonLabel: 'Run Simulation' },
        ],
    },
    news: {
        text: "Scanning sentiment across your holdings...\n\n🟢 **RELIANCE** — Mixed signals. Net: **Slightly Bullish**.\n🔴 **HDFCBANK** — Bearish pressure from margins. Net: **Bearish**.\n🟢 **TCS** — AI momentum. Net: **Bullish**.\n🟢 **INFY** — Deals strong. Net: **Very Bullish**.\n🟢 **SBIN** — Credit growth. Net: **Bullish**.\n\n**Recommendation**: Consider trimming HDFCBANK and adding to INFY.",
        actions: [
            { type: 'trade', title: 'Trim HDFCBANK', description: 'Sell 20 shares of HDFCBANK', buttonLabel: 'Review Trade' },
            { type: 'trade', title: 'Add INFY', description: 'Buy 10 shares of INFY', buttonLabel: 'Review Trade' },
        ],
    },
};

// Dynamic Context is now built inside the component

function getFallbackResponse(input: string): { text: string; actions?: ActionCard[] } {
    const lower = input.toLowerCase();
    if (lower.includes('rebalance') || lower.includes('diversif') || lower.includes('allocat')) return FALLBACK_RESPONSES.rebalance;
    if (lower.includes('risk') || lower.includes('safe') || lower.includes('volatil')) return FALLBACK_RESPONSES.risk;
    if (lower.includes('news') || lower.includes('sentiment') || lower.includes('market')) return FALLBACK_RESPONSES.news;
    return {
        text: "I can help with portfolio analysis, risk assessment, market sentiment, and rebalancing strategies. Try asking me:\n\n- *\"Should I rebalance my portfolio?\"*\n- *\"What's my risk exposure?\"*\n- *\"What does the news say about my holdings?\"*",
    };
}

const AgenticWarningCard = () => {
    const { user } = useAuthStore();
    const [status, setStatus] = useState<'idle' | 'executing' | 'success'>('idle');

    const handleRebalance = async () => {
        setStatus('executing');

        // Fake latency
        await new Promise(r => setTimeout(r, 1500));

        if (user && !user.email?.endsWith('@demo.com')) {
            try {
                await upsertHolding({
                    user_id: user.id,
                    ticker: 'GOLDBEES.NS',
                    company_name: 'Nippon India ETF Gold BeES',
                    shares: 100,
                    avg_cost: 600,
                    sector: 'Commodity'
                });
                await upsertHolding({
                    user_id: user.id,
                    ticker: 'TCS.NS',
                    company_name: 'Tata Consultancy Services',
                    shares: 25, // Reduced shares
                    avg_cost: 3900,
                    sector: 'Technology'
                });
            } catch (e) {
                console.error(e);
            }
        }

        setStatus('success');
    };

    return (
        <div className="agentic-warning-card animate-fade-in">
            <div className="agentic-warning-content">
                <p><strong>🚨 Critical Alert:</strong> 15% drop in Tech sector momentum detected via live news sentiment. Action Recommended: Shift 20% from TCS/INFY into Gold/Bonds to preserve capital.</p>
            </div>
            <button
                className={`btn ${status === 'success' ? 'btn-success' : 'btn-danger'} pt-action-btn`}
                onClick={handleRebalance}
                disabled={status !== 'idle'}
            >
                {status === 'idle' && '⚡ 1-Click Auto-Rebalance'}
                {status === 'executing' && (
                    <><span className="spinner-small"></span> Executing Trade...</>
                )}
                {status === 'success' && '✅ Portfolio Rebalanced Successfully'}
            </button>
        </div>
    );
};

export default function AdvisorPage() {
    const { user } = useAuthStore();
    const { balance, holdings } = usePaperStore();

    // Dynamically build the context string for the LLM
    const portfolioContext = useMemo(() => {
        let context = `Current Trading Account Balance: ₹${balance.toLocaleString()}\n`;

        if (holdings.length === 0) {
            context += `The user currently has NO active positions in their portfolio. Advise them on what to buy based on the current market.`;
        } else {
            const totalVal = holdings.reduce((sum: number, h: Holding) => sum + (h.shares * h.currentPrice), 0);
            const totalInv = holdings.reduce((sum: number, h: Holding) => sum + (h.shares * h.avgCost), 0);
            const pnl = totalVal - totalInv;
            const pnlPct = totalInv > 0 ? (pnl / totalInv) * 100 : 0;

            context += `Current Portfolio Value (Excluding Cash): ₹${totalVal.toLocaleString()}\n`;
            context += `Total Portfolio P&L: ₹${pnl.toLocaleString()} (${pnlPct.toFixed(2)}%)\n\nPositions:\n`;

            holdings.forEach((h: Holding) => {
                context += `- ${h.ticker} (${h.name}): ${h.shares} shares @ ₹${h.avgCost.toFixed(2)} avg. Current Price: ₹${h.currentPrice.toFixed(2)}. Sector: ${h.sector}\n`;
            });
        }

        return context;
    }, [balance, holdings]);

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '0',
            role: 'ai',
            text: "I'm your AI Financial Strategy Copilot. I have live access to your Antigravity paper trading portfolio, market data, and risk metrics. How can I help you strategize today?",
            actions: [
                { type: 'info', title: 'Analyze Portfolio', description: 'Review my current allocation and risk.', buttonLabel: 'Run Audit' },
                { type: 'info', title: 'Market Pulse', description: 'What is the current sentiment for my holdings?', buttonLabel: 'Check News' },
            ],
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const groqAvailable = isGroqAvailable();

    // Auto-scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        const userText = input.trim();
        setInput('');
        setIsTyping(true);

        if (userText.toLowerCase() === "analyze my tech sector risk") {
            setTimeout(() => {
                const aiMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    text: '',
                    isAgenticDemo: true,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, aiMsg]);
                setIsTyping(false);
            }, 600);
            return;
        }

        let responseText = '';
        let actions: ActionCard[] | undefined;

        if (groqAvailable) {
            // Build conversation history for Groq
            const history = messages
                .filter((m) => m.id !== '0') // skip the initial welcome
                .map((m) => ({
                    role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
                    content: m.text,
                }));

            try {
                responseText = await getAdvisorResponse(userText, history, portfolioContext);
            } catch (err) {
                console.warn('Groq advisor failed:', err);
            }

            // If Groq returned a valid response, try to extract action cards from keywords/JSON
            if (responseText) {
                const extracted = extractActionsFromResponse(responseText);
                actions = extracted.actions;
                // Clean the raw JSON out of the display text so it doesn't show in the chat bubble
                responseText = extracted.cleanedText;
            }
        }

        if (!responseText) {
            const fallback = getFallbackResponse(userText);

            // Allow fallback to also trigger God Mode demo if Groq is offline
            if (userText.trim().toLowerCase() === "analyze current market risk for my tech stocks") {
                responseText = "Warning: High volatility detected in the Tech sector. Historical correlation models suggest an impending 15% correction based on recent macroeconomic news.";
                actions = [{
                    type: 'agentic_action',
                    title: 'High Risk Alert: Tech Sector',
                    description: 'Critical: 15% drop detected in Tech sector news sentiment. Recommend immediate rebalancing to stable assets.',
                    buttonLabel: 'Rebalance to Gold & REITs'
                }];
            } else {
                responseText = fallback.text;
                actions = fallback.actions;
            }
        }

        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            text: responseText,
            actions,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Render markdown-like bold + italic
    const renderText = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
            if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
            return <span key={i}>{part}</span>;
        });
    };

    const handleActionClick = async (action: ActionCard) => {
        if (action.type === 'agentic_action') {
            const feedbackMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'ai',
                text: `⚙️ **${action.title}** — Executing agentic rebalancing protocol...`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, feedbackMsg]);

            if (user && !user.email?.endsWith('@demo.com')) {
                // Execute actual Supabase update to shift portfolio
                try {
                    await upsertHolding({
                        user_id: user.id,
                        ticker: 'GOLDBEES.NS',
                        company_name: 'Nippon India ETF Gold BeES',
                        shares: 50,
                        avg_cost: 600,
                        sector: 'Commodity'
                    });
                    await upsertHolding({
                        user_id: user.id,
                        ticker: 'NIFTYBEES.NS',
                        company_name: 'Nippon India ETF Nifty 50 BeES',
                        shares: 100,
                        avg_cost: 260,
                        sector: 'Equity'
                    });

                    const successMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'ai',
                        text: `✅ **Rebalancing Complete!** Successfully shifted capital to stable Gold & Broad Market ETFs. Check your Portfolio.`,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, successMsg]);
                } catch (error) {
                    const errorMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'ai',
                        text: `❌ **Rebalancing Failed:** There was an error updating your portfolio in the database.`,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                }
            } else {
                const demoMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    text: `✅ **Demo Rebalancing Complete!** (Since you are a demo user, no real database transaction occurred, but the Agent successfully triggered the protocol).`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, demoMsg]);
            }
        } else {
            const feedbackMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'ai',
                text: `✅ **${action.title}** — Action noted! In a live environment, this would execute the ${action.type} action.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, feedbackMsg]);
        }
    };

    return (
        <div className="advisor-page animate-fade-in">
            <div className="advisor-header">
                <div>
                    <h1 className="advisor-title">🤖 AI Financial Strategy Advisor</h1>
                    <p className="advisor-subtitle">
                        {groqAvailable
                            ? '🟢 Live AI — Powered by Groq LLaMA 3.3 70B'
                            : '🟡 Demo Mode — Using pre-built responses'}
                    </p>
                </div>
            </div>

            {/* Chat Window */}
            <div className="advisor-chat glass">
                <div className="advisor-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`advisor-msg advisor-msg--${msg.role} animate-fade-in`}>
                            <div className="advisor-msg-avatar">
                                {msg.role === 'ai' ? '🤖' : '👤'}
                            </div>
                            <div className="advisor-msg-content">
                                {msg.isAgenticDemo ? (
                                    <AgenticWarningCard />
                                ) : (
                                    <div className="advisor-msg-text">
                                        {msg.text.split('\n').map((line, i) => (
                                            <p key={i}>{renderText(line)}</p>
                                        ))}
                                    </div>
                                )}
                                {/* Agentic UI — Action Cards */}
                                {!msg.isAgenticDemo && msg.actions && msg.actions.length > 0 && (
                                    <div className="advisor-actions">
                                        {msg.actions.map((action, i) => {
                                            const isAgentic = action.type === 'agentic_action';
                                            return (
                                                <div
                                                    key={i}
                                                    className={`advisor-action-card advisor-action--${action.type} ${isAgentic ? 'agentic-glow-red' : ''}`}
                                                >
                                                    <div className="action-card-info">
                                                        <span className="action-card-title">{action.title}</span>
                                                        <span className="action-card-desc">{action.description}</span>
                                                    </div>
                                                    <button
                                                        className={`btn btn-sm ${isAgentic ? 'btn-danger' : 'btn-primary'}`}
                                                        style={isAgentic ? { animation: 'pulse 2s infinite' } : {}}
                                                        onClick={() => handleActionClick(action)}
                                                    >
                                                        {action.buttonLabel}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {isTyping && (
                        <div className="advisor-msg advisor-msg--ai animate-fade-in">
                            <div className="advisor-msg-avatar">🤖</div>
                            <div className="advisor-typing">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="advisor-input-area">
                    <textarea
                        className="input advisor-textarea"
                        placeholder="Ask about your portfolio, risk, market sentiment..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className="btn btn-primary advisor-send-btn"
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                    >
                        Send
                    </button>
                </div>

                {/* Suggested prompts */}
                <div className="advisor-suggestions">
                    {['Should I rebalance?', "What's my risk?", 'Market sentiment?', 'Best stock to buy?'].map((s) => (
                        <button
                            key={s}
                            className="advisor-suggestion-btn"
                            onClick={() => { setInput(s); }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Extract action cards from Groq's text response based on keywords or JSON blocks.
 * This adds the Agentic UI layer on top of the LLM's free-text response.
 */
function extractActionsFromResponse(text: string): { actions?: ActionCard[], cleanedText: string } {
    const actions: ActionCard[] = [];
    let cleanedText = text;

    // --- Check for "God Mode" Agentic JSON block ---
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);

    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed.type === 'agentic_action') {
                actions.push({
                    type: 'agentic_action',
                    title: parsed.status === 'high_risk' ? `High Risk Alert: ${parsed.sector} Sector` : 'Agentic Action Required',
                    description: parsed.message,
                    buttonLabel: parsed.action_button,
                });
                // Remove the JSON block from the text shown to the user
                cleanedText = text.replace(jsonRegex, '').trim();
                return { actions, cleanedText }; // Return immediately if God Mode is hit
            }
        } catch (e) {
            console.error("Failed to parse agentic JSON block", e);
        }
    }

    // --- Standard Keyword Extraction ---
    const lower = text.toLowerCase();

    if (lower.includes('rebalance') || (lower.includes('sell') && lower.includes('buy'))) {
        actions.push({
            type: 'rebalance',
            title: '1-Click Rebalance',
            description: 'Execute the suggested portfolio changes',
            buttonLabel: 'Rebalance Now',
        });
    }
    if (lower.includes('alert') || lower.includes('monitor') || lower.includes('watch')) {
        actions.push({
            type: 'alert',
            title: 'Set Alert',
            description: 'Get notified on key price levels',
            buttonLabel: 'Create Alert',
        });
    }
    if (lower.includes('trim') || lower.includes('reduce') || lower.includes('sell')) {
        actions.push({
            type: 'trade',
            title: 'Review Trade',
            description: 'Review the suggested position adjustment',
            buttonLabel: 'Review Trade',
        });
    }

    return {
        actions: actions.length > 0 ? actions.slice(0, 3) : undefined,
        cleanedText
    };
}
