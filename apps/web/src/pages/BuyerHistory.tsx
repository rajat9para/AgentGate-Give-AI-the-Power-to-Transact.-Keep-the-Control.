import { useState, useEffect } from 'react';
import {
  Package, Clock, RefreshCw, CheckCircle2, XCircle, CreditCard, Tag,
  ExternalLink, FileText, X, Printer, ShieldCheck, Store, ChevronRight
} from 'lucide-react';
import { buyerApi } from '../lib/api';

export default function BuyerHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = () => {
    setRefreshing(true);
    buyerApi.getHistory('demo-buyer-001')
      .then((data) => {
        setOrders(data);
      })
      .catch(console.error)
      .finally(() => {
        setLoaded(true);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (!loaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>;
  }

  const safeOrders = Array.isArray(orders) ? orders : [];

  const totalSpent = safeOrders
    .filter(o => o.status === 'paid' || o.status === 'delivered')
    .reduce((sum, o) => sum + (o.negotiated_amount || o.total_amount), 0);

  const totalSaved = safeOrders
    .filter(o => o.negotiated_amount && (o.status === 'paid' || o.status === 'delivered'))
    .reduce((sum, o) => sum + Math.max(0, o.total_amount - o.negotiated_amount), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Autonomous Purchase History</h1>
          <p>Every transaction autonomously executed by your RazorX AI Buyer Agent via Razorpay</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchOrders} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spinner' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {safeOrders.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-label">Total AI Purchases</div>
            <div className="stat-card-value">{safeOrders.length}</div>
            <div className="stat-card-subtitle">Transactions successfully fulfilled</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Amount Paid</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>₹{totalSpent.toLocaleString()}</div>
            <div className="stat-card-subtitle">Captured via Razorpay</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Negotiation Savings</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{totalSaved.toLocaleString()}</div>
            <div className="stat-card-subtitle">Saved via autonomous AI bidding</div>
          </div>
        </div>
      )}

      {safeOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Purchases Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Go to the <strong>AI Buyer</strong> workspace and make your first autonomous purchase!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {safeOrders.map((order) => {
            const finalPrice = order.negotiated_amount || order.total_amount;
            const savings = order.negotiated_amount ? Math.max(0, order.total_amount - order.negotiated_amount) : 0;
            const savingsPercent = savings > 0 ? Math.round((savings / order.total_amount) * 100) : 0;

            return (
              <div
                key={order.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' }}
                onClick={() => setSelectedOrder(order)}
              >
                {/* Product Photo & Header */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                  {order.product_image && (
                    <img
                      src={order.product_image}
                      alt={order.product_title || 'Product'}
                      style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="badge badge-green" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={11} /> Delivered
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.product_title || 'Autonomous Purchase Item'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Store size={12} /> {order.merchant_name || 'Verified Merchant'}
                    </div>
                  </div>
                </div>

                {/* Price & Savings */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>₹{finalPrice.toLocaleString()}</span>
                    {savings > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 6 }}>
                        ₹{order.total_amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {savings > 0 && (
                    <span className="badge badge-green" style={{ fontSize: 11 }}>
                      <Tag size={10} style={{ marginRight: 3 }} /> Saved ₹{savings} ({savingsPercent}%)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CreditCard size={13} />
                    <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{order.payment_method || 'CARD'}</span>
                  </div>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={13} /> View Invoice <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Bill / Tax Invoice Modal Popup */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="receipt-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                  RX
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Tax Invoice / Order Receipt</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>RazorX Autonomous AI Commerce</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: 34, height: 34, padding: 0, borderRadius: '50%' }}
                onClick={() => setSelectedOrder(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="receipt-body">
              {/* Order Meta Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Order ID</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{selectedOrder.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Razorpay Payment ID</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {selectedOrder.payment?.razorpay_payment_id || selectedOrder.razorpay_order_id || 'pay_simulated_live'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Date & Time</div>
                  <div style={{ fontSize: 12 }}>{new Date(selectedOrder.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Delivery Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 700, fontSize: 12 }}>
                    <CheckCircle2 size={13} /> Delivered
                  </div>
                </div>
              </div>

              {/* Merchant Details */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fulfilling Merchant</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedOrder.merchant_name || 'Verified Merchant'}</div>
                </div>
                <span className="badge badge-blue">Verified Merchant</span>
              </div>

              {/* Itemized Line Items */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Item Description</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  {selectedOrder.product_image && (
                    <img
                      src={selectedOrder.product_image}
                      alt={selectedOrder.product_title}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedOrder.product_title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: 1 • Direct Autonomous Settlement</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    ₹{(selectedOrder.negotiated_amount || selectedOrder.total_amount).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Bill Calculations */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Catalog Original Price</span>
                  <span style={{ fontWeight: 600 }}>₹{selectedOrder.total_amount.toLocaleString()}</span>
                </div>

                {selectedOrder.negotiated_amount && selectedOrder.negotiated_amount < selectedOrder.total_amount && (
                  <div className="receipt-row" style={{ color: 'var(--success)' }}>
                    <span>AI Negotiated Discount</span>
                    <span style={{ fontWeight: 700 }}>-₹{(selectedOrder.total_amount - selectedOrder.negotiated_amount).toLocaleString()}</span>
                  </div>
                )}

                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal (Taxable Value)</span>
                  <span style={{ fontWeight: 600 }}>₹{(Math.round((selectedOrder.negotiated_amount || selectedOrder.total_amount) / 1.18)).toLocaleString()}</span>
                </div>

                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Integrated GST (18%)</span>
                  <span style={{ fontWeight: 600 }}>₹{((selectedOrder.negotiated_amount || selectedOrder.total_amount) - Math.round((selectedOrder.negotiated_amount || selectedOrder.total_amount) / 1.18)).toLocaleString()}</span>
                </div>

                <div className="receipt-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 6, fontSize: 16 }}>
                  <span style={{ fontWeight: 800 }}>Total Paid Amount</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: 18 }}>
                    ₹{(selectedOrder.negotiated_amount || selectedOrder.total_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cryptographic Trust & Verification Badge */}
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 20, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={14} /> Cryptographic Proof & Ledger Integrity
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  This transaction was verified through an Ed25519 deterministic policy authorization and sealed into the tamper-evident SHA-256 audit ledger.
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={15} /> Print / Save Invoice
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
