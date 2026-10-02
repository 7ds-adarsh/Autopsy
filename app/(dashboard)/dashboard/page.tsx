import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { repositories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SetupProgress } from "@/components/setup-progress";
import Link from "next/link";
import { GitBranch, ArrowRight, ShieldAlert, Sparkles, Terminal, CheckCircle2, Search } from "lucide-react";

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

  const hasRepo = userRepos.length > 0;
  const currentStep = hasRepo ? 2 : 1;

  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-[#181c28] pb-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-slate-400">System Ready</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Welcome to API Autopsy, {username}
        </h1>
        <p className="text-sm text-slate-400">
          Continuous contract inspection, deterministic diffs, and AI-powered failure autopsies.
        </p>
      </div>

      {/* Setup Progress */}
      <SetupProgress currentStep={currentStep} />

      {/* Conditional State: Has Repo vs No Repo */}
      {!hasRepo ? (
        /* First-Time State: Connect Repository */
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors shadow-lg shadow-rose-950/40"
              >
                <GitBranch className="w-4 h-4" />
                Connect Repository
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>

              <span className="text-xs font-mono text-slate-500">
                Read-only • GitHub App integration
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2 State: Repository Connected & Scanner Ready */
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
                Branch: <span className="font-mono text-slate-300">{userRepos[0].defaultBranch || "main"}</span> • Installation ID: <span className="font-mono text-slate-300">{userRepos[0].installationId || "fixture-demo"}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/repositories"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-md shadow-rose-950/30 font-mono"
              >
                <Search className="w-3.5 h-3.5" />
                View Scan & Discovered Candidates
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-lg bg-[#080b12] border border-[#141b29] space-y-2">
              <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider">
                Current Objective: Step 02
              </span>
              <h3 className="text-sm font-semibold text-slate-200">
                Select Discovered Candidate to Configure
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The scanner has identified HTTP integration patterns including the payment endpoint. Click into the repository view to review evidence and set up continuous contract monitoring.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#080b12] border border-[#141b29] space-y-2">
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                Scanner Intelligence
              </span>
              <h3 className="text-sm font-semibold text-slate-200">
                Filter Safeguards Verified
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ignore filters prevent scanning vendor directories, compiled dist artifacts, lockfiles, and binaries. Only valid application source files are analyzed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Info Grid */}
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
