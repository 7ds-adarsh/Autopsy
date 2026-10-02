---
doc: spec
status: approved
---

# API Autopsy — Technical Spec

## How This Works, In Plain Language

API Autopsy is a single Next.js application that does five things:

1. **Reads your repository** — Using a GitHub App (a connection your authorize for specific repos), Autopsy scans the codebase and looks for patterns that indicate API usage: HTTP calls, URLs, response field references. It reports what it finds as candidates, with a confidence level, so you can review and confirm before monitoring starts.

2. **Calls an external API on a schedule** — Once you configure an endpoint and capture a baseline response, a scheduler running inside the server checks that API every 5 minutes. The request uses your stored credentials, which are encrypted and never leave the server.

3. **Compares responses deterministically** — Each new response is compared against the baseline by a diff engine that understands JSON structure: it checks for removed fields, added fields, type changes, and nesting changes. It doesn't use AI for this — it's a precise, repeatable algorithm. Transport errors (timeouts, 401s, 500s) are classified separately so they don't create false schema incidents.

4. **Runs an incident pipeline** — When a structural change is detected (or you trigger a simulation), the same pipeline fires every time: create an incident, scan the repository for code that references the changed fields, send the evidence (not your credentials, not the full repo) to Gemini, and store the resulting Autopsy Report.

5. **Updates your dashboard in real time** — Socket.IO pushes progress events to the browser as each pipeline step completes, so you see the investigation unfold live rather than waiting for a page refresh.

The database (PostgreSQL) is the source of truth for everything. Socket.IO only carries notifications — it never carries credentials, full responses, or anything that should be persisted.

**Why this shape:** Everything runs in one Next.js process. There's no separate backend service, no message queue, no Redis. That's a deliberate hackathon simplification — the architecture could be split into separate services in production, but for the POC one process is easier to build, easier to debug, and easier to demo.

---

## The Core Journey Through the System

*PRD ref: `prd.md → The Core Journey`*

```
User opens API Autopsy
      │
      ▼
Landing page (Next.js page, statically rendered)
      │  clicks "Connect GitHub"
      ▼
GitHub OAuth (NextAuth.js)
→ GitHub issues user access token
→ NextAuth creates session, stores user in DB
      │
      ▼
Dashboard (first-time state)
→ DB: user has no repositories yet → shows setup state
      │  clicks "Connect Repository"
      ▼
GitHub App installation flow
→ User installs Autopsy GitHub App on chosen repo
→ GitHub redirects back with installation_id
→ Server stores: repository record + installation_id in DB
      │
      ▼
Repository scan (API route: POST /api/repositories/[id]/scan)
→ GitHub App client gets installation token for that repo
→ Reads file tree and contents via GitHub REST API
→ Scanner runs regex patterns over file contents
→ Returns API candidates (endpoint, file, line, evidence, confidence)
→ Stored as scan results; shown in UI
      │  user clicks "Add Monitor" on a candidate
      ▼
Endpoint configuration (Next.js page)
→ User reviews/edits: name, base URL, endpoint, method, params, headers
→ User selects authentication type and enters credentials
→ Credential encrypted (AES-256-GCM) before DB write
→ Stored in api_credentials table (separate from monitor config)
      │  clicks "Test Connection"
      ▼
Test connection (API route: POST /api/monitors/[id]/test)
→ Server fetches encrypted credential, decrypts in memory
→ Makes HTTP request to external API
→ Returns: HTTP status, response preview (success/failure/auth-error/transport-error)
→ Credential never sent to client
      │  connection succeeds → "Continue to Baseline"
      ▼
Baseline screen (Next.js page)
→ User clicks "Capture Current Response"
→ Server makes the configured request, stores raw response JSON
→ Diff engine normalizes response → extracts structural summary
→ Shown in UI (JSON viewer + structure table)
      │  user clicks "Use This as Baseline"
      ▼
Baseline stored in DB (baselines table)
Monitor status updated → monitoring enabled
      │
      ▼
Monitor scheduler (running in server.ts)
→ Every 5 minutes: executeMonitorCheck(monitorId) for each active monitor
→ executeMonitorCheck():
    1. Load monitor config from DB
    2. Decrypt credentials in memory
    3. Call external API
    4. If transport/auth error → log, update lastStatus, skip pipeline
    5. If success → run incident pipeline
      │
      │  or: user clicks "Check Now" → same executeMonitorCheck()
      │  or: user clicks "Simulate API Change" → same pipeline, different input
      ▼
Incident pipeline (lib/pipeline/incident-pipeline.ts) — SHARED
→ 1. Normalize new response
→ 2. Load baseline from DB
→ 3. Run structural diff
→ 4. If no changes → update lastCheckedAt, emit monitor:checked → done
→ 5. If changes detected:
    6. Classify severity (breaking vs additive)
    7. Create incident record in DB
    8. Emit: incident:created via Socket.IO
    9. Run repository impact analyzer (load repo files, search for field references)
    10. Emit: autopsy:started
    11. Build AutopsyInput (diff + affected snippets only — no credentials, no full repo)
    12. Call GeminiProvider.analyzeAutopsy(input)
    13. Save AutopsyReport to DB
    14. Emit: autopsy:completed
      │
      ▼
Browser receives Socket.IO events → pipeline progress updates live
      │
      ▼
Autopsy Report page (Next.js page)
→ Loads report from DB
→ Renders: What Changed, Application Impact, Failure Path, Root Cause,
           Recommended Fix, Proposed Patch, Confidence + Evidence
```

---

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16.x (App Router)** | Single project for both frontend and backend API routes; chosen by learner |
| Language | **TypeScript** | Type safety across frontend and backend; chosen by learner |
| UI | **Tailwind CSS + shadcn/ui** | Developer-tool aesthetic; Tailwind for utility styling, shadcn for accessible components; chosen by learner |
| Database | **PostgreSQL + Drizzle ORM** | Relational model suits the data (monitors → incidents → reports); Drizzle is lightweight and TypeScript-native; chosen by learner |
| Auth | **Auth.js (`next-auth`)** (GitHub OAuth provider) | GitHub login and session management; handles token storage and CSRF |
| Repo access | **GitHub App + Octokit** | Read-only repository contents access; minimum permissions; chosen by learner; see GitHub App section below |
| AI | **Google Gemini via `@google/genai`** | Behind AIProvider abstraction; model configurable via `GEMINI_MODEL` env var; chosen by learner |
| Real-time | **Socket.IO** | WebSocket server for pipeline progress events; runs on custom server; chosen by learner |
| Custom server | **server.ts (Node.js + ts-node)** | Hosts Next.js + Socket.IO + monitor scheduler in one process; approved POC simplification |
| Scheduler | **node-cron or setInterval** | 5-minute polling; singleton with duplicate-startup guard; POC simplification explicitly noted |
| Encryption | **Node.js built-in `crypto` (AES-256-GCM)** | Credential encryption at rest; no additional library needed |
| Testing | **Vitest** (unit/integration) + **Playwright** (E2E) | Chosen by learner |
| Package manager | **npm** or **pnpm** | Either works; verify project preference at build start |

**Documentation links (verify at build start):**
- Next.js 16.x: https://nextjs.org/docs
- Auth.js (next-auth): https://authjs.dev
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Octokit (GitHub App): https://github.com/octokit/octokit.js
- `@google/genai`: https://ai.google.dev/gemini-api/docs/quickstart?lang=node
- Socket.IO: https://socket.io/docs/v4/
- shadcn/ui: https://ui.shadcn.com/docs

**Unverified at spec time — verify against official docs before first install:**
- `@google/genai` import style and SDK version — confirm against current npm and https://ai.google.dev/gemini-api/docs
- `gemini-3.8-flash` availability in the `@google/genai` SDK — verify model name at build start
- Drizzle + PostgreSQL adapter version compatibility with Next.js 16.x
- Auth.js v5 (`next-auth@5`) API surface — verify session/handler pattern against https://authjs.dev
- Socket.IO compatibility with Next.js 16.x custom server pattern

---

## Where It Runs and How Someone Tries It

**Runtime:** Local Node.js process (Node 20.9+). Browser for the frontend.

**Required environment variables** (see `.env.example`):
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...            # random 32-char string
NEXTAUTH_URL=http://localhost:3000
GITHUB_OAUTH_CLIENT_ID=...    # GitHub OAuth App (for NextAuth)
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_APP_ID=...             # GitHub App (for repo access)
GITHUB_APP_PRIVATE_KEY=...    # PEM key, with \n escaped
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash # configurable; verify model availability at build start
ENCRYPTION_KEY=...            # 64-char hex string (32 bytes)
```

**Start commands:**
```bash
npm install
npm run db:migrate     # Run Drizzle migrations
npm run dev            # Starts custom server (server.ts)
```

**What to open:** `http://localhost:3000`

**Demo recording path:**
1. Open `http://localhost:3000` — show landing page
2. Click "Connect GitHub" — complete OAuth
3. Click "Connect Repository" — install GitHub App on fixture repo
4. Show API candidates discovered
5. Click "Add Monitor" on the payment endpoint candidate
6. Complete endpoint configuration and test connection
7. Capture baseline — show JSON response and structure summary
8. On the Monitor screen — click "Simulate API Change" → "Load Breaking Example" → "Run Simulation"
9. Watch the pipeline progress live
10. Open the Autopsy Report — show the full chain

**Deployment:** Optional. Vercel works for Next.js but requires moving the custom server and scheduler to a different approach (e.g., Vercel Cron + serverless functions). For the hackathon, local demo + recorded video is sufficient and recommended.

---

## Look and Feel

*Carried forward from `prd.md → Look and Feel` and `scope.md → Inspiration & Identity`*

- **Mode:** Dark mode. Dark background (#0a0a0a or similar near-black), not gray.
- **Palette:** Muted, purposeful color. No generic SaaS purple. Use color for meaning: green for healthy/success, amber for warning/additive change, red/high-contrast for critical/breaking incidents. Sidebar and cards use slightly lighter dark surfaces.
- **Typography:** Monospace (`JetBrains Mono` or `Geist Mono`) for code, endpoints, JSON, structural summaries, and the pipeline progress log. Clean sans-serif (`Inter` or `Geist`) for prose, labels, and navigation.
- **Density:** Information-dense but scannable. Developer-tool feel — a developer should read a screen in seconds, not scroll past marketing content.
- **Motion:** Pipeline progress steps animate in sequentially as Socket.IO events arrive. Each step appearing live is the core real-time UX moment — it should feel like watching an investigation unfold, not a loading spinner.
- **Tone of copy:** Direct, technical, precise. Not alarmist. Evidence-forward. "Reconstructed likely failure path" not "Your app is broken."
- **Identity:** Forensic investigation tool. The Autopsy Report should feel like reading a post-incident analysis document.
- **shadcn/ui primitives** provide the component foundation; Tailwind utility classes handle all custom styling. No component library conflicts.

---

## Components

### Custom Server (`server.ts`)

*PRD ref: `prd.md → GitHub Authentication`, `prd.md → API Monitoring`*

Entry point for the entire application. Starts Next.js programmatically, attaches Socket.IO to the HTTP server, and initializes the monitor scheduler. Includes a guard to prevent duplicate scheduler initialization during Next.js hot reload in development.

```
server.ts
  → createServer() (Node HTTP)
  → attachNextJs(server)
  → attachSocketIO(server)       → lib/socket/server.ts
  → initScheduler()              → lib/scheduler/monitor-scheduler.ts
  → server.listen(3000)
```

### Socket.IO Server (`lib/socket/server.ts`)

*PRD ref: `prd.md → Incident Pipeline` (real-time events)*

Manages the Socket.IO instance. Exposes a `getIO()` function that the pipeline uses to emit events. Events:

| Event | Payload | When |
|---|---|---|
| `monitor:checked` | `{ monitorId, status, checkedAt }` | After each poll with no change |
| `incident:created` | `{ incidentId, monitorId, severity, isSimulation }` | When incident record is written |
| `autopsy:started` | `{ incidentId }` | Before Gemini call |
| `autopsy:progress` | `{ incidentId, step, message }` | Pipeline step updates |
| `autopsy:completed` | `{ incidentId, reportId }` | Report saved to DB |

Socket.IO never carries credentials, full repository content, or baseline responses.

### Monitor Scheduler (`lib/scheduler/monitor-scheduler.ts`)

*PRD ref: `prd.md → API Monitoring`*

Singleton module. On init, starts a `setInterval` (5-minute default). On each tick, loads all active monitors from DB and calls `executeMonitorCheck(monitorId)` for each. Tracks in-flight checks to avoid concurrent runs for the same monitor. Guards against double-init with a module-level `initialized` flag.

**POC constraint noted:** In production, this would be a separate worker process or a proper job queue (BullMQ + Redis). The single-process setInterval is adequate for the hackathon demo.

### Monitor Executor (`lib/monitor/executor.ts`)

*PRD ref: `prd.md → API Monitoring`, `prd.md → Simulate API Change`*

`executeMonitorCheck(monitorId)` and `executeSimulation(monitorId, simulatedResponse)` — both converge on `runIncidentPipeline()`. This is the function that enforces: **same code path for real and simulated responses**.

Steps for real check:
1. Load monitor from DB
2. Decrypt credentials (`lib/crypto/credentials.ts`)
3. Call external API (`lib/monitor/http-client.ts`)
4. Classify response (success / transport-error / auth-error / server-error)
5. On success → `runIncidentPipeline(monitorId, response, isSimulation: false)`
6. On transport/auth/server error → log event, update `lastStatus`, do NOT create schema incident

### HTTP Client (`lib/monitor/http-client.ts`)

Makes external API requests with the configured method, params, headers, and decrypted auth credential. Returns a typed result distinguishing success, auth failure, transport failure, and server error. Never logs credentials.

### Incident Pipeline (`lib/pipeline/incident-pipeline.ts`)

*PRD ref: `prd.md → Incident Pipeline`*

The shared pipeline. Called by both real monitoring and simulation with identical arguments (the only difference is the `isSimulation` flag which is stored on the incident record).

```
runIncidentPipeline(monitorId, newResponse, isSimulation, io):
  1. normalizeResponse(newResponse)          → lib/diff/schema-diff.ts
  2. loadBaseline(monitorId)                 → DB
  3. computeDiff(baseline, normalized)       → lib/diff/schema-diff.ts
  4. if diff.hasChanges === false:
       update monitor.lastCheckedAt
       emit monitor:checked
       return
  5. classifySeverity(diff)
  6. createIncident(monitorId, diff, severity, isSimulation)  → DB
  7. emit incident:created
  8. runRepositoryImpact(monitorId, diff)    → lib/impact/repository-impact.ts
  9. emit autopsy:started
  10. buildAutopsyInput(diff, impactResult)  → no credentials, no full repo
  11. aiProvider.analyzeAutopsy(input)       → lib/ai/gemini.ts
  12. saveAutopsyReport(incidentId, report)  → DB
  13. emit autopsy:completed
```

### Schema Diff Engine (`lib/diff/schema-diff.ts`)

*PRD ref: `prd.md → API Monitoring` — deterministic structural diff*

Pure function. Takes two normalized JSON objects and returns a `DiffResult`.

```ts
interface FieldChange {
  type: 'removed' | 'added' | 'type_changed' | 'structure_changed';
  path: string;           // dot notation: "customer_id", "customer.id"
  oldType?: string;       // "string", "object", "array", "number", etc.
  newType?: string;
  severity: 'breaking' | 'additive';
}

interface DiffResult {
  hasChanges: boolean;
  changes: FieldChange[];
  overallSeverity: 'none' | 'additive' | 'breaking';
}
```

Rules:
- **Removed field** → breaking
- **Added field** → additive (non-breaking by default)
- **Type changed** → breaking
- **Object → primitive or array** → breaking (structure_changed)
- **JSON property ordering** → ignored (normalize before compare)

### Repository Scanner (`lib/scanner/`)

*PRD ref: `prd.md → Repository Connection and Scan`*

`scanner/index.ts` — entry point. Uses the GitHub App client to fetch and analyze the repository deterministically:

```
GitHub file tree (recursive)
      ↓
Filter candidate source files
      ↓
Ignore generated/vendor/binary files
      ↓
Fetch relevant source files
      ↓
Pattern matching
      ↓
API candidates
```

**Step 1 — Fetch file tree:**
`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`

**Step 2 — Filter: ignore these paths entirely (never fetch content):**
```
node_modules/
.git/
dist/
build/
.next/
coverage/
vendor/
*.lock  (package-lock.json, yarn.lock, pnpm-lock.yaml)
*.min.js
*.map
*.generated.*
binary extensions: .png .jpg .jpeg .gif .svg .ico .woff .woff2 .ttf .eot .pdf .zip
```

**Step 3 — Fetch content** for remaining source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.java`, `.cs`, `.php`).

**Step 4 — Run `patterns.ts`** over each file's content.

**Step 5 — Return `ApiCandidate[]`.**

This keeps the scanner lightweight and deterministic — it extracts evidence from real source code without touching generated, vendor, or binary content.

`scanner/patterns.ts` — regex patterns:
```ts
// HTTP client calls
/axios\.(get|post|put|delete|patch)\s*\(['"`](https?:\/\/[^'"`]+)['"`]/
/fetch\s*\(['"`](https?:\/\/[^'"`]+)['"`]/

// Base URL patterns
/baseURL\s*[:=]\s*['"`](https?:\/\/[^'"`]+)['"`]/
/BASE_URL|API_URL|API_BASE/  // env var references

// Endpoint paths
/['"`](\/[a-z0-9_\-\/{}]+)['"`]/  // path-like strings

// Response field references (dot notation and bracket)
/\bresponse\.(\w+)\b/
/\bdata\.(\w+)\b/
/\b(\w+)\.(\w+)\b/  // general object access near API calls
/\[['"`](\w+)['"`]\]/  // bracket access
```

Each candidate has: `{ endpoint, method, file, line, evidence, confidence: 'high'|'medium'|'low' }`.

### Repository Impact Analyzer (`lib/impact/repository-impact.ts`)

*PRD ref: `prd.md → Incident Pipeline` — repository impact stage*

Given a `DiffResult`, finds which files in the repository reference the removed/changed field names. Uses the same GitHub App client to read file contents (or cached from the scan).

```ts
interface AffectedFile {
  file: string;
  line?: number;          // present when confidently identified
  snippet?: string;       // surrounding code, ≤5 lines
  confidence: 'high' | 'medium' | 'low';
  note?: string;          // e.g. "Line-level attribution unavailable"
}
```

Search strategy: for each changed field path (e.g. `customer_id`), search for:
- `\.customer_id`
- `['customer_id']`
- `["customer_id"]`
- `customer_id:` (destructuring)

Never invents attribution. If only the file is identified but not the line, `line` is omitted and `note` explains the limitation.

### AI Provider (`lib/ai/`)

*PRD ref: `prd.md → Autopsy Report`*

**`lib/ai/provider.ts`** — interface:
```ts
interface AIProvider {
  analyzeAutopsy(input: AutopsyInput): Promise<AutopsyReport>;
}

interface AutopsyInput {
  previousStructure: object;
  newStructure: object;
  diff: DiffResult;
  affectedFiles: AffectedFile[];
  repositoryMetadata: { name: string; primaryLanguage?: string; };
  // Explicitly excluded: credentials, full repo contents, raw baselines
}

interface AutopsyReport {
  whatChanged: string;
  applicationImpact: { file: string; line?: number; snippet?: string; explanation: string; }[];
  failurePath: { step: string; description: string; }[];
  rootCause: string;
  recommendedFix: string;
  proposedPatch?: string;   // unified diff format
  confidence: 'high' | 'medium' | 'low';
  confidenceEvidence: string[];
}
```

**`lib/ai/gemini.ts`** — GeminiProvider. Uses `@google/genai`. Model loaded from `process.env.GEMINI_MODEL` (defaults to `gemini-3.8-flash`). Sends a structured prompt containing only `AutopsyInput`. Parses the response into `AutopsyReport`. The prompt instructs Gemini explicitly not to invent files, functions, or code not present in the provided evidence.

**Prompt structure (condensed):**
```
You are an API incident investigator. You will receive:
- The previous API response structure
- The new API response structure
- A deterministic diff of what changed
- Code snippets from the application that reference changed fields

Your job is to reason over this evidence and produce a structured report.
Do not invent files, functions, or code that are not in the evidence provided.
Clearly distinguish what you know from evidence versus what you are inferring.
...
[AutopsyInput JSON]
...
Respond as JSON matching the AutopsyReport schema.
```

### Credential Encryption (`lib/crypto/credentials.ts`)

*PRD ref: `prd.md → Endpoint Configuration` — credential security*

AES-256-GCM using Node.js built-in `crypto`. `ENCRYPTION_KEY` env var (64-char hex = 32 bytes).

```ts
encrypt(plaintext: string): string   // → "iv:tag:ciphertext" (hex, colon-separated)
decrypt(stored: string): string      // → original plaintext
```

Used only server-side. Credentials are encrypted before any DB write, decrypted only in memory immediately before an API request, and never appear in:
- API responses
- Socket.IO events
- Gemini inputs
- Logs

### GitHub Integration (`lib/github/`)

*PRD ref: `prd.md → GitHub Authentication`, `prd.md → Repository Connection and Scan`*

**`lib/github/auth.ts`** — Auth.js (`next-auth`) configuration. GitHub OAuth provider. Stores `githubId`, `username`, `avatarUrl` in DB on first login. Verify Auth.js v5 session handler API at build start (https://authjs.dev).

**`lib/github/app.ts`** — Octokit App client for repository access. Uses `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`. Provides:
- `getInstallationClient(installationId)` → per-installation Octokit with short-lived token
- `getRepoFileTree(owner, repo, installationId)`
- `getFileContent(owner, repo, path, installationId)`

**GitHub App permissions (minimal, read-only):**
- Repository contents: `read`
- Repository metadata: `read`
- No write permissions of any kind

**GitHub App installation flow:**
1. User clicks "Connect Repository"
2. Redirect to `https://github.com/apps/{app-name}/installations/new`
3. User selects repo(s) and installs
4. GitHub redirects to `/api/github/app/callback?installation_id=...&setup_action=install`
5. Server stores `installationId` + repo metadata in DB

### Database Client (`lib/db/client.ts`)

Drizzle ORM client connected to PostgreSQL via `DATABASE_URL`. Singleton pattern — one connection pool for the process.

### API Routes (`app/api/`)

*PRD ref: `prd.md → Features and Behavior`*

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js handler |
| `/api/github/app/callback` | GET | GitHub App installation callback |
| `/api/repositories` | GET, POST | List / create repository records |
| `/api/repositories/[id]/scan` | POST | Trigger repo scan → return candidates |
| `/api/monitors` | GET, POST | List / create monitors |
| `/api/monitors/[id]` | GET, PATCH, DELETE | Monitor detail / update / delete |
| `/api/monitors/[id]/test` | POST | Test connection |
| `/api/monitors/[id]/baseline` | POST | Capture or save baseline |
| `/api/monitors/[id]/check` | POST | Trigger immediate real check |
| `/api/monitors/[id]/simulate` | POST | Trigger simulation with fixture JSON |
| `/api/incidents` | GET | List incidents |
| `/api/incidents/[id]` | GET | Incident + autopsy report |

All routes require an authenticated session. Credentials never appear in responses.

### Frontend Pages (`app/`)

*PRD ref: `prd.md → Screens and Layout`*

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Public; hero, flow diagram, four-capability block |
| Dashboard | `/dashboard` | First-time setup state or operational dashboard |
| APIs | `/apis` | List of configured monitors |
| Monitor Detail | `/apis/[id]` | Active monitor, Check Now, Simulate |
| Configure | `/apis/[id]/configure` | Endpoint + auth configuration |
| Baseline | `/apis/[id]/baseline` | Baseline capture |
| Incidents | `/incidents` | Incidents list |
| Autopsy Report | `/incidents/[id]` | Full autopsy report |
| Repositories | `/repositories` | Connected repos |
| Settings | `/settings` | Account settings |

---

## Data Model

*Schema defined with Drizzle ORM. PostgreSQL.*

```ts
// users
{
  id: uuid (PK),
  githubId: text (unique),
  username: text,
  avatarUrl: text,
  createdAt: timestamp
}

// repositories
{
  id: uuid (PK),
  userId: uuid (FK → users),
  githubRepoId: text,
  owner: text,
  name: text,
  fullName: text,         // "owner/name"
  installationId: text,   // GitHub App installation ID
  defaultBranch: text,
  createdAt: timestamp
}

// api_monitors
{
  id: uuid (PK),
  userId: uuid (FK → users),
  repositoryId: uuid (FK → repositories),
  name: text,
  baseUrl: text,
  endpoint: text,
  method: enum('GET','POST'),
  pathParams: jsonb,       // { id: "pay_123" }
  queryParams: jsonb,
  additionalHeaders: jsonb,
  authType: enum('none','api_key','bearer'),
  authHeaderName: text,    // for api_key type (e.g. "x-api-key")
  discoverySource: enum('scan','manual'),
  discoveryConfidence: enum('high','medium','low'),
  monitoringEnabled: boolean (default true),
  intervalMinutes: integer (default 5),
  lastCheckedAt: timestamp,
  lastStatus: enum('healthy','incident','error','pending'),
  activeBaselineId: uuid,  // FK → baselines
  createdAt: timestamp,
  updatedAt: timestamp
}

// api_credentials  (separate table — never joined into general queries)
{
  id: uuid (PK),
  monitorId: uuid (FK → api_monitors, unique),
  encryptedValue: text,    // "iv:tag:ciphertext"
  updatedAt: timestamp
}

// baselines
{
  id: uuid (PK),
  monitorId: uuid (FK → api_monitors),
  responseBody: jsonb,            // normalized JSON
  structureSummary: jsonb,        // flat field list with types
  captureMethod: enum('live','sample'),
  capturedAt: timestamp
}

// incidents
{
  id: uuid (PK),
  monitorId: uuid (FK → api_monitors),
  baselineId: uuid (FK → baselines),
  severity: enum('low','medium','high','critical'),
  diff: jsonb,             // DiffResult
  isSimulation: boolean,
  status: enum('open','investigating','resolved'),
  createdAt: timestamp,
  updatedAt: timestamp
}

// autopsy_reports
{
  id: uuid (PK),
  incidentId: uuid (FK → incidents, unique),
  whatChanged: text,
  applicationImpact: jsonb,    // AffectedFile[]
  failurePath: jsonb,          // FailureStep[]
  rootCause: text,
  recommendedFix: text,
  proposedPatch: text,         // unified diff string, nullable
  confidence: enum('high','medium','low'),
  confidenceEvidence: jsonb,   // string[]
  generatedAt: timestamp
}
```

**Persistence across sessions:** All data is in PostgreSQL. Sessions via NextAuth.js. Users can close the browser and return to find their monitors, incidents, and reports intact.

---

## File Structure

```
autopsy/
├── server.ts                          # Custom server: Next.js + Socket.IO + scheduler
├── app/
│   ├── page.tsx                       # Landing page (public)
│   ├── layout.tsx                     # Root layout
│   ├── globals.css
│   ├── (auth)/
│   │   └── login/page.tsx             # Login / GitHub connect
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Shell layout (sidebar + main)
│   │   ├── dashboard/page.tsx         # First-time or operational dashboard
│   │   ├── apis/
│   │   │   ├── page.tsx               # Monitor list
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Active monitor + Simulate
│   │   │       ├── configure/page.tsx # Endpoint + auth config
│   │   │       └── baseline/page.tsx  # Baseline capture
│   │   ├── incidents/
│   │   │   ├── page.tsx               # Incidents list
│   │   │   └── [id]/page.tsx          # Autopsy Report
│   │   ├── repositories/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── github/
│       │   ├── app/callback/route.ts  # GitHub App installation callback
│       │   └── repos/route.ts
│       ├── repositories/
│       │   ├── route.ts
│       │   └── [id]/scan/route.ts
│       ├── monitors/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── test/route.ts
│       │       ├── baseline/route.ts
│       │       ├── check/route.ts
│       │       └── simulate/route.ts
│       └── incidents/
│           ├── route.ts
│           └── [id]/route.ts
├── components/
│   ├── ui/                            # shadcn/ui primitives
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── shell.tsx
│   ├── landing/
│   │   ├── hero.tsx
│   │   ├── flow-diagram.tsx           # API→code→fix visual
│   │   └── capability-grid.tsx
│   ├── dashboard/
│   │   ├── setup-progress.tsx         # 01→04 step indicator
│   │   ├── first-time-state.tsx
│   │   └── operational-dashboard.tsx
│   ├── repositories/
│   │   └── api-candidates.tsx         # Scan results with confidence
│   ├── monitor/
│   │   ├── monitor-header.tsx
│   │   ├── structure-summary.tsx      # Field type display
│   │   ├── simulate-dialog.tsx
│   │   └── pipeline-progress.tsx      # Live Socket.IO updates
│   ├── report/
│   │   ├── autopsy-report.tsx
│   │   ├── failure-path.tsx           # Visual chain
│   │   └── patch-viewer.tsx           # Diff display
│   └── incidents/
│       └── incidents-list.tsx
├── lib/
│   ├── ai/
│   │   ├── provider.ts                # AIProvider interface + types
│   │   └── gemini.ts                  # GeminiProvider implementation
│   ├── crypto/
│   │   └── credentials.ts             # AES-256-GCM encrypt/decrypt
│   ├── diff/
│   │   └── schema-diff.ts             # Deterministic structural diff engine
│   ├── github/
│   │   ├── auth.ts                    # NextAuth GitHub OAuth config
│   │   └── app.ts                     # Octokit GitHub App client
│   ├── monitor/
│   │   ├── executor.ts                # executeMonitorCheck + executeSimulation
│   │   └── http-client.ts             # External API caller
│   ├── pipeline/
│   │   └── incident-pipeline.ts       # Shared real/sim pipeline
│   ├── scanner/
│   │   ├── index.ts                   # Scanner entry point
│   │   └── patterns.ts                # Regex patterns
│   ├── impact/
│   │   └── repository-impact.ts       # Field reference finder
│   ├── scheduler/
│   │   └── monitor-scheduler.ts       # Singleton poll scheduler
│   ├── socket/
│   │   └── server.ts                  # Socket.IO server + getIO()
│   └── db/
│       ├── schema.ts                  # Drizzle table definitions
│       ├── client.ts                  # DB connection singleton
│       └── migrations/                # Drizzle migration files
├── devpost/                           # Planning docs (gitignored for learner-profile)
├── .env.example                       # All required env vars, no values
├── .env.local                         # gitignored
├── next.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

## External Services and Dependencies

### PostgreSQL

- **Used for:** all application data
- **Connection:** `DATABASE_URL` env var
- **For demo:** local PostgreSQL instance (e.g. via Docker: `docker run -p 5432:5432 postgres`)
- **Migrations:** `npm run db:migrate` (Drizzle Kit)

### GitHub OAuth App

- **Used for:** user authentication (NextAuth.js)
- **Required env vars:** `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- **Scopes requested:** `read:user`, `user:email` (identity only — no repo access)
- **Setup:** Create at https://github.com/settings/developers → OAuth Apps
- **Callback URL:** `http://localhost:3000/api/auth/callback/github`

### GitHub App

- **Used for:** read-only repository access (file tree + file contents)
- **Required env vars:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`
- **Permissions (read-only):**
  - Repository contents: read
  - Repository metadata: read
- **Key API calls:**
  - `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` — file tree
  - `GET /repos/{owner}/{repo}/contents/{path}` — file content
- **Docs:** https://docs.github.com/en/apps/creating-github-apps
- **Setup:** Create at https://github.com/settings/apps/new
- **Rate limits:** 5,000 requests/hour per installation token. Sufficient for the demo.

### Gemini API

- **Used for:** Autopsy Report generation
- **SDK:** `@google/genai` (verify import style at build start)
- **Required env vars:** `GEMINI_API_KEY`, `GEMINI_MODEL` (default: `gemini-3.8-flash`)
- **Model:** Configurable via `GEMINI_MODEL`; verify `gemini-3.8-flash` availability in SDK at build start
- **Key call:** generate content with structured prompt → JSON response
- **Docs:** https://ai.google.dev/gemini-api/docs
- **Cost:** Gemini has a free tier; verify current limits at build start
- **Constraint:** Gemini receives only `AutopsyInput` — never credentials or full repository content

---

## Important Failure Modes

*PRD ref: `prd.md → States and Boundaries`*

- **External API returns 401/403/timeout during monitoring** → Classified as a connectivity event (not a schema incident). Monitor `lastStatus` updated to `error`. UI shows the error with the HTTP code. No Autopsy Report created. Next poll will retry normally.

- **Gemini API call fails or returns malformed output** → Incident record exists; autopsy status set to `failed`. UI shows the incident with the deterministic diff but no AI analysis. Developer can still see what changed — the diff is always saved before Gemini is called. Socket.IO emits `autopsy:failed` with a plain-language message.

- **GitHub App token expires or installation is revoked** → Repository scan and impact analysis fail. UI shows an error prompting the user to re-authorize the GitHub App. Monitor can still run real API checks (doesn't require repo access during polling — only for scan and impact analysis).

- **Database connection lost** → Server will log the error. In development, restart resolves it. For the demo: use a stable local DB; health check on startup recommended.

---

## What Was Simplified and Why

- **Single-process scheduler** instead of a worker service or job queue — the `setInterval` scheduler runs inside `server.ts` alongside Next.js and Socket.IO. A production system would use BullMQ + Redis or a separate worker. Single-process is adequate for the hackathon demo; explicitly labeled as a POC constraint, isolated in its own module, with a duplicate-init guard for development hot reload.

- **Pattern matching scanner** instead of a full AST or call-graph analyzer — the repository scanner uses regex over file contents rather than parsing the code into a syntax tree. This means it can't follow function calls across files. The PRD decision: report the limitation honestly rather than guess. Sufficient to prove the concept with the demo repository.

- **Local PostgreSQL** instead of a managed database service — no deployment configuration needed for the demo. Docker is sufficient.

- **`setInterval` polling** instead of configurable per-monitor schedules — all monitors run on the same 5-minute cycle. Configurable intervals are a later enhancement; one interval is sufficient for the proof of concept.

- **Controlled fixture repository** for the demo — a pre-prepared GitHub repository containing the `payment.customer_id` scenario ensures a repeatable demonstration. The product works with any connected repo; the fixture is purely a demo reliability mechanism.

---

## Decisions and Open Issues

**Learner-made decisions:**
- TypeScript/JavaScript across the full stack — consistent language; chosen by learner
- Next.js App Router — single-project full-stack; chosen by learner
- Tailwind CSS + shadcn/ui — developer-tool aesthetic; Tailwind explicitly requested
- PostgreSQL + Drizzle ORM — chosen by learner
- GitHub App for repo access (not OAuth `repo` scope) — read-only permission principle; chosen by learner after considering the tradeoff
- Custom server approach (Next.js + Socket.IO + scheduler in one process) — approved by learner as POC constraint
- Gemini via `AIProvider` abstraction — chosen by learner; decouples from model implementation
- Vitest + Playwright — chosen by learner

**Implementation decisions derived from learner choices:**
- AES-256-GCM for credential encryption — follows from "credentials encrypted at rest" constraint; uses Node.js built-in `crypto` (no additional library)
- `getIO()` singleton pattern for Socket.IO — follows from single-process architecture; allows pipeline code to emit events without prop drilling
- Scheduler duplicate-init guard via module-level `initialized` flag — follows from custom server + hot reload concern

**One genuine uncertainty explored during spec:**
The learner asked about WebSockets in Next.js — specifically whether Next.js API routes could handle persistent connections. They didn't have the context to know this was a constraint. The explanation: Next.js API routes handle one request and return one response; they can't hold open a socket. The custom server pattern (attaching Socket.IO to the same HTTP server that Next.js uses) resolves this while keeping everything in one project. The learner agreed to this approach after understanding the tradeoff.

**Open issues (none block spec approval):**
- `@google/genai` import style and `gemini-3.8-flash` model availability — verify against https://ai.google.dev/gemini-api/docs at build start
- Drizzle + PostgreSQL adapter version compatibility with Next.js 16.x — verify at build start
- Auth.js v5 (`next-auth@5`) session/handler API — verify at https://authjs.dev before implementing auth routes
- Socket.IO client-side integration in Next.js App Router components — use `useEffect` to initialize the client socket; avoid server components for Socket.IO hooks
- Demo fixture repository — needs to be created and configured with the GitHub App before the demo; confirm owner/name at build start
