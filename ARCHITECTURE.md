# AgentGate — System Structure & Architecture

## 1. High-Level Structure

```text
agentgate/
|
+-- apps/
|   +-- web/                         # React + TypeScript frontend
|   |   +-- buyer/
|   |   +-- merchant/
|   |   +-- audit/
|   |   +-- components/
|   |   +-- pages/
|   |   +-- lib/
|   |
|   +-- api/                         # Node.js + TypeScript backend
|       +-- src/
|           +-- agents/
|           |   +-- buyer-agent.ts
|           |   +-- merchant-agent.ts
|           |   +-- intent-parser.ts
|           |   +-- negotiation-agent.ts
|           |
|           +-- policy/
|           |   +-- user-policy-engine.ts
|           |   +-- merchant-policy-engine.ts
|           |   +-- payment-policy.ts
|           |
|           +-- commerce/
|           |   +-- catalog-service.ts
|           |   +-- recommendation-service.ts
|           |   +-- order-service.ts
|           |   +-- inventory-service.ts
|           |
|           +-- payments/
|           |   +-- razorpay-service.ts
|           |   +-- webhook-handler.ts
|           |   +-- payment-recovery.ts
|           |
|           +-- audit/
|           |   +-- audit-service.ts
|           |
|           +-- db/
|           +-- routes/
|           +-- middleware/
|           +-- utils/
|
+-- supabase/
|   +-- migrations/
|   +-- seed.sql
|
+-- docs/
|   +-- README.md
|   +-- CONTROL_FLOW.md
|   +-- ARCHITECTURE.md
|   +-- PRD.md
|   +-- PITCH.md
|
+-- .env.example
+-- package.json
+-- README.md
```

---

## 2. Logical Layers

### Layer 1 — Experience

React frontend contains:

- AI Buyer workspace
- user policies
- purchase history
- merchant console
- merchant policy studio
- agent activity feed
- audit timeline
- revenue analytics

Hosted on Vercel.

### Layer 2 — API / Application

Node.js backend owns:

- authentication/session validation
- agent execution
- product search
- ranking
- policies
- negotiations
- order creation
- payment orchestration
- webhooks

Hosted on a free-tier backend platform such as Render for the hackathon.

### Layer 3 — AI

Gemini is used for:

- natural-language intent extraction
- structured commerce planning
- product comparison explanation
- negotiation wording
- customer-facing explanations
- merchant insights

The AI layer returns structured outputs and never receives raw payment secrets.

### Layer 4 — Deterministic Trust

This layer is deliberately non-LLM:

- spending limits
- category rules
- approval requirements
- negotiation ceilings
- refund limits
- payment fallback permissions
- daily/weekly budget
- idempotency
- signature verification

This is the security boundary.

### Layer 5 — Data

Supabase PostgreSQL stores transactional and configuration data.

Core domain objects:

```text
User
UserPolicy
Merchant
MerchantPolicy
Product
ProductVariant
Inventory
Order
Payment
AgentAction
Negotiation
PaymentRecoveryAttempt
AuditLog
```

### Layer 6 — Payment Infrastructure

Razorpay Test Mode provides payment execution and event notifications.

---

## 3. Frontend Route Map

```text
/login
/onboarding
/buyer
/buyer/history
/buyer/policy
/buyer/memory
/buyer/approval
/merchant
/merchant/catalog
/merchant/policy
/merchant/agents
/merchant/revenue
/audit/:transactionId
```

---

## 4. Buyer UI

### Main workspace

```text
Header
  |-- spending status
  |-- current policy
  |-- AI status

Conversation panel
  |-- user request
  |-- agent progress
  |-- final explanation

Commerce results
  |-- candidates
  |-- comparison
  |-- selected product
  |-- negotiated price

Transaction panel
  |-- authorization
  |-- Razorpay status
  |-- recovery steps
  |-- order confirmation
```

### Policy screen

Users configure:

- transaction limit
- daily limit
- weekly limit
- categories
- brands
- payment fallbacks
- negotiation authority
- automatic purchase toggle
- opportunity alerts
- upgrade threshold

---

## 5. Merchant UI

### Merchant dashboard

KPIs:

- AI-generated revenue
- AI conversion rate
- AI upsell revenue
- recovered payment revenue
- abandoned-cart recovery
- blocked AI actions

### Merchant policy studio

Controls:

- discounts
- negotiation
- refunds
- auto-confirmation
- upsells
- order-size limits

### AI-readable catalog

Each product contains:

- title
- category
- description
- price
- stock
- variants
- attributes
- delivery estimate
- merchant policy metadata

---

## 6. Agent Runtime

The buyer agent follows:

```text
Intent
 -> Candidate Retrieval
 -> Candidate Ranking
 -> Negotiation
 -> Policy Check
 -> Payment Planning
 -> Razorpay Execution
 -> Recovery if necessary
 -> Confirmation
 -> Audit
```

The merchant agent follows:

```text
Request
 -> Product interpretation
 -> Price calculation
 -> Discount policy
 -> Negotiation
 -> Upsell opportunity
 -> Merchant policy check
 -> Accept / reject / counter
```

---

## 7. Suggested API Endpoints

### Auth

```text
POST /auth/session
```

### Buyer

```text
POST /buyer/intent
POST /buyer/search
POST /buyer/recommend
POST /buyer/negotiate
POST /buyer/execute
GET  /buyer/policy
PUT  /buyer/policy
```

### Merchant

```text
GET  /merchants
GET  /merchants/:id/catalog
GET  /merchant/policy
PUT  /merchant/policy
POST /merchant/products
```

### Orders

```text
POST /orders
GET  /orders/:id
POST /orders/:id/cancel
```

### Payments

```text
POST /payments/create-order
POST /payments/payment-link
GET  /payments/:id
POST /webhooks/razorpay
```

### Audit

```text
GET /audit/:transactionId
GET /audit
```

---

## 8. Database Relationship Model

```text
users
  |
  +---- user_policies
  |
  +---- agent_sessions
  |
  +---- orders
          |
          +---- order_items ---- products ---- merchants
          |
          +---- payments
          |
          +---- agent_actions
          |
          +---- audit_logs

merchants
  |
  +---- merchant_policies
  |
  +---- products
  |
  +---- inventory
```

---

## 9. AI Tool Boundary

Allowed AI tools should be narrow, for example:

```text
search_products()
compare_products()
request_discount()
get_product_details()
check_inventory()
create_purchase_intent()
get_policy_status()
explain_decision()
```

Money-moving functions should be protected by deterministic middleware:

```text
execute_payment()
issue_refund()
```

The agent cannot invoke them successfully unless policy validation has already passed.

---

## 10. Deployment

```text
GitHub
  |
  +--> Vercel -> frontend
  |
  +--> Render -> backend
             |
             +--> Supabase
             +--> Gemini
             +--> Razorpay
```

Use environment-specific configuration and keep test-mode credentials separate from production credentials.
