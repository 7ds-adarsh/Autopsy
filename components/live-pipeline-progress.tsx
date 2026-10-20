"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSocket } from "./socket-provider";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  FileCode,
  Sparkles,
  GitCommit,
  X,
} from "lucide-react";

export type PipelineStageId =
  | "started"
  | "diff"
  | "incident"
  | "impact"
  | "gemini"
  | "complete";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  sublabel: string;
  status: "idle" | "running" | "done" | "skipped" | "failed";
  detail?: string;
}

interface LivePipelineProgressProps {
  monitorId: string;
  isSimulation?: boolean;
  incidentId?: string | null;
  onComplete?: (incidentId: string) => void;
  onDismiss?: () => void;
}

export function LivePipelineProgress({
  monitorId,
  isSimulation = true,
  incidentId: initialIncidentId,
  onComplete,
  onDismiss,
}: LivePipelineProgressProps) {
  const socket = useSocket();
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(
    initialIncidentId || null
  );
  const [stages, setStages] = useState<PipelineStage[]>([
    {
      id: "started",
      label: isSimulation ? "Simulation Started" : "API Check Started",
      sublabel: isSimulation
        ? "Controlled breaking response payload loaded"
        : "Executing live HTTP request to configured endpoint",
      status: "running",
    },
    {
      id: "diff",
      label: "Response & Diff Analysis",
      sublabel: "Computing deterministic structural schema diff",
      status: "idle",
    },
    {
      id: "incident",
      label: "Incident Creation",
      sublabel: "Evaluating contract severity and recording incident",
      status: "idle",
    },
    {
      id: "impact",
      label: "Repository Impact Scan",
      sublabel: "Scanning application code references for affected fields",
      status: "idle",
    },
    {
      id: "gemini",
      label: "Gemini Autopsy Investigation",
      sublabel: "Reconstructing failure path and calculating root cause",
      status: "idle",
    },
    {
      id: "complete",
      label: "Autopsy Report Ready",
      sublabel: "Incident investigation compiled and persisted",
      status: "idle",
    },
  ]);

  const [diffDetails, setDiffDetails] = useState<{
    removed: string[];
    added: string[];
    modified: string[];
  }>({ removed: [], added: [], modified: [] });

  const [impactDetails, setImpactDetails] = useState<{
    count: number;
    files: Array<{ file: string; line?: number; source?: string }>;
  }>({ count: 0, files: [] });

  const [severity, setSeverity] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noChangesDetected, setNoChangesDetected] = useState(false);

  // Helper to transition stage status
  function updateStage(
    id: PipelineStageId,
    status: PipelineStage["status"],
    detail?: string
  ) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))
    );
  }

  // Socket event listener
  useEffect(() => {
    if (!socket) return;

    // Simulation / check started
    const handleStarted = (data: { monitorId: string }) => {
      if (data.monitorId !== monitorId) return;
      updateStage("started", "done");
      updateStage("diff", "running");
    };

    // Diff computed
    const handleDiff = (data: {
      monitorId: string;
      hasChanges: boolean;
      changes?: Array<{ path: string; type: string }>;
    }) => {
      if (data.monitorId !== monitorId) return;
      if (!data.hasChanges) {
        updateStage("diff", "done", "No schema changes detected");
        setNoChangesDetected(true);
        return;
      }
      const removed: string[] = [];
      const added: string[] = [];
      const modified: string[] = [];
      data.changes?.forEach((c) => {
        if (c.type === "removed") removed.push(c.path);
        else if (c.type === "added") added.push(c.path);
        else modified.push(c.path);
      });
      setDiffDetails({ removed, added, modified });
      updateStage(
        "diff",
        "done",
        `${removed.length} removed, ${added.length} added`
      );
      updateStage("incident", "running");
    };

    // Monitor checked unchanged
    const handleChecked = (data: { monitorId: string; status: string }) => {
      if (data.monitorId !== monitorId) return;
      if (data.status === "healthy") {
        updateStage("diff", "done", "Response contract matches baseline");
        setNoChangesDetected(true);
      }
    };

    // Incident created
    const handleIncidentCreated = (data: {
      incidentId: string;
      monitorId: string;
      severity: string;
      isSimulation: boolean;
      diff?: { changes?: Array<{ path: string; type: string }> };
    }) => {
      if (data.monitorId !== monitorId) return;
      setActiveIncidentId(data.incidentId);
      setSeverity(data.severity);
      updateStage("started", "done");
      updateStage("diff", "done");
      updateStage("incident", "done", `Severity: ${data.severity.toUpperCase()}`);
      updateStage("impact", "running");
    };

    // Repository impact completed
    const handleImpact = (data: {
      incidentId: string;
      monitorId: string;
      affectedFilesCount: number;
      affectedFiles?: Array<{ file: string; line?: number; source?: string }>;
    }) => {
      if (data.monitorId !== monitorId) return;
      setImpactDetails({
        count: data.affectedFilesCount,
        files: data.affectedFiles || [],
      });
      updateStage(
        "impact",
        "done",
        data.affectedFilesCount > 0
          ? `${data.affectedFilesCount} affected reference(s) found`
          : "No direct application references detected"
      );
      updateStage("gemini", "running");
    };

    // Autopsy started
    const handleAutopsyStarted = (data: { incidentId: string; monitorId?: string }) => {
      if (data.monitorId && data.monitorId !== monitorId) return;
      updateStage("gemini", "running", "Synthesizing evidence with Gemini...");
    };

    // Autopsy progress
    const handleAutopsyProgress = (data: {
      incidentId: string;
      step: string;
      message: string;
    }) => {
      updateStage("gemini", "running", data.message);
    };

    // Autopsy completed
    const handleAutopsyCompleted = (data: {
      incidentId: string;
      reportId: string | null;
      error?: string;
    }) => {
      if (data.error) {
        updateStage("gemini", "failed", data.error);
        updateStage("complete", "done", "Incident recorded (AI analysis failed)");
      } else {
        updateStage("gemini", "done", "Autopsy generated");
        updateStage("complete", "done", "Report ready for review");
      }
      setActiveIncidentId(data.incidentId);
      if (onComplete) {
        onComplete(data.incidentId);
      }
    };

    socket.on("simulation:started", handleStarted);
    socket.on("check:started", handleStarted);
    socket.on("diff:computed", handleDiff);
    socket.on("monitor:checked", handleChecked);
    socket.on("incident:created", handleIncidentCreated);
    socket.on("impact:completed", handleImpact);
    socket.on("autopsy:started", handleAutopsyStarted);
    socket.on("autopsy:progress", handleAutopsyProgress);
    socket.on("autopsy:completed", handleAutopsyCompleted);

    return () => {
      socket.off("simulation:started", handleStarted);
      socket.off("check:started", handleStarted);
      socket.off("diff:computed", handleDiff);
      socket.off("monitor:checked", handleChecked);
      socket.off("incident:created", handleIncidentCreated);
      socket.off("impact:completed", handleImpact);
      socket.off("autopsy:started", handleAutopsyStarted);
      socket.off("autopsy:progress", handleAutopsyProgress);
      socket.off("autopsy:completed", handleAutopsyCompleted);
    };
  }, [socket, monitorId, onComplete]);

  // Sync initialIncidentId if passed as prop
  useEffect(() => {
    if (initialIncidentId) {
      setActiveIncidentId(initialIncidentId);
    }
  }, [initialIncidentId]);

  // Vercel-compatible polling: Reconstructs pipeline state from persisted DB events
  // Runs whenever activeIncidentId is present. Stops automatically when complete or failed.
  useEffect(() => {
    if (!activeIncidentId) return;

    let isMounted = true;
    let pollTimeout: NodeJS.Timeout | null = null;

    const pollProgress = async () => {
      try {
        const res = await fetch(`/api/incidents/${activeIncidentId}/progress`);
        if (!res.ok) {
          // If progress endpoint is 404, fallback to incident status
          const incRes = await fetch(`/api/incidents/${activeIncidentId}`);
          if (incRes.ok && isMounted) {
            const data = await incRes.json();
            if (data.incident) {
              setSeverity(data.incident.severity);
              updateStage("started", "done");
              updateStage("diff", "done");
              updateStage("incident", "done", `Severity: ${data.incident.severity.toUpperCase()}`);
              if (data.report) {
                updateStage("gemini", "done", "Investigation complete");
                updateStage("complete", "done", "Autopsy report ready");
                if (onComplete) onComplete(activeIncidentId);
                return;
              }
            }
          }
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        if (Array.isArray(data.events) && data.events.length > 0) {
          updateStage("started", "done");

          for (const ev of data.events) {
            const stageId = ev.stage as PipelineStageId;
            const status = ev.status as PipelineStage["status"];
            updateStage(stageId, status, ev.detail || undefined);

            if (stageId === "diff" && ev.payload?.changes) {
              const removed: string[] = [];
              const added: string[] = [];
              const modified: string[] = [];
              ev.payload.changes.forEach((c: { path: string; type: string }) => {
                if (c.type === "removed") removed.push(c.path);
                else if (c.type === "added") added.push(c.path);
                else modified.push(c.path);
              });
              setDiffDetails({ removed, added, modified });
            }

            if (stageId === "diff" && ev.payload?.severity) {
              setSeverity(ev.payload.severity);
            }

            if (stageId === "incident" && ev.payload?.severity) {
              setSeverity(ev.payload.severity);
            }

            if (stageId === "impact" && ev.payload?.affectedFiles) {
              setImpactDetails({
                count: ev.payload.affectedFilesCount ?? ev.payload.affectedFiles.length,
                files: ev.payload.affectedFiles,
              });
            }
          }
        }

        if (data.isComplete || data.reportReady) {
          updateStage("complete", "done", "Autopsy report ready");
          if (onComplete) {
            onComplete(activeIncidentId);
          }
          return; // Stop polling on completion
        }
      } catch (err) {
        console.warn("[LivePipeline] Polling error:", err);
      }

      if (isMounted) {
        pollTimeout = setTimeout(pollProgress, 1500);
      }
    };

    pollProgress();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [activeIncidentId, onComplete]);

  return (
    <div className="border border-[#1e2638] bg-[#0a0d14] rounded-xl overflow-hidden shadow-2xl space-y-6 p-6 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#182030] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
            <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wide uppercase">
              {isSimulation ? "Live Simulation Pipeline" : "Live Monitor Pipeline"}
            </h3>
            {isSimulation && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/50 text-purple-300 font-semibold uppercase">
                [Simulation]
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Real-time inspection sequence computed deterministically before AI autopsy
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-[#141a27] transition-colors"
            title="Dismiss live view"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {noChangesDetected ? (
        <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-6 text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-bold text-emerald-300">Contract Verified — No Changes Detected</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The API response structure matches the active baseline perfectly. No breaking diff or incident was created.
          </p>
        </div>
      ) : (
        <>
          {/* Timeline steps */}
          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const isLast = idx === stages.length - 1;

              return (
                <div key={stage.id} className="relative flex items-start gap-3.5">
                  {/* Step status icon */}
                  <div className="relative flex items-center justify-center shrink-0 w-6 h-6 mt-0.5">
                    {stage.status === "done" && (
                      <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/60 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {stage.status === "running" && (
                      <div className="w-5 h-5 rounded-full bg-rose-950/80 border border-rose-500/80 flex items-center justify-center text-rose-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    )}
                    {stage.status === "failed" && (
                      <div className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/60 flex items-center justify-center text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {stage.status === "idle" && (
                      <div className="w-5 h-5 rounded-full bg-[#121622] border border-[#222a3d] flex items-center justify-center text-slate-600">
                        <Circle className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Step details */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          stage.status === "running"
                            ? "text-rose-400"
                            : stage.status === "done"
                            ? "text-slate-100"
                            : "text-slate-400"
                        }`}
                      >
                        {stage.label}
                      </span>
                      {stage.detail && (
                        <span className="text-[10px] text-slate-400 bg-[#141926] px-2 py-0.5 rounded border border-[#1f2638]">
                          {stage.detail}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{stage.sublabel}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Change Detection Evidence Panel */}
          {(diffDetails.removed.length > 0 || diffDetails.added.length > 0) && (
            <div className="border border-[#1f283d] bg-[#0c1018] rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Deterministic Schema Diff
                </span>
                {severity && (
                  <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 font-bold uppercase text-[10px]">
                    {severity}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {diffDetails.removed.length > 0 && (
                  <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/40 text-rose-300 space-y-1">
                    <span className="block font-semibold text-rose-400">Removed Fields (Breaking):</span>
                    {diffDetails.removed.map((field) => (
                      <div key={field} className="flex items-center gap-1">
                        <span className="text-rose-500 font-bold">-</span> {field}
                      </div>
                    ))}
                  </div>
                )}

                {diffDetails.added.length > 0 && (
                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-900/40 text-emerald-300 space-y-1">
                    <span className="block font-semibold text-emerald-400">Added Fields (Additive):</span>
                    {diffDetails.added.map((field) => (
                      <div key={field} className="flex items-center gap-1">
                        <span className="text-emerald-500 font-bold">+</span> {field}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repository Impact Evidence Panel */}
          {impactDetails.files.length > 0 && (
            <div className="border border-[#1f283d] bg-[#0c1018] rounded-lg p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                Repository Impact Identified ({impactDetails.count} call site{impactDetails.count === 1 ? "" : "s"})
              </span>

              <div className="space-y-1.5">
                {impactDetails.files.slice(0, 3).map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-[#131824] border border-[#202739] text-[11px] text-slate-300"
                  >
                    <span className="font-mono text-rose-300">
                      {f.file}{f.line ? `:${f.line}` : ""}
                    </span>
                    {f.source === "canonical_demo_fixture" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/40 text-amber-400">
                        Demo fixture
                      </span>
                    )}
                    {f.source === "live_repo_scan" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/40 text-emerald-400">
                        Live scan
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button upon completion */}
          {activeIncidentId && stages.find((s) => s.id === "complete")?.status === "done" && (
            <div className="pt-2 flex items-center justify-end">
              <Link
                href={`/incidents/${activeIncidentId}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-semibold text-xs tracking-wide transition-colors shadow-lg shadow-rose-950/40"
              >
                <span>View Full Autopsy Report</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
