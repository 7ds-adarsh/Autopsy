import { auth } from "@/lib/auth";
import { SetupProgress } from "@/components/setup-progress";
import Link from "next/link";
import { GitBranch, ArrowRight, ShieldAlert, Sparkles, Terminal } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const username = session?.user?.name || "Developer";

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
          Connect your repository to begin tracking external API contract changes and their code-level impact.
        </p>
      </div>

      {/* Setup Progress */}
      <SetupProgress currentStep={1} />

      {/* Main Call to Action Hero Card */}
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
