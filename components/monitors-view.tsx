"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Radio, Play, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldCheck, ArrowRight, Activity } from "lucide-react";

export interface MonitorItem {
  id: string;
  name: string;
  baseUrl: string;
  endpoint: string;
  method: string;
  authType: string;
  discoverySource: string | null;
  discoveryConfidence: string | null;
  monitoringEnabled: boolean;
  intervalMinutes: number;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  activeBaselineId: string | null;
  createdAt: string;
  repositoryId: string | null;
  repositoryName: string | null;
}

interface MonitorsViewProps {
  initialMonitors: MonitorItem[];
}

export function MonitorsView({ initialMonitors }: MonitorsViewProps) {
  const [monitors, setMonitors] = useState<MonitorItem[]>(initialMonitors);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    [id: string]: {
      status: string;
      statusCode: number;
      durationMs: number;
      errorMessage?: string;
    };
  }>({});

  async function handleTest(monitorId: string) {
    setTestingId(monitorId);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [monitorId]: {
          status: data.status,
          statusCode: data.statusCode,
          durationMs: data.durationMs,
          errorMessage: data.errorMessage,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [monitorId]: {
          status: "transport-error",
          statusCode: 0,
          durationMs: 0,
          errorMessage: err.message,
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#181c28] pb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 font-mono">Monitored APIs</h1>
          <p className="text-xs text-slate-400">
            Active HTTP contract monitors, baseline schemas, and connection health
          </p>
        </div>

        <Link
          href="/apis/configure"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors shadow-md shadow-rose-950/30 font-mono"
        >
          <Plus className="w-3.5 h-3.5" />
          Add API Monitor
        </Link>
      </div>

      {monitors.length === 0 ? (
        <div className="border border-dashed border-[#1f2535] bg-[#0c0e14] rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#151926] border border-[#232a3d] flex items-center justify-center text-slate-400 mx-auto">
            <Radio className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No APIs configured yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Select an API candidate from your scanned repository or configure a new contract endpoint manually.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/repositories"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141926] hover:bg-[#1b2336] border border-[#232c40] text-slate-300 text-xs font-mono transition-colors"
            >
              Browse Repositories →
            </Link>
            <Link
              href="/apis/configure"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure Endpoint
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {monitors.map((m) => {
            const isTesting = testingId === m.id;
            const testResult = testResults[m.id];
            const hasBaseline = !!m.activeBaselineId;

            return (
              <div
                key={m.id}
                className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-6 space-y-4 hover:border-[#242e44] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#161c28]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#161d2d] text-rose-400 border border-rose-900/40">
                        {m.method}
                      </span>
                      <Link href={`/apis/${m.id}`} className="hover:text-rose-400 transition-colors">
                        <h2 className="text-sm font-bold text-slate-100 font-mono">
                          {m.name}
                        </h2>
                      </Link>
                      {hasBaseline ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Baseline Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                          Baseline Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400">
                      {m.baseUrl}{m.endpoint}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/apis/${m.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161d2b] hover:bg-[#1f283d] border border-[#232f48] text-xs font-mono text-slate-200 transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5 text-rose-400" />
                      Open Monitor
                    </Link>

                    <button
                      onClick={() => handleTest(m.id)}
                      disabled={isTesting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#141a27] hover:bg-[#1a2233] border border-[#212b3f] text-xs font-mono text-slate-200 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${isTesting ? "animate-spin" : ""}`} />
                      {isTesting ? "Testing..." : "Test Connection"}
                    </button>

                    <Link
                      href={`/apis/${m.id}/baseline`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-mono font-medium transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {hasBaseline ? "View Baseline" : "Establish Baseline"}
                    </Link>
                  </div>
                </div>

                {/* Test Result Bar if tested */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between border ${
                      testResult.status === "success"
                        ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                        : "bg-rose-950/30 border-rose-800/40 text-rose-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>
                        Status: <strong>{testResult.status.toUpperCase()}</strong> (HTTP {testResult.statusCode})
                        {testResult.errorMessage && ` — ${testResult.errorMessage}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Latency: <strong>{testResult.durationMs}ms</strong>
                    </span>
                  </div>
                )}

                {/* Metadata details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono text-slate-500 pt-1">
                  <div>
                    <span className="block text-slate-600">Auth Type</span>
                    <span className="text-slate-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {m.authType === "none" ? "None" : `${m.authType.toUpperCase()} (AES Encrypted)`}
                    </span>
                  </div>

                  <div>
                    <span className="block text-slate-600">Linked Repo</span>
                    <span className="text-slate-300">{m.repositoryName || "Manual / None"}</span>
                  </div>

                  <div>
                    <span className="block text-slate-600">Check Interval</span>
                    <span className="text-slate-300">Every {m.intervalMinutes}m</span>
                  </div>

                  <div>
                    <span className="block text-slate-600">Last Checked</span>
                    <span className="text-slate-300">
                      {m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
