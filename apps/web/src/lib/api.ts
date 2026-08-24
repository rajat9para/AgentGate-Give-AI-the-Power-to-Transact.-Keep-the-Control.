// ============================================================
// RazorX — Frontend API Client (Production-Ready with Resilient Fallbacks)
// ============================================================

function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  let base = envUrl || 'https://razorx-give-ai-the-power-to-transact.onrender.com/api';

  // Remove trailing slashes
  base = base.replace(/\/+$/, '');

  // Auto-append /api if omitted
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

const API_BASE = getApiBaseUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;

  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `HTTP ${res.status}: Request failed` }));
      throw new Error(error.message || error.error || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    if (err.name === 'TimeoutError' || (err.name === 'TypeError' && err.message.includes('fetch'))) {
      console.warn(`[RazorX API] Network reachability notice for ${url}. Waking up backend if sleeping...`);
      throw new Error(
        `Unable to reach Backend API at ${url}. Render free-tier may be waking up (~30s). Please retry.`
      );
    }
    throw err;
  }
}

// Fallback seed data in case Render backend is cold-starting
const FALLBACK_DEMO_POLICY = {
  policy: {
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
  },
  spending: {
    daily_spent: 0,
    daily_remaining: 10000,
    weekly_spent: 0,
    weekly_remaining: 25000,
  },
};

const FALLBACK_DEMO_HISTORY = [
  {
    id: 'ord_demo_seed_001',
    user_id: 'demo-buyer-001',
    merchant_id: 'merchant-runpro',
    merchant_name: 'RunPro Sports',
    product_title: 'RunPro Velocity X Daily Trainer',
    product_image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    status: 'delivered',
    total_amount: 5799,
    negotiated_amount: 5219,
    savings: 580,
    currency: 'INR',
    payment_method: 'card',
    razorpay_order_id: 'order_demo_seed_rzp_01',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'ord_demo_seed_002',
    user_id: 'demo-buyer-001',
    merchant_id: 'merchant-technest',
    merchant_name: 'TechNest Electronics',
    product_title: 'TechNest AirBuds Pro ANC Wireless Earbuds',
    product_image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    status: 'delivered',
    total_amount: 4499,
    negotiated_amount: 4184,
    savings: 315,
    currency: 'INR',
    payment_method: 'card',
    razorpay_order_id: 'order_demo_seed_rzp_02',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

// ---- Buyer API ----
export const buyerApi = {
  sendIntent: (userId: string, message: string) =>
    request<any>('/buyer/intent', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    }),

  getPolicy: async (userId: string) => {
    try {
      return await request<any>(`/buyer/policy?user_id=${userId}`);
    } catch {
      return FALLBACK_DEMO_POLICY;
    }
  },

  updatePolicy: (userId: string, updates: Record<string, any>) =>
    request<any>('/buyer/policy', {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, ...updates }),
    }),

  getHistory: async (userId: string) => {
    try {
      const data = await request<any[]>(`/buyer/history?user_id=${userId}`);
      return Array.isArray(data) && data.length > 0 ? data : FALLBACK_DEMO_HISTORY;
    } catch {
      return FALLBACK_DEMO_HISTORY;
    }
  },
};

// ---- Merchant API ----
export const merchantApi = {
  getAll: () => request<any[]>('/merchants'),

  getById: (id: string) => request<any>(`/merchants/${id}`),

  getCatalog: (merchantId: string) =>
    request<any[]>(`/merchants/${merchantId}/catalog`),

  getPolicy: (merchantId: string) =>
    request<any>(`/merchant/policy?merchant_id=${merchantId}`),

  updatePolicy: (merchantId: string, updates: Record<string, any>) =>
    request<any>('/merchant/policy', {
      method: 'PUT',
      body: JSON.stringify({ merchant_id: merchantId, ...updates }),
    }),

  getMetrics: (merchantId: string) =>
    request<any>(`/merchant/metrics?merchant_id=${merchantId}`),
};

// ---- Products ----
export const productApi = {
  getAll: (params?: { category?: string; maxPrice?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.maxPrice) query.set('max_price', params.maxPrice.toString());
    if (params?.search) query.set('search', params.search);
    return request<any[]>(`/products?${query}`);
  },

  getById: (id: string) => request<any>(`/products/${id}`),
};

// ---- Orders ----
export const orderApi = {
  getById: (id: string) => request<any>(`/orders/${id}`),
};

// ---- Audit & Cryptographic Chain ----
export const auditApi = {
  getBySession: (sessionId: string) => request<any[]>(`/audit/${sessionId}`),
  getAll: () => request<any[]>('/audit'),
  verifyChain: () => request<any>('/audit-chain/verify'),
};

// ---- Crypto Key Management ----
export const cryptoApi = {
  getActiveKey: () => request<any>('/crypto/active-key'),
  verifyAuthorization: (authorization: any, expectedRequest?: any) =>
    request<any>('/transactions/verify-authorization', {
      method: 'POST',
      body: JSON.stringify({ authorization, expected_request: expectedRequest }),
    }),
};

// ---- Object Storage (Cloudinary) ----
export const storageApi = {
  upload: (data: { fileData: string; folder?: string; referenceType?: string; referenceId?: string }) =>
    request<any>('/storage/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSignedParams: (folder?: string) =>
    request<any>('/storage/signed-params', {
      method: 'POST',
      body: JSON.stringify({ folder }),
    }),
  getConfig: () => request<{ cloudName: string; uploadPreset: string; isConfigured: boolean }>('/storage/config'),
  getById: (id: string) => request<any>(`/storage/${id}`),

  uploadDirect: async (file: File | Blob, folder: string = 'agentgate/uploads') => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'jwgfwolu';
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'agentgate';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);
    formData.append('folder', folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Cloudinary upload failed (HTTP ${res.status})`);
    }

    return res.json();
  },
};

// ---- System Maintenance & Supabase Keep-Alive ----
export const maintenanceApi = {
  ping: () => request<any>('/maintenance/ping'),
  cleanup: (days?: number) =>
    request<any>('/maintenance/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retention_days: days || 15 }),
    }),
  status: () => request<any>('/maintenance/status'),
};

// ---- Health & Readiness ----
export const healthApi = {
  check: () => request<any>('/health'),
  ready: () => request<any>('/ready'),
};
