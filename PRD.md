# 📄 RazorX (AgentGate) — Product Requirements Document (PRD)

> **Document Version**: 2.0.0  
> **Status**: Approved & Implemented  
> **Author**: Rajat Para  
> **Category**: Autonomous AI Commerce & Fintech Security Infrastructure  

---

## 1. Product Vision & Problem Statement

### Vision
To become the global trust, governance, and cryptographic transaction layer that enables autonomous AI agents to discover, negotiate, and execute commerce on behalf of humans without risk of financial loss or fraud.

### Core Problem
Generative AI agents are probabilistic reasoning systems. When given direct access to financial credentials (credit cards, bank tokens, unconstrained payment APIs), they pose severe risks:
1. **Hallucination Risk**: Misinterpreting pricing tiers or purchasing wrong variants.
2. **Security & Prompt Injection Risk**: Malicious websites or prompts coercing agents into draining funds.
3. **No Dynamic Governance**: Absence of real-time velocity meters, category whitelists, or cryptographic parameter binding.
4. **Checkout Drop-Off**: Transient payment timeouts (e.g. UPI bank outages) cause complete workflow failure without automated fault recovery.

---

## 2. Target Personas

| Persona | Description | Primary Needs |
| :--- | :--- | :--- |
| **The Autonomous Consumer** | Tech-forward individual delegating routine procurement (groceries, gear, electronics, office supplies) to an AI assistant. | Complete confidence that the agent cannot overspend, clear explainability on why products were chosen, and automatic discounts. |
| **The Verified Merchant** | Direct-to-consumer brand or retailer selling goods online. | Ability to expose machine-readable catalogs to AI agents, capture high-intent autonomous shoppers, and protect gross profit margins during automated bargaining. |
| **The Enterprise Administrator** | Finance lead or compliance officer overseeing departmental AI spend. | Tamper-evident cryptographic audit logs (SHA-256 Merkle chains), strict daily/weekly velocity limits, and GST-compliant tax invoices. |

---

## 3. Functional Requirements

### 3.1. Natural Language Intent Parsing & Semantic Extraction
- The system must accept free-form conversational queries (e.g., *"Buy black running shoes size 9 under ₹6,000"*).
- It must extract structured parameters: `category`, `subcategory`, `max_price`, `size`, `color`, `brand`, and `preferences`.
- It must provide a deterministic rule-based fallback parser if LLM APIs experience rate limits or network degradation.

### 3.2. Federated Catalog Discovery & Scoring
- The system must query all registered merchant networks simultaneously.
- It must score candidates using a multi-factor weighting algorithm:
  $$\text{Score} = w_{\text{rel}} \cdot S_{\text{rel}} + w_{\text{sub}} \cdot S_{\text{sub}} + w_{\text{price}} \cdot S_{\text{price}} + w_{\text{qual}} \cdot S_{\text{qual}} + w_{\text{relb}} \cdot S_{\text{merchant}}$$
- It must filter out out-of-stock items and incompatible variants before ranking.

### 3.3. Autonomous AI-to-AI Price Negotiation
- The Buyer Agent must initiate multi-round price bidding with the Merchant Agent for negotiable items.
- The Merchant Agent must enforce strict floor prices: $P_{\text{floor}} = P_{\text{original}} \times (1 - D_{\text{max}})$.
- Both agents must log plain-English bargaining rationales for every concession round.

### 3.4. Deterministic Spending Policy Gate
- The policy engine must enforce:
  1. `single_transaction_limit` (e.g., max ₹6,000)
  2. `daily_limit` (rolling 24-hour spending velocity)
  3. `weekly_limit` (rolling 7-day spending velocity)
  4. `allowed_categories` (whitelist check)
  5. `allowed_payment_methods` (authorized rail check)
- If any constraint is violated, the transaction must immediately return `RED` and halt execution before payment creation.

### 3.5. Cryptographic Transaction Authorization (Ed25519)
- Upon `GREEN` policy approval, the engine must generate an Ed25519 digital signature signing the exact parameter payload and nonce.
- The signature must have a 5-minute Time-To-Live (TTL).
- Reusing a token nonce must result in immediate fail-closed rejection.

### 3.6. Centralized Execution Gateway & Razorpay Rails
- The gateway must verify the digital signature and lock funds via an atomic mutex reservation engine.
- It must create standard Razorpay Orders (`order_xxx`) and process payment captures.
- In the event of primary payment failure (e.g., UPI timeout `Error U69`), the **Payment Recovery Agent** must automatically switch to pre-authorized fallback methods (`Card`) and reconcile via webhooks.

### 3.7. Explainable Decision Cards & Tax Invoices
- Every transaction must generate an **Explainable Decision Card** detailing:
  - What was bought
  - Merchant rating & reliability
  - List price vs. final price & savings achieved
  - Reason for selection & candidate alternatives scanned
  - Payment routing & recovery audit trail
- The system must provide instant downloadable GST-compliant tax invoices.

---

## 4. Non-Functional & Security Requirements

| Metric / Dimension | Requirement | Implementation |
| :--- | :--- | :--- |
| **Latency** | End-to-end intent to authorization $\le 1.5\text{s}$ | In-memory cache + fast Ed25519 native cryptographic operations. |
| **Availability** | 99.9% uptime with resilient fallbacks | Hybrid LLM + deterministic regex classifier + Supabase keep-alive. |
| **Data Integrity** | Zero data tampering | SHA-256 Merkle hash chain linking every audit block. |
| **Concurrency** | Zero race-condition overspending | Mutex-guarded atomic budget reservation engine. |
| **Responsive UI** | Fluid viewport containment & dark/light theme | React 18, Vite 6, TailwindCSS glassmorphism, responsive flex layouts. |
