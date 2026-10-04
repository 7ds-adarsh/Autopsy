"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SetupProgress } from "@/components/setup-progress";
import { ShieldCheck, ArrowRight, Key, Globe, Send, Loader2, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";

function ConfigureEndpointForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const repoId = searchParams.get("repoId") || "";
  const paramEndpoint = searchParams.get("endpoint") || "";
  const paramMethod = (searchParams.get("method") || "POST").toUpperCase();
  const paramFile = searchParams.get("file") || "";

  // Split endpoint into baseUrl and path if full URL provided
  let initialBaseUrl = "https://api.acmepayments.com/v1";
  let initialEndpointPath = "/payments";

  if (paramEndpoint.startsWith("http")) {
    try {
      const u = new URL(paramEndpoint);
      initialBaseUrl = `${u.protocol}//${u.host}${u.pathname.split("/").slice(0, 2).join("/")}`;
      initialEndpointPath = u.pathname.replace(initialBaseUrl.replace(/https?:\/\/[^/]+/, ""), "") || u.pathname;
    } catch {
      initialBaseUrl = paramEndpoint;
      initialEndpointPath = "/payments";
    }
  } else if (paramEndpoint) {
    initialEndpointPath = paramEndpoint;
  }

  const [name, setName] = useState("Acme Payments API");
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [endpoint, setEndpoint] = useState(initialEndpointPath);
  const [method, setMethod] = useState(paramMethod);
  const [authType, setAuthType] = useState<"none" | "api_key" | "bearer">("api_key");
  const [authHeaderName, setAuthHeaderName] = useState("x-api-key");
  const [credential, setCredential] = useState("acme_live_sec_99382104");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: repoId || undefined,
          name,
          baseUrl,
          endpoint,
          method,
          authType,
          authHeaderName: authType === "api_key" ? authHeaderName : undefined,
          credential: authType !== "none" ? credential : undefined,
          discoverySource: paramFile ? "scan" : "manual",
          discoveryConfidence: "high",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create monitor");
      }

      const monitor = await res.json();
      // Proceed directly to Baseline establishment
      router.push(`/apis/${monitor.id}/baseline`);
    } catch (err: any) {
      setError(err.message || "Failed to save endpoint configuration");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Workflow Progress: Step 02 is Current */}
      <SetupProgress currentStep={2} />

      <div className="flex flex-col gap-1 border-b border-[#181c28] pb-5">
        <h1 className="text-xl font-bold font-mono text-slate-100">
          Configure API Endpoint & Credentials
        </h1>
        <p className="text-xs text-slate-400">
          Define the contract target URL, HTTP parameters, and authentication credentials.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: API Details */}
        <div className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-rose-400" />
            API Contract Target
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Monitor Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="e.g. Acme Payments API"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="https://api.acmepayments.com/v1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Endpoint Path</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="/payments"
              />
            </div>
          </div>

          {paramFile && (
            <div className="p-2.5 rounded bg-[#07090e] border border-[#141b27] text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Discovered in codebase: <strong className="text-rose-400">{paramFile}</strong></span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Verified Candidate
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Authentication & Credential Encryption */}
        <div className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-rose-400" />
              Authentication & Credential Protection
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256-GCM Encrypted at Rest</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="authType"
                value="none"
                checked={authType === "none"}
                onChange={() => setAuthType("none")}
                className="accent-rose-500"
              />
              None
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="authType"
                value="api_key"
                checked={authType === "api_key"}
                onChange={() => setAuthType("api_key")}
                className="accent-rose-500"
              />
              API Key (Header)
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="authType"
                value="bearer"
                checked={authType === "bearer"}
                onChange={() => setAuthType("bearer")}
                className="accent-rose-500"
              />
              Bearer Token
            </label>
          </div>

          {authType === "api_key" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Header Name</label>
                <input
                  type="text"
                  value={authHeaderName}
                  onChange={(e) => setAuthHeaderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="x-api-key"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">API Key Value</label>
                <input
                  type="password"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Enter API key"
                />
              </div>
            </div>
          )}

          {authType === "bearer" && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-mono text-slate-400">Bearer Token</label>
              <input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#07090f] border border-[#1c2436] text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="Enter Bearer token"
              />
            </div>
          )}

          <div className="p-3 rounded-lg bg-[#07090f] border border-[#141b27] text-[11px] font-mono text-slate-500 leading-relaxed">
            <span className="text-slate-400 font-semibold">Security Boundary:</span> Credentials are encrypted server-side with AES-256-GCM before database insertion. Decrypted only in-memory immediately prior to monitor execution. Never returned in API responses, Socket.IO streams, or AI prompts.
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/repositories"
            className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back to Discovered Candidates
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-rose-950/40 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Save & Continue to Baseline
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ConfigureEndpointPage() {
  return (
    <div className="p-8 max-w-4xl w-full mx-auto">
      <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-slate-500">Loading configuration form...</div>}>
        <ConfigureEndpointForm />
      </Suspense>
    </div>
  );
}
