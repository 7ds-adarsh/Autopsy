"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { SetupProgress } from "@/components/setup-progress";
import { FieldStructure, extractStructureSummary } from "@/lib/monitor/http-client";
import { ShieldCheck, CheckCircle2, RefreshCw, ArrowRight, Play, FileJson, Check, AlertCircle, Code, Layers } from "lucide-react";
import Link from "next/link";

const CANONICAL_PAYMENT_FIXTURE = {
  id: "pay_live_8392104",
  customer_id: "cust_77392",
  amount: 4900,
  currency: "usd",
  status: "succeeded",
  created_at: "2026-10-02T12:00:00Z",
};

export default function BaselinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [monitor, setMonitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "sample">("sample");
  const [sampleText, setSampleText] = useState(JSON.stringify(CANONICAL_PAYMENT_FIXTURE, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [testedResponse, setTestedResponse] = useState<any>(CANONICAL_PAYMENT_FIXTURE);
  const [structureSummary, setStructureSummary] = useState<FieldStructure[]>(
    extractStructureSummary(CANONICAL_PAYMENT_FIXTURE)
  );

  const [saving, setSaving] = useState(false);
  const [liveCapturing, setLiveCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load monitor details
  useEffect(() => {
    fetch(`/api/monitors/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Monitor not found");
        return res.json();
      })
      .then((data) => {
        setMonitor(data);
        if (data.activeBaseline?.responseBody) {
          setTestedResponse(data.activeBaseline.responseBody);
          setSampleText(JSON.stringify(data.activeBaseline.responseBody, null, 2));
          setStructureSummary(data.activeBaseline.structureSummary);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Update structure summary when sample JSON changes
  function handleSampleChange(text: string) {
    setSampleText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      setTestedResponse(parsed);
      setStructureSummary(extractStructureSummary(parsed));
    } catch (e: any) {
      setJsonError("Invalid JSON syntax: " + e.message);
    }
  }

  // Load canonical payment fixture
  function handleLoadFixture() {
    const text = JSON.stringify(CANONICAL_PAYMENT_FIXTURE, null, 2);
    setSampleText(text);
    setJsonError(null);
    setTestedResponse(CANONICAL_PAYMENT_FIXTURE);
    setStructureSummary(extractStructureSummary(CANONICAL_PAYMENT_FIXTURE));
  }

  // Capture live response from endpoint
  async function handleCaptureLive() {
    setLiveCapturing(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${id}/test`, {
        method: "POST",
      });

      const result = await res.json();
      if (result.status !== "success") {
        throw new Error(result.errorMessage || `HTTP ${result.statusCode} returned`);
      }

      setTestedResponse(result.data);
      setSampleText(JSON.stringify(result.data, null, 2));
      setStructureSummary(extractStructureSummary(result.data));
    } catch (err: any) {
      setError("Live capture failed: " + err.message);
    } finally {
      setLiveCapturing(false);
    }
  }

  // Confirm and save baseline
  async function handleConfirmBaseline() {
    if (!testedResponse) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/monitors/${id}/baseline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureMethod: activeTab,
          sampleJson: testedResponse,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to establish baseline");
      }

      // Redirect to APIs list or monitor detail
      router.push("/apis?baseline_saved=true");
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-500">
        Loading monitor configuration...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl w-full mx-auto space-y-6">
      {/* Workflow Progress: Step 03 is Current */}
      <SetupProgress currentStep={3} />

      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-[#181c28] pb-5">
        <h1 className="text-xl font-bold font-mono text-slate-100">
          Establish Contract Baseline
        </h1>
        <p className="text-xs text-slate-400">
          Capture or define the known-good structural contract schema for continuous change detection.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Monitor Metadata Bar */}
      {monitor && (
        <div className="p-4 rounded-xl bg-[#0c1017] border border-[#1a2130] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-900/40 text-rose-400 font-bold">
              {monitor.method}
            </span>
            <span className="font-semibold text-slate-200">{monitor.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{monitor.baseUrl}{monitor.endpoint}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Auth:</span>
            <span className="px-2 py-0.5 rounded bg-[#131826] text-slate-300 border border-[#1b2233]">
              {monitor.authType === "none" ? "None" : monitor.authType.toUpperCase()} (Masked)
            </span>
          </div>
        </div>
      )}

      {/* Capture Method Tabs */}
      <div className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#161c28] pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("sample")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                activeTab === "sample"
                  ? "bg-rose-600 text-white font-semibold"
                  : "bg-[#121622] text-slate-400 hover:text-slate-200"
              }`}
            >
              Use Sample JSON (Fixture)
            </button>
            <button
              onClick={() => {
                setActiveTab("live");
                handleCaptureLive();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                activeTab === "live"
                  ? "bg-rose-600 text-white font-semibold"
                  : "bg-[#121622] text-slate-400 hover:text-slate-200"
              }`}
            >
              Capture Live Response
            </button>
          </div>

          {activeTab === "sample" && (
            <button
              onClick={handleLoadFixture}
              className="text-xs font-mono text-rose-400 hover:text-rose-300 underline font-medium"
            >
              Load Canonical Payment Fixture
            </button>
          )}

          {activeTab === "live" && (
            <button
              onClick={handleCaptureLive}
              disabled={liveCapturing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#161c2b] border border-[#222c42] text-xs font-mono text-slate-200 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 text-rose-400 ${liveCapturing ? "animate-spin" : ""}`} />
              Re-capture
            </button>
          )}
        </div>

        {/* JSON Input or Live Stream Display */}
        {activeTab === "sample" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Sample JSON Payload:</span>
              {jsonError ? (
                <span className="text-rose-400">{jsonError}</span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Valid JSON
                </span>
              )}
            </div>
            <textarea
              rows={8}
              value={sampleText}
              onChange={(e) => handleSampleChange(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-lg bg-[#06080d] border border-[#171e2c] text-emerald-400/90 focus:outline-none focus:border-rose-500 leading-relaxed"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-mono text-slate-400">Captured Live Response Payload:</span>
            <pre className="font-mono text-xs p-3 rounded-lg bg-[#06080d] border border-[#171e2c] text-emerald-400/90 overflow-x-auto leading-relaxed max-h-48">
              {JSON.stringify(testedResponse, null, 2)}
            </pre>
          </div>
        )}

        {/* Structural Summary Table */}
        <div className="space-y-3 pt-3 border-t border-[#161c28]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Inferred Structural Schema ({structureSummary.length} fields)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Deterministic Contract Representation
            </span>
          </div>

          <div className="border border-[#171e2c] rounded-lg overflow-hidden bg-[#07090e]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0f141f] border-b border-[#171e2c] text-slate-400">
                <tr>
                  <th className="py-2 px-3">Field Path</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Nullable</th>
                  <th className="py-2 px-3">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131926]">
                {structureSummary.map((field) => (
                  <tr key={field.path} className="hover:bg-[#0b0e14]">
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      {field.path === "customer_id" ? (
                        <span className="text-rose-400 underline decoration-rose-500/50">
                          {field.path}
                        </span>
                      ) : (
                        field.path
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-[#121624] text-slate-300 border border-[#1a2133]">
                        {field.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {field.nullable ? "Yes" : "No"}
                    </td>
                    <td className="py-2 px-3 text-slate-400 truncate max-w-xs">
                      {field.sampleValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[#161c28]">
          <Link
            href={`/apis/configure`}
            className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back to Configuration
          </Link>

          <button
            onClick={handleConfirmBaseline}
            disabled={saving || !testedResponse}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-rose-950/40 disabled:opacity-50 font-mono"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Use This as Baseline & Activate Monitor
          </button>
        </div>
      </div>
    </div>
  );
}
