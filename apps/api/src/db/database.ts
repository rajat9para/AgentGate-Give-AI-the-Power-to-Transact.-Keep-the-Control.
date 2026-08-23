// ============================================================
// AgentGate — In-Memory Database (Demo Mode)
// Replaces Supabase for local development / hackathon demo
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  User, UserPolicy, Merchant, MerchantPolicy,
  Product, Order, OrderItem, Payment, PaymentRecoveryAttempt,
  AgentSession, AgentAction, Negotiation, AuditLog
} from '../types.js';
import { seedMerchants, seedProducts, seedMerchantPolicies } from './seed-data.js';

// ---- In-Memory Stores ----
const users: Map<string, User> = new Map();
const userPolicies: Map<string, UserPolicy> = new Map();
const merchants: Map<string, Merchant> = new Map();
const merchantPolicies: Map<string, MerchantPolicy> = new Map();
const products: Map<string, Product> = new Map();
const orders: Map<string, Order> = new Map();
const orderItems: Map<string, OrderItem> = new Map();
const payments: Map<string, Payment> = new Map();
const recoveryAttempts: Map<string, PaymentRecoveryAttempt> = new Map();
const agentSessions: Map<string, AgentSession> = new Map();
const agentActions: Map<string, AgentAction> = new Map();
const negotiations: Map<string, Negotiation> = new Map();
const auditLogs: Map<string, AuditLog> = new Map();

// ---- Daily/Weekly Spending Tracking ----
const dailySpending: Map<string, { date: string; total: number }> = new Map();
const weeklySpending: Map<string, { weekStart: string; total: number }> = new Map();

// ---- Initialize Seed Data ----
export function initializeDatabase(): void {
  // Seed merchants
  for (const m of seedMerchants) {
    merchants.set(m.id, m);
  }
  // Seed merchant policies
  for (const mp of seedMerchantPolicies) {
    merchantPolicies.set(mp.id, mp);
  }
  // Seed products
  for (const p of seedProducts) {
    products.set(p.id, p);
  }

  // Create a demo buyer user
  const demoUser: User = {
    id: 'demo-buyer-001',
    email: 'buyer@agentgate.demo',
    name: 'Demo Buyer',
    role: 'buyer',
    created_at: new Date().toISOString(),
  };
  users.set(demoUser.id, demoUser);

  // Create demo buyer policy
  const demoPolicy: UserPolicy = {
    id: 'demo-policy-001',
    user_id: 'demo-buyer-001',
    single_transaction_limit: 6000,
    daily_limit: 10000,
    weekly_limit: 25000,
    autonomous_purchase: true,
    allowed_categories: ['running_shoes', 'electronics', 'clothing', 'fitness', 'accessories', 'nutrition', 'student_essentials'],
    negotiation: true,
    fallback_payments: ['upi', 'card'],
    opportunity_alerts: true,
    max_opportunity_overshoot: 0.20,
    min_opportunity_improvement: 0.08,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  userPolicies.set(demoPolicy.id, demoPolicy);

  console.log(`[DB] Initialized: ${merchants.size} merchants, ${products.size} products, ${users.size} users`);
}

// ============================================================
// CRUD Operations
// ============================================================

// ---- Users ----
export const db = {
  // Users
  getUser: (id: string) => users.get(id) || null,
  getUserByEmail: (email: string) => [...users.values()].find(u => u.email === email) || null,
  createUser: (user: Omit<User, 'id' | 'created_at'>) => {
    const newUser: User = { ...user, id: uuidv4(), created_at: new Date().toISOString() };
    users.set(newUser.id, newUser);
    return newUser;
  },
  getAllUsers: () => [...users.values()],

  // User Policies
  getUserPolicy: (userId: string) => [...userPolicies.values()].find(p => p.user_id === userId) || null,
  updateUserPolicy: (userId: string, updates: Partial<UserPolicy>) => {
    const existing = [...userPolicies.values()].find(p => p.user_id === userId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    userPolicies.set(updated.id, updated);
    return updated;
  },
  createUserPolicy: (policy: Omit<UserPolicy, 'id' | 'created_at' | 'updated_at'>) => {
    const newPolicy: UserPolicy = {
      ...policy,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    userPolicies.set(newPolicy.id, newPolicy);
    return newPolicy;
  },

  // Merchants
  getMerchant: (id: string) => merchants.get(id) || null,
  getAllMerchants: () => [...merchants.values()],
  getMerchantsByCategory: (category: string) =>
    [...merchants.values()].filter(m => m.categories.includes(category)),

  // Merchant Policies
  getMerchantPolicy: (merchantId: string) =>
    [...merchantPolicies.values()].find(p => p.merchant_id === merchantId) || null,
  updateMerchantPolicy: (merchantId: string, updates: Partial<MerchantPolicy>) => {
    const existing = [...merchantPolicies.values()].find(p => p.merchant_id === merchantId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    merchantPolicies.set(updated.id, updated);
    return updated;
  },

  // Products
  getProduct: (id: string) => products.get(id) || null,
  getAllProducts: () => [...products.values()],
  getProductsByMerchant: (merchantId: string) =>
    [...products.values()].filter(p => p.merchant_id === merchantId),
  getProductsByCategory: (category: string) =>
    [...products.values()].filter(p => p.category === category),
  searchProducts: (query: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    searchText?: string;
  }) => {
    let results = [...products.values()];
    if (query.category) results = results.filter(p => p.category === query.category);
    if (query.subcategory) results = results.filter(p => p.subcategory === query.subcategory);
    if (query.minPrice !== undefined) results = results.filter(p => p.price >= query.minPrice!);
    if (query.maxPrice !== undefined) results = results.filter(p => p.price <= query.maxPrice!);
    if (query.inStock) results = results.filter(p => p.stock > 0);
    if (query.searchText) {
      const terms = query.searchText.toLowerCase().replace(/_/g, ' ').split(/\s+/).filter(Boolean);
      results = results.filter(p => {
        const productText = `${p.title} ${p.description} ${p.category} ${p.subcategory || ''} ${Object.values(p.attributes).join(' ')}`.toLowerCase();
        return terms.some(term => productText.includes(term));
      });
    }
    return results;
  },

  // Orders
  getOrder: (id: string) => orders.get(id) || null,
  getOrdersByUser: (userId: string) => [...orders.values()].filter(o => o.user_id === userId),
  getOrdersByMerchant: (merchantId: string) => [...orders.values()].filter(o => o.merchant_id === merchantId),
  createOrder: (order: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    const newOrder: Order = {
      ...order,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    orders.set(newOrder.id, newOrder);
    return newOrder;
  },
  updateOrder: (id: string, updates: Partial<Order>) => {
    const existing = orders.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    orders.set(id, updated);
    return updated;
  },

  // Payments
  getPayment: (id: string) => payments.get(id) || null,
  getPaymentsByOrder: (orderId: string) => [...payments.values()].filter(p => p.order_id === orderId),
  createPayment: (payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => {
    const newPayment: Payment = {
      ...payment,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    payments.set(newPayment.id, newPayment);
    return newPayment;
  },
  updatePayment: (id: string, updates: Partial<Payment>) => {
    const existing = payments.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    payments.set(id, updated);
    return updated;
  },

  // Recovery Attempts
  createRecoveryAttempt: (attempt: Omit<PaymentRecoveryAttempt, 'id' | 'created_at'>) => {
    const newAttempt: PaymentRecoveryAttempt = {
      ...attempt,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    };
    recoveryAttempts.set(newAttempt.id, newAttempt);
    return newAttempt;
  },
  getRecoveryAttempts: (orderId: string) =>
    [...recoveryAttempts.values()].filter(r => r.order_id === orderId),

  // Agent Sessions
  createAgentSession: (session: Omit<AgentSession, 'id' | 'created_at' | 'updated_at'>) => {
    const newSession: AgentSession = {
      ...session,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    agentSessions.set(newSession.id, newSession);
    return newSession;
  },
  getAgentSession: (id: string) => agentSessions.get(id) || null,
  updateAgentSession: (id: string, updates: Partial<AgentSession>) => {
    const existing = agentSessions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    agentSessions.set(id, updated);
    return updated;
  },

  // Agent Actions
  createAgentAction: (action: Omit<AgentAction, 'id' | 'created_at'>) => {
    const newAction: AgentAction = {
      ...action,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    };
    agentActions.set(newAction.id, newAction);
    return newAction;
  },
  getAgentActions: (sessionId: string) =>
    [...agentActions.values()].filter(a => a.session_id === sessionId),

  // Negotiations
  createNegotiation: (neg: Omit<Negotiation, 'id' | 'created_at'>) => {
    const newNeg: Negotiation = {
      ...neg,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    };
    negotiations.set(newNeg.id, newNeg);
    return newNeg;
  },
  getNegotiation: (id: string) => negotiations.get(id) || null,
  updateNegotiation: (id: string, updates: Partial<Negotiation>) => {
    const existing = negotiations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    negotiations.set(id, updated);
    return updated;
  },
  getNegotiationsBySession: (sessionId: string) =>
    [...negotiations.values()].filter(n => n.session_id === sessionId),

  // Audit Logs
  createAuditLog: (log: AuditLog | Omit<AuditLog, 'id'>) => {
    const newLog: AuditLog = {
      ...log,
      id: (log as any).id || uuidv4(),
      previous_event_hash: (log as any).previous_event_hash || 'GENESIS',
      event_hash: (log as any).event_hash || '',
    };
    auditLogs.set(newLog.id, newLog);
    return newLog;
  },
  getAuditLogsBySession: (sessionId: string) =>
    [...auditLogs.values()]
      .filter(l => l.session_id === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
  getAuditLogsByOrder: (orderId: string) =>
    [...auditLogs.values()]
      .filter(l => l.order_id === orderId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
  getAllAuditLogs: () =>
    [...auditLogs.values()].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),

  // Spending Tracking
  getDailySpending: (userId: string): number => {
    const today = new Date().toISOString().split('T')[0];
    const record = dailySpending.get(userId);
    if (!record || record.date !== today) return 0;
    return record.total;
  },
  addDailySpending: (userId: string, amount: number) => {
    const today = new Date().toISOString().split('T')[0];
    const record = dailySpending.get(userId);
    if (!record || record.date !== today) {
      dailySpending.set(userId, { date: today, total: amount });
    } else {
      record.total += amount;
    }
  },
  getWeeklySpending: (userId: string): number => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const record = weeklySpending.get(userId);
    if (!record || record.weekStart !== weekStartStr) return 0;
    return record.total;
  },
  addWeeklySpending: (userId: string, amount: number) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const record = weeklySpending.get(userId);
    if (!record || record.weekStart !== weekStartStr) {
      weeklySpending.set(userId, { weekStart: weekStartStr, total: amount });
    } else {
      record.total += amount;
    }
  },

  // Merchant Metrics
  getMerchantMetrics: (merchantId: string) => {
    const merchantOrders = [...orders.values()].filter(o => o.merchant_id === merchantId);
    const paidOrders = merchantOrders.filter(o => o.status === 'paid' || o.status === 'delivered');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.negotiated_amount || o.total_amount), 0);
    const recoveredPayments = [...recoveryAttempts.values()].filter(r =>
      r.status === 'success' && merchantOrders.some(o => o.id === r.order_id)
    );
    const recoveredRevenue = recoveredPayments.reduce((sum, r) => {
      const order = orders.get(r.order_id);
      return sum + (order ? order.total_amount : 0);
    }, 0);
    const blockedActions = [...auditLogs.values()].filter(l =>
      l.merchant_id === merchantId && l.result === 'blocked'
    ).length;

    return {
      total_ai_revenue: totalRevenue,
      ai_conversion_rate: merchantOrders.length > 0 ? paidOrders.length / merchantOrders.length : 0,
      ai_upsell_revenue: 0,
      recovered_payment_revenue: recoveredRevenue,
      abandoned_cart_recovery: 0,
      blocked_ai_actions: blockedActions,
      total_orders: paidOrders.length,
      average_order_value: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
    };
  },
};
