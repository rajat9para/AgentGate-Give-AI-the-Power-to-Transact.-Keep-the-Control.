import { useState, useEffect } from 'react';
import { Save, Settings, Sparkles, CheckCircle2, Shield, Calculator } from 'lucide-react';
import { merchantApi } from '../lib/api';

const MERCHANTS = [
  { id: 'merchant-runpro', name: 'RunPro Sports' },
  { id: 'merchant-technest', name: 'TechNest' },
  { id: 'merchant-campusmart', name: 'CampusMart' },
  { id: 'merchant-fitfuel', name: 'FitFuel' },
];

export default function MerchantPolicy() {
  const [selectedMerchant, setSelectedMerchant] = useState(MERCHANTS[0].id);
  const [policy, setPolicy] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [calcPrice, setCalcPrice] = useState<number>(5000);

  const fetchPolicy = (merchantId: string) => {
    setLoaded(false);
    merchantApi.getPolicy(merchantId)
      .then(setPolicy)
      .catch(console.error)
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    fetchPolicy(selectedMerchant);
  }, [selectedMerchant]);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await merchantApi.updatePolicy(selectedMerchant, policy);
      setToastMessage('✅ Merchant policy updated successfully!');
      setTimeout(() => setToastMessage(null), 3000);
      fetchPolicy(selectedMerchant);
    } catch (err) {
      console.error('Failed to save:', err);
      setToastMessage('❌ Failed to update merchant policy.');
      setTimeout(() => setToastMessage(null), 3000);
    }
    setSaving(false);
  };

  const minFloorPrice = policy ? Math.round(calcPrice * (1 - (policy.max_discount || 0))) : calcPrice;
  const maxSavings = calcPrice - minFloorPrice;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>Merchant Policy & Autonomy Rules</h1>
          <p>Configure negotiation ceilings, discount authority, and upselling rules for your AI store agent</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            className="form-input"
            value={selectedMerchant}
            onChange={(e) => setSelectedMerchant(e.target.value)}
            style={{ width: 220, fontWeight: 600 }}
          >
            {MERCHANTS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {!loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>
      ) : policy ? (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} style={{ color: 'var(--accent-primary)' }} /> Bounded Negotiation Controls
              </span>
              <span className="badge badge-purple">Merchant Authority</span>
            </div>

            <div className="policy-form">
              <div className="form-group">
                <label className="form-label">Autonomous AI Negotiation</label>
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
                    {policy.negotiation ? 'AI Agent is authorized to counter-offer with buyers' : 'Fixed list pricing only'}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Authorized Discount (%)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="50"
                  value={Math.round((policy.max_discount || 0) * 100)}
                  onChange={(e) => setPolicy({ ...policy, max_discount: (parseInt(e.target.value, 10) || 0) / 100 })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>The AI merchant will never accept an offer below this discount ceiling.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Confirmation Limit (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  value={policy.auto_confirmation_limit}
                  onChange={(e) => setPolicy({ ...policy, auto_confirmation_limit: parseInt(e.target.value, 10) || 0 })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Orders above this threshold require manual merchant sign-off.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Refund Threshold (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  value={policy.auto_refund_limit}
                  onChange={(e) => setPolicy({ ...policy, auto_refund_limit: parseInt(e.target.value, 10) || 0 })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Maximum refund amount the AI agent can issue without supervisor approval.</span>
              </div>
            </div>
          </div>

          {/* Interactive Calculator Box */}
          <div className="card" style={{ marginTop: 24, background: 'rgba(99, 102, 241, 0.05)', borderColor: 'var(--accent-primary)' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={18} style={{ color: 'var(--accent-primary)' }} /> Live Negotiation Policy Simulator
              </span>
              <span className="badge badge-blue">Interactive Test</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'center' }}>
              <div>
                <label className="form-label">Simulated Product Price (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Allowed Discount</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)', marginTop: 2 }}>
                  {Math.round((policy.max_discount || 0) * 100)}% (Max ₹{maxSavings})
                </div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Minimum Floor Price</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>
                  ₹{minFloorPrice}
                </div>
              </div>
            </div>
          </div>

          {/* Upselling Policy */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: 'var(--accent-secondary)' }} /> AI Cross-Sell & Upsell Agent
              </span>
              <span className="badge badge-green">Revenue Multiplier</span>
            </div>
            <div className="policy-form">
              <div className="form-group">
                <label className="form-label">Autonomous Upselling</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={policy.upsell}
                      onChange={(e) => setPolicy({ ...policy, upsell: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {policy.upsell ? 'AI Merchant Agent recommends relevant accessories post-purchase' : 'Disabled'}
                  </span>
                </div>
              </div>

              {policy.upsell && (
                <div className="form-group">
                  <label className="form-label">Maximum Upsell Recommendations</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="5"
                    value={policy.max_upsell_offers}
                    onChange={(e) => setPolicy({ ...policy, max_upsell_offers: parseInt(e.target.value, 10) || 0 })}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Capped number of complementary suggestions presented to the buyer.</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No policy found for this merchant.</p>
        </div>
      )}

      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
