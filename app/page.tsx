import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  ArrowRight,
  GitBranch,
  Search,
  FileCode,
  Flame,
  CheckCircle2,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth();

  // If already authenticated, redirect straight to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-[#181c28] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-rose-950/70 border border-rose-600/40 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <span className="font-mono text-sm tracking-wider font-bold text-slate-100">
            API AUTOPSY
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto space-y-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141824] border border-[#232a3d] text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          AI-Powered API Incident Investigation
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 uppercase font-mono">
            When APIs Change, <br />
            <span className="text-rose-500">Know What Breaks.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            API Autopsy connects external API contract mutations directly to the lines of
            application code that depend on them, reconstructing the exact failure path and
            proposing a verified code patch.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold tracking-wide transition-all shadow-xl shadow-rose-950/50"
          >
            <GitBranch className="w-4 h-4" />
            Connect GitHub
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#222738] bg-[#0d1017] hover:bg-[#131722] text-slate-300 text-sm font-medium transition-colors"
          >
            See How It Works
          </a>
        </div>

        {/* Basic Flow Sequence */}
        <div id="how-it-works" className="w-full pt-16 border-t border-[#181c28]/60 space-y-6">
          <h3 className="text-xs uppercase font-mono tracking-wider text-slate-500">
            Forensic Incident Investigation Chain
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-left">
            <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#1a1e29] space-y-2">
              <div className="w-6 h-6 rounded bg-[#161a26] flex items-center justify-center text-slate-400 text-xs font-mono">
                1
              </div>
              <h4 className="text-xs font-semibold text-slate-200">Contract Drift</h4>
              <p className="text-[11px] text-slate-500 font-mono">
                External response changes (e.g. customer_id removed).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#1a1e29] space-y-2">
              <div className="w-6 h-6 rounded bg-[#161a26] flex items-center justify-center text-slate-400 text-xs font-mono">
                2
              </div>
              <h4 className="text-xs font-semibold text-slate-200">Schema Diff</h4>
              <p className="text-[11px] text-slate-500 font-mono">
                Deterministic comparison against captured baseline.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#1a1e29] space-y-2">
              <div className="w-6 h-6 rounded bg-[#161a26] flex items-center justify-center text-slate-400 text-xs font-mono">
                3
              </div>
              <h4 className="text-xs font-semibold text-slate-200">Code Impact</h4>
              <p className="text-[11px] text-slate-500 font-mono">
                Scans repository for consumers of the altered fields.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#1a1e29] space-y-2">
              <div className="w-6 h-6 rounded bg-rose-950/40 border border-rose-600/30 flex items-center justify-center text-rose-400 text-xs font-mono">
                4
              </div>
              <h4 className="text-xs font-semibold text-rose-300">Autopsy & Fix</h4>
              <p className="text-[11px] text-slate-400 font-mono">
                Gemini reconstructs failure chain and outputs unified diff patch.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#181c28] px-8 py-6 text-center text-xs font-mono text-slate-600">
        API AUTOPSY • Devpost Build With AI Hackathon • October 2026
      </footer>
    </div>
  );
}
