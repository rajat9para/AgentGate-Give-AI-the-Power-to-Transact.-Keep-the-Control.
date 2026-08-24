// ============================================================
// AgentGate — Shared Type Definitions
// ============================================================

// ---- Users & Auth ----
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'merchant' | 'admin';
  created_at: string;
}

// ---- User Policy ----
export interface UserPolicy {
  id: string;
  user_id: string;
  single_transaction_limit: number;
  daily_limit: number;
  weekly_limit: number;
  autonomous_purchase: boolean;
  allowed_categories: string[];
  negotiation: boolean;
  fallback_payments: PaymentMethod[];
  opportunity_alerts: boolean;
  max_opportunity_overshoot: number; // e.g. 0.20 = 20%
  min_opportunity_improvement: number; // e.g. 0.08 = 8%
  created_at: string;
  updated_at: string;
}

// ---- Merchant ----
export interface Merchant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  rating: number;
  reliability_score: number;
  categories: string[];
  created_at: string;
}

// ---- Merchant Policy ----
export interface MerchantPolicy {
  id: string;
  merchant_id: string;
  negotiation: boolean;
  max_discount: number; // e.g. 0.10 = 10%
  auto_confirmation_limit: number;
  auto_refund_limit: number;
  upsell: boolean;
  max_upsell_offers: number;
  created_at: string;
  updated_at: string;
}

// ---- Products ----
export interface Product {
  id: string;
  merchant_id: string;
  title: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  original_price: number;
  currency: string;
  stock: number;
  variants: ProductVariant[];
  attributes: Record<string, string>;
  delivery_days: number;
  rating: number;
  image_url: string;
  ai_searchable: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;      // e.g. "Size 9 - Black"
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

// ---- Orders ----
export type OrderStatus = 'pending' | 'confirmed' | 'payment_processing' | 'paid' | 'payment_failed' | 'recovering' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  user_id: string;
  merchant_id: string;
  status: OrderStatus;
  total_amount: number;
  negotiated_amount: number | null;
  currency: string;
  items: OrderItem[];
  razorpay_order_id: string | null;
  payment_id: string | null;
  agent_session_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// ---- Payments ----
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'payment_link';
export type PaymentStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  order_id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  failure_reason: string | null;
  is_recovery_attempt: boolean;
  recovery_attempt_number: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecoveryAttempt {
  id: string;
  payment_id: string;
  order_id: string;
  attempt_number: number;
  method: PaymentMethod;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  failure_reason: string | null;
  created_at: string;
}

// ---- Agent ----
export interface AgentSession {
  id: string;
  user_id: string;
  type: 'buyer' | 'merchant';
  status: 'active' | 'completed' | 'failed';
  user_message: string;
  structured_intent: StructuredIntent | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface StructuredIntent {
  category: string;
  subcategory?: string;
  use_case?: string;
  max_price: number;
  min_price?: number;
  size?: string;
  color?: string;
  brand?: string;
  preferences: string[];
  hard_constraints: string[];
  purchase: boolean;
  intent_type?: 'purchase' | 'browse' | 'greeting' | 'help' | 'policy_query' | 'unknown';
  is_shopping_intent?: boolean;
  conversational_reply?: string;
}

export interface AgentAction {
  id: string;
  session_id: string;
  agent_type: 'buyer' | 'merchant' | 'negotiation' | 'recovery';
  action: string;
  description: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'blocked';
  created_at: string;
}

// ---- Negotiation ----
export interface Negotiation {
  id: string;
  session_id: string;
  order_id: string | null;
  product_id: string;
  merchant_id: string;
  user_id: string;
  original_price: number;
  final_price: number | null;
  rounds: NegotiationRound[];
  status: 'active' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
}

export interface NegotiationRound {
  round: number;
  proposer: 'buyer' | 'merchant';
  proposed_price: number;
  message: string;
  accepted: boolean;
  timestamp: string;
}

// ---- Policy Engine ----
export type PolicyDecision = 'GREEN' | 'AMBER' | 'RED';

export interface PolicyEvaluation {
  decision: PolicyDecision;
  reason: string;
  authorization?: any; // TransactionAuthorization when GREEN
  details: {
    amount_check: boolean;
    daily_budget_check: boolean;
    weekly_budget_check: boolean;
    category_check: boolean;
    payment_method_check: boolean;
    remaining_daily_budget: number;
    remaining_weekly_budget: number;
  };
}

// ---- Audit ----
export interface AuditLog {
  id: string;
  agent_id: string;
  user_id: string;
  merchant_id: string | null;
  session_id: string;
  action: string;
  requested_amount: number | null;
  approved_amount: number | null;
  reason: string;
  policy_id: string | null;
  policy_result: PolicyDecision | null;
  payment_id: string | null;
  order_id: string | null;
  timestamp: string;
  result: 'success' | 'failed' | 'blocked' | 'pending';
  // Tamper-Evident Cryptographic Hash Chain
  previous_event_hash: string;
  event_hash: string;
  authorization_id?: string | null;
  policy_version?: number | null;
  policy_hash?: string | null;
  request_hash?: string | null;
  nonce?: string | null;
  key_id?: string | null;
  verification_result?: string | null;
  reservation_result?: string | null;
}

// ---- Candidate / Recommendation ----
export interface ProductCandidate {
  product: Product;
  merchant: Merchant;
  score: number;
  match_reasons: string[];
  price_score: number;
  quality_score: number;
  relevance_score: number;
  merchant_reliability_score: number;
  negotiable: boolean;
  estimated_negotiated_price: number | null;
}

// ---- Opportunity Override ----
export interface OpportunityAlert {
  valid_purchase: ProductCandidate;
  better_option: ProductCandidate;
  price_overshoot_percent: number;
  improvement_percent: number;
  should_alert: boolean;
  message: string;
}

// ---- API Request/Response Types ----
export interface BuyerIntentRequest {
  user_id: string;
  message: string;
}

export interface BuyerIntentResponse {
  session_id: string;
  intent: StructuredIntent;
  candidates: ProductCandidate[];
  selected: ProductCandidate | null;
  negotiation: Negotiation | null;
  policy_evaluation: PolicyEvaluation;
  order: Order | null;
  payment: Payment | null;
  opportunity: OpportunityAlert | null;
  audit_trail: AuditLog[];
  agent_messages: AgentMessage[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  type: 'text' | 'product_card' | 'comparison' | 'negotiation' | 'policy' | 'payment' | 'audit' | 'opportunity';
  data?: Record<string, unknown>;
  timestamp: string;
}

// ---- Merchant Dashboard ----
export interface MerchantMetrics {
  total_ai_revenue: number;
  ai_conversion_rate: number;
  ai_upsell_revenue: number;
  recovered_payment_revenue: number;
  abandoned_cart_recovery: number;
  blocked_ai_actions: number;
  total_orders: number;
  average_order_value: number;
}
