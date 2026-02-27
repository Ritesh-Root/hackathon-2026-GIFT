import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Wallet } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isConnectingWallet, setIsConnectingWallet] = useState(false);
    const { signIn, signUp, loading, error, clearError, enterDemoMode } = useAuthStore();

    const connectWallet = async () => {
        if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
            try {
                setIsConnectingWallet(true);
                const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                    setWalletAddress(accounts[0]);
                }
            } catch (err) {
                console.error("Failed to connect wallet", err);
            } finally {
                setIsConnectingWallet(false);
            }
        } else {
            alert("No Web3 wallet detected. Please install MetaMask or a similar provider!");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSignUp) {
            await signUp(email, password, displayName);
        } else {
            await signIn(email, password);
        }
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        clearError();
    };

    return (
        <div className="login-page">
            {/* Animated background orbs */}
            <div className="login-bg-orb login-bg-orb-1" />
            <div className="login-bg-orb login-bg-orb-2" />
            <div className="login-bg-orb login-bg-orb-3" />

            <div className="login-container animate-fade-in">
                {/* Branding */}
                <div className="login-brand">
                    <div className="login-logo">
                        <img src="/logo.png" alt="Logo" style={{ width: 40, height: 40, borderRadius: 10 }} />
                    </div>
                    <h1 className="login-title gradient-text">AI Finance Copilot</h1>
                    <p className="login-subtitle">Your Smart Trading Partner</p>
                </div>

                {/* Form Card */}
                <form className="login-card glass" onSubmit={handleSubmit}>
                    <h2 className="login-card-title">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="login-card-desc">
                        {isSignUp
                            ? 'Start your intelligent investing journey'
                            : 'Sign in to your copilot dashboard'}
                    </p>

                    {error && (
                        <div className="login-error animate-fade-in">
                            <span>⚠</span> {error}
                        </div>
                    )}

                    {isSignUp && (
                        <div className="input-group animate-fade-in">
                            <label htmlFor="displayName">Display Name</label>
                            <input
                                id="displayName"
                                className="input"
                                type="text"
                                placeholder="Ritesh Mahato"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            className="input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg login-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner" />
                                {isSignUp ? 'Creating Account...' : 'Signing In...'}
                            </>
                        ) : (
                            isSignUp ? 'Create Account' : 'Sign In'
                        )}
                    </button>

                    <div className="login-toggle">
                        <span className="login-toggle-text">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        </span>
                        <button type="button" className="login-toggle-btn" onClick={toggleMode}>
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </div>
                </form>

                <button
                    className="btn btn-ghost btn-lg login-submit"
                    onClick={enterDemoMode}
                    style={{ width: '100%', maxWidth: 420, marginTop: '-8px' }}
                >
                    🚀 Try Demo — Skip Login
                </button>

                <div className="login-web3-container">
                    <button
                        className={`btn btn-lg login-web3-btn ${walletAddress ? 'login-web3-btn--connected' : ''}`}
                        onClick={connectWallet}
                        disabled={isConnectingWallet || !!walletAddress}
                        style={{ width: '100%', maxWidth: 420 }}
                    >
                        <Wallet size={20} className="web3-icon" />
                        {isConnectingWallet
                            ? 'Connecting...'
                            : walletAddress
                                ? `Connected: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                                : 'Connect Web3 Wallet'}
                    </button>
                </div>

                <p className="login-footer">
                    Powered by <span className="gradient-text">AI Finance Copilot</span> · Built by Ritesh Mahato
                </p>
            </div>
        </div>
    );
}
