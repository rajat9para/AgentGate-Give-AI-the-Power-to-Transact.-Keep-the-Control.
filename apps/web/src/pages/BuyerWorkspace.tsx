import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, ShoppingCart, AlertTriangle, CheckCircle2,
  XCircle, ArrowRightLeft, CreditCard, FileText, Zap, Sparkles,
  ShieldCheck, ShieldAlert, ArrowUpRight, Check, RefreshCw, Mic, MicOff, Star, Truck
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

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'comparison': return <ShoppingCart size={14} />;
      case 'product_card': return <Sparkles size={14} />;
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
            Type a request or speak using the microphone. RazorX discovers products across merchants, executes bounded negotiation, verifies Ed25519 policy gates, and completes Razorpay checkout.
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Explainable Decision Card
              </span>
              <span className="badge badge-purple">AI Audit Passed</span>
            </div>

            {/* Product Visual Header */}
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
              Match Score: {lastResult.selected.score}/100 • Rating: ⭐ {lastResult.selected.product.rating || 4.5}
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
                <div className="message-bubble" style={{ maxWidth: '100%' }}>
                  {getMessageIcon(msg.type) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.85 }}>
                      {getMessageIcon(msg.type)}
                      <span>{msg.type.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />

                  {/* Rich Product Comparison Cards in Chat */}
                  {msg.type === 'comparison' && msg.data?.candidates && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
                      {msg.data.candidates.map((c: any, idx: number) => (
                        <div key={idx} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {c.image_url && (
                            <img
                              src={c.image_url}
                              alt={c.title}
                              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          )}
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{c.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{c.merchant}</span>
                            <span>⭐ {c.rating || 4.5}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-primary)' }}>₹{c.price}</span>
                            {c.original_price > c.price && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{c.original_price}</span>
                            )}
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '5px 8px', marginTop: 4, width: '100%' }}
                            onClick={() => handleSendPrompt(`Buy ${c.title}`)}
                            disabled={loading}
                          >
                            <Zap size={12} style={{ color: 'var(--accent-primary)' }} /> Buy with Razorpay
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Product Card in Chat */}
                  {msg.type === 'product_card' && msg.data?.product && (
                    <div style={{ display: 'flex', gap: 12, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, marginTop: 12, alignItems: 'center' }}>
                      {msg.data.product.image_url && (
                        <img
                          src={msg.data.product.image_url}
                          alt={msg.data.product.title}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{msg.data.product.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>Merchant: {msg.data.merchant?.name} • Rating: ⭐ {msg.data.product.rating}</div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--success)' }}>₹{msg.data.product.price}</div>
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
