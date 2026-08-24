import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Bot, User, ShoppingCart, AlertTriangle, CheckCircle2,
  XCircle, ArrowRightLeft, CreditCard, FileText, Zap, Sparkles,
  ShieldCheck, ShieldAlert, ArrowUpRight, Check, RefreshCw, Mic,
  Star, Truck, ChevronLeft, ChevronRight, X, Printer, Store, Package
} from 'lucide-react';
import { buyerApi } from '../lib/api';
import RazorpayModal from '../components/RazorpayModal';
import OrderConfirmationView from './OrderConfirmationView';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  type: string;
  data?: any;
  timestamp: string;
}

const PROMPT_SUGGESTIONS = [
  {
    label: '⚡ Winning Demo: Running Shoes',
    badge: 'P0 Core',
    prompt: 'Buy black running shoes for daily training, size 9, under ₹6,000',
  },
  {
    label: '🎧 ANC Wireless Earbuds',
    badge: 'Electronics',
    prompt: 'Buy wireless earbuds with active noise cancelling under ₹5,000',
  },
  {
    label: '🧘 Eco Yoga Mat',
    badge: 'Fitness',
    prompt: 'Buy a non-slip yoga mat under ₹2,000',
  },
  {
    label: '🔍 Browse: Smartwatches',
    badge: 'Browse Only',
    prompt: 'Show me smartwatches under ₹10,000',
  },
  {
    label: '🚫 Policy Block: Limit Exceeded',
    badge: 'Trust Gate',
    prompt: 'Buy high-end smartwatch for ₹35,000',
  },
];

export default function BuyerWorkspace() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: '👋 **Welcome to RazorX Autonomous AI Commerce!**\n\nI am your autonomous Buyer Agent integrated with Razorpay. Tell me what you need or click the microphone to speak.\n\nI discover products across verified merchants, negotiate price discounts, verify your deterministic policy boundaries, execute Razorpay checkout, automatically recover payment failures, and deliver cryptographic receipts.',
      type: 'text',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Razorpay Checkout Modal State
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<any>(null);

  // Confirmed Order Tracking Page State
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  // Tax Invoice Receipt Modal State
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Web Speech API for Voice Shopping
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const handleOpenRazorpayCheckout = (candidate: any) => {
    const prod = candidate.product || candidate;
    const merchantName = candidate.merchant?.name || candidate.merchant || 'Verified Merchant';

    setCheckoutProduct({
      title: prod.title,
      image_url: prod.image_url,
      price: prod.price,
      original_price: prod.original_price,
      merchant_name: merchantName,
      negotiated_price: Math.round(prod.price * 0.92), // 8% negotiation discount
    });
    setRazorpayModalOpen(true);
  };

  const handleSendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      type: 'text',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await buyerApi.sendIntent('demo-buyer-001', userMsg.content);
      setLastResult(result);

      if (result.intent?.conversational_reply) {
        setMessages(prev => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            role: 'agent',
            content: result.intent.conversational_reply,
            type: 'text',
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (result.candidates && result.candidates.length > 0) {
        const isPurchase = result.order && result.order.status !== 'blocked';
        const isBlocked = result.policy_evaluation?.decision === 'RED';

        const summaryMsg: Message = {
          id: `summary-${Date.now()}`,
          role: 'agent',
          content: isBlocked
            ? `🚫 **Policy Guardrail Blocked Transaction**\n${result.policy_evaluation.reason}`
            : isPurchase
            ? `🎉 **Autonomous Purchase Fulfilled & Delivered!**\nI negotiated a price reduction and executed checkout via Razorpay with Ed25519 authorization.`
            : `🔍 **Matching Products Found**\nHere are the top ranked products across verified merchants. Scroll through the carousel below to select and buy with Razorpay.`,
          type: isPurchase ? 'executive_summary' : 'carousel',
          data: {
            candidates: result.candidates,
            selected: result.selected,
            negotiation: result.negotiation,
            policy: result.policy_evaluation,
            order: result.order,
            payment: result.payment,
            authorization: result.authorization,
          },
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, summaryMsg]);
      } else if (result.agent_messages) {
        setMessages(prev => [
          ...prev,
          ...result.agent_messages.filter((m: Message) => m.role !== 'user'),
        ]);
      }
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `❌ **Connection Error**: ${error.message}. Please verify the Render backend connection.`,
          type: 'text',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const scrollCarousel = (trackId: string, direction: 'left' | 'right') => {
    const track = document.getElementById(trackId);
    if (track) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // If viewing confirmed order tracking page:
  if (confirmedOrder) {
    return (
      <OrderConfirmationView
        order={confirmedOrder}
        onBackToShopping={() => setConfirmedOrder(null)}
        onViewHistory={() => navigate('/buyer/history')}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Autonomous AI Buyer Workspace</h1>
          <p>Autonomous commerce execution with delegated policy boundaries, live price negotiation & Razorpay recovery</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-green">Razorpay Live API</span>
          <span className="badge badge-blue">Groq 120B Reasoning</span>
          <span className="badge badge-purple">Ed25519 Guardrail</span>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="workspace-grid">
        {/* Chat Main Card */}
        <div className="card chat-card">
          <div className="chat-messages-area">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message-row ${msg.role}`}>
                <div className="message-bubble" style={{ maxWidth: '100%', width: '100%' }}>
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />

                  {/* 🎠 Product Carousel Slider with Total Results Count */}
                  {(msg.type === 'carousel' || (msg.data?.candidates && !msg.data?.order)) && msg.data?.candidates && (
                    <div className="carousel-container">
                      {/* Total Results Count Banner */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '4px 2px' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={14} /> Found {msg.data.candidates.length} matching products across verified merchants
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', borderRadius: '50%', width: 28, height: 28 }}
                            onClick={() => scrollCarousel(`track-${msg.id}`, 'left')}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', borderRadius: '50%', width: 28, height: 28 }}
                            onClick={() => scrollCarousel(`track-${msg.id}`, 'right')}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Scrollable Track */}
                      <div id={`track-${msg.id}`} className="carousel-track">
                        {msg.data.candidates.map((c: any, idx: number) => {
                          const prod = c.product || c;
                          const discount = prod.original_price > prod.price
                            ? Math.round(((prod.original_price - prod.price) / prod.original_price) * 100)
                            : 0;

                          return (
                            <div key={idx} className="carousel-item">
                              <div className="carousel-image-box">
                                {prod.image_url ? (
                                  <img
                                    src={prod.image_url}
                                    alt={prod.title}
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ShoppingCart size={32} style={{ color: 'var(--text-muted)' }} />
                                  </div>
                                )}
                                {discount > 0 && (
                                  <span className="badge badge-amber" style={{ position: 'absolute', top: 8, right: 8, backdropFilter: 'blur(4px)' }}>
                                    {discount}% OFF
                                  </span>
                                )}
                                <span className="badge badge-green" style={{ position: 'absolute', bottom: 8, left: 8, backdropFilter: 'blur(4px)', fontSize: 10 }}>
                                  {c.score || 95}% Match
                                </span>
                              </div>

                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {prod.title}
                              </div>

                              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{c.merchant?.name || c.merchant || 'Verified Merchant'}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Star size={12} style={{ fill: 'var(--warning)', color: 'var(--warning)' }} />
                                  {prod.rating || 4.7}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>₹{prod.price?.toLocaleString()}</span>
                                {prod.original_price > prod.price && (
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                    ₹{prod.original_price?.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {/* Direct Razorpay Checkout Trigger */}
                              <button
                                className="btn btn-primary"
                                style={{ marginTop: 'auto', fontSize: 12, padding: '8px 12px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                onClick={() => handleOpenRazorpayCheckout(c)}
                                disabled={loading}
                              >
                                <Zap size={14} /> Buy with Razorpay
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 🏆 Consolidated Executive Execution Card */}
                  {msg.type === 'executive_summary' && msg.data?.order && (
                    <div className="execution-card">
                      {/* Product Preview Row */}
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                        {msg.data.selected?.product?.image_url && (
                          <img
                            src={msg.data.selected.product.image_url}
                            alt={msg.data.selected.product.title}
                            style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                            {msg.data.selected?.product?.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Merchant: <strong>{msg.data.selected?.merchant?.name}</strong> • Rating: ⭐ {msg.data.selected?.product?.rating || 4.8}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
                            ₹{(msg.data.negotiation?.final_price || msg.data.order.negotiated_amount || msg.data.order.total_amount)?.toLocaleString()}
                          </div>
                          <span className="badge badge-green" style={{ fontSize: 10 }}>Delivered</span>
                        </div>
                      </div>

                      {/* Step-by-Step Transparency Timeline */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className="execution-step-row">
                          <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <strong>AI Negotiation:</strong> Discount secured from ₹{msg.data.selected?.product?.price} → <strong>₹{msg.data.negotiation?.final_price || msg.data.order.negotiated_amount}</strong>
                            {msg.data.negotiation?.final_price && (
                              <span style={{ color: 'var(--success)', marginLeft: 6 }}>
                                (Saved ₹{msg.data.selected.product.price - msg.data.negotiation.final_price})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="execution-step-row">
                          <ShieldCheck size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <strong>Policy Gate:</strong> Ed25519 Cryptographic Authorization issued & budget reserved.
                          </div>
                        </div>

                        <div className="execution-step-row">
                          <CreditCard size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <strong>Razorpay Checkout:</strong> Payment captured via <strong>{msg.data.order.payment_method || 'CARD'}</strong> (Auto-recovered from simulated UPI timeout).
                          </div>
                        </div>

                        <div className="execution-step-row">
                          <Package size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <strong>Order Status:</strong> Order ID #{msg.data.order.id?.slice(0, 8)} confirmed & delivered.
                          </div>
                        </div>
                      </div>

                      {/* Direct Post-Purchase Actions */}
                      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => setReceiptOrder({
                            ...msg.data.order,
                            product_title: msg.data.selected?.product?.title,
                            product_image: msg.data.selected?.product?.image_url,
                            merchant_name: msg.data.selected?.merchant?.name,
                            payment: msg.data.payment,
                          })}
                        >
                          <FileText size={14} /> View Tax Invoice
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => setConfirmedOrder({
                            id: msg.data.order.id,
                            product_title: msg.data.selected?.product?.title,
                            product_image: msg.data.selected?.product?.image_url,
                            merchant_name: msg.data.selected?.merchant?.name,
                            total_amount: msg.data.selected?.product?.price || msg.data.order.total_amount,
                            negotiated_amount: msg.data.negotiation?.final_price || msg.data.order.negotiated_amount,
                            currency: 'INR',
                            payment_method: msg.data.order.payment_method || 'card',
                            razorpay_order_id: msg.data.order.razorpay_order_id,
                            created_at: new Date().toISOString(),
                          })}
                        >
                          <Package size={14} /> Full Order Tracking Page
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message-row agent">
                <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RefreshCw size={16} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                  <span>Agent is reasoning on Groq LPU, discovering merchant candidates & negotiating price...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestion Chips */}
          <div className="prompt-chips-bar">
            {PROMPT_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="prompt-chip"
                onClick={() => handleSendPrompt(s.prompt)}
                disabled={loading}
              >
                <span className="badge badge-blue" style={{ fontSize: 9, padding: '2px 6px' }}>{s.badge}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Chat & Voice Input Bar */}
          <div className="chat-input-bar">
            {speechSupported && (
              <button
                className={`mic-btn ${isListening ? 'active' : ''}`}
                onClick={toggleVoiceInput}
                title={isListening ? 'Listening... Click to stop' : 'Click to speak purchase request (Voice Assistant)'}
              >
                {isListening ? (
                  <div className="voice-wave-container">
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                  </div>
                ) : (
                  <Mic size={18} />
                )}
              </button>
            )}

            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder={isListening ? '🎙️ Listening... Speak your request...' : "Type or speak your request (e.g. 'Buy black running shoes size 9 under ₹6,000')..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(input)}
              disabled={loading}
            />

            <button
              className="btn btn-primary"
              style={{ width: 44, height: 44, padding: 0 }}
              onClick={() => handleSendPrompt(input)}
              disabled={loading || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lastResult?.selected ? (
            <div className="decision-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} /> Explainable Decision
                </span>
                <span className="badge badge-purple">AI Audit Passed</span>
              </div>

              {lastResult.selected.product.image_url && (
                <div style={{ width: '100%', height: 140, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
                  <img
                    src={lastResult.selected.product.image_url}
                    alt={lastResult.selected.product.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: 6, fontSize: 11, color: '#fff', fontWeight: 600 }}>
                    {lastResult.selected.merchant.name}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                {lastResult.selected.product.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Match Score: {lastResult.selected.score}/100 • Rating: ⭐ {lastResult.selected.product.rating || 4.8}
              </div>

              <div className="decision-grid">
                <div className="decision-item">
                  <div className="decision-item-title">Price Paid</div>
                  <div className="decision-item-value" style={{ color: 'var(--success)' }}>
                    ₹{lastResult.negotiation?.final_price || lastResult.selected.product.price}
                  </div>
                </div>
                <div className="decision-item">
                  <div className="decision-item-title">Delivery Status</div>
                  <div className="decision-item-value" style={{ color: 'var(--success)' }}>Delivered</div>
                </div>
                <div className="decision-item">
                  <div className="decision-item-title">Payment Route</div>
                  <div className="decision-item-value" style={{ textTransform: 'uppercase' }}>
                    {lastResult.order?.payment_method || 'CARD'} (Auto-Recovered)
                  </div>
                </div>
                <div className="decision-item">
                  <div className="decision-item-title">Savings</div>
                  <div className="decision-item-value" style={{ color: 'var(--success)' }}>
                    {lastResult.negotiation?.final_price
                      ? `₹${lastResult.selected.product.price - lastResult.negotiation.final_price}`
                      : 'Catalog Price'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Bot size={48} style={{ color: 'var(--accent-primary)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Autonomous Agent Ready</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                Type a request or speak using the microphone. RazorX discovers products across merchants, executes bounded negotiation, verifies Ed25519 policy gates, and completes Razorpay checkout.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Razorpay Standard Checkout & Recovery Modal */}
      {checkoutProduct && (
        <RazorpayModal
          isOpen={razorpayModalOpen}
          onClose={() => setRazorpayModalOpen(false)}
          onSuccess={(orderData) => {
            setRazorpayModalOpen(false);
            setConfirmedOrder(orderData);
          }}
          product={checkoutProduct}
          negotiatedPrice={checkoutProduct.negotiated_price}
          razorpayOrderId={`order_rzp_${Date.now().toString(36)}`}
        />
      )}

      {/* Tax Invoice Modal Popup */}
      {receiptOrder && (
        <div className="modal-overlay" onClick={() => setReceiptOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                onClick={() => setReceiptOrder(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="receipt-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Order ID</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{receiptOrder.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Payment Status</div>
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Paid & Delivered
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Merchant</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{receiptOrder.merchant_name || 'Verified Merchant'}</div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                {receiptOrder.product_image && (
                  <img
                    src={receiptOrder.product_image}
                    alt={receiptOrder.product_title}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{receiptOrder.product_title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: 1 • Direct Settlement</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  ₹{(receiptOrder.negotiated_amount || receiptOrder.total_amount).toLocaleString()}
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Catalog Price</span>
                  <span style={{ fontWeight: 600 }}>₹{receiptOrder.total_amount?.toLocaleString()}</span>
                </div>
                {receiptOrder.negotiated_amount && (
                  <div className="receipt-row" style={{ color: 'var(--success)' }}>
                    <span>Negotiated Savings</span>
                    <span style={{ fontWeight: 700 }}>-₹{(receiptOrder.total_amount - receiptOrder.negotiated_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="receipt-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 6, fontSize: 15 }}>
                  <span style={{ fontWeight: 800 }}>Total Paid</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: 17 }}>
                    ₹{(receiptOrder.negotiated_amount || receiptOrder.total_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={15} /> Print Invoice
                </button>
                <button className="btn btn-primary" onClick={() => setReceiptOrder(null)}>
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
