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
5. **AST Code Impact Analysis:** Queries repository files for direct references to altered fields (dot notation, bracket syntax, destructuring).
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
│                (Live AST Scan vs Canonical Demo Fixture)  │
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

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/autopsy` |
| `NEXTAUTH_SECRET` | 32-character random string for Auth.js session encryption | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Canonical app URL | `http://localhost:3000` |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID (for developer login) | `Ov23li...` |
| `GITHUB_OAUTH_CLIENT_SECRET`| GitHub OAuth App Client Secret | `6b2d18...` |
| `GITHUB_APP_ID` | GitHub App ID (for repository code scanning) | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App RSA Private Key (PEM format) | `"-----BEGIN RSA PRIVATE KEY-----\n..."` |
| `GITHUB_APP_CLIENT_ID` | GitHub App Client ID | `Iv23...` |
| `GITHUB_APP_CLIENT_SECRET` | GitHub App Client Secret | `a1b2c3...` |
| `GEMINI_API_KEY` | Google GenAI API Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model name for Autopsy reasoning | `gemini-3.8-flash` |
| `ENCRYPTION_KEY` | 32-byte AES-256 encryption key in 64 hex characters | `openssl rand -hex 32` |
| `PORT` | Local server port | `3000` |

> **Security Note:** `.env` and `.env.local` are explicitly excluded in `.gitignore`. Real credentials must never be committed.

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
| **Code Impact** | Live repository AST scan of connected repo | Live AST scan, or explicitly gated canonical demo fixture |

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

1. **Pattern-Based AST Scanner:** The repository scanner uses regex and pattern matching for outbound HTTP calls (`fetch`, `axios`, `got`) and field accesses. Highly dynamic metaprogramming or complex reflection may not be detected with high confidence.
2. **Single-Process Polling Scheduler:** The background monitor scheduler runs as an in-process singleton (`setInterval`) suitable for local development and single-instance deployments. For horizontal multi-pod clusters, an external distributed queue (such as BullMQ, Redis, or Cloud Tasks) should be used.
3. **Read-Only Patch Delivery:** API Autopsy generates standard unified diff patches (`.patch`) for developer review and copying; it does not automatically commit changes to user repositories.

---

## License

[MIT](LICENSE) © 2026 API Autopsy Contributors.