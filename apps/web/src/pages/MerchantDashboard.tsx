import { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, CreditCard, ShieldAlert, DollarSign,
  BarChart3, ArrowUpRight, ShieldCheck, RefreshCw, Sparkles, Store
} from 'lucide-react';
import { merchantApi } from '../lib/api';

const MERCHANTS = [
  { id: 'merchant-runpro', name: 'RunPro Sports', category: 'Running & Athletics', rating: 4.6, reliability: '94%' },
  { id: 'merchant-technest', name: 'TechNest', category: 'Smart Electronics', rating: 4.4, reliability: '91%' },
  { id: 'merchant-campusmart', name: 'CampusMart', category: 'Student Essentials', rating: 4.2, reliability: '88%' },
  { id: 'merchant-fitfuel', name: 'FitFuel', category: 'Fitness & Nutrition', rating: 4.5, reliability: '92%' },
];

export default function MerchantDashboard() {
  const [selectedMerchant, setSelectedMerchant] = useState(MERCHANTS[0].id);
  const [metrics, setMetrics] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = (merchantId: string) => {
    setRefreshing(true);
    merchantApi.getMetrics(merchantId)
      .then(setMetrics)
      .catch(console.error)
      .finally(() => {
        setLoaded(true);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    setLoaded(false);
    fetchMetrics(selectedMerchant);
  }, [selectedMerchant]);

  const currentMerchantInfo = MERCHANTS.find(m => m.id === selectedMerchant) || MERCHANTS[0];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>Merchant AI Analytics Dashboard</h1>
          <p>Real-time AI commerce revenue, autonomous conversion rates, and recovery statistics</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
          <button className="btn btn-secondary" onClick={() => fetchMetrics(selectedMerchant)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Merchant Overview Card */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.8), rgba(99, 102, 241, 0.08))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Store size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{currentMerchantInfo.name}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Category: {currentMerchantInfo.category} • Merchant Rating: ★{currentMerchantInfo.rating}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="badge badge-green">AI Storefront Connected</span>
            <span className="badge badge-purple">Reliability: {currentMerchantInfo.reliability}</span>
          </div>
        </div>
      </div>

      {!loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-label">
                <DollarSign size={14} style={{ display: 'inline', marginRight: 4 }} />
                AI Commerce Revenue
              </div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                ₹{(metrics?.total_ai_revenue || 0).toLocaleString()}
              </div>
              <div className="stat-card-subtitle">Generated autonomously via AI buyers</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">
                <TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />
                AI Conversion Rate
              </div>
              <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>
                {((metrics?.ai_conversion_rate || 0) * 100).toFixed(1)}%
              </div>
              <div className="stat-card-subtitle">Autonomous session completion</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">
                <ShoppingBag size={14} style={{ display: 'inline', marginRight: 4 }} />
                Total AI Orders
              </div>
              <div className="stat-card-value">{metrics?.total_orders || 0}</div>
              <div className="stat-card-subtitle">Confirmed through Razorpay</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">
                <BarChart3 size={14} style={{ display: 'inline', marginRight: 4 }} />
                Average Order Value
              </div>
              <div className="stat-card-value">₹{Math.round(metrics?.average_order_value || 0).toLocaleString()}</div>
              <div className="stat-card-subtitle">Per successful transaction</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} /> Growth & Revenue Uplift
                </span>
                <span className="badge badge-green">Active Engine</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recovered Payment Revenue</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>₹{(metrics?.recovered_payment_revenue || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>UPI failure automatically saved to Card</div>
                  </div>
                  <CreditCard size={28} style={{ color: 'var(--success)', opacity: 0.8 }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Upsell Revenue</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-secondary)', marginTop: 2 }}>₹{(metrics?.ai_upsell_revenue || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Complementary accessory recommendations</div>
                  </div>
                  <ArrowUpRight size={28} style={{ color: 'var(--accent-secondary)', opacity: 0.8 }} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} style={{ color: 'var(--info)' }} /> Trust & Safety Middleware
                </span>
                <span className="badge badge-purple">Guarded</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Blocked Unauthorized Actions</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--error)', marginTop: 2 }}>{metrics?.blocked_ai_actions || 0}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Exceeded budget or unverified policies</div>
                  </div>
                  <ShieldAlert size={28} style={{ color: 'var(--error)', opacity: 0.8 }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Abandoned Purchase Recovery</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>₹{(metrics?.abandoned_cart_recovery || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Automated payment link re-engagement</div>
                  </div>
                  <ShoppingBag size={28} style={{ color: 'var(--text-muted)', opacity: 0.8 }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
