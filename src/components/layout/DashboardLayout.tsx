import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import UserProfileDrawer from './UserProfileDrawer';
import CommandPalette from './CommandPalette';
import LiveStatusBadge from '../LiveStatusBadge';
import './DashboardLayout.css';

const NAV_ITEMS = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard', end: true },
    { path: '/dashboard/learn', icon: '📚', label: 'Learn' },
    { path: '/dashboard/predict', icon: '🎯', label: 'Predict' },
    { path: '/dashboard/news', icon: '📰', label: 'News' },
    { path: '/dashboard/portfolio', icon: '💼', label: 'Portfolio' },
    { path: '/dashboard/advisor', icon: '🤖', label: 'AI Advisor' },
    { path: '/dashboard/community', icon: '💬', label: 'Community' },
];

export default function DashboardLayout() {
    const { user, signOut } = useAuthStore();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const location = useLocation();

    // Extract display name from user metadata or email
    const displayName =
        user?.user_metadata?.display_name ||
        user?.email?.split('@')[0] ||
        'Investor';

    return (
        <div className="dashboard-layout">
            {/* ── Sidebar ── */}
            <aside className="sidebar glass">
                <div className="sidebar-brand">
                    <img src="/logo.png" alt="Logo" className="sidebar-logo" />
                    <div className="sidebar-brand-text">
                        <span className="sidebar-brand-name gradient-text">AI Finance Copilot</span>
                        <span className="sidebar-brand-sub">Your Smart Trading Partner</span>
                        <LiveStatusBadge />
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            className={({ isActive }) =>
                                `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
                            }
                        >
                            <span className="sidebar-nav-icon">{item.icon}</span>
                            <span className="sidebar-nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">{displayName}</span>
                            <span className="sidebar-user-role">Investor</span>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm sidebar-signout" onClick={handleSignOut}>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="dashboard-main">
                <UserProfileDrawer />
                {(location.pathname === '/dashboard' || location.pathname === '/dashboard/') && <CommandPalette />}
                <Outlet />
            </main>
        </div>
    );
}
