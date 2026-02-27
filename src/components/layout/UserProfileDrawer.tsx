import { useState } from 'react';
import { Wallet, ShieldCheck, X } from 'lucide-react';

declare global {
    interface Window {
        ethereum?: any;
    }
}
import ReactECharts from 'echarts-for-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';
import './UserProfileDrawer.css';

export default function UserProfileDrawer() {
    const { user, initialize } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);

    const displayName =
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'Demo Investor';

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState(displayName);
    const [editHandle, setEditHandle] = useState(() => localStorage.getItem('user_handle') || '@trader');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const saveProfile = async () => {
        setIsSavingProfile(true);
        try {
            // Save handle locally
            localStorage.setItem('user_handle', editHandle.startsWith('@') ? editHandle : '@' + editHandle);

            // Save display name to Supabase
            if (user && editName !== displayName) {
                const { error } = await supabase.auth.updateUser({
                    data: { display_name: editName }
                });

                if (error) {
                    console.error("Failed to update profile", error);
                    alert("Failed to update profile: " + error.message);
                } else {
                    // Update authStore to reflect new name immediately
                    await initialize();
                }
            }
            setIsEditingProfile(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const connectWeb3 = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                setIsConnecting(true);
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts.length > 0) {
                    setWalletAddress(accounts[0]);
                }
            } catch (error) {
                console.error("Wallet connection rejected or failed", error);
            } finally {
                setIsConnecting(false);
            }
        } else {
            alert("No Web3 provider detected. Please install MetaMask.");
        }
    };

    const formatWallet = (address: string) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const sparklineOption = {
        backgroundColor: 'transparent',
        tooltip: { show: false },
        grid: { top: 10, bottom: 0, left: -20, right: -20 },
        xAxis: { show: false, type: 'category', data: ['1', '2', '3', '4', '5', '6', '7'] },
        yAxis: { show: false, type: 'value', min: 'dataMin' },
        series: [
            {
                data: [12000, 13500, 13000, 16000, 15500, 21000, 24500],
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    color: '#8b5cf6', // accent-purple
                    width: 2,
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(139, 92, 246, 0.4)' },
                            { offset: 1, color: 'rgba(139, 92, 246, 0)' }
                        ]
                    }
                }
            }
        ]
    };

    return (
        <div className="user-profile-wrapper">
            {/* Trigger Avatar */}
            <button className="user-avatar-trigger" onClick={() => setIsOpen(true)}>
                <div className="avatar-pulse-ring"></div>
                <div className="avatar-image">
                    {displayName.charAt(0).toUpperCase()}
                </div>
            </button>

            {/* Overlay */}
            <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)}></div>

            {/* Slide-Out Drawer */}
            <div className={`user-profile-drawer ${isOpen ? 'open' : ''}`}>
                <div className="drawer-ambient-light"></div>

                <div className="drawer-header">
                    <button className="drawer-close-btn" onClick={() => setIsOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="drawer-content">
                    {/* Section A: Identity & Action */}
                    <div className="drawer-section identity-section">
                        {isEditingProfile ? (
                            <div className="edit-profile-form">
                                <div className="large-avatar mb-4 mx-auto">
                                    {editName.charAt(0).toUpperCase()}
                                </div>
                                <div className="form-group">
                                    <label>Display Name</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="edit-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Handle</label>
                                    <div className="handle-input-wrapper">
                                        <span className="handle-prefix">@</span>
                                        <input
                                            type="text"
                                            value={editHandle.replace('@', '')}
                                            onChange={(e) => setEditHandle('@' + e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                            className="edit-input handle-input"
                                        />
                                    </div>
                                </div>
                                <div className="edit-actions">
                                    <button
                                        className="btn-ghost"
                                        onClick={() => setIsEditingProfile(false)}
                                        disabled={isSavingProfile}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn-primary save-btn"
                                        onClick={saveProfile}
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="large-avatar">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="identity-info">
                                    <h2 className="identity-name">{displayName}</h2>
                                    <span className="identity-handle">{editHandle}</span>
                                </div>
                                <button className="btn-ghost edit-profile-btn" onClick={() => setIsEditingProfile(true)}>
                                    Edit Profile
                                </button>
                            </>
                        )}
                    </div>

                    {/* Section B: Gamification Engine */}
                    <div className="drawer-section gamification-section">
                        <div className="trader-stats-card">
                            <div className="stats-header">
                                <span className="level-badge">Level 14: Market Maker</span>
                                <span className="xp-text">8,450 / 10,000 XP</span>
                            </div>
                            <div className="xp-progress-bar-container">
                                <div className="xp-progress-bar-fill" style={{ width: '84.5%' }}></div>
                            </div>
                            <div className="balance-info">
                                <span className="balance-label">Virtual Trading Balance</span>
                                <span className="balance-value neon-green">₹1,485,600</span>
                            </div>
                        </div>
                    </div>

                    {/* Section C: The "Sparkline" Portfolio Graph */}
                    <div className="drawer-section portfolio-graph-section">
                        <h3 className="section-title-small">All-Time P&L</h3>
                        <div className="sparkline-container">
                            <ReactECharts
                                option={sparklineOption}
                                style={{ height: '80px', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                                notMerge={true}
                                lazyUpdate={true}
                            />
                        </div>
                    </div>

                    {/* Section D: Web3 Authentication */}
                    <div className="drawer-section web3-section">
                        <button
                            className={`web3-action-card ${walletAddress ? 'connected' : ''}`}
                            onClick={!walletAddress ? connectWeb3 : undefined}
                            disabled={isConnecting}
                        >
                            <div className="web3-card-icon">
                                {walletAddress ? <ShieldCheck size={20} className="neon-green-text" /> : <Wallet size={20} />}
                            </div>
                            <div className="web3-card-content">
                                {isConnecting ? (
                                    <span className="web3-status">Connecting...</span>
                                ) : walletAddress ? (
                                    <>
                                        <span className="web3-status">Connected: {formatWallet(walletAddress)}</span>
                                        <span className="web3-subtext">Verified Web3 Identity</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="web3-status">Connect Web3 Wallet</span>
                                        <span className="web3-subtext">Secure decentralized login</span>
                                    </>
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
