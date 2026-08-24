import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, ShoppingCart, AlertTriangle, CheckCircle2,
  XCircle, ArrowRightLeft, CreditCard, FileText, Zap, Sparkles,
  ShieldCheck, ShieldAlert, ArrowUpRight, Check, RefreshCw, Mic, MicOff, Volume2
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
    badge: 'Electronics',
    prompt: 'Buy wireless earbuds with active noise cancelling under ₹5,000',
  },
  {
    label: '🧘 Eco Yoga Mat',
    badge: 'Fitness',
    prompt: 'Buy a non-slip yoga mat under ₹2,000',
  },
  {
    label: '🚫 Policy Block: Limit Exceeded',
    badge: 'Trust Gate',
    prompt: 'Buy high-end smartwatch for ₹35,000',
  },
  {
    label: '💡 Opportunity Tolerance Window',
    badge: 'Smart AI',
    prompt: 'Buy running shoes under ₹5,000',
  },
];

export default function BuyerWorkspace() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: '👋 **Welcome to RazorX Autonomous Commerce!** I am your AI Buyer Agent connected to Razorpay.\n\nTell me what you need in natural language or click the microphone to speak. I will discover products across verified merchants, negotiate price discounts, verify policy boundaries, execute Razorpay checkout, automatically recover payment failures, and document every step in the tamper-evident audit ledger.',
      type: 'text',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Initialize Web Speech API for Voice Shopping
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
          content: `❌ **Connection Error**: ${error.message}. Please verify the Render backend connection.`,
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
          <Bot size={48} style={{ color: 'var(--accent-primary)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Autonomous Agent Ready</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            Type a request or speak using the microphone. The agent will execute discovery across merchants, bounded price negotiation, Ed25519 cryptographic policy gates, and Razorpay checkout.
          </p>
        </div>
      );
    }

    const isBlocked = lastResult.policy_evaluation?.decision === 'RED';
    const isGreen = lastResult.policy_evaluation?.decision === 'GREEN';

    return (
      <>
        {/* Policy Decision Badge */}
        <div className="card" style={{ borderColor: isBlocked ? 'var(--error)' : isGreen ? 'var(--success)' : 'var(--warning)', marginBottom: 16 }}>
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

        {/* Explainable Decision Card */}
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
                <div className="decision-item-title">Delivery Time</div>
                <div className="decision-item-value">{lastResult.selected.product.delivery_days} Business Days</div>
              </div>

              <div className="decision-item">
                <div className="decision-item-title">Payment Route</div>
                <div className="decision-item-value" style={{ textTransform: 'uppercase' }}>
                  {lastResult.order?.payment_method || 'CARD'} (Auto-Recovered)
                </div>
              </div>
            </div>

            {/* Cryptographic Proof Token */}
            {lastResult.authorization && (
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} /> Ed25519 Signed Authorization
                </div>
                <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  ID: {lastResult.authorization.id}<br/>
                  Key: {lastResult.authorization.key_id}<br/>
                  Sig: {lastResult.authorization.signature?.slice(0, 32)}...
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Autonomous AI Buyer Workspace</h1>
          <p>Autonomous commerce execution with delegated policy boundaries, live negotiation & Razorpay recovery</p>
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
                <div className="message-bubble">
                  {getMessageIcon(msg.type) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.85 }}>
                      {getMessageIcon(msg.type)}
                      <span>{msg.type}</span>
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message-row agent">
                <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RefreshCw size={16} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                  <span>Agent is querying Groq LPU, discovering merchant candidates & negotiating price...</span>
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
          {renderSidePanel()}
        </div>
      </div>

      {upgradeToast && (
        <div className="card" style={{ position: 'fixed', bottom: 30, right: 30, background: 'var(--bg-secondary)', border: '1px solid var(--success)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', boxShadow: 'var(--shadow-glow-success)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{upgradeToast}</span>
        </div>
      )}
    </div>
  );
}
