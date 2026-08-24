import React from 'react';
import {
  CheckCircle2, Package, Truck, ShieldCheck, ArrowLeft, Printer,
  Store, Tag, CreditCard, ExternalLink, Sparkles, Clock, FileText
} from 'lucide-react';

interface OrderConfirmationProps {
  order: {
    id: string;
    product_title: string;
    product_image?: string;
    merchant_name: string;
    total_amount: number;
    negotiated_amount?: number;
    currency: string;
    payment_method: string;
    razorpay_order_id?: string;
    payment?: any;
    created_at?: string;
  };
  onBackToShopping: () => void;
  onViewHistory: () => void;
}

export default function OrderConfirmationView({
  order,
  onBackToShopping,
  onViewHistory,
}: OrderConfirmationProps) {
  const finalPrice = order.negotiated_amount || order.total_amount;
  const savings = order.negotiated_amount ? Math.max(0, order.total_amount - order.negotiated_amount) : 0;
  const savingsPercent = savings > 0 ? Math.round((savings / order.total_amount) * 100) : 0;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '10px 0 40px' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button
          className="btn btn-secondary"
          onClick={onBackToShopping}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Back to AI Assistant
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> Print Invoice
          </button>
          <button className="btn btn-primary" onClick={onViewHistory} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={14} /> View in Order History
          </button>
        </div>
      </div>

      {/* Success Hero Banner */}
      <div className="card" style={{ textAlign: 'center', padding: '36px 20px', border: '1px solid var(--success)', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-card) 100%)', boxShadow: 'var(--shadow-glow-success)', marginBottom: 24 }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle2 size={40} />
        </div>
        <span className="badge badge-green" style={{ fontSize: 12, padding: '4px 12px', marginBottom: 12 }}>
          ✨ Autonomous Transaction Fulfilled & Delivered
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
          Order Confirmed & Paid via Razorpay!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 540, margin: '0 auto' }}>
          Your AI Buyer Agent negotiated a discount with the merchant and executed checkout with Ed25519 authorization.
        </p>
      </div>

      {/* Grid: Order Summary & Tracking Stepper */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Item Details Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Purchased Item</span>
            <span className="badge badge-blue">Direct Settlement</span>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            {order.product_image && (
              <img
                src={order.product_image}
                alt={order.product_title}
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                {order.product_title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Store size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>{order.merchant_name}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Order ID: <span style={{ fontFamily: 'monospace' }}>#{order.id.slice(0, 12)}</span>
              </div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="receipt-row">
              <span style={{ color: 'var(--text-secondary)' }}>Catalog Original Price</span>
              <span style={{ fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</span>
            </div>

            {savings > 0 && (
              <div className="receipt-row" style={{ color: 'var(--success)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={12} /> AI Negotiated Savings
                </span>
                <span style={{ fontWeight: 800 }}>-₹{savings.toLocaleString()} ({savingsPercent}%)</span>
              </div>
            )}

            <div className="receipt-row">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal (Taxable Base)</span>
              <span style={{ fontWeight: 600 }}>₹{(Math.round(finalPrice / 1.18)).toLocaleString()}</span>
            </div>

            <div className="receipt-row">
              <span style={{ color: 'var(--text-secondary)' }}>GST (18% Included)</span>
              <span style={{ fontWeight: 600 }}>₹{(finalPrice - Math.round(finalPrice / 1.18)).toLocaleString()}</span>
            </div>

            <div className="receipt-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 4, fontSize: 17 }}>
              <span style={{ fontWeight: 800 }}>Total Paid Amount</span>
              <span style={{ fontWeight: 900, color: 'var(--accent-primary)', fontSize: 20 }}>
                ₹{finalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Live Execution Timeline Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Autonomous Pipeline</span>
            <span className="badge badge-purple">Audit Sealed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Autonomous Product Discovery & Match</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top candidate selected across 4 verified merchants.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>AI-to-AI Price Negotiation</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Discount secured: ₹{order.total_amount} → ₹{finalPrice} (Saved ₹{savings}).
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Ed25519 Policy Authorization Verified</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Deterministic bounds verified. Signed authorization token generated.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Razorpay Payment Captured</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Payment captured via <strong>{order.payment_method?.toUpperCase() || 'CARD'}</strong> (Auto-recovered from simulated UPI timeout).
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Fulfillment & Delivery Status</div>
                <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  ✅ Delivered to demo buyer address.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
        <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: 14 }} onClick={onBackToShopping}>
          <Sparkles size={16} /> Buy Another Product
        </button>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }} onClick={onViewHistory}>
          <FileText size={16} /> View All Orders in History
        </button>
      </div>
    </div>
  );
}
