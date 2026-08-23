import { useState, useEffect } from 'react';
import { Save, Shield, CheckCircle2, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import { buyerApi } from '../lib/api';

const ALL_CATEGORIES = [
  'running_shoes',
  'electronics',
  'clothing',
  'fitness',
  'accessories',
  'nutrition',
  'student_essentials',
];

const ALL_PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'wallet'];

const DEFAULT_POLICY = {
  single_transaction_limit: 6000,
  daily_limit: 10000,
  weekly_limit: 25000,
  autonomous_purchase: true,
  allowed_categories: ['running_shoes', 'electronics', 'clothing', 'fitness', 'accessories', 'nutrition', 'student_essentials'],
  negotiation: true,
  fallback_payments: ['upi', 'card'],
  opportunity_alerts: true,
  max_opportunity_overshoot: 0.20,
  min_opportunity_improvement: 0.08,
};

export default function BuyerPolicy() {
  const [policy, setPolicy] = useState<any>(null);
  const [spending, setSpending] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPolicy = () => {
    setLoaded(false);
    buyerApi.getPolicy('demo-buyer-001')
      .then((data) => {
        setPolicy(data.policy);
        setSpending(data.spending);
        setLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load policy:', err);
        setLoaded(true);
      });
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await buyerApi.updatePolicy('demo-buyer-001', policy);
      setToastMessage('✅ Spending policy updated successfully!');
      setTimeout(() => setToastMessage(null), 3000);
      fetchPolicy();
    } catch (err) {
      console.error('Failed to save policy:', err);
      setToastMessage('❌ Failed to update policy. Check server logs.');
      setTimeout(() => setToastMessage(null), 3000);
    }
    setSaving(false);
  };

  const handleResetDefaults = () => {
    setPolicy({ ...policy, ...DEFAULT_POLICY });
    setToastMessage('Restored default policy settings. Click Save to persist.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleCategory = (cat: string) => {
    if (!policy) return;
    const current = policy.allowed_categories || [];
    const updated = current.includes(cat)
      ? current.filter((c: string) => c !== cat)
      : [...current, cat];
    setPolicy({ ...policy, allowed_categories: updated });
  };

  const togglePaymentMethod = (method: string) => {
    if (!policy) return;
    const current = policy.fallback_payments || [];
    const updated = current.includes(method)
      ? current.filter((m: string) => m !== method)
      : [...current, method];
    setPolicy({ ...policy, fallback_payments: updated });
  };

  if (!loaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>;
  }

  if (!policy) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <AlertCircle size={40} style={{ color: 'var(--error)', marginBottom: 16 }} />
        <h3>No Policy Found</h3>
        <p style={{ color: 'var(--text-muted)' }}>Make sure the backend is running on port 5000.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>My Spending Policy</h1>
          <p>Define deterministic boundaries and delegated authority for your AI Buyer Agent</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleResetDefaults} disabled={saving}>
            <RotateCcw size={15} /> Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>

      {/* Spending Status */}
      {spending && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-label">Daily Budget</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>₹{spending.daily_spent}</div>
            <div className="stat-card-subtitle">₹{Math.max(0, spending.daily_remaining)} remaining of ₹{policy.daily_limit}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Weekly Budget</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-secondary)' }}>₹{spending.weekly_spent}</div>
            <div className="stat-card-subtitle">₹{Math.max(0, spending.weekly_remaining)} remaining of ₹{policy.weekly_limit}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Single Tx Limit</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{policy.single_transaction_limit}</div>
            <div className="stat-card-subtitle">Hard ceiling per autonomous purchase</div>
          </div>
        </div>
      )}

      {/* Spending Limits */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} style={{ color: 'var(--accent-primary)' }} /> Deterministic Spending Limits
          </span>
          <span className="badge badge-purple">Trust Boundary</span>
        </div>
        <div className="policy-form">
          <div className="form-group">
            <label className="form-label">Single Transaction Limit (₹)</label>
            <input
              className="form-input"
              type="number"
              value={policy.single_transaction_limit}
              onChange={(e) => setPolicy({ ...policy, single_transaction_limit: parseInt(e.target.value, 10) || 0 })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Any purchase exceeding this is blocked automatically.</span>
          </div>
          <div className="form-group">
            <label className="form-label">Daily Limit (₹)</label>
            <input
              className="form-input"
              type="number"
              value={policy.daily_limit}
              onChange={(e) => setPolicy({ ...policy, daily_limit: parseInt(e.target.value, 10) || 0 })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Maximum cumulative spending allowed per calendar day.</span>
          </div>
          <div className="form-group">
            <label className="form-label">Weekly Limit (₹)</label>
            <input
              className="form-input"
              type="number"
              value={policy.weekly_limit}
              onChange={(e) => setPolicy({ ...policy, weekly_limit: parseInt(e.target.value, 10) || 0 })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Maximum cumulative spending allowed per week.</span>
          </div>
        </div>
      </div>

      {/* Autonomy Controls */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Autonomy & Intelligence Controls</span>
          <span className="badge badge-blue">Agent Behaviors</span>
        </div>
        <div className="policy-form">
          <div className="form-group">
            <label className="form-label">Autonomous Purchase</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policy.autonomous_purchase}
                  onChange={(e) => setPolicy({ ...policy, autonomous_purchase: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {policy.autonomous_purchase ? 'Agent completes purchases within limits without manual popup' : 'Requires approval for each transaction'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Agent-to-Agent Negotiation</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policy.negotiation}
                  onChange={(e) => setPolicy({ ...policy, negotiation: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {policy.negotiation ? 'Agent automatically bargains with merchant AI for discounts' : 'Fixed list prices only'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Opportunity Alerts</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={policy.opportunity_alerts}
                  onChange={(e) => setPolicy({ ...policy, opportunity_alerts: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {policy.opportunity_alerts ? 'Alert when a superior product exists above budget' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Max Opportunity Overshoot (%)</label>
            <input
              className="form-input"
              type="number"
              value={Math.round((policy.max_opportunity_overshoot || 0.2) * 100)}
              onChange={(e) => setPolicy({ ...policy, max_opportunity_overshoot: (parseInt(e.target.value, 10) || 0) / 100 })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>How far above budget the AI can explore for upgrades (e.g. 20%).</span>
          </div>
        </div>
      </div>

      {/* Allowed Categories & Fallback Payment Methods */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Authorized Categories & Payment Fallback Chain</span>
          <span className="badge badge-green">Permissions</span>
        </div>
        <div className="policy-form">
          <div className="form-group full-width">
            <label className="form-label">Allowed Shopping Categories (Click to toggle)</label>
            <div className="category-pills">
              {ALL_CATEGORIES.map((cat) => {
                const isActive = (policy.allowed_categories || []).includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-pill ${isActive ? 'active' : ''}`}
                    onClick={() => toggleCategory(cat)}
                  >
                    {isActive ? '✓ ' : '+ '}
                    {cat.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group full-width">
            <label className="form-label">Authorized Payment Fallback Methods (Click to toggle)</label>
            <div className="category-pills">
              {ALL_PAYMENT_METHODS.map((method) => {
                const isActive = (policy.fallback_payments || []).includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    className={`category-pill ${isActive ? 'active' : ''}`}
                    onClick={() => togglePaymentMethod(method)}
                  >
                    {isActive ? '✓ ' : '+ '}
                    {method.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Primary method is attempted first (UPI). If declined, the recovery agent steps through authorized fallback methods in order.
            </span>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
