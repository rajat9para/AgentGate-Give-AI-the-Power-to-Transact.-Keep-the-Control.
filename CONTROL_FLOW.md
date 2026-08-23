# AgentGate — Control Flow & Decision Engine

## 1. Purpose

This document defines who controls each decision in AgentGate, how authority moves through the system, and exactly where AI is allowed to act.

The guiding principle is:

> **LLM proposes. Deterministic policy code authorizes. Razorpay executes. Webhooks confirm. The audit ledger records.**

---

## 2. Authority Hierarchy

```text
User Policy
    |
    v
AgentGate Policy Engine
    |
    v
Buyer Agent Decision
    |
    v
Merchant Agent Policy
    |
    v
Transaction Action
    |
    v
Razorpay
```

No downstream component can increase authority granted upstream.

---

## 3. Buyer Control Flow

### A. User gives an objective

```text
"Buy a daily-training running shoe under ₹6,000."
```

### B. Agent extracts structured intent

```json
{
  "category": "running_shoes",
  "use_case": "daily_training",
  "max_price": 6000,
  "purchase": true
}
```

### C. Agent searches all available merchant catalogs

The agent must search the full available candidate set before selecting a winner when the request requires “best” or “cheapest”.

### D. Candidate ranking

Each candidate receives a deterministic or hybrid score using:

```text
Requirement match
Product quality
Price
Merchant reliability
Inventory
Delivery
User preferences
Current discount
```

### E. Merchant negotiation

Only if:

```text
merchant_policy.negotiation == true
```

The negotiation engine enforces:

- maximum discount
- maximum number of rounds
- minimum acceptable merchant price
- user price limit

### F. User policy validation

```text
final_price <= user_policy.single_transaction_limit
AND
category is allowed
AND
payment method is allowed
AND
remaining daily/weekly budget is sufficient
```

If all conditions pass, the agent is authorized to purchase.

---

## 4. Three Decision States

### GREEN — Execute

```text
Candidate satisfies objective
AND
policy is satisfied
AND
risk is acceptable
        |
        v
BUY
```

No user approval request.

### AMBER — Recover inside policy

The initially preferred action is unavailable or fails, but an alternative action remains within the existing authority.

Examples:

- UPI fails → authorized card fallback
- Merchant A unavailable → merchant B
- Discount fails → buy at valid price

Agent continues autonomously.

### RED — Outside authority

No valid action can be completed under the user's policy.

Examples:

- Only suitable product costs ₹9,000 when limit is ₹6,000
- Refund exceeds merchant authority
- Payment recovery would exceed the spending limit

Agent does not silently expand authority.

---

## 5. Opportunity Override

Opportunity Override is not a permission to buy outside policy.

It is an information mechanism.

Flow:

```text
Find best valid option
        |
        v
Purchase valid option
        |
        v
Search for materially better option outside range
        |
        v
Improvement >= threshold?
        |
      YES
        |
        v
Price overshoot <= configured threshold?
        |
      YES
        |
        v
Notify user
```

Example:

```text
Current purchase:
₹5,799 / score 95

Opportunity:
₹6,999 / score 98

Overshoot: 20.7%
Improvement: 3 points
```

If the threshold is 8% improvement, do not notify.

If a future configuration permits this opportunity, the system can present it as an optional upgrade. It still requires explicit acceptance because it exceeds the original authority.

---

## 6. Payment Control Flow

```text
Approved purchase
      |
      v
Create Razorpay Order
      |
      v
Checkout / payment authorization
      |
      +------ success ------> verify webhook -> mark PAID
      |
      +------ failure ------> recovery engine
```

### Recovery engine

The recovery engine reads:

```text
user_policy.payment_fallbacks
merchant_policy.allowed_methods
transaction_amount
retry_count
failure_code
```

It then selects the next permitted action.

Example:

```text
UPI failed
  |
  v
Retry allowed? YES
  |
  v
Retry #1
  |
  v
Failed
  |
  v
Card fallback allowed? YES
  |
  v
Card payment succeeds
```

If no permitted action remains, the system ends the flow safely and explains why.

---

## 7. Refund Control Flow

Refunds should be more restrictive than purchases.

Example merchant policy:

```text
Auto refund <= ₹2,000
Manual approval > ₹2,000
```

Agent requests:

```text
refund = ₹12,000
```

Decision:

```text
BLOCKED
```

The system logs the action and surfaces an approval workflow instead of executing it.

---

## 8. Agent-to-Agent Control

```text
Buyer Agent
   |
   | request product + constraints
   v
Merchant Agent
   |
   | offer / negotiation proposal
   v
Buyer Agent
   |
   | counter-offer within buyer budget
   v
Merchant Agent
   |
   | final offer within merchant rules
   v
Policy Engine
   |
   v
Transaction
```

Neither agent can override the other's policy.

---

## 9. Webhook Control Flow

```text
Razorpay
   |
   v
Webhook endpoint
   |
   v
Signature verification
   |
   v
Idempotency check
   |
   v
Event handler
   |
   +--> payment state
   +--> order state
   +--> recovery state
   +--> audit log
```

The frontend should never treat a client-side success callback alone as the final payment authority.

---

## 10. Audit Requirements

Every money-related action must log:

```text
agent_id
user_id
merchant_id
action
requested_amount
approved_amount
reason
policy_id
policy_result
risk_result
payment_id
order_id
timestamp
result
```

This supports the hackathon requirement that money actions are explainable and auditable.

---

## 11. Golden Rule

```text
AI can decide HOW.

Policy decides WHETHER.

Razorpay executes.

Webhook confirms.

Audit records.
```
