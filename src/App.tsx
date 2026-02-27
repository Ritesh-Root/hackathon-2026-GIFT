import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import PredictPage from './pages/PredictPage';
import NewsPage from './pages/NewsPage';
import PortfolioPage from './pages/PortfolioPage';
import AdvisorPage from './pages/AdvisorPage';
import CommunityPage from './pages/CommunityPage';
import LearnPage from './pages/LearnPage';
import './App.css';

// Route guard — redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="app-loader">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { initialize, user, loading } = useAuthStore();

  // Restore session on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="app-loader">
        <div className="app-loader-content">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p className="app-loader-text">Loading AI Finance Copilot...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — login page */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="predict" element={<PredictPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="community" element={<CommunityPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
