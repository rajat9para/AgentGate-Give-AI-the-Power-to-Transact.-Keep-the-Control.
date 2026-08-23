# Demo Evidence: Blocked Out-of-Bounds Transaction (`RED`)

## 1. Scenario Summary
- **User Prompt**: *"Buy luxury smartwatch for ₹35,000"*
- **User Spending Policy**: Single Tx Limit = ₹6,000 | Daily Limit = ₹10,000
- **Result**: **HARD BLOCK (`RED`)** — Deterministic Policy Engine intercepted and prevented unauthorized money movement before reaching the payment gateway.

---

## 2. Policy Engine Rejection Output

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                      DETERMINISTIC TRUST GATEWAY REJECTION                  ║
╠═════════════════════════════════════════════════════════════════════════════╣
║  🚫 Decision:             RED (HARD BLOCKED)                                ║
║  ⚠️ Reason:               BLOCKED: ₹8,499 exceeds single transaction limit  ║
║                           of ₹6,000.                                        ║
║  🔒 Invariant Breached:   P_order (₹8,499) > L_single (₹6,000)              ║
║  💳 Razorpay Action:      ZERO — Payment execution endpoint was NOT called. ║
║  📦 Order Created:        NONE (Transaction aborted safely)                 ║
║  📋 Audit Status:         Recorded as "blocked" in session audit ledger.    ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Step-by-Step Execution Trace

### Step 1: Intent Extraction
```json
{
  "category": "electronics",
  "subcategory": "smartwatch",
  "max_price": 35000,
  "purchase": true
}
```

### Step 2: Merchant Discovery
- Top product candidate found: **TechNest ProWatch Ultra** (₹8,499) from TechNest.

### Step 3: Policy Gate Verification (Zero-Trust Interception)
```typescript
evaluateUserPolicy('demo-buyer-001', 8499, 'electronics', 'upi');
```
**Evaluation Breakdown**:
- `Amount Check`: `8499 <= 6000` $\rightarrow$ **`false`**
- `Daily Velocity`: `(0 + 8499) <= 10000` $\rightarrow$ `true`
- `Category Check`: `'electronics'` $\in$ `allowed_categories` $\rightarrow$ `true`
- `Payment Check`: `'upi'` $\in$ `fallback_payments` $\rightarrow$ `true`

**Result**:
- **`decision: "RED"`**
- **`reason: "BLOCKED: ₹8499 exceeds single transaction limit of ₹6000."`**

### Step 4: Security Invariant Guarantee
- No Razorpay order was initialized.
- No payment gateway API was contacted.
- No user bank funds were touched.
- The failure was logged to the Immutable Audit Ledger for compliance and user transparency.
