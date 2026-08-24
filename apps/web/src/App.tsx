import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  MessageSquare, Shield, History, Store, Package, Settings,
  BarChart3, FileText, Zap, Sun, Moon, ShieldCheck, Activity, Cpu
} from 'lucide-react';
import BuyerWorkspace from './pages/BuyerWorkspace';
import BuyerPolicy from './pages/BuyerPolicy';
import BuyerHistory from './pages/BuyerHistory';
import MerchantDashboard from './pages/MerchantDashboard';
import MerchantCatalog from './pages/MerchantCatalog';
import MerchantPolicy from './pages/MerchantPolicy';
import AuditPage from './pages/AuditPage';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('razorx_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('razorx_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Sleek Razorpay Sidebar */}
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">RX</div>
            <div className="sidebar-logo-text">
              <span>RazorX</span>
              <span className="sidebar-logo-tag">AI Transact Engine</span>
            </div>
          </div>

          <div className="sidebar-section">Autonomous Buyer</div>
          <NavLink to="/buyer" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <MessageSquare /> <span>AI Co-Pilot</span>
          </NavLink>
          <NavLink to="/buyer/policy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Shield /> <span>Spending Policy</span>
          </NavLink>
          <NavLink to="/buyer/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <History /> <span>Order History</span>
          </NavLink>

          <div className="sidebar-section">Merchant Network</div>
          <NavLink to="/merchant" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <BarChart3 /> <span>Analytics & GMV</span>
          </NavLink>
          <NavLink to="/merchant/catalog" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Package /> <span>Product Catalog</span>
          </NavLink>
          <NavLink to="/merchant/policy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Settings /> <span>Merchant Policy</span>
          </NavLink>

          <div className="sidebar-section">Trust & Security</div>
          <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FileText /> <span>Audit Hash Chain</span>
          </NavLink>

          <div style={{ flex: 1 }} />
          <div className="sidebar-link" style={{ opacity: 0.85, fontSize: '12px', background: 'rgba(10, 133, 234, 0.08)' }}>
            <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>Razorpay Connected</span>
          </div>
        </nav>

        {/* Main Content Area with Header */}
        <main className="main-content">
          <header className="topbar">
            <div className="topbar-status-group">
              <div className="status-pill">
                <span className="status-dot" />
                <span>Ed25519 Authority: Active</span>
              </div>
              <div className="status-pill">
                <Cpu size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Groq LPU: Online</span>
              </div>
              <div className="status-pill">
                <Activity size={14} style={{ color: 'var(--success)' }} />
                <span>Anti-Sleep: Running</span>
              </div>
            </div>

            <div className="topbar-actions">
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>

          <div className="page-container">
            <Routes>
              <Route path="/" element={<Navigate to="/buyer" replace />} />
              <Route path="/buyer" element={<BuyerWorkspace />} />
              <Route path="/buyer/policy" element={<BuyerPolicy />} />
              <Route path="/buyer/history" element={<BuyerHistory />} />
              <Route path="/merchant" element={<MerchantDashboard />} />
              <Route path="/merchant/catalog" element={<MerchantCatalog />} />
              <Route path="/merchant/policy" element={<MerchantPolicy />} />
              <Route path="/audit" element={<AuditPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
