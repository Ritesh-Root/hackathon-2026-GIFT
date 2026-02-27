import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { fetchUserProgress, updateUserProgress, isDemoUser } from '../services/supabaseService';
import { Wallet, Shield, Brain, TrendingUp } from 'lucide-react';
import PaperTradeSim from '../components/PaperTradeSim';
import { usePaperStore } from '../store/paperStore';
import './LearnPage.css';

interface LearningModule {
    id: string;
    title: string;
    description: string;
    icon: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    lessons: number;
    duration: string;
    progress: number; // 0 - 100
    topics: string[];
}

const MODULES: LearningModule[] = [
    {
        id: 'fundamentals',
        title: 'Market Fundamentals',
        description: 'Understand how stock markets work — exchanges, order types, and the role of market makers.',
        icon: '📊',
        difficulty: 'Beginner',
        lessons: 8,
        duration: '1.5 hrs',
        progress: 100,
        topics: ['Exchanges & Order Types', 'Market Hours & Sessions', 'Bid-Ask Spread', 'Market vs. Limit Orders'],
    },
    {
        id: 'technical-analysis',
        title: 'Technical Analysis',
        description: 'Master chart patterns, candlestick formations, and technical indicators for price analysis.',
        icon: '📈',
        difficulty: 'Intermediate',
        lessons: 12,
        duration: '3 hrs',
        progress: 67,
        topics: ['Candlestick Patterns', 'Support & Resistance', 'Moving Averages', 'RSI & MACD', 'Fibonacci Retracement'],
    },
    {
        id: 'fundamental-analysis',
        title: 'Fundamental Analysis',
        description: 'Learn to evaluate company financials — P/E ratios, revenue growth, and DCF valuation models.',
        icon: '🏦',
        difficulty: 'Intermediate',
        lessons: 10,
        duration: '2.5 hrs',
        progress: 40,
        topics: ['Reading Financial Statements', 'P/E & PEG Ratios', 'DCF & FCF Models', 'Competitive Moats'],
    },
    {
        id: 'portfolio-theory',
        title: 'Portfolio Theory',
        description: 'Diversification, correlation, the efficient frontier, and Modern Portfolio Theory (MPT).',
        icon: '💼',
        difficulty: 'Advanced',
        lessons: 8,
        duration: '2 hrs',
        progress: 15,
        topics: ['Diversification Math', 'Correlation Matrix', 'Efficient Frontier', 'Sharpe Ratio'],
    },
    {
        id: 'risk-management',
        title: 'Risk Management',
        description: 'Position sizing, stop-loss strategies, and understanding Value-at-Risk (VaR) for protecting your capital.',
        icon: '🛡️',
        difficulty: 'Advanced',
        lessons: 6,
        duration: '1.5 hrs',
        progress: 0,
        topics: ['Position Sizing Rules', 'Stop-Loss Strategies', 'Value-at-Risk (VaR)', 'Kelly Criterion'],
    },
    {
        id: 'ai-trading',
        title: 'AI in Trading',
        description: 'How machine learning, NLP sentiment analysis, and neural networks are revolutionizing trading strategies.',
        icon: '🤖',
        difficulty: 'Advanced',
        lessons: 7,
        duration: '2 hrs',
        progress: 0,
        topics: ['ML Price Prediction', 'NLP Sentiment Analysis', 'Algorithmic Trading', 'Backtesting Strategies'],
    },
];

interface QuizQuestion {
    question: string;
    options: string[];
    correct: number;
    explanation: string;
}

const QUIZ: QuizQuestion[] = [
    {
        question: 'Which candlestick pattern signals a potential bullish reversal?',
        options: ['Shooting Star', 'Hammer', 'Evening Star', 'Dark Cloud Cover'],
        correct: 1,
        explanation: 'A Hammer forms at the bottom of a downtrend with a small body and long lower wick, indicating buying pressure overcoming sellers.',
    },
    {
        question: 'What does a P/E ratio of 25 indicate?',
        options: [
            'The company earns ₹25 per share',
            'Investors pay ₹25 for every ₹1 of earnings',
            'The stock price is ₹25',
            'The company has 25% profit margin',
        ],
        correct: 1,
        explanation: 'P/E = Price / Earnings Per Share. A P/E of 25 means investors are willing to pay ₹25 for each ₹1 the company earns annually.',
    },
    {
        question: 'What is the primary benefit of portfolio diversification?',
        options: [
            'Guaranteed higher returns',
            'Reduced unsystematic risk',
            'Elimination of all losses',
            'Lower trading costs',
        ],
        correct: 1,
        explanation: 'Diversification reduces unsystematic (company-specific) risk by spreading investments across uncorrelated assets. It cannot eliminate systematic (market-wide) risk.',
    },
];

const VirtualBalance = ({ balance }: { balance: number }) => {
    return (
        <div className="virtual-balance-pill">
            <div className="virtual-balance-icon-bg">
                <Wallet className="virtual-balance-icon" size={18} />
            </div>
            <div className="virtual-balance-text">
                <span className="virtual-balance-label">Paper Trading Balance</span>
                <span className="virtual-balance-amount">₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        </div>
    );
};

const SkillBadges = () => {
    return (
        <div className="skill-badges-wrapper animate-fade-in">
            <h3 className="skill-badges-title">Acquired Skills</h3>
            <div className="skill-badges-container">
                <div className="skill-badge skill-badge--unlocked" title="Risk Manager">
                    <div className="skill-badge-icon-wrapper">
                        <Shield className="skill-badge-icon" size={24} />
                    </div>
                    <span className="skill-badge-name">Risk Manager</span>
                </div>
                <div className="skill-badge skill-badge--locked" title="Sentiment Sage (Locked)">
                    <div className="skill-badge-icon-wrapper">
                        <Brain className="skill-badge-icon" size={24} />
                    </div>
                    <span className="skill-badge-name">Sentiment Sage</span>
                </div>
                <div className="skill-badge skill-badge--locked" title="Market Maker (Locked)">
                    <div className="skill-badge-icon-wrapper">
                        <TrendingUp className="skill-badge-icon" size={24} />
                    </div>
                    <span className="skill-badge-name">Market Maker</span>
                </div>
            </div>
        </div>
    );
};

export default function LearnPage() {
    const { user } = useAuthStore();
    const isDemo = !user || isDemoUser(user.id);
    const [modules, setModules] = useState<LearningModule[]>(MODULES);
    const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
    const [quizActive, setQuizActive] = useState(false);
    const [currentQ, setCurrentQ] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [quizComplete, setQuizComplete] = useState(false);

    // Persistent paper trading wallet (localStorage-backed)
    const { balance: virtualBalance } = usePaperStore();

    // Load progress from Supabase for real users
    useEffect(() => {
        if (isDemo || !user) return;

        fetchUserProgress(user.id).then((dbProgress) => {
            if (dbProgress.length > 0) {
                setModules((prev: LearningModule[]) =>
                    prev.map((mod: LearningModule) => {
                        const saved = dbProgress.find((p) => p.module_id === mod.id);
                        return saved ? { ...mod, progress: saved.progress } : mod;
                    })
                );
            }
        });
    }, [isDemo, user]);

    // Overall progress
    const completedLessons = modules.reduce((sum: number, m: LearningModule) => sum + Math.round((m.progress / 100) * m.lessons), 0);
    const totalLessons = modules.reduce((sum: number, m: LearningModule) => sum + m.lessons, 0);
    const overallProgress = Math.round((completedLessons / totalLessons) * 100);

    const handleAnswer = (idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        setShowExplanation(true);
        if (idx === QUIZ[currentQ].correct) {
            setScore((s: number) => s + 1);
        }
    };

    const handleNextQ = () => {
        if (currentQ < QUIZ.length - 1) {
            setCurrentQ((q: number) => q + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        } else {
            setQuizComplete(true);
            // Save quiz score to Supabase
            if (!isDemo && user) {
                const pct = Math.round(((score + (currentQ === QUIZ.length - 1 ? 1 : 0)) / QUIZ.length) * 100);
                updateUserProgress(user.id, 'quiz-assessment', pct, score);
            }
        }
    };

    const resetQuiz = () => {
        setCurrentQ(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setScore(0);
        setQuizComplete(false);
        setQuizActive(false);
    };

    const difficultyColor = (d: string) => {
        if (d === 'Beginner') return 'var(--color-success)';
        if (d === 'Intermediate') return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    return (
        <div className="learn-page animate-fade-in">
            <div className="learn-header">
                <div>
                    <h1 className="learn-title">📚 Learning & Assessment</h1>
                    <p className="learn-subtitle">Master financial concepts through structured modules and quizzes</p>
                </div>
                <div className="learn-header-actions">
                    <VirtualBalance balance={virtualBalance} />
                    <button
                        className={`btn ${quizActive ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => quizActive ? resetQuiz() : setQuizActive(true)}
                    >
                        {quizActive ? '✕ Exit Quiz' : '🧠 Take Assessment'}
                    </button>
                </div>
            </div>

            {/* Quiz Mode */}
            {quizActive && (
                <div className="learn-quiz-section animate-fade-in">
                    {quizComplete ? (
                        <div className="card learn-quiz-result">
                            <span className="quiz-result-icon">{score === QUIZ.length ? '🏆' : score >= 2 ? '🎉' : '📖'}</span>
                            <h2>Assessment Complete</h2>
                            <p className="quiz-result-score">
                                You scored <strong>{score}/{QUIZ.length}</strong>
                            </p>
                            <p className="quiz-result-label">
                                {score === QUIZ.length
                                    ? 'Perfect! You\'re a finance pro.'
                                    : score >= 2
                                        ? 'Great work! Review the areas you missed.'
                                        : 'Keep learning — you\'ll get there!'}
                            </p>
                            <div className="quiz-result-actions">
                                <button className="btn btn-primary" onClick={resetQuiz}>Try Again</button>
                                <button className="btn btn-ghost" onClick={() => setQuizActive(false)}>Back to Modules</button>
                            </div>
                        </div>
                    ) : (
                        <div className="card learn-quiz-card">
                            <div className="quiz-progress-bar">
                                <div className="quiz-progress-fill" style={{ width: `${((currentQ + 1) / QUIZ.length) * 100}%` }} />
                            </div>
                            <span className="quiz-counter">Question {currentQ + 1} of {QUIZ.length}</span>
                            <h3 className="quiz-question">{QUIZ[currentQ].question}</h3>
                            <div className="quiz-options">
                                {QUIZ[currentQ].options.map((opt, i) => (
                                    <button
                                        key={i}
                                        className={`quiz-option ${selectedAnswer !== null
                                            ? i === QUIZ[currentQ].correct
                                                ? 'quiz-option--correct'
                                                : i === selectedAnswer
                                                    ? 'quiz-option--wrong'
                                                    : ''
                                            : ''
                                            }`}
                                        onClick={() => handleAnswer(i)}
                                        disabled={selectedAnswer !== null}
                                    >
                                        <span className="quiz-option-letter">{'ABCD'[i]}</span>
                                        <span>{opt}</span>
                                    </button>
                                ))}
                            </div>
                            {showExplanation && (
                                <div className="quiz-explanation animate-fade-in">
                                    <p>{QUIZ[currentQ].explanation}</p>
                                    <button className="btn btn-primary btn-sm" onClick={handleNextQ}>
                                        {currentQ < QUIZ.length - 1 ? 'Next Question →' : 'View Results'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Stats Bar */}
            {!quizActive && (
                <>
                    <div className="learn-stats">
                        <div className="card learn-stat-card">
                            <span className="learn-stat-value">{overallProgress}%</span>
                            <span className="learn-stat-label">Overall Progress</span>
                            <div className="learn-stat-bar">
                                <div className="learn-stat-fill" style={{ width: `${overallProgress}%` }} />
                            </div>
                        </div>
                        <div className="card learn-stat-card">
                            <span className="learn-stat-value">{completedLessons}/{totalLessons}</span>
                            <span className="learn-stat-label">Lessons Completed</span>
                        </div>
                        <div className="card learn-stat-card">
                            <span className="learn-stat-value">{modules.filter((m) => m.progress === 100).length}</span>
                            <span className="learn-stat-label">Modules Mastered</span>
                        </div>
                    </div>

                    <SkillBadges />

                    {/* Module Grid */}
                    <div className="learn-modules-grid">
                        {modules.map((mod: LearningModule) => (
                            <div
                                key={mod.id}
                                className={`card learn-module-card ${selectedModule?.id === mod.id ? 'learn-module-card--selected' : ''}`}
                                onClick={() => setSelectedModule(selectedModule?.id === mod.id ? null : mod)}
                            >
                                <div className="module-card-header">
                                    <span className="module-icon">{mod.icon}</span>
                                    <span
                                        className="badge"
                                        style={{
                                            background: `${difficultyColor(mod.difficulty)}18`,
                                            color: difficultyColor(mod.difficulty),
                                            border: `1px solid ${difficultyColor(mod.difficulty)}33`,
                                        }}
                                    >
                                        {mod.difficulty}
                                    </span>
                                </div>
                                <h3 className="module-title">{mod.title}</h3>
                                <p className="module-desc">{mod.description}</p>
                                <div className="module-meta">
                                    <span>{mod.lessons} lessons</span>
                                    <span>·</span>
                                    <span>{mod.duration}</span>
                                </div>
                                {/* Progress bar */}
                                <div className="module-progress">
                                    <div className="module-progress-bar">
                                        <div
                                            className="module-progress-fill"
                                            style={{
                                                width: `${mod.progress}%`,
                                                background: mod.progress === 100
                                                    ? 'var(--color-success)'
                                                    : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                            }}
                                        />
                                    </div>
                                    <span className="module-progress-text">
                                        {mod.progress === 100 ? '✓ Complete' : `${mod.progress}%`}
                                    </span>
                                </div>

                                {/* Expandable topics */}
                                {selectedModule?.id === mod.id && (
                                    <div className="module-topics animate-fade-in">
                                        <h4>Topics Covered</h4>
                                        <ul>
                                            {mod.topics.map((t: string, i: number) => (
                                                <li key={i}>
                                                    <span className="topic-bullet">
                                                        {i < Math.round((mod.progress / 100) * mod.topics.length) ? '✅' : '○'}
                                                    </span>
                                                    {t}
                                                </li>
                                            ))}
                                        </ul>
                                        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                                            {mod.progress === 0 ? 'Start Module' : mod.progress === 100 ? 'Revise' : 'Continue'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Paper Trading Simulator */}
                    <PaperTradeSim />
                </>
            )}
        </div>
    );
}
