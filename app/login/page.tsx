"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { ShieldAlert, GitBranch, ArrowRight, Loader2, Terminal } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  async function handleGitHubSignIn() {
    setLoading(true);
    await signIn("github", { callbackUrl: "/dashboard" });
  }

  async function handleDevSignIn() {
    setDevLoading(true);
    await signIn("dev-mock-github", {
      callbackUrl: "/dashboard",
      username: "octocat",
    });
  }

  return (
    <div className="min-h-screen bg-[#07080a] flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-[#0c0e14] border border-[#1a1e29] rounded-xl p-8 space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded bg-rose-950/70 border border-rose-600/40 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="font-mono text-sm tracking-wider font-bold text-slate-100">API AUTOPSY</p>
            <p className="text-[11px] text-slate-500 font-mono">Forensic API Monitor</p>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-100">Connect your GitHub</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            API Autopsy uses GitHub to scan your repositories for outbound API integrations.
          </p>
        </div>

        {/* GitHub OAuth (real — requires env vars) */}
        <button
          onClick={handleGitHubSignIn}
          disabled={loading || devLoading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitBranch className="w-4 h-4 text-slate-300" />
          )}
          {loading ? "Connecting..." : "Continue with GitHub"}
        </button>

        {/* Dev sign-in — rendered in development only */}
        {process.env.NODE_ENV !== "production" && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#1e2535]" />
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Dev Mode</span>
              <div className="flex-1 h-px bg-[#1e2535]" />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                GitHub OAuth not configured? Use the dev account to test the dashboard, scanner, and pipeline locally.
              </p>
              <button
                onClick={handleDevSignIn}
                disabled={loading || devLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#11141e] hover:bg-[#161a28] border border-[#232a3c] text-slate-300 text-xs font-mono font-semibold transition-colors disabled:opacity-60"
              >
                {devLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                )}
                {devLoading ? "Signing in..." : "Sign in as Dev Account (octocat)"}
              </button>
            </div>
          </>
        )}

        <p className="text-[10px] text-slate-600 text-center font-mono leading-relaxed">
          Read-only repository access · Credentials encrypted at rest
        </p>
      </div>
    </div>
  );
}
