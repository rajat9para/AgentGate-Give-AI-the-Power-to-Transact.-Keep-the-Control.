import { useState, useEffect } from 'react';
import { Package, Clock, RefreshCw, CheckCircle2, XCircle, CreditCard, Tag, ExternalLink } from 'lucide-react';
import { buyerApi } from '../lib/api';

export default function BuyerHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = () => {
    setRefreshing(true);
    buyerApi.getHistory('demo-buyer-001')
      .then(setOrders)
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

  const totalSpent = orders
    .filter(o => o.status === 'paid' || o.status === 'delivered')
    .reduce((sum, o) => sum + (o.negotiated_amount || o.total_amount), 0);

  const totalSaved = orders
    .filter(o => o.negotiated_amount && (o.status === 'paid' || o.status === 'delivered'))
    .reduce((sum, o) => sum + (o.total_amount - o.negotiated_amount), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>Autonomous Purchase History</h1>
          <p>Every transaction executed by your AI Buyer Agent via Razorpay</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchOrders} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spinner' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {orders.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-label">Total AI Purchases</div>
            <div className="stat-card-value">{orders.length}</div>
            <div className="stat-card-subtitle">Transactions executed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Amount Paid</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>₹{totalSpent.toLocaleString()}</div>
            <div className="stat-card-subtitle">Through Razorpay test mode</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Negotiation Savings</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{totalSaved.toLocaleString()}</div>
            <div className="stat-card-subtitle">Saved by AI negotiation</div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Purchases Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Go to the <strong>AI Buyer</strong> workspace and make your first autonomous purchase!
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Order Records</span>
            <span className="badge badge-purple">{orders.length} orders</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Final Amount</th>
                  <th>Negotiated Savings</th>
                  <th>Razorpay Order ID</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const savings = order.negotiated_amount ? order.total_amount - order.negotiated_amount : 0;
                  return (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                        {order.id.slice(0, 12)}...
                      </td>
                      <td>
                        <span className={`badge badge-${order.status === 'paid' || order.status === 'delivered' ? 'green' : order.status === 'payment_failed' ? 'red' : 'amber'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{order.negotiated_amount || order.total_amount}
                      </td>
                      <td>
                        {savings > 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Tag size={12} /> Saved ₹{savings}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {order.razorpay_order_id || 'simulated_rzp'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} />
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
