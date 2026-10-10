"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Flame,
  GitBranch,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { SimulateDialog } from "./simulate-dialog";
import { LivePipelineProgress } from "./live-pipeline-progress";

export interface MonitorDetailData {
  id: string;
  name: string;
  baseUrl: string;
  endpoint: string;
  method: string;
  pathParams: Record<string, string> | null;
  queryParams: Record<string, string> | null;
  additionalHeaders: Record<string, string> | null;
  authType: string;
  authHeaderName: string | null;
  hasCredential: boolean;
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
  activeBaseline: {
    id: string;
    responseBody: any;
    structureSummary: Array<{
      field: string;
      type: string;
      path: string;
      required: boolean;
    }> | null;
    captureMethod: string;
    capturedAt: string;
  } | null;
  latestIncident?: {
    id: string;
    severity: string;
    isSimulation: boolean;
    status: string;
    createdAt: string;
    diff: any;
  } | null;
}

interface MonitorDetailViewProps {
  initialMonitor: MonitorDetailData;
}

export function MonitorDetailView({ initialMonitor }: MonitorDetailViewProps) {
  const [monitor, setMonitor] = useState<MonitorDetailData>(initialMonitor);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [isPipelineActive, setIsPipelineActive] = useState(false);
  const [isSimulationRun, setIsSimulationRun] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Masked auth string
  const authDisplay =
    monitor.authType === "none"
      ? "None"
      : monitor.authType === "api_key"
      ? `${monitor.authHeaderName || "API Key"} ••••••••`
      : "Bearer Token ••••••••";

  // Calculate next check
  const nextCheckDisplay = (() => {
    if (!monitor.monitoringEnabled) return "Paused";
    if (!monitor.lastCheckedAt) return "In ~5 minutes";
    const last = new Date(monitor.lastCheckedAt).getTime();
    const next = new Date(last + monitor.intervalMinutes * 60 * 1000);
    if (next.getTime() <= Date.now()) return "Due now";
    return next.toLocaleTimeString();
  })();

  // Handle Check Now
  async function handleCheckNow() {
    setIsChecking(true);
    setActionMessage(null);
    setIsSimulationRun(false);
    setIsPipelineActive(true);

    try {
      const res = await fetch(`/api/monitors/${monitor.id}/check`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Check failed");
      }

      if (data.status === "healthy") {
        setActionMessage({
          type: "success",
          text: "Real check completed: Contract matches baseline with 0 changes.",
        });
        setMonitor((prev) => ({
          ...prev,
          lastStatus: "healthy",
          lastCheckedAt: new Date().toISOString(),
        }));
      } else if (data.status === "incident") {
        setActiveIncidentId(data.incidentId);
        setActionMessage({
          type: "error",
          text: `Real check completed: Breaking contract change detected! Incident created.`,
        });
        setMonitor((prev) => ({
          ...prev,
          lastStatus: "incident",
          lastCheckedAt: new Date().toISOString(),
        }));
      } else {
        setActionMessage({
          type: "error",
          text: `Check finished with status: ${data.status} (${data.message || ""})`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to execute check",
      });
    } finally {
      setIsChecking(false);
    }
  }

  // Handle Pause / Resume Monitoring
  async function handleToggleMonitoring() {
    setIsTogglingStatus(true);
    setActionMessage(null);
    const newStatus = !monitor.monitoringEnabled;

    try {
      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoringEnabled: newStatus }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setMonitor((prev) => ({
        ...prev,
        monitoringEnabled: newStatus,
      }));
      setActionMessage({
        type: "success",
        text: newStatus
          ? "Monitoring resumed. Background polling is now active."
          : "Monitoring paused. Background checks are halted.",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to toggle status",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  }

  function handleSimulationStarted(incidentId?: string) {
    if (incidentId) {
      setActiveIncidentId(incidentId);
    }
    setIsSimulationRun(true);
    setIsPipelineActive(true);
    setActionMessage({
      type: "success",
      text: "Breaking-change simulation launched. Inspect real-time investigation below.",
    });
  }

  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-8 font-mono">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/apis" className="hover:text-slate-300 transition-colors">
          Monitored APIs
        </Link>
        <span>/</span>
        <span className="text-slate-300 font-semibold">{monitor.name}</span>
      </div>

      {/* Screen 6 Header */}
      <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#161d2d]">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-[#161f30] text-rose-400 border border-rose-900/50">
                {monitor.method}
              </span>
              <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
                {monitor.name}
              </h1>

              {monitor.monitoringEnabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  MONITORING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/70 text-amber-400 border border-amber-800/40 text-[11px] font-semibold">
                  <Pause className="w-3 h-3" />
                  PAUSED
                </span>
              )}

              {monitor.lastStatus === "incident" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[11px] font-semibold">
                  <Flame className="w-3 h-3 text-rose-400" />
                  INCIDENT DETECTED
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 font-mono">
              {monitor.baseUrl}
              <span className="text-slate-200">{monitor.endpoint}</span>
            </p>

            {monitor.repositoryName && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                Linked Repository:{" "}
                <span className="text-slate-300 font-semibold">
                  {monitor.repositoryName}
                </span>
              </p>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCheckNow}
              disabled={isChecking || !monitor.activeBaselineId}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141a27] hover:bg-[#1b2336] border border-[#232c40] text-slate-200 text-xs font-mono transition-colors disabled:opacity-50"
              title="Execute immediate live check against configured endpoint"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-rose-400 ${
                  isChecking ? "animate-spin" : ""
                }`}
              />
              {isChecking ? "Checking..." : "Check Now"}
            </button>

            <button
              onClick={handleToggleMonitoring}
              disabled={isTogglingStatus}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141a27] hover:bg-[#1b2336] border border-[#232c40] text-slate-200 text-xs font-mono transition-colors disabled:opacity-50"
            >
              {monitor.monitoringEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  Pause Monitoring
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                  Resume Monitoring
                </>
              )}
            </button>

            {/* Simulate API Change Button - visually distinct demo/test styling */}
            <button
              onClick={() => setIsSimulateOpen(true)}
              disabled={!monitor.activeBaselineId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/60 text-purple-200 text-xs font-mono font-semibold transition-colors shadow-md shadow-purple-950/40 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Simulate API Change
            </button>

            <Link
              href={`/apis/${monitor.id}/baseline`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#121622] hover:bg-[#182030] border border-[#1f283c] text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Baseline
            </Link>
          </div>
        </div>

        {/* Action feedback alert */}
        {actionMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
              actionMessage.type === "success"
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-300"
                : "bg-rose-950/40 border-rose-800/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Monitoring Status Panel (Screen 6 Spec) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1a2233]">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Last Check
            </span>
            <span className="text-slate-200 text-xs font-bold">
              {monitor.lastCheckedAt
                ? new Date(monitor.lastCheckedAt).toLocaleTimeString()
                : "Never checked"}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1a2233]">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Next Check
            </span>
            <span className="text-slate-200 text-xs font-bold">
              {nextCheckDisplay}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1a2233]">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Last Response
            </span>
            <span className="text-slate-200 text-xs font-bold flex items-center gap-1.5">
              {monitor.lastStatus === "healthy" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  HTTP 200 (Clean)
                </>
              ) : monitor.lastStatus === "incident" ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Diff Incident
                </>
              ) : monitor.lastStatus === "error" ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Connection Error
                </>
              ) : (
                "Pending"
              )}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1a2233]">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Baseline
            </span>
            <span className="text-slate-200 text-xs font-bold flex items-center gap-1.5">
              {monitor.activeBaselineId ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Established
                </>
              ) : (
                <span className="text-amber-400">Not Captured</span>
              )}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1a2233]">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Authentication
            </span>
            <span className="text-slate-200 text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {authDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Live Investigation Pipeline (Screen 8) when active */}
      {isPipelineActive && (
        <LivePipelineProgress
          monitorId={monitor.id}
          isSimulation={isSimulationRun}
          incidentId={activeIncidentId}
          onDismiss={() => setIsPipelineActive(false)}
        />
      )}

      {/* Latest Incident Panel (Screen 6 Spec) */}
      {monitor.latestIncident && (
        <div className="border border-rose-950/60 bg-[#0d090d] rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-rose-950/50">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-rose-200 font-mono uppercase tracking-wide">
                  Latest Incident Recorded
                </h3>
                <p className="text-[11px] text-rose-400/80">
                  {new Date(monitor.latestIncident.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold uppercase text-xs">
                {monitor.latestIncident.severity}
              </span>
              {monitor.latestIncident.isSimulation && (
                <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 uppercase text-[10px] font-semibold">
                  Simulation
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Deterministic schema diff detected a contract mutation compared to the active baseline. An Autopsy Report with root cause, failure path, and code impact is available.
          </p>

          <div className="flex justify-end pt-1">
            <Link
              href={`/incidents/${monitor.latestIncident.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-semibold transition-colors shadow-md shadow-rose-950/40"
            >
              <span>View Autopsy Report</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Current API Structure Panel (Screen 6 Spec) */}
      <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#161d2d]">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wide">
              Current API Structure
            </h3>
            <p className="text-[11px] text-slate-400">
              Contract schema from established baseline ({monitor.activeBaseline?.captureMethod || "sample"})
            </p>
          </div>

          <Link
            href={`/apis/${monitor.id}/baseline`}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
          >
            <span>Full Baseline JSON</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {monitor.activeBaseline?.structureSummary &&
        monitor.activeBaseline.structureSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#182030] text-slate-500 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Path</th>
                  <th className="py-2.5 px-3 text-right">Constraint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141a27] text-slate-300">
                {monitor.activeBaseline.structureSummary.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#0e121d] transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-200">
                      {item.field}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-[#131826] text-rose-400 border border-rose-900/40 text-[10px]">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                      {item.path}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 text-[10px]">
                      {item.required ? "Required" : "Optional"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            No structural summary available. Capture or re-establish a baseline to view fields.
          </div>
        )}
      </div>

      {/* Simulate API Change Dialog Modal */}
      <SimulateDialog
        monitorId={monitor.id}
        baselineResponse={monitor.activeBaseline?.responseBody}
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        onSimulationStarted={handleSimulationStarted}
      />
    </div>
  );
}
