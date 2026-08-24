# 🏛️ RazorX (AgentGate) — Complete System Architecture & Engineering Masterclass

> **Document Purpose**: *In-depth architectural breakdown, code structure, data models, cryptographic protocols, and design patterns powering the RazorX (AgentGate) Autonomous Commerce Platform.*

---

## 1. High-Level Directory & Workspace Structure

AgentGate is structured as a modern **TypeScript Monorepo** managing the backend execution engine and the frontend web workspace:

```text
c:\Razorpay_hackahton_project\
│
├── apps/
│   ├── api/                                  # Backend API, Agent Engine & Cryptographic Gateway
│   │   ├── src/
│   │   │   ├── agents/                       # Agentic Reasoning Plane
│   │   │   │   ├── buyer-agent.ts            # Orchestrates discovery, ranking, negotiation & checkout
│   │   │   │   ├── merchant-agent.ts         # Handles merchant margin policies & counter-offers
│   │   │   │   ├── negotiation-agent.ts      # Multi-round bounded price bargaining protocol
│   │   │   │   └── intent-parser.ts          # Groq LPU / Gemini semantic classifier with fallback
│   │   │   │
│   │   │   ├── commerce/                     # Federated Commerce & Catalog Engine
│   │   │   │   ├── catalog-service.ts        # Search & multi-factor candidate scoring engine
│   │   │   │   ├── recommendation-service.ts # High-affinity complementary upselling logic
│   │   │   │   ├── order-service.ts          # Order state machine & lifecycle management
│   │   │   │   └── opportunity-engine.ts     # Bounded overshoot & upgrade evaluation
│   │   │   │
│   │   │   ├── crypto/                       # Cryptographic Trust Layer (RFC 8032)
│   │   │   │   ├── transaction-authorizer.ts # Ed25519 keypair generation, token signing & verification
│   │   │   │   ├── audit-chain.ts            # SHA-256 Merkle hash chain ledger with tamper detection
│   │   │   │   └── security.test.ts          # 21 cryptographic security invariant tests
│   │   │   │
│   │   │   ├── gateway/                      # Centralized Trust & Payment Execution
│   │   │   │   ├── execution-gateway.ts      # Verifies signature, locks nonce, reserves budget & executes
│   │   │   │   └── budget-reservation.ts     # Mutex-guarded atomic budget reservation engine
│   │   │   │
│   │   │   ├── policy/                       # Deterministic Governance Middleware
│   │   │   │   ├── user-policy-engine.ts     # Evaluates single limits, daily/weekly velocity & categories
│   │   │   │   ├── merchant-policy-engine.ts # Evaluates merchant discount thresholds & floor prices
│   │   │   │   └── payment-policy.ts         # Payment method whitelists & fallback authorization
│   │   │   │
│   │   │   ├── payments/                     # Payment Rails Integration
│   │   │   │   ├── razorpay-service.ts       # Razorpay Orders API, Payment Links & Simulation
│   │   │   │   ├── webhook-handler.ts        # HMAC-SHA256 signature verification & state transitions
│   │   │   │   └── payment-recovery.ts       # State machine managing automated UPI-to-Card recovery
│   │   │   │
│   │   │   ├── db/                           # Persistence & Multi-Store Seed Data
│   │   │   │   ├── database.ts               # In-memory fast store with Supabase PostgreSQL synchronization
│   │   │   │   ├── seed-data.ts              # 26 verified products & 4 merchant stores with authentic photos
│   │   │   │   └── supabase-client.ts        # Supabase client, anti-sleep keep-alive & 15-day retention
│   │   │   │
│   │   │   ├── routes/                       # Express REST API Endpoints
│   │   │   │   └── index.ts                  # Public endpoints for chat, orders, merchants, policies & audits
│   │   │   │
│   │   │   ├── config.ts                     # Environment configuration & credential validation
│   │   │   ├── types.ts                      # Strongly typed domain models, intents & cryptographic schemas
│   │   │   └── index.ts                      # Server bootstrap & background maintenance scheduler
│   │   │
│   │   ├── package.json                      # API dependencies (Express, Razorpay SDK, Supabase, Cloudinary)
│   │   └── tsconfig.json                     # Strict TypeScript compiler options (ES2022, NodeNext)
│   │
│   └── web/                                  # Frontend Web Workspace
│       ├── src/
│       │   ├── components/                   # Glassmorphic UI Components
│       │   │   ├── Navbar.tsx                # Dynamic navigation, role toggle & live system clock
│       │   │   ├── ThemeToggle.tsx           # Dark/Light mode theme switcher with local storage persistence
│       │   │   ├── AuditTimeline.tsx         # Visual SHA-256 Merkle chain timeline with crypto badges
│       │   │   └── ExplainableCard.tsx       # Decision justification cards & GST invoice renderers
│       │   │
│       │   ├── pages/                        # Core Application Views
│       │   │   ├── BuyerWorkspace.tsx        # AI Co-Pilot chat, thought streams & candidate carousels
│       │   │   ├── BuyerHistory.tsx          # Order tracking, tax invoice downloads & buy-again flows
│       │   │   ├── MerchantDashboard.tsx     # Merchant analytics, margin configuration & settlement logs
│       │   │   └── MerchantCatalog.tsx       # Federated 4-store catalog grid & instant checkout
│       │   │
│       │   ├── lib/
│       │   │   └── api.ts                    # Resilient API client with automatic dev-proxy routing
│       │   │
│       │   ├── index.css                     # Custom glassmorphism, gradient tokens & scrollbar styles
│       │   ├── App.tsx                       # Root router & layout wrapper
│       │   └── main.tsx                      # React 18 DOM mount
│       │
│       ├── vite.config.ts                    # Vite dev server with `/api` proxy to backend
│       └── package.json                      # Web dependencies (React 18, Lucide Icons, Canvas Confetti)
│
├── projectlogo/                              # Official branding assets
│   └── agentgate-logo.png                    # High-definition master logo
│
├── dashboardview/                            # High-resolution screenshot gallery
│   ├── 01-ai-copilot-workspace.png
│   ├── 02-autonomous-negotiation-execution.png
│   ├── 03-spending-policy-governance.png
│   ├── 04-merchant-dashboard-analytics.png
│   ├── 05-merchant-catalog-multistore.png
│   ├── 06-autonomous-anc-earbuds-flow.png
│   ├── 07-technest-electronics-catalog.png
│   └── 08-fitfuel-fitness-catalog.png
│
├── supabase/                                 # Database Schema & Migrations
│   ├── migrations/                           # PostgreSQL schema definitions
│   └── seed.sql                              # Seed SQL tables for merchants, products & policy models
│
├── PITCH.md                                  # 5-6 minute recruiter presentation script & Q&A guide
├── ARCHITECTURE.md                           # Complete system engineering masterclass (this file)
├── CONTROL_FLOW.md                           # Detailed execution control flow & sequence diagrams
├── PRD.md                                    # Product Requirements Document & specifications
└── README.md                                 # Master repository documentation & showcase
```

---

## 2. Four-Tier Architectural Separation

AgentGate strictly separates responsibilities into four distinct architectural tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. EXPERIENCE PLANE (React 18 + Vite 6 + Tailwind Glassmorphism)            │
│    • Real-time Agent Streaming • Multi-Store Catalog • Spending Governance  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WebSocket REST
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. AGENTIC REASONING PLANE (Groq LPU / Gemini + Multi-Agent Protocols)      │
│    • Buyer Agent • Merchant Agent • Negotiation Protocol • Recovery Agent   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Candidate Proposal (Subject to Gate)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. DETERMINISTIC TRUST GATEWAY (Policy Engine + Ed25519 Cryptography)       │
│    • Single Limit (≤ ₹6k) • Daily/Weekly Velocity • Category Whitelists     │
│    • Nonce Anti-Replay • Ed25519 Signatures • Atomic Budget Mutex Engine    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Verified Cryptographic Token
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SETTLEMENT & AUDIT PLANE (Razorpay Standard SDK + Merkle Chain)          │
│    • Razorpay Orders API • HMAC Webhooks • SHA-256 Hash Chain Ledger        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cryptographic Specification & Security Invariants

### Ed25519 Token Structure (RFC 8032)
When the Deterministic Policy Engine approves a purchase, it produces an `AuthorizationPayload`:

```typescript
export interface AuthorizationPayload {
  authorization_id: string;        // UUIDv4 unique token identifier
  user_id: string;                 // Bound user principal
  merchant_id: string;             // Bound merchant recipient
  amount: number;                  // Exact authorized amount in minor/major currency
  currency: string;                // 'INR'
  category: string;                // Whitelisted category
  payment_method: string;          // Authorized payment rail ('upi' | 'card')
  fallback_method?: string;        // Pre-authorized fallback ('card')
  nonce: string;                   // UUIDv4 one-time cryptographic nonce
  policy_id: string;               // Active policy identifier
  policy_hash: string;             // SHA-256 hash of active user spending policy
  request_hash: string;            // SHA-256 hash of original request parameters
  issued_at: number;               // Unix timestamp (seconds)
  expires_at: number;              // issued_at + 300 seconds (5 min TTL)
}
```

The digital signature is generated via:
```typescript
const messageDigest = crypto.createHash('sha256').update(canonicalJSON(payload)).digest();
const signature = crypto.sign(null, messageDigest, privateKey).toString('base64');
```

### Verification Fail-Closed Invariants:
1. **Signature Invariant**: `crypto.verify(null, messageDigest, publicKey, signature)` must equal `true`.
2. **Parameter Binding Invariant**: The executing request parameters (`amount`, `merchant_id`, `category`) must match the token's payload byte-for-byte.
3. **Temporal Invariant**: Current time must satisfy $\text{issued\_at} - 60 \le t \le \text{expires\_at}$.
4. **Replay Invariant**: The `nonce` must not exist in the consumed nonce registry.
5. **Policy Invariant**: `SHA-256(current_user_policy)` must equal `token.policy_hash`.

---

## 4. Multi-Agent Bounded Negotiation Mechanics

The negotiation protocol executes an automated 3-round bargaining algorithm:

```
Round 1 (Opening Bid):
  Buyer Agent computes opening discount bid:
  P_0 = P_list * (1 - 0.12)  [Requests 12% discount]

Round 2 (Merchant Counter):
  Merchant Agent queries stock level & configured max_discount (e.g. 10%):
  P_floor = P_list * (1 - max_discount)
  If P_0 < P_floor:
    Merchant counters with: P_counter = P_list * (1 - max_discount * 0.45)

Round 3 (Settlement Agreement):
  Buyer Agent checks if P_counter <= User_Budget:
    If YES -> Form binding agreement at P_counter
    If NO  -> Buyer proposes midpoint concession P_mid = (P_0 + P_counter) / 2
              If P_mid >= P_floor -> Binding agreement at P_mid
              Else -> Settle at P_floor
```

This guarantees that:
- The merchant's **gross margin is never breached**.
- The buyer secures the **optimal market price** autonomously.
- Every round is recorded with plain-English rationales in the session logs.

---

## 5. Persistence, Keep-Alive & Data Retention

- **In-Memory Store (`database.ts`)**: Ultra-fast Map-based storage for millisecond API responses during live chat.
- **Supabase PostgreSQL Synchronization (`supabase-client.ts`)**: Automatically mirrors merchants, orders, policies, and audit blocks to PostgreSQL.
- **Anti-Sleep Keep-Alive Engine**: Sends a lightweight heartbeat ping every 3.5 hours (`12,600s`) to prevent cloud database instances from idling.
- **Automated 15-Day Data Retention**: Periodically cleans up consumed nonces and expired budget reservations older than 15 days to maintain lean table indexes.
