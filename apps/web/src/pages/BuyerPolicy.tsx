import { useState, useEffect } from 'react';
import { Save, Shield, CheckCircle2, RotateCcw, AlertCircle, Sparkles, Plus, Check } from 'lucide-react';
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

  // Local string buffers to prevent leading-zero and typing glitch
  const [singleLimitStr, setSingleLimitStr] = useState('6000');
  const [dailyLimitStr, setDailyLimitStr] = useState('10000');
  const [weeklyLimitStr, setWeeklyLimitStr] = useState('25000');

  const fetchPolicy = () => {
    setLoaded(false);
    buyerApi.getPolicy('demo-buyer-001')
      .then((data) => {
        const pol = data?.policy || DEFAULT_POLICY;
        const sp = data?.spending || { daily_spent: 0, daily_remaining: 10000, weekly_spent: 0, weekly_remaining: 25000 };
        setPolicy(pol);
        setSpending(sp);
        setSingleLimitStr(String(pol.single_transaction_limit || 6000));
        setDailyLimitStr(String(pol.daily_limit || 10000));
        setWeeklyLimitStr(String(pol.weekly_limit || 25000));
        setLoaded(true);
      })
      .catch((err) => {
        console.warn('Backend waking up, using default policy:', err);
        setPolicy(DEFAULT_POLICY);
        setSpending({ daily_spent: 0, daily_remaining: 10000, weekly_spent: 0, weekly_remaining: 25000 });
        setSingleLimitStr(String(DEFAULT_POLICY.single_transaction_limit));
        setDailyLimitStr(String(DEFAULT_POLICY.daily_limit));
        setWeeklyLimitStr(String(DEFAULT_POLICY.weekly_limit));
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
      const payload = {
        ...policy,
        single_transaction_limit: Math.max(100, parseInt(singleLimitStr, 10) || 6000),
        daily_limit: Math.max(100, parseInt(dailyLimitStr, 10) || 10000),
        weekly_limit: Math.max(100, parseInt(weeklyLimitStr, 10) || 25000),
      };

      await buyerApi.updatePolicy('demo-buyer-001', payload);
      setPolicy(payload);
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
    setSingleLimitStr(String(DEFAULT_POLICY.single_transaction_limit));
    setDailyLimitStr(String(DEFAULT_POLICY.daily_limit));
    setWeeklyLimitStr(String(DEFAULT_POLICY.weekly_limit));
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

  const handleNumberInput = (setter: (v: string) => void, val: string) => {
    // Clean string input without leading zero artifacts
    const cleaned = val.replace(/^0+(?=\d)/, '');
    setter(cleaned);
  };

  const addAmount = (setter: (v: string) => void, currentStr: string, delta: number) => {
    const current = parseInt(currentStr, 10) || 0;
    setter(String(Math.max(100, current + delta)));
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>My Spending Policy</h1>
          <p>Define deterministic boundaries and delegated authority for your RazorX AI Buyer Agent</p>
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
            <div className="stat-card-subtitle">₹{Math.max(0, spending.daily_remaining)} remaining of ₹{dailyLimitStr}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Weekly Budget</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-secondary)' }}>₹{spending.weekly_spent}</div>
            <div className="stat-card-subtitle">₹{Math.max(0, spending.weekly_remaining)} remaining of ₹{weeklyLimitStr}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Single Tx Limit</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{singleLimitStr}</div>
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
          <span className="badge badge-purple">Ed25519 Bound Gate</span>
        </div>
        <div className="policy-form">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Single Transaction Limit (₹)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3000, 6000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setSingleLimitStr(String(amt))}
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => addAmount(setSingleLimitStr, singleLimitStr, 1000)}
                >
                  <Plus size={10} /> ₹1K
                </button>
              </div>
            </div>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              value={singleLimitStr}
              onChange={(e) => handleNumberInput(setSingleLimitStr, e.target.value)}
              placeholder="e.g. 6000"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Any purchase exceeding this is blocked automatically.</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Daily Velocity Limit (₹)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[5000, 10000, 20000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setDailyLimitStr(String(amt))}
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => addAmount(setDailyLimitStr, dailyLimitStr, 2000)}
                >
                  <Plus size={10} /> ₹2K
                </button>
              </div>
            </div>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              value={dailyLimitStr}
              onChange={(e) => handleNumberInput(setDailyLimitStr, e.target.value)}
              placeholder="e.g. 10000"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Maximum cumulative spending allowed per calendar day.</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Weekly Limit (₹)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[15000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setWeeklyLimitStr(String(amt))}
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => addAmount(setWeeklyLimitStr, weeklyLimitStr, 5000)}
                >
                  <Plus size={10} /> ₹5K
                </button>
              </div>
            </div>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              value={weeklyLimitStr}
              onChange={(e) => handleNumberInput(setWeeklyLimitStr, e.target.value)}
              placeholder="e.g. 25000"
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
                {policy.negotiation ? 'AI actively negotiates price discounts with merchant bots' : 'Accepts listed catalog price'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Opportunity Tolerance Alerts</label>
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
                {policy.opportunity_alerts ? 'Alerts if a significantly better option exists just above budget' : 'Strict budget cutoff only'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Allowed Categories */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Allowed Categories</span>
          <span className="badge badge-green">{policy.allowed_categories?.length || 0} active</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Transactions outside enabled categories are deterministically rejected before payment generation.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ALL_CATEGORIES.map((cat) => {
            const isAllowed = policy.allowed_categories?.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                className={`btn ${isAllowed ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => toggleCategory(cat)}
              >
                {isAllowed && <Check size={14} />}
                <span>{cat.replace(/_/g, ' ').toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Authorized Fallback Payments */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Authorized Fallback Payment Methods</span>
          <span className="badge badge-amber">{policy.fallback_payments?.length || 0} enabled</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          If primary UPI fails, RazorX will automatically retry using enabled methods in signed authorization scope.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ALL_PAYMENT_METHODS.map((method) => {
            const isAllowed = policy.fallback_payments?.includes(method);
            return (
              <button
                key={method}
                type="button"
                className={`btn ${isAllowed ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => togglePaymentMethod(method)}
              >
                {isAllowed && <Check size={14} />}
                <span>{method.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {toastMessage && (
        <div className="card" style={{ position: 'fixed', bottom: 30, right: 30, background: 'var(--bg-secondary)', border: '1px solid var(--success)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', boxShadow: 'var(--shadow-glow-success)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
