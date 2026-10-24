# API Autopsy

> **When APIs change, know what breaks.**  
> Continuous third-party API contract inspection, deterministic schema diffing, application code impact analysis, and Gemini-powered failure autopsies with verified unified diff patches.

Built for the **Devpost Build With AI: Basics** learning hackathon (October 2026).

---

## The Problem

Modern applications depend on dozens of external third-party APIs (payment processors, authentication providers, shipping trackers, communication gateways). 

When an external provider changes its response payload—renaming a field, removing a legacy identifier, or changing an object structure:
1. **The API doesn't return an HTTP 500.** It returns an HTTP 200 with an altered payload.
2. **Traditional monitors report "Healthy".** Uptime checks and latency probes stay green.
3. **Your application fails silently.** Downstream code reads `undefined`, passes corrupt state to services, and breaks user workflows.
4. **Debugging is painful.** Developers must reverse-engineer the provider's unannounced contract drift and hunt through their repository to find every affected call site.

---

## How API Autopsy Solves It

API Autopsy connects external API contract drift directly to the lines of code in your codebase that depend on them:

```
API changed → customer_id removed → payment.customer_id → undefined → Customer lookup fails → Recommended fix
```

1. **Discover Integrations:** Read-only repository scanner detects outbound HTTP requests, endpoint paths, and field access references with transparent confidence levels.
2. **Capture Baselines:** Establishes a known-good structural baseline for each configured API endpoint.
3. **Continuous Monitoring & Dual-Path Pipeline:**
   - **Real Checks:** Periodic background scheduler polls external APIs and validates live response structures against captured baselines.
   - **Simulations:** Controlled sandbox executes breaking payload mutations (e.g., canonical `customer_id` → `customer.id` demo) to test application resilience safely.
4. **Deterministic Diff Engine:** Compares JSON schemas recursively—ignoring harmless property ordering while flagging breaking deletions, renames, and type mutations.
5. **Repository Impact Scan:** Queries repository files for direct references to altered fields (dot notation, bracket syntax, destructuring) using pattern-based matching.
6. **Gemini Root Cause Autopsy:** Google Gemini reasons over the deterministic diff and verified code evidence to reconstruct the failure propagation path and generate a unified diff patch (`--- a/file +++ b/file`).
7. **Strict Provenance Attribution:** Clear boundaries ensure pre-loaded demo fixtures are never misrepresented as live repository scans.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    Next.js Dashboard UI                   │
│   (Monitor Detail, Live Pipeline, Autopsy Report, Registry)│
└───────────────▲───────────────────────────▲───────────────┘
                │ HTTP REST                 │ Socket.IO Events
┌───────────────▼───────────────────────────▼───────────────┐
│                 server.ts (Custom Server)                 │
│         - Next.js Request Router                          │
│         - Socket.IO Real-Time Dispatcher                  │
│         - In-Process Polling Scheduler (5 min interval)   │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                   Dual-Path Incident Pipeline             │
│                                                           │
│   Real HTTP Check Path              Simulation Path       │
│   (executeMonitorCheck)            (executeSimulation)    │
│           │                                │              │
│           └────────────────┬───────────────┘              │
│                            │                              │
│                            ▼                              │
│             1. Recursive JSON Schema Diff                 │
│                            │                              │
│                            ▼                              │
│             2. Severity Classification (Breaking/Additive)│
│                            │                              │
│                            ▼                              │
│             3. Repository Impact Analysis                 │
│                (Live Repo Scan vs Canonical Demo Fixture) │
│                            │                              │
│                            ▼                              │
│             4. Gemini Autopsy Reasoning                   │
│                (Root Cause + Failure Path + Unified Patch)│
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                   │
│   (Users, Repositories, Monitors, Baselines, Incidents,   │
│    Autopsy Reports, Encrypted Credentials)                │
└───────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Node.js**: `v20.9.0` or higher
- **Package Manager**: `npm`
- **PostgreSQL**: `v15` or higher (local or managed instance, e.g. Neon, Supabase)
- **Google Gemini API Key**: with access to `gemini-3.8-flash` (or compatible model)
- **GitHub Account**: with permissions to register a GitHub OAuth App and GitHub App

---

## Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

### Environment Variables Reference

| Variable | Required In | Description | Format / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Production & Dev | PostgreSQL pooled connection string | `postgresql://user:pass@ep-xyz.neon.tech/autopsy?sslmode=require` |
| `NEXTAUTH_SECRET` | Production & Dev | 32-byte session encryption secret | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Production & Dev | Canonical URL of the application | `https://your-project.vercel.app` (or `http://localhost:3000`) |
| `GITHUB_OAUTH_CLIENT_ID` | Production & Dev | GitHub OAuth App Client ID (user authentication) | `Ov23li...` |
| `GITHUB_OAUTH_CLIENT_SECRET` | Production & Dev | GitHub OAuth App Client Secret | `6b2d18...` |
| `GITHUB_APP_ID` | Production & Dev | GitHub App ID (repository code scanning) | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | Production & Dev | GitHub App RSA Private Key (PEM format with `\n`) | `"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"` |
| `GITHUB_APP_CLIENT_ID` | Production & Dev | GitHub App Client ID | `Iv23...` |
| `GITHUB_APP_CLIENT_SECRET` | Production & Dev | GitHub App Client Secret | `a1b2c3...` |
| `GEMINI_API_KEY` | Production & Dev | Google GenAI API Key for Autopsy reasoning | `AIzaSy...` |
| `GEMINI_MODEL` | Production & Dev | Gemini model identifier | `gemini-3.8-flash` |
| `ENCRYPTION_KEY` | Production & Dev | 32-byte AES-256 key as 64 hex characters | `openssl rand -hex 32` |
| `CRON_SECRET` | Production & Dev | Bearer secret for `/api/cron/monitor-tick` | `openssl rand -hex 32` |
| `PORT` | Local Dev Only | Custom server HTTP port (**Do NOT set on Vercel**) | `3000` |

> **Security Note:** `.env`, `.env.local`, and real secrets are strictly excluded in `.gitignore`. Real credentials must never be committed to Git.

---

## Quickstart & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database Schema
Apply migrations using Drizzle ORM:
```bash
npm run db:push
```

### 3. Start Development Server
API Autopsy uses a custom Node.js server (`server.ts`) that hosts Next.js, Socket.IO, and the background polling scheduler in a unified process:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open the application.

---

## Vercel Deployment Guide

API Autopsy is designed for seamless native Next.js deployment on Vercel without relying on custom server infrastructure.

### 1. Git-Based Deployment Steps
1. Fork or push the repository to GitHub: `https://github.com/7ds-adarsh/Autopsy`
2. In the [Vercel Dashboard](https://vercel.com/new), select **Add New...** → **Project**.
3. Import your GitHub repository.
4. Framework Preset: **Next.js** (automatically detected).
5. Build Command: `next build` (default).
6. Output Directory: `.next` (default).
7. Configure all Required Environment Variables (see checklist below) under **Environment Variables**.
8. Click **Deploy**.

### 2. Production Database Preparation
- **Recommended Providers:** [Neon](https://neon.tech), [Supabase](https://supabase.com), or any managed PostgreSQL instance with a connection pooler (e.g. PgBouncer).
- **Serverless Pooling:** Use the pooled connection string (port 6543 on Supabase, or `-pooler` endpoint on Neon). API Autopsy's DB client is configured with `max: 5`, a 10-second idle timeout, and 5-second connection timeout to keep serverless function cold starts low.
- **Applying Schema to Production:**  
  Run migrations locally targeting your production database URL (never run migrations as an automatic build side effect):
  ```bash
  # Option A: Run migrations via Drizzle Kit
  DATABASE_URL="postgresql://user:pass@ep-pooler.neon.tech/autopsy?sslmode=require" npm run db:migrate

  # Option B: Push schema directly
  DATABASE_URL="postgresql://user:pass@ep-pooler.neon.tech/autopsy?sslmode=require" npm run db:push
  ```

### 3. Production GitHub Configuration

#### A. GitHub OAuth App (User Login)
In GitHub Settings → Developer Settings → OAuth Apps:
- **Application name:** API Autopsy (Production)
- **Homepage URL:** `https://your-project.vercel.app`
- **Authorization callback URL:** `https://your-project.vercel.app/api/auth/callback/github`
- Copy Client ID and generate a Client Secret to set as `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.

#### B. GitHub App (Repository Scanner)
In GitHub Settings → Developer Settings → GitHub Apps:
- **GitHub App name:** API Autopsy Scanner (Production)
- **Homepage URL:** `https://your-project.vercel.app`
- **Callback URL:** `https://your-project.vercel.app/api/github/app/callback`
- **Setup URL:** `https://your-project.vercel.app/api/github/app/callback` (Redirect on update checked)
- **Permissions:** Repository permissions → *Contents* (Read-only), *Metadata* (Read-only).
- **Private Key:** Click **Generate a private key**. In Vercel environment variables, paste the private key either with literal `\n` or as a multiline string.
- Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, and `GITHUB_APP_CLIENT_SECRET`.

### 4. Cron Scheduling & Background Checks
- **Hobby Plan Limitation:** Vercel Cron on the Hobby plan is restricted to once per day (`0 0 * * *`). Setting a 5-minute interval in `vercel.json` will cause Vercel build/deployment failures on Hobby accounts.
- **External Cron Invocation (Recommended for 5-min checks):**  
  Use an external scheduler (e.g. [cron-job.org](https://cron-job.org), GitHub Actions scheduled workflow, or Upstash QStash) to invoke the protected endpoint every 5 minutes:
  ```http
  POST https://your-project.vercel.app/api/cron/monitor-tick
  Authorization: Bearer <CRON_SECRET>
  ```
  The endpoint is idempotent: it only checks enabled monitors whose `lastCheckedAt + intervalMinutes` has elapsed.
- **If Unattended Cron is Not Configured:** Automatic background polling remains inactive, but **manual "Check Now"** and **"Simulate API Change"** remain fully operational on-demand.

### 5. Production Testing & Verification
- **Testing the Canonical Demo:** Open any configured API monitor, click **Simulate API Change**, choose the pre-loaded **Canonical Breaking Change**, and click **Run Simulation**. Progress events are written to PostgreSQL and polled at `/api/incidents/[id]/progress`, rendering the live forensic investigation pipeline and unified diff patch without requiring Socket.IO.
- **Testing Manual Checks:** Click **Check Now** on any monitor with an established baseline to verify live endpoint responses.

---

## Testing

Run unit and integration test suites:

```bash
# Run Vitest test suite
npm test

# Run TypeScript compilation check
npx tsc --noEmit
```

The test suite covers:
- **`lib/diff/schema-diff.test.ts`**: Recursive JSON structural diffing (additions, deletions, type alterations, nested renames, order invariance).
- **`lib/monitor/canonical-demo.test.ts`**: Simulation configuration resolution, explicit gating of canonical demo evidence, and non-canonical safety.
- **`lib/monitor/slice5-ui-integration.test.ts`**: End-to-end simulation payload resolution, incident creation contracts, and provenance tagging.
- **`lib/pipeline/demo-cleanup.test.ts`**: Demo data cleanup safety invariants, target identification, and production guard testing.

---

## Demo Data Cleanup (Hackathon Preparation)

Before recording demo videos or presenting at the hackathon, you can safely reset development and demo data to a clean slate.

### Safety Invariants
- **Preserved:** User accounts, GitHub OAuth identities, linked repositories, canonical demo monitor (`Acme Payments API`, `POST /payments`), known-good baseline, and encrypted credentials.
- **Removed:** Non-canonical test monitors, test baselines, test incidents, autopsy reports, and pipeline events.
- **Guardrails:** Refuses to run against production databases (`NODE_ENV=production` or production hosts) unless `--allow-production` is explicitly passed. Never truncates tables or deletes users. Operates in an atomic PostgreSQL transaction with automatic rollback on error.

### 1. Preview Cleanup Plan (Dry-Run)
Inspect exactly which records will be preserved and which will be deleted without modifying the database:
```bash
npm run demo:cleanup:preview
```

### 2. Execute Cleanup
Requires both `--execute` and `--confirm` flags:
```bash
npm run demo:cleanup -- --execute --confirm
```

### 3. Verify Clean State
Ensure the canonical monitor is healthy with 0 incidents:
```bash
npm run demo:cleanup -- --verify
```

### 4. Verify Canonical Simulation
Run the canonical simulation end-to-end to verify that the canonical monitor, baseline, and pipeline generate a live incident, autopsy report, and pipeline events:
```bash
npm run demo:verify-simulation
```

---

## Real Checks vs. Simulations

API Autopsy supports two execution paths that converge on the exact same core pipeline:

| Dimension | Real API Check (`executeMonitorCheck`) | Simulation (`executeSimulation`) |
| :--- | :--- | :--- |
| **Trigger** | "Check Now" button or 5-min scheduled background tick | "Simulate API Change" dialog |
| **Payload Source** | Live HTTP request to configured external endpoint | Injected fixture JSON or user-pasted test payload |
| **Credentials** | Decrypted server-side for outbound call only | Not accessed or needed |
| **`isSimulation`** | `false` | `true` (tagged on all records, badges, and alerts) |
| **External Impact**| Real external request made | Zero external network calls |
| **Code Impact** | Pattern-based code reference scan of connected repo | Pattern-based scan, or explicitly gated canonical demo fixture |

---

## Provenance Attribution & Safety Rules

- **Canonical Demo Gating:** Pre-loaded code evidence (`src/services/payment.ts:19`) is injected **only** when the user explicitly triggers the designated canonical demo (`useCanonicalDemo: true`).
- **No Fabricated Impact:** For custom responses or monitors without a linked repository, `applicationImpact` is never fabricated. Gemini assigns appropriately low confidence.
- **Explicit UI Provenance:** The Autopsy Report explicitly differentiates sources:
  - `Canonical demo fixture — not retrieved from your repository`
  - `Verified repository scan evidence`
  - `No direct code references found`

---

## Known Limitations

1. **Pattern-Based Code Reference Scanner:** The repository scanner uses regex and pattern matching for outbound HTTP calls (`fetch`, `axios`, `got`) and field accesses. Highly dynamic metaprogramming or complex reflection may not be detected with high confidence.
2. **Single-Process Polling Scheduler:** The background monitor scheduler runs as an in-process singleton (`setInterval`) suitable for local development and single-instance deployments. For horizontal multi-pod clusters, an external distributed queue (such as BullMQ, Redis, or Cloud Tasks) should be used.
3. **Read-Only Patch Delivery:** API Autopsy generates standard unified diff patches (`.patch`) for developer review and copying; it does not automatically commit changes to user repositories.

---

## License

[MIT](LICENSE) © 2026 API Autopsy Contributors.