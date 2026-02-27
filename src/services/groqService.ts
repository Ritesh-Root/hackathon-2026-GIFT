/**
 * Groq AI Service
 * Calls Groq's ultra-fast LLM API for:
 *  - Stock prediction analysis
 *  - Financial advisor chat
 *
 * NOTE: For hackathon demo, calls are made from the client.
 * In production, move to Supabase Edge Functions.
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GroqResponse {
    choices: { message: { content: string } }[];
}

async function callGroq(messages: GroqMessage[], temperature = 0.7): Promise<string> {
    if (!GROQ_API_KEY) {
        console.warn('Groq API key not set — using fallback responses');
        return '';
    }

    try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature,
                max_tokens: 1024,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Groq API error:', res.status, errText);
            return '';
        }

        const data: GroqResponse = await res.json();
        return data.choices[0]?.message?.content ?? '';
    } catch (err) {
        console.error('Groq fetch error:', err);
        return '';
    }
}

// ── Stock Prediction Analysis ──
export async function getAIPredictionFromGroq(
    ticker: string,
    currentPrice: number,
    recentPrices: number[]
): Promise<{
    direction: 'BULLISH' | 'BEARISH';
    confidence: number;
    targetPrice: number;
    reasoning: string;
    technicalSignals: string[];
    timeframe: string;
} | null> {
    const pricesStr = recentPrices.map((p) => `$${p.toFixed(2)}`).join(', ');

    const response = await callGroq([
        {
            role: 'system',
            content: `You are an expert financial analyst AI. Analyze the given stock data and provide a prediction in JSON format ONLY. No markdown, no code blocks, just valid JSON.`,
        },
        {
            role: 'user',
            content: `Analyze ${ticker} stock currently trading at $${currentPrice.toFixed(2)}.
Recent closing prices (last 20 days): ${pricesStr}

Respond with ONLY this JSON structure:
{
  "direction": "BULLISH" or "BEARISH",
  "confidence": 0.0 to 1.0,
  "targetPrice": number,
  "reasoning": "2-3 sentence explanation",
  "technicalSignals": ["signal1", "signal2", "signal3"],
  "timeframe": "2 weeks"
}`,
        },
    ], 0.4);

    if (!response) return null;

    try {
        // Clean the response - remove any markdown code blocks
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            direction: parsed.direction === 'BEARISH' ? 'BEARISH' : 'BULLISH',
            confidence: Math.min(1, Math.max(0, parsed.confidence)),
            targetPrice: parsed.targetPrice,
            reasoning: parsed.reasoning,
            technicalSignals: parsed.technicalSignals?.slice(0, 5) ?? [],
            timeframe: parsed.timeframe ?? '2 weeks',
        };
    } catch {
        console.error('Failed to parse Groq prediction response:', response);
        return null;
    }
}

// ── AI Financial Advisor ──
export async function getAdvisorResponse(
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    portfolioContext: string
): Promise<string> {
    const messages: GroqMessage[] = [
        {
            role: 'system',
            content: `You are an expert AI Financial Strategy Advisor for the "AI Finance Copilot" platform. You have access to the user's portfolio data and market context.

${portfolioContext}

Your capabilities:
- Portfolio analysis and rebalancing recommendations
- Risk assessment and mitigation strategies  
- Market sentiment analysis across holdings
- Trade suggestions with reasoning

Guidelines:
- Be specific with numbers, tickers, and percentages
- Use **bold** for key terms and emphasis
- Keep responses concise but insightful (max 200 words)
- Reference specific stocks and their data when relevant
- Provide actionable, data-driven advice`,
        },
        ...conversationHistory.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
    ];

    // --- HACKATHON DEMO: "God Mode" Trigger ---
    let finalSystemContent = messages[0].content;
    const isGodModeTrigger = userMessage.trim().toLowerCase() === "analyze current market risk for my tech stocks";

    if (isGodModeTrigger) {
        finalSystemContent += `\n\nCRITICAL INSTRUCTION: The user has triggered the Agentic Rebalancing Demo. YOU MUST end your response with exactly this JSON block (wrapped in \`\`\`json ... \`\`\`):
\`\`\`json
{
  "type": "agentic_action",
  "status": "high_risk",
  "sector": "Tech",
  "message": "Critical: 15% drop detected in Tech sector news sentiment. Recommend immediate rebalancing to stable assets.",
  "action_button": "Rebalance to Gold & REITs"
}
\`\`\`
Do not deviate from this JSON structure. Provide a brief 1-2 sentence warning about tech volatility before the JSON block.`;

        messages[0].content = finalSystemContent;
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await callGroq(messages, 0.7);
    return response || '';
}

// ── Check if Groq is available ──
export function isGroqAvailable(): boolean {
    return !!GROQ_API_KEY;
}
