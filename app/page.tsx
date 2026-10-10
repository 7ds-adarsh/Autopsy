import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  ArrowRight,
  GitBranch,
  Terminal,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth();

  // If already authenticated, redirect straight to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-slate-100 flex flex-col justify-between selection:bg-rose-950 selection:text-rose-200">
      {/* Top Navbar */}
      <header className="border-b border-[#181c28] px-6 sm:px-12 h-16 flex items-center justify-between sticky top-0 bg-[#07080a]/90 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-rose-950/70 border border-rose-600/40 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm tracking-wider font-bold text-slate-100">
              API AUTOPSY
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono">
              POC
            </span>
          </div>
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
            className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors shadow-sm shadow-rose-950/40 font-mono"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-5xl mx-auto space-y-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141824] border border-[#232a3d] text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Continuous Contract Drift & Failure Forensics
        </div>

        <div className="space-y-5">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 uppercase font-mono leading-tight">
            When APIs Change, <br />
            <span className="text-rose-500">Know What Breaks.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed font-sans">
            API Autopsy investigates third-party API changes inside your codebase,
            shows what can break, explains why, and recommends how to fix it.
          </p>
        </div>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-xl shadow-rose-950/50 font-mono"
          >
            <GitBranch className="w-4 h-4" />
            Connect GitHub
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#222738] bg-[#0d1017] hover:bg-[#131722] text-slate-300 text-xs sm:text-sm font-medium transition-colors font-mono"
          >
            See How It Works
          </a>
        </div>

        {/* Visual Flow Sequence (PRD Screen 1 diagram) */}
        <div id="how-it-works" className="w-full pt-12 border-t border-[#181c28] space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-rose-400" />
              Forensic Incident Chain
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Deterministic Detection → AST Trace → AI Autopsy
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[#0a0d14] border border-[#1b2130] font-mono text-xs overflow-x-auto shadow-2xl">
            <div className="flex items-center gap-2 text-slate-300 whitespace-nowrap py-1">
              <span className="px-2.5 py-1 rounded bg-[#161b29] text-slate-200 border border-[#232b40]">
                API changed
              </span>
              <span className="text-rose-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded bg-rose-950/50 text-rose-300 border border-rose-800/40">
                customer_id removed
              </span>
              <span className="text-rose-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded bg-amber-950/50 text-amber-300 border border-amber-800/40">
                payment.customer_id
              </span>
              <span className="text-rose-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded bg-rose-950/50 text-rose-300 border border-rose-800/40">
                undefined
              </span>
              <span className="text-rose-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded bg-rose-950/60 text-rose-200 border border-rose-700/50 font-bold">
                Customer lookup fails
              </span>
              <span className="text-emerald-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 font-bold">
                Recommended fix
              </span>
            </div>
          </div>
        </div>

        {/* Four-Capability Block (PRD Screen 1: DETECT / INVESTIGATE / EXPLAIN / FIX) */}
        <div className="w-full pt-8 space-y-4 text-left">
          <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400">
            Core Architecture Capabilities
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* DETECT */}
            <div className="p-5 rounded-xl bg-[#0b0e15] border border-[#182030] space-y-2.5 hover:border-[#222e47] transition-colors">
              <div className="w-7 h-7 rounded bg-[#131a29] border border-[#202b42] flex items-center justify-center text-rose-400 text-xs font-mono font-bold">
                01
              </div>
              <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wider text-rose-400">
                DETECT
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Continuous background monitoring compares live API responses against captured schema baselines.
              </p>
            </div>

            {/* INVESTIGATE */}
            <div className="p-5 rounded-xl bg-[#0b0e15] border border-[#182030] space-y-2.5 hover:border-[#222e47] transition-colors">
              <div className="w-7 h-7 rounded bg-[#131a29] border border-[#202b42] flex items-center justify-center text-amber-400 text-xs font-mono font-bold">
                02
              </div>
              <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wider text-amber-400">
                INVESTIGATE
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Deterministic diff engine identifies structural breaks and queries repository AST for references.
              </p>
            </div>

            {/* EXPLAIN */}
            <div className="p-5 rounded-xl bg-[#0b0e15] border border-[#182030] space-y-2.5 hover:border-[#222e47] transition-colors">
              <div className="w-7 h-7 rounded bg-[#131a29] border border-[#202b42] flex items-center justify-center text-sky-400 text-xs font-mono font-bold">
                03
              </div>
              <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wider text-sky-400">
                EXPLAIN
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Gemini reconstructs the end-to-end failure propagation path through your application services.
              </p>
            </div>

            {/* FIX */}
            <div className="p-5 rounded-xl bg-[#0b0e15] border border-[#182030] space-y-2.5 hover:border-[#222e47] transition-colors">
              <div className="w-7 h-7 rounded bg-[#131a29] border border-[#202b42] flex items-center justify-center text-emerald-400 text-xs font-mono font-bold">
                04
              </div>
              <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wider text-emerald-400">
                FIX
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Generates verified unified diff patches with code evidence and provenance attribution.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#181c28] px-6 sm:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 bg-[#07080a]">
        <div>
          API AUTOPSY • Forensic Third-Party API Inspection
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Devpost Build With AI: Basics</span>
          <span>•</span>
          <Link href="/login" className="hover:text-slate-300 transition-colors">
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
}
