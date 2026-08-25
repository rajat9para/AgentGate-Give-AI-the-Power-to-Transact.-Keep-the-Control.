// ============================================================
// AgentGate — API Routes (Production-Hardened)
// Enforces Authentication, Scoped Tokens, Zod Edge Validation,
// HTTP Idempotency, Anomaly Rate Limiting, & Persistent Ledgers
// ============================================================

import { Router, type Request, type Response } from 'express';
import { executeBuyerFlow } from '../agents/buyer-agent.js';
import { generateMerchantResponse, getMerchantDashboardMetrics, getUpsellRecommendations } from '../agents/merchant-agent.js';
import { db } from '../db/database.js';
import { evaluateUserPolicy } from '../policy/user-policy-engine.js';
import { canAutoRefund } from '../policy/merchant-policy-engine.js';
import { handleWebhook } from '../payments/webhook-handler.js';
import { getAuditTrail, getOrderAuditTrail, getAllAuditLogs, verifyAuditChain, createAuditLog } from '../audit/audit-service.js';
import { keyManager } from '../crypto/key-manager.js';
import { verifyTransactionAuthorization } from '../crypto/authorization.js';
import {
  aiIntentRateLimiter,
  webhookRateLimiter,
  policyMutationRateLimiter,
  purchaseExecutionRateLimiter,
  recordSecurityViolation,
} from '../middleware/rate-limit.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { authRouter } from '../auth/auth-routes.js';
import { authenticateToken, requireAuth, requireUserSession, requireScope } from '../auth/auth-middleware.js';
import { validateBody, validateQuery, validateParams } from '../validation/validate-middleware.js';
import {
  buyerIntentSchema,
  updateUserPolicySchema,
  updateMerchantPolicySchema,
  verifyAuthorizationRequestSchema,
  storageUploadSchema,
  productSearchQuerySchema,
} from '../validation/schemas.js';
import { cloudinaryStorageService } from '../storage/cloudinary-service.js';
import { supabaseDb } from '../db/supabase-client.js';
import { maintenanceService } from '../services/maintenance-service.js';
import { reconciliationService } from '../services/reconciliation-service.js';
import { config } from '../config.js';

export const router = Router();

// ============================================================
// Authentication & Token Issuance Routes
// ============================================================
router.use('/auth', authRouter);

// ============================================================
// Buyer Routes (Strict Identity Derivation & Scoped Authorization)
// ============================================================

/**
 * POST /api/buyer/intent
 * Main entry point — user gives a natural language purchase request
 * Derives user_id strictly from verified token / session.
 */
router.post(
  '/buyer/intent',
  aiIntentRateLimiter,
  idempotencyMiddleware,
  authenticateToken,
  requireAuth,
  validateBody(buyerIntentSchema),
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      const userId = req.user!.userId; // Derived strictly from verified token

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const result = await executeBuyerFlow(userId, message);
      res.json(result);
    } catch (error) {
      console.error('[API] /buyer/intent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/buyer/policy
 * Returns active spending limits for authenticated user.
 */
router.get('/buyer/policy', authenticateToken, requireAuth, (req: Request, res: Response) => {
  // If caller is admin, allow reading other user policies; otherwise force authenticated userId
  const userId =
    req.user!.role === 'admin' && req.query.user_id
      ? String(req.query.user_id)
      : req.user!.userId;

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
      daily_remaining: Math.max(0, policy.daily_limit - dailySpent),
      weekly_spent: weeklySpent,
      weekly_remaining: Math.max(0, policy.weekly_limit - weeklySpent),
    },
  });
});

/**
 * PUT /api/buyer/policy
 * Updates spending limits for authenticated user.
 * Requires direct human user session (agents cannot mutate spending limits).
 */
router.put(
  '/buyer/policy',
  policyMutationRateLimiter,
  idempotencyMiddleware,
  authenticateToken,
  requireUserSession,
  validateBody(updateUserPolicySchema),
  (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const updates = req.body;

    const updated = db.updateUserPolicy(userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json(updated);
  }
);

/**
 * GET /api/buyer/history
 * Returns enriched order history for authenticated user.
 */
router.get('/buyer/history', authenticateToken, requireAuth, (req: Request, res: Response) => {
  const userId =
    req.user!.role === 'admin' && req.query.user_id
      ? String(req.query.user_id)
      : req.user!.userId;

  function getCategoryFallbackImage(category?: string): string {
    switch (category?.toLowerCase()) {
      case 'running_shoes':
      case 'shoes':
        return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
      case 'electronics':
        return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80';
      case 'student_essentials':
        return 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80';
      case 'fitness':
        return 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&auto=format&fit=crop&q=80';
      case 'nutrition':
        return 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop&q=80';
      case 'clothing':
        return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80';
      case 'accessories':
        return 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80';
      default:
        return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
    }
  }

  const rawOrders = db.getOrdersByUser(userId);
  const enrichedOrders = rawOrders.map((order) => {
    const merchant = db.getMerchant(order.merchant_id);
    const payments = db.getPaymentsByOrder(order.id);
    const latestPayment = payments[payments.length - 1] || null;

    const items = (order.items || []).map((item) => {
      const product = db.getProduct(item.product_id);
      const fallback = getCategoryFallbackImage(product?.category);
      return {
        ...item,
        product_title: product?.title || 'Autonomous Purchase Item',
        product_image: product?.image_url || fallback,
        category: product?.category || 'General',
        attributes: product?.attributes || {},
      };
    });

    const primaryItem = items[0];
    const product = primaryItem ? db.getProduct(primaryItem.product_id) : null;
    const categoryFallback = getCategoryFallbackImage(product?.category);

    return {
      ...order,
      status: order.status === 'paid' || order.status === 'confirmed' ? 'delivered' : order.status,
      merchant_name: merchant?.name || 'Verified Merchant',
      merchant_logo: merchant?.logo_url,
      merchant_rating: merchant?.rating || 4.8,
      product_title: primaryItem?.product_title || product?.title || 'Autonomous Item',
      product_image: primaryItem?.product_image || product?.image_url || categoryFallback,
      items,
      payment: latestPayment,
      payment_method: latestPayment?.method || 'card',
      savings: order.negotiated_amount ? Math.max(0, order.total_amount - order.negotiated_amount) : 0,
    };
  });

  res.json(enrichedOrders.reverse());
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
 * GET /api/merchants/:id/metrics or GET /api/merchant/metrics
 */
router.get('/merchants/:id/metrics', (req: Request, res: Response) => {
  const merchantId = String(req.params.id);
  const metrics = getMerchantDashboardMetrics(merchantId);
  res.json(metrics);
});

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
 * GET /api/merchants/:id/policy or GET /api/merchant/policy
 */
router.get('/merchants/:id/policy', (req: Request, res: Response) => {
  const merchantId = String(req.params.id);
  const policy = db.getMerchantPolicy(merchantId);
  if (!policy) {
    res.status(404).json({ error: 'No policy found for merchant' });
    return;
  }
  res.json(policy);
});

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
 * PUT /api/merchants/:id/policy or PUT /api/merchant/policy
 */
router.put(
  '/merchants/:id/policy',
  policyMutationRateLimiter,
  idempotencyMiddleware,
  validateBody(updateMerchantPolicySchema),
  (req: Request, res: Response) => {
    const merchantId = String(req.params.id);
    const updated = db.updateMerchantPolicy(merchantId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    res.json(updated);
  }
);

router.put(
  '/merchant/policy',
  policyMutationRateLimiter,
  idempotencyMiddleware,
  validateBody(updateMerchantPolicySchema),
  (req: Request, res: Response) => {
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
  }
);

/**
 * GET /api/merchant/upsell
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
router.get('/products', validateQuery(productSearchQuerySchema), (req: Request, res: Response) => {
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
router.post('/webhooks/razorpay', webhookRateLimiter, handleWebhook);

// ============================================================
// Cryptographic Transaction Authorization Routes
// ============================================================

/**
 * POST /api/transactions/verify-authorization
 * Validates a TransactionAuthorization object against expected parameters
 */
router.post(
  '/transactions/verify-authorization',
  validateBody(verifyAuthorizationRequestSchema),
  (req: Request, res: Response) => {
    const { authorization, expected_request } = req.body;

    const result = verifyTransactionAuthorization(authorization, {
      expectedRequest: expected_request,
    });

    if (!result.valid) {
      recordSecurityViolation(req);
    }

    res.json(result);
  }
);

// ============================================================
// Cloudinary Media / Object Storage Routes
// ============================================================

/**
 * POST /api/storage/upload
 */
router.post(
  '/storage/upload',
  idempotencyMiddleware,
  validateBody(storageUploadSchema),
  async (req: Request, res: Response) => {
    try {
      const { fileData, folder, resourceType, referenceType, referenceId, ownerId } = req.body;

      const stored = await cloudinaryStorageService.uploadMedia({
        fileData,
        folder,
        resourceType,
        referenceType,
        referenceId,
        ownerId,
      });

      res.json(stored);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Storage upload failed' });
    }
  }
);

/**
 * POST /api/storage/signed-params
 */
router.post('/storage/signed-params', (req: Request, res: Response) => {
  const { folder } = req.body;
  const params = cloudinaryStorageService.generateSignedUploadParams(folder);
  res.json(params);
});

/**
 * GET /api/storage/config
 */
router.get('/storage/config', (_req: Request, res: Response) => {
  res.json(cloudinaryStorageService.getPublicUploadConfig());
});

/**
 * GET /api/storage/:id
 */
router.get('/storage/:id', (req: Request, res: Response) => {
  const media = cloudinaryStorageService.getMediaById(String(req.params.id));
  if (!media) {
    res.status(404).json({ error: 'Media object not found' });
    return;
  }
  res.json(media);
});

// ============================================================
// System Maintenance, Anti-Sleep, & Payment Reconciliation Routes
// ============================================================

/**
 * ALL /api/maintenance/ping
 */
router.all('/maintenance/ping', async (_req: Request, res: Response) => {
  const result = await maintenanceService.pingSupabase();
  res.status(result.success ? 200 : 500).json({
    status: result.success ? 'ok' : 'failed',
    message: result.success ? 'Supabase keep-alive ping successful' : result.error,
    latency_ms: result.latencyMs,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/maintenance/cleanup
 */
router.post('/maintenance/cleanup', async (req: Request, res: Response) => {
  const days = req.body?.retention_days ? parseInt(String(req.body.retention_days), 10) : config.maintenance.retentionDays;
  const result = await maintenanceService.runCleanup(days);
  res.json(result);
});

/**
 * POST /api/maintenance/reconcile
 * Trigger payment reconciliation between Razorpay ledger and local orders
 */
router.post('/maintenance/reconcile', async (_req: Request, res: Response) => {
  const report = await reconciliationService.reconcile();
  res.json(report);
});

/**
 * GET /api/maintenance/status
 */
router.get('/maintenance/status', (_req: Request, res: Response) => {
  res.json(maintenanceService.getStatus());
});

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
 * GET /api/audit-chain/verify
 */
router.get('/audit-chain/verify', (_req: Request, res: Response) => {
  const verification = verifyAuditChain();
  res.json(verification);
});

/**
 * GET /api/crypto/active-key
 */
router.get('/crypto/active-key', (_req: Request, res: Response) => {
  const activeKeyId = keyManager.getActiveKeyId();
  const publicKeyPem = keyManager.getPublicKeyPem(activeKeyId);
  res.json({
    key_id: activeKeyId,
    algorithm: 'Ed25519',
    public_key: publicKeyPem,
  });
});

/**
 * GET /api/crypto/rotation-history
 */
router.get('/crypto/rotation-history', (_req: Request, res: Response) => {
  res.json(keyManager.getKeyRotationHistory());
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
// Health & Readiness Endpoints
// ============================================================

/**
 * GET /api/health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: config.nodeEnv,
    demo_mode: config.demoMode,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

/**
 * GET /api/ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const supabaseHealth = await supabaseDb.checkHealth();
  const activeKeyId = keyManager.getActiveKeyId();
  const isReady = Boolean(activeKeyId);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    subsystems: {
      crypto_key_manager: {
        status: activeKeyId ? 'operational' : 'degraded',
        active_key_id: activeKeyId,
        algorithm: 'Ed25519',
      },
      supabase: supabaseHealth,
      cloudinary: {
        configured: config.cloudinary.isConfigured,
        mode: config.cloudinary.isConfigured ? 'cloud' : 'in-memory-mock',
      },
      razorpay: {
        configured: config.razorpay.isConfigured,
        mode: config.demoMode ? 'simulated-test-mode' : 'live-api',
      },
      groq_ai: {
        configured: config.groq.isConfigured,
        model: config.groq.model,
      },
    },
  });
});
