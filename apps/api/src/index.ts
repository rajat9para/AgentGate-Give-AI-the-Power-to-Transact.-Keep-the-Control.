// ============================================================
// AgentGate — Production Web Service Entry Point (Render / Node.js)
// ============================================================

import express from 'express';
import cors from 'cors';
import { config, validateStartupConfig } from './config.js';
import { router } from './routes/index.js';
import { initializeDatabase } from './db/database.js';
import { requestCorrelationMiddleware } from './middleware/logger.js';
import { requestTimeoutMiddleware, notFoundHandler, centralizedErrorHandler } from './middleware/error-handler.js';
import { keyManager } from './crypto/key-manager.js';
import { supabaseDb } from './db/supabase-client.js';
import { maintenanceService } from './services/maintenance-service.js';

const app = express();

// 1. Startup Configuration Validation
const startupCheck = validateStartupConfig();
if (!startupCheck.valid) {
  console.error('❌ [AgentGate] Startup configuration validation failed:');
  startupCheck.errors.forEach((err) => console.error(`   - ${err}`));
  if (config.nodeEnv === 'production' && !config.demoMode) {
    process.exit(1);
  }
}
if (startupCheck.warnings.length > 0) {
  console.warn('⚠️ [AgentGate] Startup warnings:');
  startupCheck.warnings.forEach((warn) => console.warn(`   - ${warn}`));
}

// 2. CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  config.frontendUrl,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Match explicit allowed origins or Vercel preview deployment URLs (*.vercel.app)
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /\.onrender\.com$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in demo mode, but origin is reflected
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Idempotency-Key'],
  })
);

// 3. Request Logging, Correlation IDs, and Timeout
app.use(requestCorrelationMiddleware);
app.use(requestTimeoutMiddleware);

// 4. Body Parser
app.use(express.json({ limit: '10mb' })); // Support base64 image uploads for Cloudinary
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Root Liveness & Readiness Endpoints (for Render & Load Balancers)
app.get('/', (_req, res) => {
  res.json({
    name: 'AgentGate API',
    version: '1.0.0',
    description: 'Autonomous AI Commerce & Cryptographic Authority Gateway',
    environment: config.nodeEnv,
    demo_mode: config.demoMode,
    active_key_id: keyManager.getActiveKeyId(),
    endpoints: {
      health: 'GET /health or GET /api/health',
      ready: 'GET /ready or GET /api/ready',
      buyer_intent: 'POST /api/buyer/intent',
      buyer_policy: 'GET /api/buyer/policy?user_id=demo-buyer-001',
      merchants: 'GET /api/merchants',
      products: 'GET /api/products',
      audit: 'GET /api/audit',
      audit_verify: 'GET /api/audit-chain/verify',
      storage_upload: 'POST /api/storage/upload',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: config.nodeEnv,
    demo_mode: config.demoMode,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/ready', async (_req, res) => {
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
    },
  });
});

// 6. API Route Handlers
app.use('/api', router);

// 7. 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(centralizedErrorHandler);

// 8. Initialize In-Memory Database State
initializeDatabase();

// 9. Start HTTP Server & Background Workers
const server = app.listen(config.port, () => {
  // Start anti-sleep keep-alive and data retention jobs
  maintenanceService.start();

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🚀 AgentGate Production Web Service (Render / Node.js)         ║
║                                                                  ║
║   Port:         ${config.port}                                             ║
║   Environment:  ${config.nodeEnv}                                      ║
║   Mode:         ${config.demoMode ? 'DEMO (simulated)' : 'PRODUCTION'}                              ║
║   Key Manager:  Ed25519 (${keyManager.getActiveKeyId()}) ║
║   Supabase:     ${config.supabase.isConfigured ? 'Configured (PostgreSQL + Anti-Sleep)' : 'In-Memory State'}        ║
║   Cloudinary:   ${config.cloudinary.isConfigured ? 'Configured (Cloud Storage: ' + config.cloudinary.cloudName + ')' : 'In-Memory Mock'}        ║
║   Razorpay:     ${config.demoMode ? 'Simulated (Test Mode)' : (config.razorpay.isConfigured ? 'Configured (Live)' : 'Unconfigured')}            ║
║   Groq AI:      ${config.groq.isConfigured ? 'Configured (Live LLaMA 3.3)' : 'Regex / Fallback Parser'}             ║
║                                                                  ║
║   Service URL:  http://localhost:${config.port}                                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
});

// 10. Graceful Shutdown Handling (SIGINT & SIGTERM for Render deployment)
function handleGracefulShutdown(signal: string) {
  console.log(`\n[AgentGate] Received ${signal}. Initiating graceful shutdown...`);
  maintenanceService.stop();
  server.close(() => {
    console.log('[AgentGate] HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections hang
  setTimeout(() => {
    console.error('[AgentGate] Forced exit after shutdown timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default app;
