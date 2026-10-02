---
doc: prd
status: approved
---

# API Autopsy — Product Requirements

An AI-powered incident investigation platform for developers whose applications depend on third-party APIs. When an external API changes, API Autopsy connects the change to the specific code that depends on it, reconstructs the likely failure path, and recommends a concrete fix.
Source: `scope.md → The Unique Kernel`, `scope.md → Who It's For`

---

## The Core Journey

Source: `scope.md → The Core Loop`, `scope.md → What "Working" Looks Like`

1. **Land** — Developer opens API Autopsy. The landing page immediately communicates the core idea: external API change → your code → failure path → fix.
2. **Authenticate** — Developer clicks "Connect GitHub" and completes GitHub OAuth. They are routed to the dashboard.
3. **Connect Repository** — First-time dashboard prompts the developer to connect their GitHub repository. The developer selects a repo; API Autopsy begins scanning it.
4. **Discover APIs** — The scanner identifies API usage patterns in the codebase and presents API candidates with evidence and confidence levels.
5. **Select / Add Endpoint** — The developer selects a discovered candidate (or adds one manually) and lands on the endpoint configuration screen.
6. **Configure Endpoint** — The developer reviews pre-filled fields (URL, method, path params), configures request parameters, and sets authentication if required. API credentials are never displayed after entry.
7. **Test Connection** — The developer tests the endpoint; the result is shown clearly (success / auth failure / request failure). Transport/auth failures are never treated as schema changes.
8. **Establish Baseline** — The developer captures the live API response (or pastes sample JSON) as the known-good contract. They inspect the response and the parsed structure summary before confirming.
9. **Start Monitoring** — API Autopsy begins periodically checking the endpoint against the baseline.
10. **Detect Change** — When a structural change is found (or a simulation is triggered), an incident pipeline fires: diff → incident creation → repository impact analysis → Gemini investigation.
11. **View Autopsy Report** — The developer reads the report: what changed, which file/line is affected, the reconstructed failure path, the root cause, the recommended fix, the proposed code patch, and the confidence evidence.
12. **Review / Copy Fix** — The developer reviews or copies the proposed patch. No automatic application.
13. **Return to Monitoring** — The monitor shows the latest incident. Past incidents are accessible from the Incidents section.

---

## Screens and Layout

### Layout Shell

A persistent developer-tool layout with:

- **Left sidebar** — navigation: Dashboard, APIs, Incidents, Repositories, Settings. Authenticated GitHub user/avatar at the bottom.
- **Main content area** — changes per screen. No top nav bar needed; the sidebar carries navigation.

### Screen 1 — Landing Page

Public. Communicates the product before login.

- Header: `API AUTOPSY` with Login and Get Started links.
- Hero headline: `WHEN APIs CHANGE, KNOW WHAT BREAKS.`
- Subtext: `API Autopsy investigates third-party API changes inside your codebase, shows what can break, explains why, and recommends how to fix it.`
- Primary CTA: `Connect GitHub`. Secondary: `See How It Works`.
- Visual flow (inline diagram, not marketing copy):
  ```
  API changed → customer_id removed → payment.customer_id → undefined → Customer lookup fails → Recommended fix
  ```
- Four-capability block: DETECT / INVESTIGATE / EXPLAIN / FIX — each with one sentence.
- No pricing, no testimonials, no blog, no enterprise sales content.

### Screen 2 — First-Time Dashboard

Shown after GitHub auth when no repository is connected.

- Greeting: `Good to have you here.`
- Setup message: `Connect the repository where your application uses third-party APIs.`
- Subtext: `API Autopsy needs to understand your code before it can connect API changes to the code that depends on them.`
- Primary CTA: `Connect Repository`.
- **Setup progress indicator** (persistent during onboarding):
  ```
  01  Repository      ● Current
  02  API Endpoint    ○ Pending
  03  Baseline        ○ Pending
  04  Monitoring      ○ Pending
  ```
- Steps 02–04 appear locked/pending until the prior step completes.

### Screen 3 — Repository Scan

Triggered by Connect Repository. Inline on the dashboard or modal.

- GitHub repo selector (list of repos the user has authorized access to).
- After selection, transition to live scan state:
  ```
  Repository connected
  ↓ Scanning repository...
  ↓ Finding API integrations...
  ```
- Scan completes → API Candidates list appears:
  ```
  3 API candidates discovered

  GET /v1/payments/{id}
  Found in: src/services/payment.ts:42
  Evidence: axios.get(...)
  Confidence: Medium
  [Add Monitor]  [Edit]  [Dismiss]
  ```
- "Add API manually" option always available beneath candidates.
- Confidence indicators are honest: Medium or Low means the developer should verify before monitoring.

### Screen 4 — Configure Endpoint

Source: `scope.md → POC Boundary → Endpoint configuration`

Setup progress: 02 API Endpoint ● Current.

If arriving from discovery, show context banner:
```
Discovered API
GET /v1/payments/{id}
Found in: src/services/payment.ts:42
Evidence: axios.get(...)
```
If manually added, show: `Manually added API`.

Page title: `Configure API Monitor`
Subtext: `Confirm how API Autopsy should access this endpoint and establish a connection.`

**Section 1 — API Details**
- API Name (editable, pre-filled from discovery)
- Base URL (editable, pre-filled)
- Endpoint path (editable, pre-filled)
- HTTP Method (GET / POST selector, pre-selected if detected)
- If scanner confidence is Medium/Low, show inline: `Detected from repository — Confidence: Medium. Please verify before monitoring.`

**Section 2 — Request Configuration**
- Path Parameters (key/value pairs, e.g. `id = pay_123`)
- Query Parameters (key/value pairs)
- Additional Headers (key/value pairs)
- Request Body editor for POST requests (where needed for demo scenarios)
- Keep this minimal — only what's needed to call the configured endpoint.

**Section 3 — Authentication**
- Selector: None / API Key / Bearer Token
- API Key selected → Header Name (editable, default `x-api-key`) + masked key field
- Bearer Token selected → masked token field
- Inline reassurance copy: `Your credentials are encrypted and never shared with the AI analysis.`
- Once saved, the secret is never shown again — only masked (e.g. `API Key ••••••••`).

**Section 4 — Test Connection**
- Primary action: `Test Connection`
- Results:
  - ✓ `Connection successful — HTTP 200 — Ready to capture baseline`
  - ✕ `Authentication failed — HTTP 401 — Check your API credentials.`
  - ✕ `Request failed — HTTP 500 — The endpoint responded with a server error.`
  - ✕ `Request failed — Connection timeout / DNS failure.`
- Transport and authentication failures are never treated as API schema incidents.

**Section 5 — Continue**
- After a successful test: `Continue to Baseline` button becomes active.

### Screen 5 — Establish Baseline

Source: `scope.md → POC Boundary → Baseline capture`

Setup progress: 03 Baseline ● Current.

Page title: `Establish Baseline`
Subtext: `This response becomes the known-good structure. Future API checks will be compared against it for meaningful changes.`

**API Summary Banner** (compact):
```
Payments API
GET /v1/payments/{id}
https://api.example.com
✓ Connection successful — HTTP 200
```

**Primary capture action:** `Capture Current Response`
- Makes the configured request; displays the returned JSON in a readable viewer.
- Developer can inspect before accepting.

**Secondary option:** `Use Sample JSON`
- Developer pastes JSON manually; API Autopsy validates and previews structure.
- Useful for demos and testing without a live API dependency.

**Response viewer** — readable JSON display.

**Structural summary** — lightweight, beside or below the JSON:
```
Response Structure
id              string
customer_id     string
amount          number
```
For nested fields:
```
customer
  └── id        string
```

**What will be monitored** — inline explanation:
```
API Autopsy will watch for:
• Fields being removed
• Fields being added
• Field types changing
• Nested structures changing

JSON property ordering is not treated as a change.
```

**Confirm action:** `Use This as Baseline`
Pre-confirmation text: `This response will be used as the reference for future API checks.`
Post-confirmation: `✓ Baseline established` → `Configure Monitoring` button.

Simulation is NOT available on this screen. Baseline = known-good state only.

### Screen 6 — API Monitor (Active)

The main operational screen for a monitored endpoint.

**Header:**
```
Payments API
GET /v1/payments/{id}
Repository: my-store
● MONITORING
```
Controls: `Check Now` | `Pause Monitoring` | `Simulate API Change` (visually distinct — test/demo styling, clearly labeled)

**Monitoring status panel:**
```
Last check       12:42:18
Next check       12:47:18
Last response    HTTP 200
Baseline         Established
Authentication   API Key ••••••••
```
Actual credentials never shown.

**Current API Structure panel:**
```
id              string
customer_id     string
amount          number
```

**Latest incident** (when present):
```
Latest Incident
CRITICAL — Autopsy available
[View Report]
```

### Screen 7 — Simulate API Change Dialog

Triggered from the `Simulate API Change` button on the Monitor screen.

Title: `Simulate a Breaking API Change`
Subtext: `Provide a simulated response representing how a third-party API contract might change. This will run through the same detection and investigation pipeline as a real API change.`

- **Current / Baseline Response** — read-only JSON viewer.
- **Simulated New Response** — editable JSON field, pre-populated with a sensible default.
- **Load Breaking Example** — convenience button that loads the canonical demo scenario (`customer_id` → `customer.id`).
- Disclaimer (persistent, not dismissable): `This is a simulation. It does not indicate that the external provider actually changed its API.`
- Primary action: `Run Simulation`

### Screen 8 — Live Incident Pipeline (Real-time)

Appears immediately after "Run Simulation" or when a real change is detected. Updates via WebSocket.

```
SIMULATION STARTED
✓ Controlled response loaded

↓

ANALYZING RESPONSE
✓ Deterministic diff computed

↓

CHANGE DETECTED
! customer_id removed
! customer object introduced

↓

INCIDENT CREATED
CRITICAL

↓

ANALYZING REPOSITORY
Scanning relevant API usage...

↓

IMPACT IDENTIFIED
src/services/payment.ts:42

↓

GEMINI INVESTIGATION
Reconstructing failure path...

↓

AUTOPSY COMPLETE
```

Each step updates live — not a single spinner at the end.

**Change detection evidence** (shown after diff step):
```
BREAKING CHANGE DETECTED

Removed:    customer_id: string
Added:      customer: object
Nested:     customer.id: string
```
This appears before Gemini runs, making clear the change was detected deterministically.

**Repository impact evidence** (shown after scan step):
```
APPLICATION IMPACT
1 affected reference found

src/services/payment.ts:42
const customerId = payment.customer_id;
```
If line-level attribution is uncertain:
```
Potentially affected file: src/services/payment.ts
Line-level attribution unavailable.
```
The UI never invents specificity it doesn't have.

### Screen 9 — Autopsy Report

The main investigation output. Accessible from the incident pipeline completion and from the Incidents list.

**Header:**
```
INCIDENT
CRITICAL
Payments API — GET /v1/payments/{id}
[SIMULATION]  ← badge if simulated
```

**WHAT CHANGED**
Plain-language explanation of the API contract difference. e.g.: `customer_id was removed from the root response. The customer identifier is now available at customer.id.`

**APPLICATION IMPACT**
File(s) and line(s) where the changed contract is referenced, with relevant code snippet. Qualified with confidence where uncertain.

**FAILURE PATH**
Reconstructed as a visual chain:
```
Third-party API
      ↓
PaymentService
      ↓
payment.customer_id
      ↓
undefined
      ↓
getCustomer(undefined)
      ↓
Potential application failure
```
Language is explicit that this is a reconstructed likely failure path, not an observed production failure.

**ROOT CAUSE**
Why the application's current code is incompatible with the new API structure.

**RECOMMENDED FIX**
What the developer should change, in plain language.

**PROPOSED PATCH**
```diff
- const customerId = payment.customer_id;
+ const customerId = payment.customer.id;
```
Presented as a recommendation for review/copying. Never auto-applied.

**CONFIDENCE**
```
Confidence: High

Evidence:
• API field removed (deterministic)
• Repository directly references customer_id
• Reference located in payment service
```
Confidence is tied to evidence, not presented as an unexplained AI score.

**Report footer:** `Detected by: Deterministic diff engine | Investigated by: Gemini`
This makes the distinction between detected facts and AI inference explicit.

### Screen 10 — Incidents List

Accessible from the sidebar.

- List of all incidents, ordered by recency.
- Each row: severity badge, API name, endpoint, timestamp, simulation badge if applicable, link to Autopsy Report.
- Empty state: `No incidents yet. API Autopsy will notify you when a change is detected.`

### Screen 11 — Operational Dashboard (Post-Setup)

Once at least one API is actively monitored, the main dashboard transitions from onboarding to:
- Monitored APIs count
- Active incidents count
- Critical incidents count
- Recent activity feed
- Quick links to individual monitors

---

## Look and Feel

Source: learner description of forensic investigation identity.

- **Identity:** Forensic investigation tool, not a monitoring dashboard. Calm, precise, authoritative. Feels like reading a post-incident report — structured, evidence-forward, technical.
- **Tone:** Not alarmist. The product surfaces facts and lets the evidence speak. Copy is direct and technical, not marketing-ish.
- **Color:** Dark mode preferred. Muted, professional palette — not a generic SaaS purple gradient. Use color purposefully: severity badges (critical = high-contrast warning), status indicators (green = healthy, amber = warning, red = incident), pipeline progress.
- **Typography:** Monospace for code, endpoints, JSON, and structural summaries. Clean sans-serif for UI copy and report prose. Feels like a developer tool, not a consumer app.
- **Motion:** Pipeline progress updates should animate in live — not batch-revealed. Each step appearing as it completes communicates real-time processing.
- **Density:** Information-dense but not cluttered. A developer should be able to scan a screen and understand the state in seconds.

---

## Features and Behavior

### GitHub Authentication

- GitHub OAuth login and repository authorization.
- After auth, user is routed to the dashboard.
- GitHub user/avatar persists in the sidebar.
- If auth fails or is cancelled, user returns to the landing page with a clear message.

### Repository Connection and Scan

Source: `scope.md → POC Boundary → GitHub OAuth login and repository connection`

- Developer selects one repository from their authorized GitHub repos.
- Scanner examines the codebase for API usage patterns: `fetch`, Axios, HTTP clients, SDK calls, base URLs, endpoint paths, HTTP methods, response field references.
- Scan produces API candidates with:
  - Detected endpoint (method + path)
  - File and line where detected
  - Evidence snippet
  - Confidence level (High / Medium / Low)
- If the scan finds nothing, the UI offers "Add API manually" and explains what patterns are supported.
- Scan results are not presented as facts — confidence level is always surfaced.

### Endpoint Configuration

Source: `scope.md → POC Boundary → Endpoint configuration`

- Pre-fills discovered values; developer can edit anything before saving.
- Supports GET and POST for the MVP.
- Path parameters, query parameters, and additional headers are configurable.
- Authentication: None / API Key (with editable header name) / Bearer Token.
- Credentials are encrypted at rest, stored separately from monitor configuration, never exposed to the frontend, logs, WebSocket messages, Gemini, or generated patches.
- Once saved, credentials are only ever shown masked.
- Test Connection validates the endpoint before allowing the developer to proceed.

### Baseline

Source: `scope.md → POC Boundary → Baseline capture`

- Primary: capture live response from the configured endpoint.
- Secondary: paste sample JSON (for demos and testing).
- Both paths show the parsed structural summary before confirmation.
- Baseline is stored normalized; JSON property ordering is ignored in future comparisons.

### API Monitoring

Source: `scope.md → POC Boundary → Periodic real API monitoring`

- Periodic polling of the configured endpoint.
- Deterministic structural diff: field removal, addition, type change, nesting change, object/array structure change.
- Transport and authentication failures (401, 403, timeout, DNS, 5xx) are classified separately and do not create schema incidents.
- `Check Now` triggers an immediate check.
- `Pause Monitoring` suspends polling without deleting configuration.

### Simulate API Change

Source: `scope.md → POC Boundary → Simulate API Change feature`

- Available on the active monitor screen; visually differentiated from real monitoring controls.
- Dialog shows the current baseline (read-only) and an editable simulated response.
- `Load Breaking Example` loads the canonical demo scenario.
- Persistent disclaimer: `This is a simulation. It does not indicate that the external provider actually changed its API.`
- The simulated response enters the exact same downstream pipeline as a real response: normalize → diff → incident → repository impact → Gemini → Autopsy Report.
- Simulated incidents are marked with a `[SIMULATION]` badge throughout.
- Simulation is implemented as a simple controlled fixture — no mock server infrastructure.

### Incident Pipeline

Source: `scope.md → POC Boundary → Incident creation`

Both real monitoring and simulation enter the same pipeline:
1. Normalize the new response.
2. Diff against the baseline (deterministic).
3. Classify change type and severity.
4. Create incident record.
5. Identify affected repository files/lines (pattern match against changed fields).
6. Send diff + affected code snippets to Gemini (never credentials, never unnecessary repo content).
7. Receive structured Autopsy Report from Gemini.
8. Push real-time progress updates to the dashboard via WebSocket.

### Autopsy Report

Source: `scope.md → POC Boundary → Autopsy Report`

- Sections: What Changed, Application Impact, Failure Path, Root Cause, Recommended Fix, Proposed Patch, Confidence.
- Failure path is explicitly described as a reconstructed likely failure path, not an observed production failure.
- Proposed patch is for review/copy — not auto-applied.
- Confidence is tied to named evidence items, not an unexplained score.
- Report clearly separates: deterministic findings vs. AI inference vs. proposed remediation.
- Gemini must not invent files, functions, or code not present in the provided evidence.
- Reports persist in the Incidents list and can be reopened.

---

## States and Boundaries

- **First-time / no repository** — Setup dashboard with onboarding flow. Sidebar items for APIs, Incidents, Repositories show empty states with prompts to complete setup.
- **Repository connected, no endpoint** — Discovery results shown; step 02 unlocked.
- **Endpoint configured, no baseline** — Baseline screen is the active step.
- **Baseline established, monitoring active** — Monitor screen shows live status; Simulate API Change is available.
- **Incident in progress** — Live pipeline screen updates via WebSocket. The rest of the UI remains accessible.
- **Autopsy complete** — Report is available; monitor shows "Latest incident — Autopsy available."
- **Transport / auth failure** — Logged as a connectivity event, not a schema incident. UI explains the distinction clearly.
- **Scanner finds nothing** — Honest empty state; manual endpoint entry is always available.
- **Scanner uncertain** — Confidence level shown; developer is asked to verify before monitoring. Never pretend certainty.
- **Gemini returns low-confidence result** — Confidence section reflects this; report is still shown with the evidence available.
- **Session persistence** — Connected repositories, configured endpoints, baselines, and incidents persist across sessions. The developer does not need to reconfigure after closing the browser.
- **Credentials** — Never displayed after entry; no way to retrieve a stored credential through the UI.

---

## Product Decisions

- **Setup is intentionally two steps: repository first, then API endpoint.** Repository connection must precede API configuration because Autopsy needs code context before it can meaningfully connect an API change to application impact. This is a UX principle, not just an implementation detail.
- **Simulation runs the real pipeline.** The hackathon demo must prove the actual product architecture, not a fake presentation-only workflow. Simulation input = real processing.
- **Proposed patch is review/copy only — no auto-application.** Automatic application is explicitly out of scope. AI is an advisor.
- **Credentials encrypted at rest, never exposed anywhere downstream.** Non-negotiable security constraint, established in scope.
- **Attribution is honest about confidence.** The UI never invents file-level or line-level precision it doesn't have. "Potentially affected" is an acceptable and expected output.
- **OpenAPI import explicitly deferred from the POC.** The two baseline sources for the MVP are: (1) Capture a live API response, (2) Use Sample JSON. OpenAPI import adds complexity without proving the core idea and belongs in a later version. The scope and PRD are consistent on this: OpenAPI is not in the POC.
- **Baseline screen is separate from the simulation screen.** Baseline = known-good state. Simulation = test the change pipeline. Keeping them separate protects the mental model.
- **Repository scanner uses direct pattern matching only — no multi-file call-graph tracing.** The scanner identifies API request calls, URL/endpoint paths, HTTP methods, and response-field references at the file/line level. If a deeper cross-file relationship cannot be established confidently, the scanner reports the limitation rather than guessing. Full AST or dependency-graph analysis is deferred.
- **Monitoring polling interval: 5 minutes (default, not configurable in the POC).** `Check Now` provides on-demand real checks. No scheduling UI is needed for the hackathon.
- **Demo uses a controlled GitHub fixture repository.** The product works with any connected repo; the fixture repo contains the canonical `payment.customer_id` integration to ensure a deterministic and repeatable demonstration. The fixture is a demo reliability mechanism, not a product limitation.
- **Gemini receives only the diff + affected code snippets.** Not the full repo, not credentials. The reasoning layer works from curated evidence only.

---

## What We're Building

Source: `scope.md → The POC Boundary → Demo focus`

One connected repository → one monitored API endpoint → one baseline → one controlled breaking change → one incident → repository impact → Gemini Autopsy → proposed fix.

- [ ] Landing page with hero, flow diagram, four-capability block, and Connect GitHub CTA
- [ ] GitHub OAuth login and repository selection
- [ ] Repository scanner (fetch, Axios, HTTP clients, URL/endpoint patterns, response field references)
- [ ] API candidate discovery with confidence levels; edit / dismiss / manual add
- [ ] Endpoint configuration: API Details, Request Configuration, Authentication (None / API Key / Bearer Token)
- [ ] Test Connection with correct classification of transport vs. auth vs. schema failures
- [ ] Baseline capture: live response + sample JSON path; structural summary display
- [ ] Setup progress indicator (01→04) persistent across onboarding screens
- [ ] Periodic real API monitoring with deterministic structural diff
- [ ] Simulate API Change: dialog with read-only baseline, editable simulated response, Load Breaking Example, Run Simulation
- [ ] Incident pipeline: normalize → diff → incident → repository impact → Gemini → Autopsy
- [ ] Real-time WebSocket updates to pipeline progress screen
- [ ] Autopsy Report: all sections, simulation badge, evidence-linked confidence
- [ ] Incidents list with reopen support
- [ ] Operational dashboard (post-setup state)

---

## Deferred From the POC

- **OpenAPI spec import** — adds an alternative baseline path but isn't needed to prove the core idea.
- **Multiple monitored endpoints per project** — architecture should support it; demo needs only one.
- **GitLab / Bitbucket** — GitHub is sufficient for the hackathon.
- **Webhook / Slack alerts** — real-time dashboard covers the demo; integrations are a distribution feature.

---

## Possible Later Enhancements

- OpenAPI import as a baseline source alongside live capture.
- Multiple simultaneous monitored endpoints.
- Baseline versioning and diff history.
- Deeper AST-based code analysis (beyond pattern matching).
- Automatic pull request generation for the proposed fix.
- Slack, webhook, and email notifications.
- GitLab and Bitbucket repository connections.
- Additional authentication schemes (OAuth flows, HMAC signing).

---

## Non-Goals

- **Enterprise RBAC / team accounts** — adds auth complexity with no proof-of-concept value.
- **Automatic code commits or pull requests** — AI is an advisor; automation is a future concern.
- **Full AST analysis engine** — pattern matching over the repository is sufficient to prove the concept.
- **Kubernetes / distributed tracing / APM** — different product surface entirely.
- **Billing and subscription management** — not relevant to a hackathon proof of concept.
- **Production deployment** — optional per hackathon rules; demo runs locally or on a dev host.
- **Mock server infrastructure for simulation** — a controlled JSON fixture is sufficient.

---

## Open Questions

All open questions resolved prior to PRD approval:

- **Repository scanner depth** → Pattern matching only. No multi-file call-graph tracing. Report limitations honestly. *(decided)*
- **Monitoring frequency** → 5-minute default polling. Check Now for on-demand. Not configurable in POC. *(decided)*
- **Demo repository** → Controlled GitHub fixture repo containing the canonical `payment.customer_id` scenario. Product architecture supports any repo. *(decided)*
- **OpenAPI import** → Explicitly deferred from POC. *(decided)*
