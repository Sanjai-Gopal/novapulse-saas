# NovaPulse AI — Intelligent Workflow & API Observability SaaS

NovaPulse is a responsive, full-featured telemetry and API observability SaaS platform. It monitors distributed microservices, tracks OpenTelemetry traces, dispatches real-time incident alerts, and provides row-level secured workspaces backed by **Supabase** and verified payments via **Razorpay**.

---

## Key Features

1. **Autonomous API Observability**:
   - Monitored microservices overview with real-time latency ping checks, status badges, and environment tags (Production, Staging, Dev).
   - Live OpenTelemetry trace stream with HTTP method indicators, status codes, and duration measurements.
   - Intelligent incident alerting center with severity categorization (Critical, Warning, Info) and resolution tracking.
   - API Ingestion key generation with one-time secret token reveal and copyable SDK integration snippets for Node.js, Python, and cURL.

2. **Enterprise Authentication**:
   - Built on **Supabase Auth** supporting Email/Password sign-up and sign-in, and Google OAuth.
   - Phone sign-in has been removed to keep authentication streamlined.
   - Dual-mode architecture: Runs seamlessly in live Supabase cloud mode with Row Level Security, or in an interactive local demo mode if credentials are not yet supplied.

3. **Secure Payment & Subscription Flow**:
   - Developer / Growth plan button connects directly to the Razorpay hosted payment link: [`https://razorpay.me/@sanjai6676`](https://razorpay.me/@sanjai6676).
   - Enterprise plan button triggers the Enterprise Walkthrough Demo request workflow.
   - Serverless payment architecture in `/api/razorpay/...` uses server-side HMAC SHA-256 signature verification to prevent exposing `RAZORPAY_KEY_SECRET` in client code.

4. **Multi-Tenant Data Isolation (Row Level Security)**:
   - Full PostgreSQL schema in `supabase/schema.sql` with RLS enabled on `profiles`, `services`, `alerts`, `telemetry_traces`, and `api_keys`.
   - Automated `on_auth_user_created` trigger seeds starter services, alerts, and traces for every new user immediately upon registration.

---

## Quickstart: Run Locally

### Prerequisites
- Node.js `20.19+` or `22.12+`
- npm `10+`

### Steps
1. Navigate to the project directory:
   ```bash
   cd novapulse-saas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials in `.env.local` (see setup guide below).

4. Start the local Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. Test production build:
   ```bash
   npm run build
   npm run preview
   ```

---

## Supabase Configuration & Database Setup

Follow these steps in your [Supabase Dashboard](https://supabase.com/dashboard):

### 1. Execute SQL Schema & RLS Policies
1. Open your Supabase project and navigate to **SQL Editor** (`/project/<id>/sql`).
2. Click **New query** and paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Click **Run**. This creates:
   - `profiles` table with subscription tier (`free`, `growth`, `enterprise`).
   - `services` table with RLS scoped to `auth.uid() = owner_id`.
   - `alerts` table with RLS scoped to `auth.uid() = owner_id`.
   - `telemetry_traces` and `api_keys` tables with RLS.
   - `demo_requests` table for capturing enterprise inquiries.
   - The `on_auth_user_created` trigger that seeds default services when a user registers.

### 2. Enable Authentication Providers
1. In the Supabase sidebar, go to **Authentication** > **Providers**.
2. **Email**: Toggle **Enable Email provider** ON.
3. **Google OAuth**:
   - Toggle **Enable Google provider** ON.
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID for Web Applications.
   - Set the Authorized Redirect URI to your Supabase callback:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste the Google **Client ID** and **Client Secret** into the Supabase Google Provider settings and click **Save**.

### 3. Configure Redirect URLs
In Supabase > **Authentication** > **URL Configuration**:
- **Site URL**: `https://<your-deployed-app>.vercel.app` (or `http://localhost:5173` during local development).
- **Redirect URLs**: Add:
  - `http://localhost:5173/**`
  - `https://<your-deployed-app>.vercel.app/**`

---

## Razorpay Payment Setup

### 1. Hosted Quick Payment Link
The Developer / Growth plan button directs users to:
```
https://razorpay.me/@sanjai6676
```
Configure your payment amounts and branding directly in your Razorpay Dashboard under **Payment Links / Pages**.

### 2. Server-Side Payment Verification (Optional for Automated Upgrades)
To automate subscription activation after checkout:
1. In [Razorpay Dashboard](https://dashboard.razorpay.com/) > **Settings** > **API Keys**, generate your **Key ID** and **Key Secret**.
2. Add these to your server environment (e.g. Vercel Environment Variables):
   - `RAZORPAY_KEY_ID=rzp_live_...`
   - `RAZORPAY_KEY_SECRET=...`
3. Never prefix Razorpay secrets with `VITE_`. Vercel automatically exposes serverless functions under `/api/razorpay/create-order.js` and `/api/razorpay/verify-payment.js` without leaking secrets to the browser.

---

## Deployment on Vercel

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete NovaPulse SaaS with Supabase RLS and Razorpay"
   git push origin main
   ```

2. In the [Vercel Dashboard](https://vercel.com/new), import your `novapulse-saas` repository.
3. Framework Preset: **Vite**.
4. In **Project Settings** > **Environment Variables**, add:

| Variable Name | Value | Target |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable/anon key | Production, Preview |
| `VITE_RAZORPAY_PAYMENT_LINK` | `https://razorpay.me/@sanjai6676` | Production, Preview |
| `RAZORPAY_KEY_ID` | `rzp_live_...` (or test key) | Production, Preview |
| `RAZORPAY_KEY_SECRET` | Your Razorpay secret key | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key | Production, Preview |

5. Click **Deploy**. Vercel will build the frontend assets and automatically deploy serverless functions in `/api`.

---

## Security Architecture

- **Zero Secret Leakage**: The client frontend only receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. All Razorpay API secrets and Supabase service-role credentials reside strictly on the server side.
- **Row Level Security (RLS)**: Direct browser calls to Supabase are restricted to rows where `owner_id = auth.uid()`. Even if an authenticated user attempts to query another user's services or traces via the API, PostgreSQL blocks unauthorized access at the database level.
- **Input Validation**: All client forms validate inputs against sanitization schemas before dispatching network payloads.
