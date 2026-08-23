import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { MessageSquare, Shield, History, Store, Package, Settings, BarChart3, FileText, Zap } from 'lucide-react';
import BuyerWorkspace from './pages/BuyerWorkspace';
import BuyerPolicy from './pages/BuyerPolicy';
import BuyerHistory from './pages/BuyerHistory';
import MerchantDashboard from './pages/MerchantDashboard';
import MerchantCatalog from './pages/MerchantCatalog';
import MerchantPolicy from './pages/MerchantPolicy';
import AuditPage from './pages/AuditPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">AG</div>
            <div className="sidebar-logo-text">AgentGate</div>
          </div>

          <div className="sidebar-section">Buyer</div>
          <NavLink to="/buyer" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <MessageSquare /> <span>AI Buyer</span>
          </NavLink>
          <NavLink to="/buyer/policy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Shield /> <span>My Policy</span>
          </NavLink>
          <NavLink to="/buyer/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <History /> <span>Purchase History</span>
          </NavLink>

          <div className="sidebar-section">Merchant</div>
          <NavLink to="/merchant" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <BarChart3 /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/merchant/catalog" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Package /> <span>Catalog</span>
          </NavLink>
          <NavLink to="/merchant/policy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Settings /> <span>Merchant Policy</span>
          </NavLink>

          <div className="sidebar-section">System</div>
          <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FileText /> <span>Audit Trail</span>
          </NavLink>

          <div style={{ flex: 1 }} />
          <div className="sidebar-link" style={{ opacity: 0.5, fontSize: '12px' }}>
            <Zap /> <span>Demo Mode</span>
          </div>
        </nav>

        <main className="main-content">
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
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
