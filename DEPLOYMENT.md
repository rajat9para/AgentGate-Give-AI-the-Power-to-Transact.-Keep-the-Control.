# AgentGate — Production Deployment & Infrastructure Guide

> **Architecture Principle**:
> *AI can PLAN and PROPOSE. Deterministic systems AUTHORIZE. Cryptographic controls PROVE authorization (Ed25519). The execution gateway ENFORCES authorization. The payment provider EXECUTES the transaction.*

---

## 1. Production Architecture Overview

AgentGate utilizes a decoupled, enterprise cloud architecture:

```
                    ┌─────────────────────────┐
                    │         VERCEL          │
                    │   Web Frontend / UI     │
                    └────────────┬────────────┘
                                 │ HTTPS
                                 ▼
                    ┌─────────────────────────┐
                    │         RENDER          │
                    │     Backend / API       │
                    │                         │
                    │  Agent Orchestration    │
                    │  Policy Engine          │
                    │  Authorization Layer    │
                    │  Execution Gateway      │
                    │  Audit Service           │
                    │  Payment Service         │
                    └───────┬─────────┬───────┘
                            │         │
                            │         └───────────────┐
                            ▼                         ▼
                    ┌───────────────┐          ┌───────────────┐
                    │   SUPABASE    │          │   RAZORPAY    │
                    │ PostgreSQL    │          │ Payment API   │
                    │               │          │               │
                    │ Users         │          │ Test/Live     │
                    │ Policies      │          └───────────────┘
                    │ Agents        │
                    │ Transactions  │
                    │ Authorizations│
                    │ Nonces        │
                    │ Audit Logs    │
                    └───────────────┘

                    ┌────────────────┐
                    │   CLOUDINARY   │
                    │ Object Storage │
                    │ Documents      │
                    │ Images/Files   │
                    └────────────────┘
```

---

## 2. Secrets & Responsibility Matrix

| Service | Responsibility | Required Secrets (Backend Only) | Browser Safe (Frontend) |
| :--- | :--- | :--- | :--- |
| **Vercel** | SPA Frontend Hosting | *None* | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME` |
| **Render** | API & Execution Gateway | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`, `AGENTGATE_SIGNING_KEY` | `PORT`, `FRONTEND_URL` |
| **Supabase** | Relational Database & RLS | PostgreSQL connection / Service Role | Anon Public Key |
| **Cloudinary** | Receipts, Images, Proof Files | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `CLOUDINARY_CLOUD_NAME` |
| **Razorpay** | Payment Gateway & Webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `RAZORPAY_KEY_ID` (Public) |

---

## 3. Step-by-Step Deployment Instructions

### Phase 1: Supabase Database Setup

1. **Create Supabase Project**:
   - Sign in to [Supabase](https://supabase.com) and create a new project.
   - Note your **Database Password** and **Region**.

2. **Execute Database Migrations**:
   - In the Supabase Dashboard, navigate to the **SQL Editor**.
   - Open and run [supabase/migrations/20260823000000_agentgate_schema.sql](file:///c:/Razorpay_hackahton_project/supabase/migrations/20260823000000_agentgate_schema.sql).
   - This creates all 11 core tables (`users`, `policies`, `merchants`, `products`, `orders`, `transaction_authorizations`, `authorization_nonces`, `spending_reservations`, `payment_attempts`, `audit_events`, `signing_keys`), indexes, constraints, and Row Level Security (RLS) policies.

3. **Execute Seed Data**:
   - In the SQL Editor, open and run [supabase/seed.sql](file:///c:/Razorpay_hackahton_project/supabase/seed.sql).
   - Populates initial merchants (RunPro, TechNest, CampusMart, FitFuel), catalog products, variants, demo buyer, policy limits, and active Ed25519 signing key.

4. **Retrieve API Credentials**:
   - Navigate to **Project Settings** $\rightarrow$ **API**.
   - Copy `Project URL` $\rightarrow$ `SUPABASE_URL`.
   - Copy `anon public key` $\rightarrow$ `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`.
   - Copy `service_role secret key` $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY` (⚠️ **Backend only; never expose to frontend**).

---

### Phase 2: Cloudinary Object Storage Setup

1. **Create Cloudinary Account**:
   - Sign up at [Cloudinary](https://cloudinary.com).
2. **Retrieve API Keys**:
   - In the Cloudinary Dashboard console, copy:
     - `Cloud Name` $\rightarrow$ `CLOUDINARY_CLOUD_NAME`
     - `API Key` $\rightarrow$ `CLOUDINARY_API_KEY`
     - `API Secret` $\rightarrow$ `CLOUDINARY_API_SECRET`
3. **Upload Preset (Optional)**:
   - Create an upload preset named `agentgate_uploads` with signed uploads enabled.

---

### Phase 3: Razorpay Payment Gateway Setup

1. **Generate API Keys**:
   - Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com) in **Test Mode**.
   - Go to **Settings** $\rightarrow$ **API Keys** $\rightarrow$ **Generate Key**.
   - Copy `Key ID` $\rightarrow$ `RAZORPAY_KEY_ID`.
   - Copy `Key Secret` $\rightarrow$ `RAZORPAY_KEY_SECRET`.
2. **Configure Webhook**:
   - Go to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add New Webhook**.
   - **Webhook URL**: `https://<your-render-backend>.onrender.com/api/webhooks/razorpay`
   - **Secret**: Set a strong random secret $\rightarrow$ `RAZORPAY_WEBHOOK_SECRET`.
   - **Active Events**:
     - `payment.authorized`
     - `payment.captured`
     - `payment.failed`
     - `order.paid`

---

### Phase 4: Render Backend Web Service Deployment

1. **Connect Repository**:
   - Sign in to [Render](https://render.com) and click **New +** $\rightarrow$ **Web Service** (or use Blueprint with `render.yaml`).
   - Select your GitHub repository: `https://github.com/rajat9para/AgentGate-Give-AI-the-Power-to-Transact.-Keep-the-Control..git`.

2. **Configure Service Settings**:
   - **Name**: `agentgate-api`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build:api`
   - **Start Command**: `npm run start --workspace=apps/api`
   - **Health Check Path**: `/health`

3. **Configure Environment Variables**:
   ```env
   NODE_ENV=production
   DEMO_MODE=false
   PORT=5000
   REQUEST_TIMEOUT_MS=30000

   # URLs
   FRONTEND_URL=https://your-agentgate-app.vercel.app
   BACKEND_URL=https://agentgate-api.onrender.com

   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Groq AI (Ultra-fast LLM)
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b

   # Razorpay
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret

   # Ed25519 Signing Authority
   AGENTGATE_KEY_ID=agentgate-prod-2026-08-v1
   AGENTGATE_SIGNING_KEY=your_private_ed25519_key (optional: auto-generated in-memory if left empty)
   ```

4. **Deploy**:
   - Trigger manual deploy. Once built, verify the health endpoints:
     - `https://agentgate-api.onrender.com/health` (Liveness)
     - `https://agentgate-api.onrender.com/ready` (Subsystems readiness)

---

### Phase 5: Vercel Frontend UI Deployment

1. **Import Project into Vercel**:
   - Sign in to [Vercel](https://vercel.com) and click **Add New** $\rightarrow$ **Project**.
   - Select your GitHub repository.
2. **Build and Output Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/web` (or root with `npm run build --workspace=apps/web`)
   - **Output Directory**: `dist`
3. **Configure Frontend Environment Variables**:
   ```env
   VITE_API_BASE_URL=https://agentgate-api.onrender.com/api
   VITE_APP_URL=https://your-agentgate-app.vercel.app
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
   ```
4. **Deploy & Bind Domain**:
   - Click **Deploy**. Vercel will bundle the production frontend using `vercel.json` SPA routing.

---

## 4. Health & Verification Probes

### Liveness Probe (`GET /health`)
```bash
curl https://agentgate-api.onrender.com/health
```
```json
{
  "status": "ok",
  "environment": "production",
  "demo_mode": false,
  "timestamp": "2026-08-23T18:40:00.000Z",
  "uptime_seconds": 142
}
```

### Readiness Probe (`GET /ready`)
```bash
curl https://agentgate-api.onrender.com/ready
```
```json
{
  "status": "ready",
  "timestamp": "2026-08-23T18:40:00.000Z",
  "subsystems": {
    "crypto_key_manager": {
      "status": "operational",
      "active_key_id": "agentgate-prod-2026-08-v1",
      "algorithm": "Ed25519"
    },
    "supabase": {
      "status": "healthy",
      "message": "Supabase PostgreSQL connected & responsive."
    },
    "cloudinary": {
      "configured": true,
      "mode": "cloud"
    },
    "razorpay": {
      "configured": true,
      "mode": "live-api"
    }
  }
}
```

---

## 5. Key Rotation & Disaster Recovery

### Ed25519 Key Rotation
1. Generate new Ed25519 key pair with versioned ID (e.g., `agentgate-prod-2026-09-v2`).
2. Insert new public key into `signing_keys` table in Supabase.
3. Update `AGENTGATE_KEY_ID` and `AGENTGATE_SIGNING_KEY` on Render.
4. Existing in-flight authorizations remain verifiable using the registered previous public key until expired.

### Rollback Procedure
1. **Frontend**: In Vercel, select the previous successful deployment and click **Instant Rollback**.
2. **Backend**: In Render, select the previous deploy and click **Rollback to this revision**.
3. **Database**: If necessary, run schema rollback scripts against Supabase SQL console.
