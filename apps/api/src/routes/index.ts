// ============================================================
// AgentGate — API Routes
// ============================================================

import { Router, type Request, type Response } from 'express';
import { executeBuyerFlow } from '../agents/buyer-agent.js';
import { generateMerchantResponse, getMerchantDashboardMetrics, getUpsellRecommendations } from '../agents/merchant-agent.js';
import { db } from '../db/database.js';
import { evaluateUserPolicy } from '../policy/user-policy-engine.js';
import { canAutoRefund } from '../policy/merchant-policy-engine.js';
import { handleWebhook } from '../payments/webhook-handler.js';
import { getAuditTrail, getOrderAuditTrail, getAllAuditLogs } from '../audit/audit-service.js';
import { createAuditLog } from '../audit/audit-service.js';

export const router = Router();

// ============================================================
// Buyer Routes
// ============================================================

/**
 * POST /api/buyer/intent
 * Main entry point — user gives a natural language purchase request
 */
router.post('/buyer/intent', async (req: Request, res: Response) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      res.status(400).json({ error: 'user_id and message are required' });
      return;
    }

    const result = await executeBuyerFlow(user_id, message);
    res.json(result);
  } catch (error) {
    console.error('[API] /buyer/intent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/buyer/policy?user_id=xxx
 */
router.get('/buyer/policy', (req: Request, res: Response) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    res.status(400).json({ error: 'user_id query parameter required' });
    return;
  }

  const policy = db.getUserPolicy(userId);
  if (!policy) {
    res.status(404).json({ error: 'No policy found for user' });
    return;
  }

  const dailySpent = db.getDailySpending(userId);
  const weeklySpent = db.getWeeklySpending(userId);

  res.json({
    policy,
    spending: {
      daily_spent: dailySpent,
      daily_remaining: policy.daily_limit - dailySpent,
      weekly_spent: weeklySpent,
      weekly_remaining: policy.weekly_limit - weeklySpent,
    },
  });
});

/**
 * PUT /api/buyer/policy
 */
router.put('/buyer/policy', (req: Request, res: Response) => {
  const { user_id, ...updates } = req.body;
  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  const updated = db.updateUserPolicy(user_id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }

  res.json(updated);
});

/**
 * GET /api/buyer/history?user_id=xxx
 */
router.get('/buyer/history', (req: Request, res: Response) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    res.status(400).json({ error: 'user_id query parameter required' });
    return;
  }

  const orders = db.getOrdersByUser(userId);
  res.json(orders);
});

// ============================================================
// Merchant Routes
// ============================================================

/**
 * GET /api/merchants
 */
router.get('/merchants', (_req: Request, res: Response) => {
  res.json(db.getAllMerchants());
});

/**
 * GET /api/merchants/:id
 */
router.get('/merchants/:id', (req: Request, res: Response) => {
  const merchantId = String(req.params.id);
  const merchant = db.getMerchant(merchantId);
  if (!merchant) {
    res.status(404).json({ error: 'Merchant not found' });
    return;
  }
  res.json(merchant);
});

/**
 * GET /api/merchants/:id/catalog
 */
router.get('/merchants/:id/catalog', (req: Request, res: Response) => {
  const merchantId = String(req.params.id);
  const products = db.getProductsByMerchant(merchantId);
  res.json(products);
});

/**
 * GET /api/merchant/policy?merchant_id=xxx
 */
router.get('/merchant/policy', (req: Request, res: Response) => {
  const merchantId = req.query.merchant_id ? String(req.query.merchant_id) : '';
  if (!merchantId) {
    res.status(400).json({ error: 'merchant_id query parameter required' });
    return;
  }

  const policy = db.getMerchantPolicy(merchantId);
  if (!policy) {
    res.status(404).json({ error: 'No policy found for merchant' });
    return;
  }

  res.json(policy);
});

/**
 * PUT /api/merchant/policy
 */
router.put('/merchant/policy', (req: Request, res: Response) => {
  const { merchant_id, ...updates } = req.body;
  if (!merchant_id) {
    res.status(400).json({ error: 'merchant_id is required' });
    return;
  }

  const updated = db.updateMerchantPolicy(String(merchant_id), updates);
  if (!updated) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }

  res.json(updated);
});

/**
 * GET /api/merchant/metrics?merchant_id=xxx
 */
router.get('/merchant/metrics', (req: Request, res: Response) => {
  const merchantId = req.query.merchant_id ? String(req.query.merchant_id) : '';
  if (!merchantId) {
    res.status(400).json({ error: 'merchant_id query parameter required' });
    return;
  }

  const metrics = getMerchantDashboardMetrics(merchantId);
  res.json(metrics);
});

/**
 * GET /api/merchant/upsell?merchant_id=xxx&product_id=yyy
 */
router.get('/merchant/upsell', (req: Request, res: Response) => {
  const merchantId = req.query.merchant_id ? String(req.query.merchant_id) : '';
  const productId = req.query.product_id ? String(req.query.product_id) : '';
  if (!merchantId || !productId) {
    res.status(400).json({ error: 'merchant_id and product_id are required' });
    return;
  }

  const recommendations = getUpsellRecommendations(merchantId, productId, 2);
  res.json(recommendations);
});

// ============================================================
// Product Routes
// ============================================================

/**
 * GET /api/products
 */
router.get('/products', (req: Request, res: Response) => {
  const category = req.query.category ? String(req.query.category) : undefined;
  const maxPrice = req.query.max_price ? parseInt(String(req.query.max_price), 10) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;

  const products = db.searchProducts({
    category: category || undefined,
    maxPrice,
    inStock: true,
    searchText: search || undefined,
  });

  res.json(products);
});

/**
 * GET /api/products/:id
 */
router.get('/products/:id', (req: Request, res: Response) => {
  const productId = String(req.params.id);
  const product = db.getProduct(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

// ============================================================
// Order Routes
// ============================================================

/**
 * GET /api/orders/:id
 */
router.get('/orders/:id', (req: Request, res: Response) => {
  const orderId = String(req.params.id);
  const order = db.getOrder(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json(order);
});

// ============================================================
// Payment / Webhook Routes
// ============================================================

/**
 * POST /api/webhooks/razorpay
 */
router.post('/webhooks/razorpay', handleWebhook);

// ============================================================
// Audit Routes
// ============================================================

/**
 * GET /api/audit/:sessionId
 */
router.get('/audit/:sessionId', (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const trail = getAuditTrail(sessionId);
  res.json(trail);
});

/**
 * GET /api/audit
 */
router.get('/audit', (_req: Request, res: Response) => {
  res.json(getAllAuditLogs());
});

/**
 * GET /api/audit/order/:orderId
 */
router.get('/audit/order/:orderId', (req: Request, res: Response) => {
  const orderId = String(req.params.orderId);
  const trail = getOrderAuditTrail(orderId);
  res.json(trail);
});

// ============================================================
// User Routes
// ============================================================

/**
 * GET /api/users/:id
 */
router.get('/users/:id', (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const user = db.getUser(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

/**
 * GET /api/users
 */
router.get('/users', (_req: Request, res: Response) => {
  res.json(db.getAllUsers());
});

// ============================================================
// Health Check
// ============================================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    demo_mode: process.env.DEMO_MODE === 'true',
    timestamp: new Date().toISOString(),
  });
});
