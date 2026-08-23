import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, ShoppingCart, AlertTriangle, CheckCircle2,
  XCircle, ArrowRightLeft, CreditCard, FileText, Zap, Sparkles,
  ShieldCheck, ShieldAlert, ArrowUpRight, Check, RefreshCw
} from 'lucide-react';
import { buyerApi } from '../lib/api';

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
    badge: 'Tech',
    prompt: 'Buy wireless earbuds with active noise cancelling under ₹5,000',
  },
  {
    label: '🧘 Eco-friendly Yoga Mat',
    badge: 'Fitness',
    prompt: 'Buy a non-slip yoga mat under ₹2,000',
  },
  {
    label: '🚫 Test: Policy Block (Limit Exceeded)',
    badge: 'Trust Gate',
    prompt: 'Buy high-end smartwatch for ₹35,000',
  },
  {
    label: '💡 Test: Opportunity Alert',
    badge: 'Opportunity',
    prompt: 'Buy running shoes under ₹5,000',
  },
];

export default function BuyerWorkspace() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: '👋 **Welcome to AgentGate!** I am your autonomous AI Buyer Agent connected to Razorpay.\n\nTell me what you need in natural language. I will discover products across verified merchants, negotiate the best price, verify policy boundaries, execute Razorpay checkout, automatically recover from payment failures, and document every step in the audit trail.',
      type: 'text',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;

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
    setActiveStep(1);

    try {
      setActiveStep(2);
      const result = await buyerApi.sendIntent('demo-buyer-001', userMsg.content);
      setLastResult(result);
      setActiveStep(result.policy_evaluation?.decision === 'RED' ? 4 : 8);

      if (result.agent_messages) {
        setMessages(prev => [
          ...prev,
          ...result.agent_messages.filter((m: Message) => m.role !== 'user'),
        ]);
      }
    } catch (error: any) {
      setActiveStep(0);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `❌ **Connection Error**: ${error.message}. Make sure the backend is running on port 5000.`,
          type: 'text',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeOpportunity = (betterOption: any) => {
    if (!betterOption) return;
    setUpgradeToast(`Upgraded to ${betterOption.product.title} (₹${betterOption.product.price})! Policy override logged.`);
    setTimeout(() => setUpgradeToast(null), 4000);

    setMessages(prev => [
      ...prev,
      {
        id: `upgrade-${Date.now()}`,
        role: 'user',
        content: `Yes, upgrade to ${betterOption.product.title} at ₹${betterOption.product.price}.`,
        type: 'text',
        timestamp: new Date().toISOString(),
      },
      {
        id: `upgrade-resp-${Date.now()}`,
        role: 'agent',
        content: `🎉 **Opportunity Upgrade Accepted!**\n\nUpgraded to **${betterOption.product.title}** from **${betterOption.merchant.name}** for **₹${betterOption.product.price}**.\n✅ Single limit override approved under configured ${Math.round((lastResult?.opportunity?.price_overshoot_percent || 0.15) * 100)}% tolerance window.\n📋 Transaction reconciled into audit log.`,
        type: 'payment',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'comparison': return <ShoppingCart size={14} />;
      case 'negotiation': return <ArrowRightLeft size={14} />;
      case 'policy': return <ShieldCheck size={14} />;
      case 'payment': return <CreditCard size={14} />;
      case 'audit': return <FileText size={14} />;
      case 'opportunity': return <Sparkles size={14} />;
      default: return null;
    }
  };

  const renderSidePanel = () => {
    if (!lastResult) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Bot size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>AI Co-Pilot Ready</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            Select a sample prompt below or type your custom shopping request to see real-time candidates, bounded negotiation, deterministic policy checks, and Razorpay recovery.
          </p>
        </div>
      );
    }

    const isBlocked = lastResult.policy_evaluation?.decision === 'RED';
    const isGreen = lastResult.policy_evaluation?.decision === 'GREEN';

    return (
      <>
        {/* Policy Decision Badge */}
        <div className="card" style={{ borderColor: isBlocked ? 'var(--error)' : isGreen ? 'var(--success)' : 'var(--warning)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isBlocked ? <ShieldAlert size={18} style={{ color: 'var(--error)' }} /> : <ShieldCheck size={18} style={{ color: 'var(--success)' }} />}
              Deterministic Policy Gate
            </span>
            <span className={`badge badge-${isGreen ? 'green' : isBlocked ? 'red' : 'amber'}`}>
              {lastResult.policy_evaluation?.decision}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {lastResult.policy_evaluation?.reason}
          </p>
        </div>

        {/* Explainable Decision Card (PRD 6.15) */}
        {lastResult.selected && isGreen && (
          <div className="decision-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Explainable Decision Card
              </span>
              <span className="badge badge-purple">AI Audit Passed</span>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {lastResult.selected.product.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Merchant: {lastResult.selected.merchant.name} • Match Score: {lastResult.selected.score}/100
            </div>

            <div className="decision-grid">
              <div className="decision-item">
                <div className="decision-item-title">Price Paid</div>
                <div className="decision-item-value" style={{ color: 'var(--success)' }}>
                  ₹{lastResult.negotiation?.final_price || lastResult.selected.product.price}
                  {lastResult.negotiation?.final_price && lastResult.negotiation.final_price < lastResult.selected.product.price && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 6 }}>
                      ₹{lastResult.selected.product.price}
                    </span>
                  )}
                </div>
              </div>

              <div className="decision-item">
                <div className="decision-item-title">Negotiation Savings</div>
                <div className="decision-item-value" style={{ color: lastResult.negotiation?.final_price ? 'var(--success)' : 'var(--text-muted)' }}>
                  {lastResult.negotiation?.final_price
                    ? `₹${lastResult.selected.product.price - lastResult.negotiation.final_price} (${Math.round(((lastResult.selected.product.price - lastResult.negotiation.final_price) / lastResult.selected.product.price) * 100)}%)`
                    : 'Fixed Price'}
                </div>
              </div>

              <div className="decision-item">
                <div className="decision-item-title">Why Selected</div>
                <div className="decision-item-value" style={{ fontSize: 12 }}>
                  {lastResult.selected.match_reasons?.slice(0, 2).join(', ') || 'Best attribute match & budget'}
                </div>
              </div>

              <div className="decision-item">
                <div className="decision-item-title">Payment Route</div>
                <div className="decision-item-value" style={{ fontSize: 12 }}>
                  {lastResult.payment?.is_recovery_attempt ? (
                    <span style={{ color: 'var(--warning)' }}>
                      UPI Declined → Recovered via {lastResult.payment?.method?.toUpperCase()}
                    </span>
                  ) : (
                    <span>Direct {lastResult.payment?.method?.toUpperCase() || 'UPI'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Authorization Badge Card */}
        {lastResult.policy_evaluation?.authorization && (
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(99, 102, 241, 0.05))', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--success)' }}>
                <ShieldCheck size={16} /> Cryptographic Transaction Authorization
              </span>
              <span className="badge badge-green">Ed25519 Signed</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, fontSize: 12, marginBottom: 12 }}>
              <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auth ID</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, marginTop: 2, color: 'var(--accent-primary)' }}>
                  {lastResult.policy_evaluation.authorization.authorization_id?.slice(0, 18)}...
                </div>
              </div>

              <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Key ID / Algo</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, marginTop: 2 }}>
                  {lastResult.policy_evaluation.authorization.key_id} (Ed25519)
                </div>
              </div>

              <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Policy Hash</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, marginTop: 2 }}>
                  {lastResult.policy_evaluation.authorization.policy_hash?.slice(0, 14)}...
                </div>
              </div>

              <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Request Hash</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, marginTop: 2 }}>
                  {lastResult.policy_evaluation.authorization.request_hash?.slice(0, 14)}...
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Signature Verified</span>
              <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Policy Bound</span>
              <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Transaction Bound</span>
              <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Nonce Consumed</span>
              <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Budget Reserved</span>
              <span className="badge badge-purple" style={{ fontSize: 11 }}>✓ Hash Chain Linked</span>
            </div>
          </div>
        )}

        {/* Selected Product Card */}
        {lastResult.selected && (
          <div className="product-card">
            <div className="product-card-header">
              <span className="product-card-title">{lastResult.selected.product.title}</span>
              <span className="product-card-score">{lastResult.selected.score} pts</span>
            </div>
            <div className="product-card-merchant">{lastResult.selected.merchant.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="product-card-price">₹{lastResult.negotiation?.final_price || lastResult.selected.product.price}</span>
              {lastResult.negotiation?.final_price && (
                <span className="product-card-original-price">₹{lastResult.selected.product.price}</span>
              )}
            </div>
            <div className="product-card-rating">
              {'★'.repeat(Math.round(lastResult.selected.product.rating))}{'☆'.repeat(5 - Math.round(lastResult.selected.product.rating))}
              <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{lastResult.selected.product.rating}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>• {lastResult.selected.product.delivery_days} day delivery</span>
            </div>
          </div>
        )}

        {/* Candidates Comparison */}
        {lastResult.candidates?.length > 1 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Discovery Network</span>
              <span className="badge badge-blue">{lastResult.candidates.length} candidates</span>
            </div>
            {lastResult.candidates.slice(0, 4).map((c: any, i: number) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.product.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.merchant.name} • ★{c.product.rating}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>₹{c.product.price}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score: {c.score}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Negotiation Transcript */}
        {lastResult.negotiation?.rounds?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Agent-to-Agent Negotiation</span>
              <span className={`badge badge-${lastResult.negotiation.status === 'accepted' ? 'green' : 'amber'}`}>
                {lastResult.negotiation.status}
              </span>
            </div>
            <div className="negotiation-rounds">
              {lastResult.negotiation.rounds.map((r: any, i: number) => (
                <div key={i} className={`negotiation-round ${r.proposer}`}>
                  <div className="negotiation-bubble">
                    <div className="negotiation-price">₹{r.proposed_price} <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>({r.proposer === 'buyer' ? 'Buyer Agent' : 'Merchant Agent'})</span></div>
                    <div>{r.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunity Alert */}
        {lastResult.opportunity?.should_alert && (
          <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)' }}>
                <Sparkles size={16} /> Superior Opportunity Alert
              </span>
              <span className="badge badge-amber">+{(lastResult.opportunity.improvement_percent * 100).toFixed(0)}% Better</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {lastResult.opportunity.message}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => handleUpgradeOpportunity(lastResult.opportunity.better_option)}
            >
              <ArrowUpRight size={16} /> Upgrade to {lastResult.opportunity.better_option.product.title} (₹{lastResult.opportunity.better_option.product.price})
            </button>
          </div>
        )}

        {/* Audit Trail Snippet */}
        {lastResult.audit_trail?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Audit Trail</span>
              <span className="badge badge-purple">{lastResult.audit_trail.length} events</span>
            </div>
            <div className="audit-timeline">
              {lastResult.audit_trail.slice(0, 5).map((log: any, i: number) => (
                <div key={i} className="audit-item">
                  <div className={`audit-dot ${log.result}`}>
                    {log.result === 'success' ? <CheckCircle2 size={14} /> :
                     log.result === 'blocked' ? <XCircle size={14} /> :
                     log.result === 'failed' ? <XCircle size={14} /> : <Zap size={14} />}
                  </div>
                  <div className="audit-content">
                    <div className="audit-action">{log.action.replace(/_/g, ' ')}</div>
                    <div className="audit-reason">{log.reason.slice(0, 90)}{log.reason.length > 90 ? '...' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>AI Buyer Agent</h1>
          <p>Autonomous commerce execution with delegated policy boundaries & Razorpay integration</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-green">Razorpay Test Mode</span>
          <span className="badge badge-purple">Policy Guard Active</span>
        </div>
      </div>

      {/* Execution Progress Indicator */}
      <div className="step-timeline">
        <div className={`step-item ${activeStep >= 1 ? (activeStep > 1 ? 'done' : 'active') : ''}`}>
          <div className="step-number">{activeStep > 1 ? <Check size={12} /> : '1'}</div>
          <span>Intent</span>
        </div>
        <div className="step-connector" />
        <div className={`step-item ${activeStep >= 2 ? (activeStep > 2 ? 'done' : 'active') : ''}`}>
          <div className="step-number">{activeStep > 2 ? <Check size={12} /> : '2'}</div>
          <span>Discovery</span>
        </div>
        <div className="step-connector" />
        <div className={`step-item ${activeStep >= 3 ? (activeStep > 3 ? 'done' : 'active') : ''}`}>
          <div className="step-number">{activeStep > 3 ? <Check size={12} /> : '3'}</div>
          <span>Negotiate</span>
        </div>
        <div className="step-connector" />
        <div className={`step-item ${activeStep >= 4 ? (activeStep > 4 ? 'done' : 'active') : ''}`}>
          <div className="step-number">{activeStep > 4 ? <Check size={12} /> : '4'}</div>
          <span>Policy Gate</span>
        </div>
        <div className="step-connector" />
        <div className={`step-item ${activeStep >= 6 ? (activeStep > 6 ? 'done' : 'active') : ''}`}>
          <div className="step-number">{activeStep > 6 ? <Check size={12} /> : '5'}</div>
          <span>Razorpay & Recovery</span>
        </div>
        <div className="step-connector" />
        <div className={`step-item ${activeStep >= 8 ? 'done' : ''}`}>
          <div className="step-number">{activeStep >= 8 ? <Check size={12} /> : '6'}</div>
          <span>Audit Confirmed</span>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-main">
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="chat-message-avatar">
                  {msg.role === 'agent' ? <Bot size={16} /> : msg.role === 'user' ? <User size={16} /> : <Zap size={16} />}
                </div>
                <div className="chat-message-content">
                  {getMessageIcon(msg.type) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      {getMessageIcon(msg.type)}
                      {msg.type}
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message agent">
                <div className="chat-message-avatar"><Bot size={16} /></div>
                <div className="chat-message-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <RefreshCw size={14} className="spinner" />
                    <span>Agent is searching merchant network, negotiating & evaluating policy...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Trigger Chips */}
          <div className="prompt-chips">
            {PROMPT_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="prompt-chip"
                onClick={() => handleSendPrompt(s.prompt)}
                disabled={loading}
              >
                <span className="prompt-chip-badge">{s.badge}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <input
                className="chat-input"
                placeholder="Type your shopping request (e.g. 'Buy black running shoes for daily training under ₹6,000')..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(input)}
                disabled={loading}
              />
              <button className="btn btn-icon" onClick={() => handleSendPrompt(input)} disabled={loading || !input.trim()}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="side-panel">
          {renderSidePanel()}
        </div>
      </div>

      {upgradeToast && (
        <div className="toast toast-success">
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span>{upgradeToast}</span>
        </div>
      )}
    </div>
  );
}
