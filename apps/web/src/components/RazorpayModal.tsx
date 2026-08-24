import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, CreditCard, QrCode, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, X, Zap, Lock, Sparkles, Building2, Store
} from 'lucide-react';

interface RazorpayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderData: any) => void;
  product: {
    title: string;
    image_url?: string;
    price: number;
    original_price?: number;
    merchant_name: string;
  };
  negotiatedPrice?: number;
  razorpayOrderId?: string;
  authorizationId?: string;
}

export default function RazorpayModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  negotiatedPrice,
  razorpayOrderId,
  authorizationId,
}: RazorpayModalProps) {
  const [stage, setStage] = useState<'selecting' | 'processing' | 'recovering' | 'success'>('selecting');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [progress, setProgress] = useState(0);

  const finalAmount = negotiatedPrice || product.price;
  const savings = product.original_price && product.original_price > finalAmount
    ? product.original_price - finalAmount
    : (product.price > finalAmount ? product.price - finalAmount : 0);

  useEffect(() => {
    if (isOpen) {
      setStage('selecting');
      setProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePayNow = () => {
    setStage('processing');
    setProgress(20);

    // Simulate real Razorpay checkout flow with autonomous recovery
    setTimeout(() => {
      setProgress(50);
      setStage('recovering'); // Show automatic recovery from simulated UPI timeout

      setTimeout(() => {
        setProgress(85);
        setTimeout(() => {
          setProgress(100);
          setStage('success');
          setTimeout(() => {
            onSuccess({
              id: `ord_${Date.now().toString(36)}`,
              product_title: product.title,
              product_image: product.image_url,
              merchant_name: product.merchant_name,
              total_amount: product.original_price || product.price,
              negotiated_amount: finalAmount,
              currency: 'INR',
              status: 'delivered',
              payment_method: 'card',
              razorpay_order_id: razorpayOrderId || `order_rzp_${Date.now().toString(36)}`,
              payment: {
                razorpay_payment_id: `pay_${Date.now().toString(36)}`,
                status: 'captured',
                method: 'card',
                amount: finalAmount,
              },
              created_at: new Date().toISOString(),
            });
          }, 1200);
        }, 1200);
      }, 1400);
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {/* Razorpay Signature Blue Header */}
        <div style={{ background: '#0a85ea', padding: '20px 24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#ffffff', width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#0a85ea', fontSize: 16 }}>
              R
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>Razorpay Trusted Business</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>Autonomous AI Checkout Gateway</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Order Amount & Merchant Banner */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Merchant</div>
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Store size={14} style={{ color: '#0a85ea' }} /> {product.merchant_name}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Amount to Pay</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
              ₹{finalAmount.toLocaleString()}
            </div>
            {savings > 0 && (
              <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 6px' }}>
                Saved ₹{savings.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {stage === 'selecting' && (
            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <ShieldCheck size={12} style={{ color: 'var(--success)' }} /> Ed25519 Deterministic Policy Authorized
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                Select Payment Method
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <div
                  className={`card ${selectedMethod === 'upi' ? 'active' : ''}`}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: selectedMethod === 'upi' ? '2px solid #0a85ea' : '1px solid var(--border)',
                    background: selectedMethod === 'upi' ? 'rgba(10, 133, 234, 0.08)' : 'var(--bg-card)'
                  }}
                  onClick={() => setSelectedMethod('upi')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <QrCode size={20} style={{ color: '#0a85ea' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>UPI / QR Code</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fast autonomous instant payment</div>
                    </div>
                  </div>
                  <span className="badge badge-blue">Preferred</span>
                </div>

                <div
                  className={`card ${selectedMethod === 'card' ? 'active' : ''}`}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: selectedMethod === 'card' ? '2px solid #0a85ea' : '1px solid var(--border)',
                    background: selectedMethod === 'card' ? 'rgba(10, 133, 234, 0.08)' : 'var(--bg-card)'
                  }}
                  onClick={() => setSelectedMethod('card')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CreditCard size={20} style={{ color: 'var(--accent-secondary)' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Credit / Debit Card</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Authorized Fallback (Visa/Mastercard)</div>
                    </div>
                  </div>
                  <span className="badge badge-purple">Fallback</span>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800, background: '#0a85ea', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={handlePayNow}
              >
                <Lock size={16} /> Pay ₹{finalAmount.toLocaleString()} via Razorpay
              </button>
            </div>
          )}

          {stage === 'processing' && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div className="spinner" style={{ width: 44, height: 44, border: '4px solid var(--border)', borderTopColor: '#0a85ea', borderRadius: '50%', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Submitting to Razorpay Gateway</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Initiating primary UPI transaction with Ed25519 authorization proof...
              </p>
            </div>
          )}

          {stage === 'recovering' && (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--warning)' }}>
                <AlertTriangle size={26} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--warning)' }}>
                Primary UPI Timeout Detected
              </h3>
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: 12, margin: '14px 0', fontSize: 12, textAlign: 'left', lineHeight: 1.5 }}>
                <strong>🔄 Autonomous Recovery Active:</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  Switching to pre-authorized <strong>Card Method</strong> using signed cryptographic authorization token <code>{authorizationId?.slice(0, 16) || 'auth_ed25519'}...</code>
                </div>
              </div>
              <div className="spinner" style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', margin: '10px auto 0' }} />
            </div>
          )}

          {stage === 'success' && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--success)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, color: 'var(--success)' }}>
                Payment Captured Successfully!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                ₹{finalAmount.toLocaleString()} captured via Auto-Recovered Card. Loading confirmation...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: 'var(--bg-secondary)', padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Lock size={12} /> 256-Bit SSL Encrypted
          </span>
          <span>Powered by Razorpay & RazorX</span>
        </div>
      </div>
    </div>
  );
}
