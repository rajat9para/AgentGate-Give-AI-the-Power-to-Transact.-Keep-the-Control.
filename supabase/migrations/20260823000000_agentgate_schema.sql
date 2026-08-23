-- ============================================================
-- AgentGate — Production PostgreSQL Database Schema (Supabase)
-- Domain: Autonomous AI Commerce & Cryptographic Authority
-- ============================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS & IDENTITY
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT ('user_' || replace(uuid_generate_v4()::text, '-', '')),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'merchant', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. AGENTS & AGENT PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buyer', 'merchant', 'negotiator', 'recovery')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, permission_key)
);

-- ============================================================
-- 3. POLICIES & POLICY VERSIONS (DETERMINISTIC TRUST BOUNDARY)
-- ============================================================

CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY DEFAULT ('pol_' || replace(uuid_generate_v4()::text, '-', '')),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    single_transaction_limit NUMERIC(12, 2) NOT NULL CHECK (single_transaction_limit > 0),
    daily_limit NUMERIC(12, 2) NOT NULL CHECK (daily_limit >= single_transaction_limit),
    weekly_limit NUMERIC(12, 2) NOT NULL CHECK (weekly_limit >= daily_limit),
    autonomous_purchase BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_payments JSONB NOT NULL DEFAULT '["upi", "card"]'::jsonb,
    max_negotiation_discount NUMERIC(5, 4) NOT NULL DEFAULT 0.15 CHECK (max_negotiation_discount >= 0 AND max_negotiation_discount <= 1),
    opportunity_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    max_opportunity_overshoot NUMERIC(5, 4) NOT NULL DEFAULT 0.20 CHECK (max_opportunity_overshoot >= 0 AND max_opportunity_overshoot <= 1),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    policy_hash TEXT NOT NULL,
    policy_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(policy_id, version)
);

-- ============================================================
-- 4. MERCHANTS & CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.50 CHECK (rating >= 1.0 AND rating <= 5.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_policies (
    id TEXT PRIMARY KEY DEFAULT ('mpol_' || replace(uuid_generate_v4()::text, '-', '')),
    merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
    max_discount NUMERIC(5, 4) NOT NULL DEFAULT 0.12 CHECK (max_discount >= 0 AND max_discount <= 1),
    min_margin NUMERIC(5, 4) NOT NULL DEFAULT 0.15 CHECK (min_margin >= 0 AND min_margin <= 1),
    auto_refund_max NUMERIC(12, 2) NOT NULL DEFAULT 10000 CHECK (auto_refund_max >= 0),
    allow_negotiation BOOLEAN NOT NULL DEFAULT TRUE,
    payment_methods JSONB NOT NULL DEFAULT '["upi", "card", "netbanking"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    floor_price NUMERIC(12, 2) NOT NULL CHECK (floor_price > 0 AND floor_price <= price),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.50 CHECK (rating >= 1.0 AND rating <= 5.0),
    delivery_days INTEGER NOT NULL DEFAULT 2 CHECK (delivery_days >= 1),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    stock_count INTEGER NOT NULL DEFAULT 10 CHECK (stock_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ORDERS & COMMERCE TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT ('order_' || replace(uuid_generate_v4()::text, '-', '')),
    user_id TEXT NOT NULL REFERENCES users(id),
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'payment_failed', 'cancelled', 'refunded')),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    negotiated_amount NUMERIC(12, 2) CHECK (negotiated_amount IS NULL OR negotiated_amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    razorpay_order_id TEXT,
    payment_id TEXT,
    agent_session_id TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. CRYPTOGRAPHIC TRANSACTION AUTHORIZATIONS & NONCES
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_authorizations (
    authorization_id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL DEFAULT '1.0',
    user_id TEXT NOT NULL REFERENCES users(id),
    agent_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    purpose TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    allowed_payment_methods JSONB NOT NULL,
    policy_version INTEGER NOT NULL,
    policy_hash TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    key_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_window CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS authorization_nonces (
    nonce TEXT PRIMARY KEY,
    authorization_id TEXT NOT NULL UNIQUE,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ATOMIC SPENDING RESERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS spending_reservations (
    reservation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    authorization_id TEXT NOT NULL UNIQUE REFERENCES transaction_authorizations(authorization_id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
    expires_at TIMESTAMPTZ NOT NULL,
    committed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. PAYMENT ATTEMPTS & PROVIDER INTEGRATION (RAZORPAY)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_attempts (
    id TEXT PRIMARY KEY DEFAULT ('pay_' || replace(uuid_generate_v4()::text, '-', '')),
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    method TEXT NOT NULL CHECK (method IN ('upi', 'card', 'netbanking', 'wallet', 'payment_link')),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
    failure_reason TEXT,
    is_recovery_attempt BOOLEAN NOT NULL DEFAULT FALSE,
    recovery_attempt_number INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY DEFAULT ('audit_' || replace(uuid_generate_v4()::text, '-', '')),
    event_hash TEXT NOT NULL UNIQUE,
    previous_event_hash TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT REFERENCES users(id),
    merchant_id TEXT REFERENCES merchants(id),
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    requested_amount NUMERIC(12, 2),
    approved_amount NUMERIC(12, 2),
    reason TEXT NOT NULL,
    policy_result TEXT CHECK (policy_result IS NULL OR policy_result IN ('GREEN', 'AMBER', 'RED')),
    policy_id TEXT,
    policy_version INTEGER,
    policy_hash TEXT,
    request_hash TEXT,
    authorization_id TEXT,
    nonce TEXT,
    key_id TEXT,
    payment_id TEXT,
    order_id TEXT,
    result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'blocked', 'pending')),
    verification_result TEXT,
    reservation_result TEXT,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. SIGNING KEYS & KEY ROTATION
-- ============================================================

CREATE TABLE IF NOT EXISTS signing_keys (
    key_id TEXT PRIMARY KEY,
    algorithm TEXT NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
    public_key_pem TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ
);

-- ============================================================
-- 11. MEDIA / OBJECT STORAGE (CLOUDINARY METADATA)
-- ============================================================

CREATE TABLE IF NOT EXISTS media_objects (
    id TEXT PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    secure_url TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'image',
    format TEXT,
    bytes INTEGER,
    owner_id TEXT,
    reference_type TEXT CHECK (reference_type IS NULL OR reference_type IN ('transaction', 'receipt', 'product', 'audit_proof')),
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE & INTEGRITY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_merchant_category ON products(merchant_id, category);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_user_status ON transaction_authorizations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_user_status ON spending_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_hash_chain ON audit_events(event_hash, previous_event_hash);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- Public read access to merchants and product catalogs
CREATE POLICY "Public read access to merchants" ON merchants FOR SELECT USING (true);
CREATE POLICY "Public read access to products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read access to product variants" ON product_variants FOR SELECT USING (true);

-- Authenticated Users access only their own policies and orders
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can read own policies" ON policies FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can read own orders" ON orders FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can read own audit logs" ON audit_events FOR SELECT USING (auth.uid()::text = user_id);

-- Backend Service Role has full access to all tables for execution & verification
-- (By default, Supabase service_role key bypasses RLS)
