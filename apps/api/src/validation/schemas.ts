// ============================================================
// AgentGate — Zod Validation Schemas
// Enforces strict edge input validation across all API routes
// ============================================================

import { z } from 'zod';

export const allowedCategoriesEnum = z.enum([
  'running_shoes',
  'electronics',
  'clothing',
  'fitness',
  'accessories',
  'nutrition',
  'student_essentials',
  'all',
]);

export const paymentMethodEnum = z.enum(['upi', 'card', 'netbanking']);

/**
 * Schema for POST /api/buyer/intent
 */
export const buyerIntentSchema = z.object({
  message: z.string().min(1, 'Message is required and cannot be empty').max(3000, 'Message is too long (max 3000 characters)'),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  product_id: z.string().optional(),
  variant_id: z.string().optional().nullable(),
  quantity: z.number().int().positive().max(100).optional(),
});

/**
 * Schema for PUT /api/buyer/policy
 */
export const updateUserPolicySchema = z.object({
  user_id: z.string().optional(),
  single_transaction_limit: z.number().positive('Single transaction limit must be positive').max(1000000).optional(),
  daily_limit: z.number().positive('Daily limit must be positive').max(5000000).optional(),
  weekly_limit: z.number().positive('Weekly limit must be positive').max(20000000).optional(),
  autonomous_purchase: z.boolean().optional(),
  allowed_categories: z.array(z.string()).optional(),
  negotiation: z.boolean().optional(),
  fallback_payments: z.array(paymentMethodEnum).optional(),
  opportunity_alerts: z.boolean().optional(),
  max_opportunity_overshoot: z.number().min(0).max(1).optional(),
  min_opportunity_improvement: z.number().min(0).max(1).optional(),
}).refine(
  (data) => {
    if (data.single_transaction_limit && data.daily_limit) {
      return data.single_transaction_limit <= data.daily_limit;
    }
    return true;
  },
  { message: 'single_transaction_limit cannot exceed daily_limit', path: ['single_transaction_limit'] }
).refine(
  (data) => {
    if (data.daily_limit && data.weekly_limit) {
      return data.daily_limit <= data.weekly_limit;
    }
    return true;
  },
  { message: 'daily_limit cannot exceed weekly_limit', path: ['daily_limit'] }
);

/**
 * Schema for PUT /api/merchant/policy
 */
export const updateMerchantPolicySchema = z.object({
  merchant_id: z.string().optional(),
  max_discount: z.number().min(0, 'max_discount cannot be negative').max(1, 'max_discount cannot exceed 1.0').optional(),
  min_margin: z.number().min(0, 'min_margin cannot be negative').max(1, 'min_margin cannot exceed 1.0').optional(),
  auto_refund_max: z.number().min(0, 'auto_refund_max cannot be negative').optional(),
  allow_negotiation: z.boolean().optional(),
  payment_methods: z.array(paymentMethodEnum).optional(),
});

/**
 * Schema for TransactionAuthorization validation
 */
export const transactionAuthorizationSchema = z.object({
  authorization_id: z.string().min(1),
  schema_version: z.string().min(1),
  user_id: z.string().min(1),
  agent_id: z.string().min(1),
  merchant_id: z.string().min(1),
  purpose: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  allowed_payment_methods: z.array(paymentMethodEnum).min(1),
  policy_version: z.number().int().positive(),
  policy_hash: z.string().min(1),
  request_hash: z.string().min(1),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  nonce: z.string().min(1),
  key_id: z.string().min(1),
  signature: z.string().min(1),
});

export const verifyAuthorizationRequestSchema = z.object({
  authorization: transactionAuthorizationSchema,
  expected_request: z.object({
    user_id: z.string().optional(),
    agent_id: z.string().optional(),
    merchant_id: z.string().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    category: z.string().optional(),
    purpose: z.string().optional(),
    payment_method: paymentMethodEnum.optional(),
  }).optional(),
});

/**
 * Schema for POST /api/storage/upload
 */
export const storageUploadSchema = z.object({
  fileData: z.string().min(1, 'fileData is required'),
  folder: z.string().optional(),
  resourceType: z.enum(['image', 'raw', 'auto']).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  ownerId: z.string().optional(),
});

/**
 * Schema for Product Search Query Params
 */
export const productSearchQuerySchema = z.object({
  category: z.string().optional(),
  max_price: z.coerce.number().positive().optional(),
  search: z.string().max(200).optional(),
});
