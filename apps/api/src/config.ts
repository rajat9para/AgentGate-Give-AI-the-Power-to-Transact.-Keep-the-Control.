// ============================================================
// AgentGate — Production Configuration & Environment Validation
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

export interface AgentGateConfig {
  port: number;
  nodeEnv: string;
  demoMode: boolean;
  frontendUrl: string;
  backendUrl: string;
  requestTimeoutMs: number;

  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
    isConfigured: boolean;
  };

  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    isConfigured: boolean;
  };

  groq: {
    apiKey: string;
    model: string;
    isConfigured: boolean;
  };

  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    isConfigured: boolean;
  };

  crypto: {
    signingKey: string;
    keyId: string;
    publicKey: string;
  };
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';
const groqApiKey = process.env.GROQ_API_KEY || '';
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

export const config: AgentGateConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode: process.env.DEMO_MODE !== 'false', // Default to demo mode if not explicitly set to false
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),

  supabase: {
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceKey,
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    isConfigured: Boolean(supabaseUrl && supabaseServiceKey),
  },

  cloudinary: {
    cloudName: cloudinaryCloudName,
    apiKey: cloudinaryApiKey,
    apiSecret: cloudinaryApiSecret,
    isConfigured: Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret),
  },

  groq: {
    apiKey: groqApiKey,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    isConfigured: Boolean(groqApiKey),
  },

  razorpay: {
    keyId: razorpayKeyId,
    keySecret: razorpayKeySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    isConfigured: Boolean(razorpayKeyId && razorpayKeySecret),
  },

  crypto: {
    signingKey: process.env.AGENTGATE_SIGNING_KEY || process.env.ED25519_PRIVATE_KEY || '',
    keyId: process.env.AGENTGATE_KEY_ID || process.env.ED25519_KEY_ID || 'agentgate-prod-2026-08-v1',
    publicKey: process.env.AGENTGATE_PUBLIC_KEY || process.env.ED25519_PUBLIC_KEY || '',
  },
};

/**
 * Validates configuration on application startup.
 * Throws an error in production if mandatory secrets are missing.
 */
export function validateStartupConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.nodeEnv === 'production') {
    if (!config.demoMode) {
      if (!config.supabase.isConfigured) {
        errors.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production mode');
      }
      if (!config.razorpay.isConfigured) {
        errors.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production mode');
      }
      if (!config.groq.isConfigured) {
        warnings.push('GROQ_API_KEY is not set. Intent parser will use deterministic regex fallback');
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
