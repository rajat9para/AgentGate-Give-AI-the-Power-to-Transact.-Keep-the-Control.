// ============================================================
// AgentGate — Frontend API Client (Production-Ready)
// ============================================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
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
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach AgentGate Backend API at ${API_BASE}. Ensure the Render backend service is running.`
      );
    }
    throw err;
  }
}

// ---- Buyer ----
export const buyerApi = {
  sendIntent: (userId: string, message: string) =>
    request<any>('/buyer/intent', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    }),

  getPolicy: (userId: string) =>
    request<any>(`/buyer/policy?user_id=${userId}`),

  updatePolicy: (userId: string, updates: Record<string, any>) =>
    request<any>('/buyer/policy', {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, ...updates }),
    }),

  getHistory: (userId: string) =>
    request<any[]>(`/buyer/history?user_id=${userId}`),
};

// ---- Merchant ----
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
  getById: (id: string) => request<any>(`/storage/${id}`),
};

// ---- Health & Readiness ----
export const healthApi = {
  check: () => request<any>('/health'),
  ready: () => request<any>('/ready'),
};
