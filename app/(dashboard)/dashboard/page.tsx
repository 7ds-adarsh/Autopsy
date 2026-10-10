import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, apiMonitors, incidents, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SetupProgress } from "@/components/setup-progress";
import Link from "next/link";
import {
  GitBranch,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Terminal,
  CheckCircle2,
  Search,
  Radio,
  Layers,
  Activity,
  Flame,
  Clock,
  ExternalLink,
  Play,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const username = session?.user?.name || "Developer";
  let userId = session?.user?.id;

  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  const userRepos = userId
    ? await db
        .select()
        .from(repositories)
        .where(eq(repositories.userId, userId))
        .orderBy(desc(repositories.createdAt))
    : [];

  const userMonitors = userId
    ? await db
        .select()
        .from(apiMonitors)
        .where(eq(apiMonitors.userId, userId))
        .orderBy(desc(apiMonitors.createdAt))
    : [];

  const userIncidents = userId
    ? await db
        .select({
          id: incidents.id,
          monitorId: incidents.monitorId,
          severity: incidents.severity,
          isSimulation: incidents.isSimulation,
          status: incidents.status,
          createdAt: incidents.createdAt,
          monitorName: apiMonitors.name,
          monitorEndpoint: apiMonitors.endpoint,
          monitorMethod: apiMonitors.method,
        })
        .from(incidents)
        .innerJoin(apiMonitors, eq(incidents.monitorId, apiMonitors.id))
        .where(eq(apiMonitors.userId, userId))
        .orderBy(desc(incidents.createdAt))
        .limit(6)
    : [];

  const hasRepo = userRepos.length > 0;
  const hasMonitor = userMonitors.length > 0;
  const hasBaseline = userMonitors.some((m) => !!m.activeBaselineId);

  const monitoredCount = userMonitors.filter((m) => m.monitoringEnabled).length;
  const activeIncidentsCount = userIncidents.filter((i) => i.status === "open").length;
  const criticalIncidentsCount = userIncidents.filter((i) => i.severity === "critical").length;

  let currentStep: 1 | 2 | 3 | 4 = 1;
  if (hasBaseline) {
    currentStep = 4;
  } else if (hasMonitor) {
    currentStep = 3;
  } else if (hasRepo) {
    currentStep = 2;
  }

  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#181c28] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-slate-400">Continuous Monitor Active</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Welcome to API Autopsy, {username}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous contract inspection, deterministic diffs, and AI-powered failure autopsies.
          </p>
        </div>

        {hasBaseline && (
          <div className="flex items-center gap-3">
            <Link
              href="/apis"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141926] hover:bg-[#1a2233] border border-[#232c40] text-slate-200 text-xs font-mono transition-colors"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              API Monitors ({userMonitors.length})
            </Link>
            <Link
              href="/incidents"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-semibold transition-colors shadow-md shadow-rose-950/40"
            >
              <Flame className="w-3.5 h-3.5" />
              Incident Registry
            </Link>
          </div>
        )}
      </div>

      {/* Onboarding setup progress indicator (Steps 1–3, or collapsibly shown in Step 4) */}
      {!hasBaseline && <SetupProgress currentStep={currentStep} />}

      {/* Step 1: No Repositories */}
      {!hasRepo && (
        <div className="border border-[#1f2535] bg-gradient-to-b from-[#0f121a] to-[#0a0d13] rounded-xl p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-600/30 text-rose-300 text-xs font-mono">
              <ShieldAlert className="w-3.5 h-3.5" /> Step 1: Connect Source Code
            </div>

            <h2 className="text-xl font-bold text-slate-100">
              Link a GitHub Repository to Discover API Integrations
            </h2>

            <p className="text-sm text-slate-400 leading-relaxed">
              API Autopsy uses read-only access to scan your codebase for outbound HTTP calls, endpoints, and field references. When third-party APIs mutate, Autopsy traces precisely which lines of your code will fail.
            </p>

            <div className="pt-2 flex items-center gap-4">
              <Link
                href="/repositories"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors shadow-lg shadow-rose-950/40 font-mono"
              >
                <GitBranch className="w-4 h-4" />
                Connect Repository
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Repo Connected, Need Monitor */}
      {hasRepo && !hasMonitor && (
        <div className="border border-[#1f2535] bg-gradient-to-b from-[#0f1420] to-[#090c12] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#182133]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-3 h-3" /> Step 01 Complete
              </div>
              <h2 className="text-lg font-bold text-slate-100 font-mono mt-1">
                Connected: {userRepos[0].fullName}
              </h2>
              <p className="text-xs text-slate-400">
                Discovered candidate API endpoints are ready for configuration.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/repositories"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-md shadow-rose-950/30 font-mono"
              >
                <Search className="w-3.5 h-3.5" />
                Select Discovered Candidate
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Monitor Created, Needs Baseline */}
      {hasMonitor && !hasBaseline && (
        <div className="border border-[#1f2535] bg-gradient-to-b from-[#0f1420] to-[#090c12] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#182133]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-3 h-3" /> Steps 01 & 02 Complete
              </div>
              <h2 className="text-lg font-bold text-slate-100 font-mono mt-1">
                Endpoint Configured: {userMonitors[0].name}
              </h2>
              <p className="text-xs text-slate-400">
                Establish the structural baseline contract before continuous monitoring begins.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/apis/${userMonitors[0].id}/baseline`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-md shadow-rose-950/30 font-mono"
              >
                <Layers className="w-3.5 h-3.5" />
                Establish Baseline
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Screen 11 — Operational Dashboard (When Baselines & Monitoring Active) */}
      {hasBaseline && (
        <div className="space-y-6">
          {/* Metrics Row (PRD Screen 11) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="p-5 rounded-xl bg-[#0c1017] border border-[#1b2230] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Monitored APIs</span>
                <Radio className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{userMonitors.length}</div>
              <p className="text-[11px] text-emerald-400">
                {monitoredCount} actively scheduled
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c1017] border border-[#1b2230] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Incidents</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{activeIncidentsCount}</div>
              <p className="text-[11px] text-slate-400">
                {userIncidents.length} total recorded
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c1017] border border-[#1b2230] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Critical Severity</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400">{criticalIncidentsCount}</div>
              <p className="text-[11px] text-slate-400">
                Breaking contract drifts
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#0c1017] border border-[#1b2230] space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Baselines Active</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {userMonitors.filter((m) => !!m.activeBaselineId).length}
              </div>
              <p className="text-[11px] text-slate-400">
                Known-good schemas
              </p>
            </div>
          </div>

          {/* Quick Links to Individual Monitors */}
          <div className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#161c28]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Configured API Monitors
                </h2>
              </div>
              <Link
                href="/apis"
                className="text-xs text-rose-400 hover:text-rose-300 font-mono transition-colors"
              >
                Manage All →
              </Link>
            </div>

            <div className="space-y-3 font-mono">
              {userMonitors.map((mon) => (
                <div
                  key={mon.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-[#080b11] border border-[#182030] hover:border-[#222c42] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#161e2e] text-slate-300 border border-[#222c40]">
                        {mon.method}
                      </span>
                      <Link
                        href={`/apis/${mon.id}`}
                        className="text-sm font-bold text-slate-100 hover:text-rose-400 transition-colors"
                      >
                        {mon.name}
                      </Link>
                      {mon.monitoringEnabled ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#161a26] text-slate-400 border border-[#202738]">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {mon.baseUrl}{mon.endpoint}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/apis/${mon.id}`}
                      className="px-3 py-1.5 rounded bg-[#141926] hover:bg-[#1a2233] border border-[#232c40] text-slate-200 text-xs font-mono transition-colors"
                    >
                      View Monitor
                    </Link>
                    <Link
                      href={`/apis/${mon.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/50 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-mono transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-rose-400" />
                      Simulate
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed (PRD Screen 11) */}
          <div className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#161c28]">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Recent Activity Feed
                </h2>
              </div>
              <Link
                href="/incidents"
                className="text-xs text-rose-400 hover:text-rose-300 font-mono transition-colors"
              >
                View Incident Registry →
              </Link>
            </div>

            {userIncidents.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No incidents recorded yet. Captured baselines are healthy.
              </div>
            ) : (
              <div className="divide-y divide-[#151c28] font-mono">
                {userIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          inc.severity === "critical"
                            ? "bg-rose-950/70 text-rose-300 border border-rose-700/50"
                            : inc.severity === "high"
                            ? "bg-orange-950/70 text-orange-300 border border-orange-700/50"
                            : "bg-amber-950/70 text-amber-300 border border-amber-700/50"
                        }`}
                      >
                        {inc.severity}
                      </span>
                      {inc.isSimulation && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                          SIMULATION
                        </span>
                      )}
                      <div>
                        <span className="font-semibold text-slate-200">
                          {inc.monitorName}
                        </span>{" "}
                        <span className="text-slate-500">
                          ({inc.monitorMethod} {inc.monitorEndpoint})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-slate-400">
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(inc.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <Link
                        href={`/incidents/${inc.id}`}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        Autopsy Report →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Architecture Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-[#171a24] bg-[#0b0d13] p-5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono font-semibold">
            <Terminal className="w-4 h-4 text-slate-400" />
            Deterministic Scan
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Discovers endpoints, HTTP verbs, and data field references in your codebase with transparent pattern evidence.
          </p>
        </div>

        <div className="border border-[#171a24] bg-[#0b0d13] p-5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono font-semibold">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            Contract Baselines
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Records the known-good structural schema of each API. Every subsequent check is compared against this truth.
          </p>
        </div>

        <div className="border border-[#171a24] bg-[#0b0d13] p-5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono font-semibold">
            <Sparkles className="w-4 h-4 text-slate-400" />
            AI Root Cause Autopsy
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            When a breaking diff occurs, Gemini analyzes the failure path through your code and generates a unified diff patch.
          </p>
        </div>
      </div>
    </div>
  );
}
