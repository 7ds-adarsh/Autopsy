---
doc: scope
status: approved
---

# API Autopsy

An AI-powered incident investigation platform that connects an external API contract change to the application code that depends on it, reconstructs the failure path, and proposes a code fix.

## The Unique Kernel

Most API monitors tell you the API changed. API Autopsy tells you what breaks in *your code* because of that change, why it breaks, and exactly what to update.

The distinctive capability is the chain: **external API diff → repository code scan → failure path reconstruction → AI-generated Autopsy Report with a proposed patch.** Delete any one of those links and it becomes a standard API monitor.

## Who It's For

A developer whose application depends on one or more third-party APIs — payment providers, data APIs, external services. They've been burned before: the API silently changed, something broke in production, and it took hours to trace the failure back to a changed field. They don't want to watch a schema-diff dashboard; they want to know *which of their functions is about to return undefined*.

## The Core Loop

They connect their GitHub repository and configure a third-party endpoint. API Autopsy captures a baseline response and continuously monitors the endpoint. When a structural change is detected — or when they trigger a simulation — an **Autopsy Report** appears: what changed in the API, which file and line in their repo references the changed field, how the failure propagates, and a concrete code diff to fix it. They open the report, read the chain, and review or copy the proposed fix.

## Inspiration & Identity

Feels like a forensic investigation tool, not a monitoring dashboard. Think post-incident reports and root-cause analyses — structured, precise, evidence-forward. The name says it: we're doing a technical autopsy of what went wrong and why. The tone is calm and authoritative, not alarmist. The UI should surface the incident chain clearly and let the Autopsy Report do the talking.

## Why This Matters to the Learner

Real developer pain: third-party APIs break applications silently, and tracing the failure is slow and manual. "I want to know not just *that* the API changed, but *what breaks in my application, why, and what to change.*" The idea is also a good vehicle for the learning goals — this is a multi-layer system (monitoring, repo analysis, AI reasoning) where the agent collaboration and code comprehension skills will matter.

## What "Working" Looks Like

A developer opens the dashboard, connects a GitHub repository, selects or confirms a discovered API endpoint, and captures a baseline response. The repository contains code that references a specific response field. They hit **Simulate API Change**, supply a controlled JSON response that restructures that field, and watch the real-time pipeline fire:

```
Simulated change detected
↓ Deterministic diff computed
↓ Incident created
↓ Repository impact analysis running...
↓ Gemini investigating...
↓ Autopsy complete
```

The Autopsy Report opens and shows: the removed field, the affected file and line where confidently identifiable, the reconstructed failure path, and a diff-style code fix. The "oh, that's the whole idea" moment is seeing your own repository code appear in the report, connected to the API change.

## The POC Boundary

**Demo focus:** one connected repository → one monitored API endpoint → one baseline → one controlled breaking change → one incident → repository impact → Gemini Autopsy → proposed fix. The architecture supports expansion, but the implementation and demo prioritize this single complete path above all else.

**In:**
- GitHub OAuth login and repository connection
- Automated repository scan for API usage (fetch, Axios, HTTP clients, URLs, endpoint paths, response-field references)
- API candidate discovery with user review (select, edit, dismiss, or manually add)
- Endpoint configuration: URL, HTTP method, query params, headers
- Authentication: public (none), API key in header, Bearer token — credentials encrypted at rest and stored separately from monitor configuration; never exposed to the frontend, logs, WebSocket messages, Gemini, or generated patches under any circumstances
- Baseline capture (live API call or manual JSON input)
- Periodic real API monitoring with deterministic structural diff (field removal, addition, type change, nesting change)
- Transport/auth failure classification (401, 403, timeout, DNS, 5xx) — not treated as schema incidents
- **Simulate API Change** feature: controlled before/after JSON fixture, exercises the exact same pipeline as a real detected change; clearly labeled as simulation in the UI
- Incident creation with severity classification
- Repository impact analysis: identify files/lines referencing changed fields
- Gemini investigation layer: receives diff + affected code snippets (not credentials, not full repo unnecessarily)
- Autopsy Report: what changed, application impact, failure path, root cause, recommended fix, proposed code patch, confidence
- Real-time WebSocket updates to the dashboard during incident pipeline
- Incidents list and individual report view

**Out of POC (but real production behavior preserved):**
- The real API monitoring, baseline, and comparison engine are built fully — simulation is an additional trigger, not a replacement

## Later

- OpenAPI spec import as baseline source
- Multiple monitored endpoints per project
- Slack / webhook alert integrations
- More authentication schemes (OAuth flows, HMAC signing, mTLS)
- Diff history and baseline versioning
- GitLab and Bitbucket repository connections
- Deeper AST-based code analysis (beyond pattern matching)
- Automatic pull request generation for the proposed fix

## Explicitly Cut

- **Enterprise RBAC and teams** — adds auth complexity with no proof-of-concept value
- **Automatic commits/pull requests** — impressive but not the idea being proven; keep AI as advisor
- **Full AST analysis engine** — heavyweight; pattern matching over the repo is sufficient to prove the concept
- **Kubernetes / distributed tracing / APM integration** — different product surface
- **Billing and subscription management** — not relevant to a hackathon proof of concept
- **Production deployment** — optional per hackathon rules; demo runs locally or on a dev host
- **Mock server system for simulation** — a simple controlled JSON fixture is enough; no need for a separate mock infrastructure
