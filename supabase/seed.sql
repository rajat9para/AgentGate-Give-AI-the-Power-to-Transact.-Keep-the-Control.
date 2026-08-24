-- ============================================================
-- AgentGate — Supabase Seed Data
-- Populates default merchants, products, user, policy, and agents
-- ============================================================

-- 1. Demo User
INSERT INTO users (id, email, name, role) VALUES
('demo-buyer-001', 'buyer@agentgate.dev', 'Demo Autonomous Buyer', 'buyer')
ON CONFLICT (id) DO NOTHING;

-- 2. User Policy (Deterministic Trust Policy)
INSERT INTO policies (
    id, user_id, single_transaction_limit, daily_limit, weekly_limit,
    autonomous_purchase, allowed_categories, fallback_payments,
    max_negotiation_discount, opportunity_alerts, max_opportunity_overshoot, active, version
) VALUES (
    'pol_demo_user_001',
    'demo-buyer-001',
    6000.00,
    10000.00,
    25000.00,
    TRUE,
    '["electronics", "clothing", "office", "fitness", "books", "shoes", "running_shoes", "accessories"]'::jsonb,
    '["upi", "card"]'::jsonb,
    0.15,
    TRUE,
    0.20,
    TRUE,
    1
)
ON CONFLICT (id) DO NOTHING;

-- 3. Core Agents
INSERT INTO agents (id, name, type, status, description) VALUES
('buyer-agent', 'Autonomous Buyer Agent', 'buyer', 'active', 'Discovers products, compares attributes, ranks candidates, and negotiates with merchants.'),
('merchant-agent', 'Autonomous Merchant Agent', 'merchant', 'active', 'Evaluates buyer proposals against discount boundaries and stock levels.'),
('payment-recovery-agent', 'Autonomous Payment Recovery Agent', 'recovery', 'active', 'Handles payment failure recovery via authorized fallback chains within cryptographic bounds.')
ON CONFLICT (id) DO NOTHING;

-- 4. Merchants
INSERT INTO merchants (id, name, domain, rating) VALUES
('merchant-runpro', 'RunPro Official Store', 'runpro.in', 4.85),
('merchant-technest', 'TechNest Electronics', 'technest.io', 4.70),
('merchant-campusmart', 'CampusMart Essentials', 'campusmart.co', 4.55),
('merchant-fitfuel', 'FitFuel Nutrition & Gear', 'fitfuel.in', 4.80)
ON CONFLICT (id) DO NOTHING;

-- 5. Merchant Policies
INSERT INTO merchant_policies (id, merchant_id, max_discount, min_margin, auto_refund_max, allow_negotiation, payment_methods) VALUES
('mpol_runpro', 'merchant-runpro', 0.12, 0.20, 10000.00, TRUE, '["upi", "card"]'::jsonb),
('mpol_technest', 'merchant-technest', 0.08, 0.15, 15000.00, TRUE, '["upi", "card", "netbanking"]'::jsonb),
('mpol_campusmart', 'merchant-campusmart', 0.15, 0.10, 5000.00, TRUE, '["upi", "card"]'::jsonb),
('mpol_fitfuel', 'merchant-fitfuel', 0.10, 0.25, 8000.00, TRUE, '["upi", "card"]'::jsonb)
ON CONFLICT (merchant_id) DO NOTHING;

-- 6. Products
INSERT INTO products (id, merchant_id, title, description, category, price, floor_price, currency, rating, delivery_days, image_url) VALUES
('prod-run-001', 'merchant-runpro', 'RunPro Velocity X Daily Trainer', 'High-mileage responsive running shoe with breathable mesh and carbon rubber outsole.', 'running_shoes', 5500.00, 4800.00, 'INR', 4.8, 2, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'),
('prod-run-002', 'merchant-runpro', 'RunPro CloudStride Comfort', 'Plush cushioned trainer designed for recovery runs and everyday comfort.', 'running_shoes', 4999.00, 4400.00, 'INR', 4.7, 2, 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80'),
('prod-run-003', 'merchant-runpro', 'RunPro Elite Marathoner Pro', 'Ultralight carbon-plated racing shoe engineered for race-day speed.', 'running_shoes', 8200.00, 7500.00, 'INR', 4.9, 3, 'https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=600&auto=format&fit=crop&q=80'),
('prod-tech-001', 'merchant-technest', 'TechNest SoundWave Pro ANC Earbuds', 'Hybrid active noise cancelling wireless earbuds with 36-hour battery life.', 'electronics', 4499.00, 3999.00, 'INR', 4.7, 1, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80'),
('prod-tech-002', 'merchant-technest', 'TechNest PulseFit Smartwatch', 'AMOLED fitness tracker with continuous heart rate and SpO2 monitoring.', 'electronics', 3999.00, 3499.00, 'INR', 4.6, 2, 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&auto=format&fit=crop&q=80'),
('prod-campus-001', 'merchant-campusmart', 'CampusMart GripMaster Yoga Mat', '6mm eco-friendly TPE non-slip exercise yoga mat with alignment lines.', 'fitness', 1499.00, 1200.00, 'INR', 4.5, 2, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&auto=format&fit=crop&q=80'),
('prod-campus-002', 'merchant-campusmart', 'CampusMart UltraBlend Whey 1kg', 'Pure whey protein isolate powder for post-workout recovery.', 'fitness', 2200.00, 1900.00, 'INR', 4.6, 1, 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO NOTHING;

-- 7. Product Variants
INSERT INTO product_variants (id, product_id, sku, attributes, in_stock, stock_count) VALUES
('var-run-001-blk-9', 'prod-run-001', 'RP-VX-BLK-9', '{"color": "black", "size": "9"}'::jsonb, TRUE, 15),
('var-run-001-blk-10', 'prod-run-001', 'RP-VX-BLK-10', '{"color": "black", "size": "10"}'::jsonb, TRUE, 12),
('var-run-001-wht-9', 'prod-run-001', 'RP-VX-WHT-9', '{"color": "white", "size": "9"}'::jsonb, TRUE, 8),
('var-run-002-blk-9', 'prod-run-002', 'RP-CS-BLK-9', '{"color": "black", "size": "9"}'::jsonb, TRUE, 20),
('var-tech-001-blk', 'prod-tech-001', 'TN-SW-BLK', '{"color": "matte black"}'::jsonb, TRUE, 30)
ON CONFLICT (id) DO NOTHING;

-- 8. Active Signing Key
INSERT INTO signing_keys (key_id, algorithm, public_key_pem, active) VALUES
('agentgate-prod-2026-08-v1', 'Ed25519', '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAvwI/WkR5bV8F2kF7J7nQz7W5B2Q8K2y8z8x8v8u8t8s=\n-----END PUBLIC KEY-----', TRUE)
ON CONFLICT (key_id) DO NOTHING;
