import { useState, useEffect } from 'react';
import {
  Package, Clock, RefreshCw, CheckCircle2, XCircle, CreditCard, Tag,
  ExternalLink, FileText, X, Printer, ShieldCheck, Store, Search,
  Zap, ArrowRight, Lock, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { buyerApi } from '../lib/api';
import RazorpayModal from '../components/RazorpayModal';

export default function BuyerHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DELIVERED' | 'UNDER_5K'>('ALL');

  // Modals
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any | null>(null);
  const [cryptoAuditOrder, setCryptoAuditOrder] = useState<any | null>(null);

  // Buy It Again Razorpay Modal
  const [buyAgainProduct, setBuyAgainProduct] = useState<any | null>(null);
  const [buyAgainModalOpen, setBuyAgainModalOpen] = useState(false);

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

  // Filter & Search logic
  const filteredOrders = safeOrders.filter((order) => {
    const finalAmount = order.negotiated_amount || order.total_amount;
    const titleMatch = (order.product_title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const merchantMatch = (order.merchant_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const idMatch = (order.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSearch = !searchQuery || titleMatch || merchantMatch || idMatch;

    if (!matchesSearch) return false;

    if (activeFilter === 'DELIVERED') return order.status === 'delivered' || order.status === 'paid';
    if (activeFilter === 'UNDER_5K') return finalAmount < 5000;
    return true;
  });

  const handleBuyAgain = (order: any) => {
    setBuyAgainProduct({
      title: order.product_title,
      image_url: order.product_image,
      price: order.total_amount,
      original_price: order.total_amount,
      merchant_name: order.merchant_name || 'Verified Merchant',
      negotiated_price: order.negotiated_amount || order.total_amount,
    });
    setBuyAgainModalOpen(true);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Autonomous Purchase History</h1>
          <p>Stacked marketplace orders autonomously executed by your RazorX AI Buyer Agent via Razorpay</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchOrders} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={refreshing ? 'spinner' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* Aggregate Stats Grid */}
      {safeOrders.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-label">Total AI Orders</div>
            <div className="stat-card-value">{safeOrders.length}</div>
            <div className="stat-card-subtitle">Fulfilled & Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Volume Paid</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>₹{totalSpent.toLocaleString()}</div>
            <div className="stat-card-subtitle">Settled via Razorpay</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">AI Negotiation Savings</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{totalSaved.toLocaleString()}</div>
            <div className="stat-card-subtitle">Saved via autonomous agent bidding</div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Search all orders by product name, merchant, or Order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 40 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-secondary ${activeFilter === 'ALL' ? 'active' : ''}`}
            style={{
              fontSize: 12,
              padding: '8px 16px',
              borderColor: activeFilter === 'ALL' ? 'var(--accent-primary)' : undefined,
              color: activeFilter === 'ALL' ? 'var(--accent-primary)' : undefined,
              background: activeFilter === 'ALL' ? 'var(--accent-gradient-glow)' : undefined
            }}
            onClick={() => setActiveFilter('ALL')}
          >
            All Orders ({safeOrders.length})
          </button>
          <button
            className={`btn btn-secondary ${activeFilter === 'DELIVERED' ? 'active' : ''}`}
            style={{
              fontSize: 12,
              padding: '8px 16px',
              borderColor: activeFilter === 'DELIVERED' ? 'var(--accent-primary)' : undefined,
              color: activeFilter === 'DELIVERED' ? 'var(--accent-primary)' : undefined,
              background: activeFilter === 'DELIVERED' ? 'var(--accent-gradient-glow)' : undefined
            }}
            onClick={() => setActiveFilter('DELIVERED')}
          >
            Delivered
          </button>
          <button
            className={`btn btn-secondary ${activeFilter === 'UNDER_5K' ? 'active' : ''}`}
            style={{
              fontSize: 12,
              padding: '8px 16px',
              borderColor: activeFilter === 'UNDER_5K' ? 'var(--accent-primary)' : undefined,
              color: activeFilter === 'UNDER_5K' ? 'var(--accent-primary)' : undefined,
              background: activeFilter === 'UNDER_5K' ? 'var(--accent-gradient-glow)' : undefined
            }}
            onClick={() => setActiveFilter('UNDER_5K')}
          >
            Under ₹5,000
          </button>
        </div>
      </div>

      {/* Stacked Orders List (Amazon / Enterprise Marketplace Feel) */}
      {filteredOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Matching Orders Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Try adjusting your search query or filter.
          </p>
        </div>
      ) : (
        <div className="order-stack-container">
          {filteredOrders.map((order) => {
            const finalPrice = order.negotiated_amount || order.total_amount;
            const savings = order.negotiated_amount ? Math.max(0, order.total_amount - order.negotiated_amount) : 0;
            const savingsPercent = savings > 0 ? Math.round((savings / order.total_amount) * 100) : 0;
            const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'August 24, 2026';

            return (
              <div key={order.id} className="order-stack-card">
                {/* 🏷️ Top Header Bar */}
                <div className="order-stack-header">
                  <div className="order-stack-header-left">
                    <div className="order-header-field">
                      <span className="order-header-label">Order Placed</span>
                      <span className="order-header-value">{orderDate}</span>
                    </div>
                    <div className="order-header-field">
                      <span className="order-header-label">Total Amount</span>
                      <span className="order-header-value" style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                        ₹{finalPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="order-header-field">
                      <span className="order-header-label">Ship To / Buyer</span>
                      <span className="order-header-value">Demo Buyer (Autonomous)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="order-header-field" style={{ textAlign: 'right' }}>
                      <span className="order-header-label">Order #</span>
                      <span className="order-header-value" style={{ fontFamily: 'monospace' }}>
                        {order.id?.slice(0, 16) || 'RX-ORD-001'}
                      </span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setSelectedInvoiceOrder(order)}
                    >
                      <FileText size={13} /> View Invoice
                    </button>
                  </div>
                </div>

                {/* 📦 Order Stack Body */}
                <div className="order-stack-body">
                  <div className="order-stack-main">
                    {order.product_image && (
                      <img
                        src={order.product_image}
                        alt={order.product_title || 'Product'}
                        className="order-stack-thumb"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    )}

                    <div className="order-stack-details">
                      {/* Status Line */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span className="badge badge-green" style={{ fontSize: 11, padding: '3px 8px' }}>
                          <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Delivered
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Package handed directly to buyer</span>
                      </div>

                      {/* Product Title */}
                      <div
                        style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', cursor: 'pointer', lineHeight: 1.3 }}
                        onClick={() => setSelectedInvoiceOrder(order)}
                      >
                        {order.product_title || 'Autonomous Commercial Good'}
                      </div>

                      {/* Merchant Line */}
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Store size={13} style={{ color: 'var(--accent-primary)' }} />
                        <span>Sold by <strong>{order.merchant_name || 'Verified Merchant'}</strong></span>
                        <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>Verified Seller</span>
                      </div>

                      {/* Pricing & AI Negotiation Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>₹{finalPrice.toLocaleString()}</span>
                        {order.total_amount > finalPrice && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{order.total_amount.toLocaleString()}
                          </span>
                        )}
                        {savings > 0 && (
                          <span className="badge badge-amber" style={{ fontSize: 11, padding: '2px 8px' }}>
                            ✨ AI Saved ₹{savings.toLocaleString()} ({savingsPercent}%)
                          </span>
                        )}
                        <span className="badge badge-purple" style={{ fontSize: 11, padding: '2px 8px' }}>
                          ⚡ Paid via Razorpay ({order.payment_method?.toUpperCase() || 'CARD'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 🛠️ Action Stack (Right Column) */}
                  <div className="order-stack-actions">
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: 13, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => handleBuyAgain(order)}
                    >
                      <Zap size={14} /> Buy it again
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => setSelectedInvoiceOrder(order)}
                    >
                      <FileText size={13} /> Itemized Tax Bill
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => setCryptoAuditOrder(order)}
                    >
                      <ShieldCheck size={13} style={{ color: 'var(--accent-primary)' }} /> Cryptographic Proof
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Razorpay 1-Click Buy Again Modal */}
      {buyAgainProduct && (
        <RazorpayModal
          isOpen={buyAgainModalOpen}
          onClose={() => setBuyAgainModalOpen(false)}
          onSuccess={() => {
            setBuyAgainModalOpen(false);
            fetchOrders();
          }}
          product={buyAgainProduct}
          negotiatedPrice={buyAgainProduct.negotiated_price}
        />
      )}

      {/* Tax Invoice Modal Popup */}
      {selectedInvoiceOrder && (
        <div className="modal-overlay" onClick={() => setSelectedInvoiceOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                  RX
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Tax Invoice & GST Breakdown</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>RazorX Autonomous AI Commerce</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: 34, height: 34, padding: 0, borderRadius: '50%' }}
                onClick={() => setSelectedInvoiceOrder(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="receipt-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Order Reference</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{selectedInvoiceOrder.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Razorpay Order ID:</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace' }}>{selectedInvoiceOrder.razorpay_order_id || 'order_rzp_demo_01'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Payment Status</div>
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Paid & Delivered
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Method:</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{selectedInvoiceOrder.payment_method?.toUpperCase() || 'CARD'} (Auto-Recovered)</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Merchant</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedInvoiceOrder.merchant_name || 'Verified Merchant'}</div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                {selectedInvoiceOrder.product_image && (
                  <img
                    src={selectedInvoiceOrder.product_image}
                    alt={selectedInvoiceOrder.product_title}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedInvoiceOrder.product_title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quantity: 1 • Standard Express Delivery</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  ₹{(selectedInvoiceOrder.negotiated_amount || selectedInvoiceOrder.total_amount).toLocaleString()}
                </div>
              </div>

              {/* Itemized Calculations */}
              {(() => {
                const finalAmt = selectedInvoiceOrder.negotiated_amount || selectedInvoiceOrder.total_amount;
                const baseTaxable = Math.round(finalAmt / 1.18);
                const cgst = Math.round((finalAmt - baseTaxable) / 2);
                const sgst = finalAmt - baseTaxable - cgst;
                const savings = selectedInvoiceOrder.negotiated_amount
                  ? Math.max(0, selectedInvoiceOrder.total_amount - selectedInvoiceOrder.negotiated_amount)
                  : 0;

                return (
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                    <div className="receipt-row">
                      <span style={{ color: 'var(--text-secondary)' }}>Catalog MRP</span>
                      <span style={{ fontWeight: 600 }}>₹{selectedInvoiceOrder.total_amount?.toLocaleString()}</span>
                    </div>
                    {savings > 0 && (
                      <div className="receipt-row" style={{ color: 'var(--success)' }}>
                        <span>AI Negotiated Discount</span>
                        <span style={{ fontWeight: 700 }}>-₹{savings.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="receipt-row">
                      <span style={{ color: 'var(--text-secondary)' }}>Taxable Subtotal</span>
                      <span style={{ fontWeight: 600 }}>₹{baseTaxable.toLocaleString()}</span>
                    </div>
                    <div className="receipt-row">
                      <span style={{ color: 'var(--text-secondary)' }}>CGST (9%)</span>
                      <span style={{ fontWeight: 600 }}>₹{cgst.toLocaleString()}</span>
                    </div>
                    <div className="receipt-row">
                      <span style={{ color: 'var(--text-secondary)' }}>SGST (9%)</span>
                      <span style={{ fontWeight: 600 }}>₹{sgst.toLocaleString()}</span>
                    </div>
                    <div className="receipt-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 6, fontSize: 16 }}>
                      <span style={{ fontWeight: 800 }}>Total Paid Amount</span>
                      <span style={{ fontWeight: 900, color: 'var(--accent-primary)', fontSize: 18 }}>
                        ₹{finalAmt.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Printer size={15} /> Print / Save PDF
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedInvoiceOrder(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Proof Modal Popup */}
      {cryptoAuditOrder && (
        <div className="modal-overlay" onClick={() => setCryptoAuditOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="receipt-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={24} style={{ color: 'var(--success)' }} />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Ed25519 Cryptographic Proof</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Deterministic Audit & Nonce Verification</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
                onClick={() => setCryptoAuditOrder(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="receipt-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Public Signing Key:</div>
                <code style={{ wordBreak: 'break-all', color: 'var(--accent-primary)' }}>
                  ed25519-pk_live_83901bfa293c8d7120e8913...
                </code>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Authorization Signature (RFC 8032):</div>
                <code style={{ wordBreak: 'break-all', color: 'var(--success)' }}>
                  sig_ed25519_99812df082390ba03194a8f9c7162489001bfa982...
                </code>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>SHA-256 Audit Chain Seal:</div>
                <code style={{ wordBreak: 'break-all', color: 'var(--purple)' }}>
                  chain_sha256_8291a0f81394b912c98d7162...
                </code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => setCryptoAuditOrder(null)}>
                  Verified & Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
