# Demo Evidence: Authorized Autonomous Transaction (`GREEN`)

## 1. Scenario Summary
- **User Prompt**: *"Buy black running shoes for daily training, size 9, under ₹6,000"*
- **User Spending Policy**: Single Tx Limit = ₹6,000 | Daily Limit = ₹10,000 | Allowed Categories = `['running_shoes', 'electronics', ...]` | Fallback Payments = `['upi', 'card']`
- **Result**: **SUCCESS (`GREEN`)** — Autonomous price negotiation, policy validation, Razorpay order creation, automatic recovery from simulated UPI timeout to Card, and audit confirmation.

---

## 2. Rendered Explainable Decision Card

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                        EXPLAINABLE DECISION CARD                            ║
╠═════════════════════════════════════════════════════════════════════════════╣
║  📦 What I bought:        RunPro Velocity X Daily Trainer (Size 9, Black)   ║
║  🏪 Merchant:             RunPro Sports (Rating: 4.6/5, Reliability: 94%)   ║
║  💰 How much I paid:      ₹5,538 (List Price: ₹5,799 — Saved ₹261 via AI)   ║
║  🎯 Why I chose it:       100% attribute match, responsive cushioning,      ║
║                           highest ranked candidate (94/100 score).          ║
║  🔍 Alternatives scanned: 5 candidates evaluated across 4 network merchants ║
║  🔐 Policy evaluation:    GREEN — Within single limit (₹6,000),             ║
║                           daily budget (₹4,462 remaining), category allowed ║
║  💳 Payment route:        UPI Declined (U69 Timeout) ➔ Autonomously         ║
║                           recovered via Card (pay_demo_9a8f2bc)             ║
║  📋 Order Reference:      ba5525b8-82d9-4545-ae3f-6b4142a04620              ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Step-by-Step Execution Trace

### Step 1: Natural Language Intent Extraction
```json
{
  "category": "running_shoes",
  "subcategory": "daily_training",
  "use_case": "daily_training",
  "max_price": 6000,
  "size": "9",
  "color": "black",
  "hard_constraints": ["size_9"],
  "purchase": true
}
```

### Step 2: Multi-Merchant Candidate Discovery & Ranking
| Product | Merchant | List Price | Match Score | Key Attribute Matches |
| :--- | :--- | :--- | :--- | :--- |
| **RunPro Velocity X** | RunPro Sports | ₹5,799 | **94 / 100** | Category, Subcategory, Size 9, Black, Responsive |
| **RunPro CloudStride** | RunPro Sports | ₹4,999 | **88 / 100** | Category, Subcategory, Size 9, Black, Cushioning |
| **FitFuel SprintX** | FitFuel | ₹3,999 | **82 / 100** | Category, Subcategory, Size 9, Black |
| **CampusMart QuickRun** | CampusMart | ₹1,999 | **74 / 100** | Category, Subcategory, Size 9, Black |

### Step 3: Agent-to-Agent Bounded Negotiation
- **Round 1 (Buyer AI)**: *"I'm interested in this product. Would you consider ₹5,103?"*
- **Round 1 (Merchant AI)**: *"Thank you for your interest! I can offer ₹5,567 — that's 4% off."*
- **Round 2 (Buyer AI)**: *"How about we meet in the middle at ₹5,335?"*
- **Round 2 (Merchant AI)**: *"Deal! I'll do ₹5,538 for you. That's my best offer."* (4.5% discount; satisfies Merchant max_discount cap of 10%).
- **Round 3 (Buyer AI)**: *"Agreed! ₹5,538 works for me. Proceeding with purchase."*

### Step 4: Deterministic Policy Engine Evaluation
- `Amount Check`: ₹5,538 $\le$ ₹6,000 (**PASS**)
- `Daily Velocity`: ₹0 + ₹5,538 $\le$ ₹10,000 (**PASS**)
- `Weekly Velocity`: ₹0 + ₹5,538 $\le$ ₹25,000 (**PASS**)
- `Category Whitelist`: `'running_shoes'` $\in$ `allowed_categories` (**PASS**)
- `Payment Method`: `'upi'` $\in$ `fallback_payments` (**PASS**)
- **Decision**: **`GREEN`**

### Step 5: Razorpay Execution & Autonomous Payment Recovery
1. Razorpay Order created: `order_demo_ba5525b8` (Amount: ₹5,538 / 553,800 paise)
2. Primary payment attempted: `UPI`
3. Primary payment status: `FAILED` (Bank server timeout. Error code: `U69`)
4. Webhook dispatched: `payment.failed`
5. Payment Recovery Agent invoked $\rightarrow$ consults Buyer Policy fallback chain (`['upi', 'card']`)
6. Fallback payment attempted: `Card`
7. Fallback payment status: `CAPTURED` (Transaction ID: `pay_demo_9a8f2bc`)
8. Webhook dispatched: `payment.captured`
9. Order Status updated: `PAID`

### Step 6: Audit Trail Generated
- 10 atomic audit records created with timestamps, session IDs, policy states, and plain-language rationale.
