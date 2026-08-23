// ============================================================
// AgentGate — API Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { router } from './routes/index.js';
import { initializeDatabase } from './db/database.js';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api', router);

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'AgentGate API',
    version: '1.0.0',
    description: 'Autonomous AI Commerce on Razorpay',
    demo_mode: config.demoMode,
    endpoints: {
      health: 'GET /api/health',
      buyer_intent: 'POST /api/buyer/intent',
      buyer_policy: 'GET /api/buyer/policy?user_id=demo-buyer-001',
      merchants: 'GET /api/merchants',
      products: 'GET /api/products',
      audit: 'GET /api/audit',
    },
  });
});

// Initialize database and start server
initializeDatabase();

app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   🚀 AgentGate API Server                   ║
║                                              ║
║   Port:      ${config.port}                         ║
║   Mode:      ${config.demoMode ? 'DEMO (simulated)' : 'PRODUCTION'}          ║
║   Gemini:    ${config.gemini.apiKey ? 'Connected' : 'Not configured'}              ║
║   Razorpay:  ${config.demoMode ? 'Simulated' : (config.razorpay.keyId ? 'Connected' : 'Not configured')}               ║
║                                              ║
║   http://localhost:${config.port}                    ║
║                                              ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
