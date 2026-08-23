# AgentGate — Product Requirements Document

## 1. Product Name

**AgentGate**

### Tagline

**Let AI buy. Keep control of the money.**

---

## 2. Hackathon Track

**AI Growth & Agentic Commerce**

Primary objectives:

1. Grow merchant revenue.
2. Make merchants transactable by AI buyers end to end.
3. Keep every money action explainable, bounded, and gated.

---

## 3. Product Vision

AgentGate is an AI-native commerce network where a user's Buyer Agent can discover products from AI-readable merchants, compare and negotiate offers, purchase autonomously within user-defined authority, recover from allowed payment failures, and explain every action afterward.

Merchants have their own Merchant Agents that can recommend, negotiate, cross-sell, recover abandoned purchases, and accept AI-generated orders under merchant-defined policies.

The system becomes a trust/control layer between autonomous agents and Razorpay payment execution.

---

## 4. Target Users

### Consumer / Buyer

Wants to delegate repetitive shopping while retaining strict spending control.

### Merchant

Wants an AI-native sales channel capable of discovering, convincing, converting, upselling, and recovering customers.

### Hackathon Judge / Evaluator

Needs to see an end-to-end, technically credible, measurable agentic-commerce flow using Razorpay test APIs.

---

## 5. Core User Stories

### Buyer

- As a user, I can describe what I want in natural language.
- As a user, I can define autonomous spending limits.
- As a user, I can allow the agent to negotiate within boundaries.
- As a user, I can allow approved fallback payment methods.
- As a user, I can receive automatic purchase completion without repetitive approvals.
- As a user, I can see exactly why the agent selected a product.
- As a user, I can receive an opportunity alert when a materially better product exists outside my configured range.
- As a user, I can approve an exception only when necessary.
- As a user, I can inspect a complete transaction audit trail.

### Merchant

- As a merchant, I can publish an AI-readable product catalog.
- As a merchant, I can create an AI agent policy.
- As a merchant, I can authorize discounts and negotiation limits.
- As a merchant, I can allow AI upselling.
- As a merchant, I can recover abandoned purchases.
- As a merchant, I can see AI-generated revenue.
- As a merchant, I can block unauthorized refunds or purchases.
- As a merchant, I can inspect why an AI action was allowed or blocked.

---

## 6. Feature Set

### P0 — Must Have

#### 6.1 AI Buyer

Natural-language commerce interface.

Requirements:

- parse intent
- preserve hard constraints
- identify soft preferences
- produce structured plan
- search merchant network
- compare candidates
- select best valid candidate

#### 6.2 AI-Readable Merchant Catalog

Requirements:

- structured product attributes
- prices
- variants
- stock
- merchant policy metadata
- delivery estimate
- AI purchase eligibility

#### 6.3 Deterministic Policy Engine

Requirements:

- single transaction limit
- daily limit
- weekly limit
- category rules
- merchant restrictions
- payment-method rules
- negotiation ceiling
- refund authority
- opportunity thresholds

#### 6.4 Autonomous Purchase

If a transaction satisfies policy, the system executes without asking for approval.

#### 6.5 Agent-to-Agent Negotiation

Buyer Agent and Merchant Agent can negotiate price within bounded rules.

#### 6.6 Razorpay Payment Execution

Use Razorpay Test Mode for order/payment execution.

#### 6.7 Webhook Confirmation

Payment success must be confirmed through backend payment events rather than trusting only browser state.

#### 6.8 Audit Trail

Every important action must be recorded and explainable.

#### 6.9 Failure Handling

At least one graceful failure must be intentionally demonstrated.

Recommended demo:

UPI fails -> authorized fallback payment succeeds.

---

### P1 — Strong Differentiators

#### 6.10 Payment Failure Recovery Agent

Automatically choose among allowed retries, fallback payment method, Payment Link, or safe stop.

#### 6.11 Opportunity Override

Complete the best valid purchase first. Then surface a materially better out-of-range opportunity according to user-configured thresholds.

#### 6.12 AI Upsell Agent

Merchant agent identifies high-relevance complementary products while respecting maximum offers.

#### 6.13 Abandoned Purchase Recovery

Merchant agent can send bounded recovery offers and payment links.

#### 6.14 Purchase Memory

Agent remembers non-sensitive shopping preferences.

Examples:

- preferred brands
- usual categories
- preferred colors
- preferred quality/price tradeoff

#### 6.15 Explainable Decision Card

Every purchase displays:

```text
What I bought
Why I chose it
How much I paid
What alternatives I considered
Which policy allowed it
How payment completed
```

---

### P2 — Post-Hackathon Expansion

- multi-merchant discovery beyond the internal merchant network
- external merchant adapters
- agent identity and reputation
- family/team spending policies
- subscription optimization
- price monitoring
- universal agent checkout protocol
- merchant onboarding API
- AI-commerce analytics benchmark

---

## 7. Functional Flow

```text
USER
 |
 | objective + policy
 v
BUYER AGENT
 |
 +--> intent extraction
 |
 +--> merchant discovery
 |
 +--> product comparison
 |
 +--> negotiation
 |
 +--> candidate selection
 |
 v
POLICY ENGINE
 |
 +--> allowed -> payment
 |
 +--> invalid -> continue search / safe stop
 |
 v
RAZORPAY
 |
 +--> success -> order complete
 |
 +--> failure -> recovery agent
 |
 v
AUDIT + MEMORY
```

---

## 8. Policy Model

### User policy

```json
{
  "singleTransactionLimit": 6000,
  "dailyLimit": 10000,
  "weeklyLimit": 25000,
  "autonomousPurchase": true,
  "allowedCategories": ["electronics", "clothing", "fitness"],
  "negotiation": true,
  "fallbackPayments": ["upi", "card"],
  "opportunityAlerts": true,
  "maxOpportunityOvershoot": 0.2,
  "minOpportunityImprovement": 0.08
}
```

### Merchant policy

```json
{
  "negotiation": true,
  "maxDiscount": 0.10,
  "autoConfirmationLimit": 25000,
  "autoRefundLimit": 2000,
  "upsell": true
}
```

---

## 9. AI Behavior Requirements

The AI must:

- preserve explicit constraints
- avoid inventing availability
- use tools for actual catalog information
- explain material decisions
- stop when no valid option exists
- never claim payment success before confirmation
- never expose secrets
- never bypass policy middleware

The AI must not directly control authorization.

---

## 10. Security & Trust

### Secrets

Server-side only:

- Razorpay secret
- Gemini key
- webhook secret
- Supabase service role key

### Webhooks

- verify signature
- deduplicate events
- make handlers idempotent
- maintain explicit payment state machine

### Authorization

All purchase/refund execution must call deterministic policy functions before the Razorpay adapter.

---

## 11. Success Metrics

### Buyer metrics

- purchase completion rate
- average user interaction count per purchase
- policy violation prevention count
- payment recovery rate
- average savings from negotiation

### Merchant metrics

- AI-generated revenue
- AI conversion rate
- AI upsell revenue
- abandoned-cart recovery revenue
- payment recovery revenue
- average order value uplift

### Trust metrics

- unauthorized action attempts blocked
- successful policy evaluations
- audit completeness
- payment events reconciled

---

## 12. Winning Demo

### Act 1 — Buyer

User gives one sentence.

The agent searches several merchants and compares products.

### Act 2 — Agent-to-agent negotiation

Buyer agent requests a better price.

Merchant agent responds within policy.

### Act 3 — Autonomous purchase

Policy passes. Razorpay payment executes.

### Act 4 — Failure recovery

Force UPI failure in the demo. Agent automatically uses the authorized fallback.

### Act 5 — Opportunity override

The agent identifies a better item above budget and reports it after completing the valid purchase.

### Act 6 — Trust

Open the audit trail and show:

```text
Intent
Candidates
Decision
Negotiation
Policy evaluation
Razorpay action
Failure
Recovery
Final outcome
```

---

## 13. Non-Goals for MVP

Do not spend hackathon time on:

- scraping Amazon or other marketplaces
- real-money production transactions
- complex microservice infrastructure
- custom LLM training
- full ERP integration
- real bank account data
- unrestricted autonomous payments

The internal merchant network is a deliberate design choice for a reliable end-to-end demonstration.

---

## 14. Recommended Technology

```text
Frontend: React + TypeScript + Tailwind + Vite
Hosting: Vercel
Backend: Node.js + TypeScript + Express/Fastify
Hosting: Render or comparable free-tier service
Database/Auth: Supabase PostgreSQL + Supabase Auth
AI: Gemini API free-tier eligible model
Payments: Razorpay Test Mode
Source control: GitHub
```

---

## 15. MVP Definition of Done

The MVP is complete when a judge can:

1. Create a user policy.
2. Give the AI buyer a purchase objective.
3. Watch it search multiple merchants.
4. See comparative reasoning.
5. See AI negotiation.
6. See policy approval.
7. Execute a Razorpay test payment.
8. Trigger a payment failure.
9. See automatic authorized recovery.
10. Receive a final order confirmation.
11. Open the audit trail.
12. Observe a blocked action outside policy.
13. See merchant-side AI revenue metrics.

---

## 16. Product Positioning

### One sentence

**AgentGate is the permissioned transaction layer that lets AI buyers autonomously shop from AI-readable merchants and complete Razorpay payments without giving the agent unrestricted control of money.**

### Why it is differentiated

The project is not another shopping chatbot. It combines:

- agentic buyer behavior
- agentic merchant behavior
- AI-readable catalogs
- bounded negotiation
- delegated spending authority
- automatic payment recovery
- opportunity detection
- merchant revenue growth
- explainable auditability
- Razorpay transaction execution

That combination should be the centerpiece of the hackathon story.
