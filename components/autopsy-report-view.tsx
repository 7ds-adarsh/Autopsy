"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Sparkles,
  ShieldAlert,
  FileCode,
  GitBranch,
  Copy,
  Check,
  AlertTriangle,
  HelpCircle,
  Clock,
  Terminal,
  Activity,
  ArrowDown,
  Layers,
} from "lucide-react";

export interface AutopsyReportData {
  incident: {
    id: string;
    monitorId: string;
    severity: string;
    isSimulation: boolean;
    status: string;
    createdAt: string;
    diff: {
      hasChanges: boolean;
      overallSeverity: string;
      changes: Array<{
        path: string;
        type: "added" | "removed" | "type_changed";
        oldType?: string;
        newType?: string;
        severity: "breaking" | "additive";
      }>;
    };
  };
  monitor: {
    name: string;
    endpoint: string;
    baseUrl?: string;
    method?: string;
    repositoryName?: string | null;
  };
  report: {
    id: string;
    whatChanged: string;
    applicationImpact: Array<{
      file: string;
      line?: number;
      snippet?: string;
      confidence?: "high" | "medium" | "low";
      explanation?: string;
      source?: "live_repo_scan" | "canonical_demo_fixture";
    }>;
    failurePath: Array<{
      step: string;
      description: string;
      file?: string;
      line?: number;
    }>;
    rootCause: string;
    recommendedFix: string;
    proposedPatch: string | null;
    confidence: "high" | "medium" | "low";
    confidenceEvidence: string[];
    generatedAt: string;
  } | null;
}

interface AutopsyReportViewProps {
  data: AutopsyReportData;
}

export function AutopsyReportView({ data }: AutopsyReportViewProps) {
  const { incident, monitor, report } = data;
  const [copiedPatch, setCopiedPatch] = useState(false);

  const changes = incident.diff?.changes || [];
  const removedChanges = changes.filter((c) => c.type === "removed");
  const addedChanges = changes.filter((c) => c.type === "added");
  const modifiedChanges = changes.filter((c) => c.type === "type_changed");

  const hasReport = !!report;
  const isFailedReport =
    hasReport && report.whatChanged.toLowerCase().includes("failed");

  function handleCopyPatch() {
    if (!report?.proposedPatch) return;
    navigator.clipboard.writeText(report.proposedPatch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  }

  return (
    <div className="p-8 max-w-5xl w-full mx-auto space-y-8 font-mono text-xs">
      {/* Back button */}
      <div>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-xs font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents Registry</span>
        </Link>
      </div>

      {/* Screen 9 Header */}
      <div className="border border-[#182030] bg-[#090c13] rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#141a27]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Incident Report
              </span>
              <span className="text-slate-600">•</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase border ${
                  incident.severity === "critical"
                    ? "bg-rose-950/90 text-rose-400 border-rose-800/60"
                    : incident.severity === "high"
                    ? "bg-orange-950/90 text-orange-400 border-orange-800/60"
                    : "bg-amber-950/90 text-amber-400 border-amber-800/60"
                }`}
              >
                {incident.severity}
              </span>

              {incident.isSimulation ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  [SIMULATION]
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/50">
                  [LIVE CHECK]
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold text-slate-100 font-mono tracking-tight">
              {monitor.name} — {monitor.method || "POST"} {monitor.endpoint}
            </h1>

            {monitor.repositoryName && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                Repository: <span className="text-slate-200">{monitor.repositoryName}</span>
              </p>
            )}
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center sm:justify-end gap-1">
              <Clock className="w-3 h-3" />
              <span>Detected: {new Date(incident.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-slate-600">ID: {incident.id.slice(0, 18)}...</div>
          </div>
        </div>

        {/* Gemini failure fallback notice if applicable */}
        {(!hasReport || isFailedReport) && (
          <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Gemini AI Investigation Unavailable</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              The AI autopsy could not be generated, but the deterministic schema diff and incident record are fully preserved below.
            </p>
          </div>
        )}
      </div>

      {/* 1. WHAT CHANGED */}
      <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
        <div className="border-b border-[#141a27] pb-3">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            1. What Changed
          </h2>
        </div>

        {/* Plain language explanation */}
        <p className="text-xs text-slate-200 leading-relaxed font-sans">
          {report?.whatChanged ||
            "Deterministic schema diff detected a structural contract mismatch between the active baseline and the latest API payload."}
        </p>

        {/* Deterministic Diff Tags */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Deterministic Field Differences:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {removedChanges.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-300 space-y-1.5">
                <span className="block font-bold text-rose-400 text-[11px]">
                  Removed Fields (Breaking):
                </span>
                {removedChanges.map((c) => (
                  <div key={c.path} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-rose-200">- {c.path}</span>
                    <span className="text-[10px] text-rose-400/80">
                      was {c.oldType || "string"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {addedChanges.length > 0 && (
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 space-y-1.5">
                <span className="block font-bold text-emerald-400 text-[11px]">
                  Added Fields (Additive):
                </span>
                {addedChanges.map((c) => (
                  <div key={c.path} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-emerald-200">+ {c.path}</span>
                    <span className="text-[10px] text-emerald-400/80">
                      new {c.newType || "object"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. APPLICATION IMPACT */}
      <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#141a27] pb-3">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-400" />
            2. Application Impact
          </h2>

          {/* Provenance badge */}
          {report?.applicationImpact && report.applicationImpact.length > 0 ? (
            report.applicationImpact[0]?.source === "canonical_demo_fixture" ? (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                Canonical demo fixture — not retrieved from your repository
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                Verified repository scan evidence
              </span>
            )
          ) : (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded bg-[#151926] text-slate-400 border border-[#222a3d]">
              No direct code references found
            </span>
          )}
        </div>

        {report?.applicationImpact && report.applicationImpact.length > 0 ? (
          <div className="space-y-3">
            {report.applicationImpact.map((impact, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-[#07090f] border border-[#1a2233] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 font-mono">
                      {impact.file}
                      {impact.line ? `:${impact.line}` : ""}
                    </span>
                    {impact.confidence && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#131926] text-slate-400 border border-[#20283b] uppercase">
                        {impact.confidence} confidence
                      </span>
                    )}
                  </div>
                  {impact.source === "canonical_demo_fixture" && (
                    <span className="text-[10px] text-amber-400/90 font-mono">
                      [Demo fixture]
                    </span>
                  )}
                </div>

                {impact.explanation && (
                  <p className="text-[11px] text-slate-400 font-sans">
                    {impact.explanation}
                  </p>
                )}

                {impact.snippet && (
                  <pre className="p-3 rounded bg-[#030407] border border-[#141b2b] text-slate-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {impact.snippet}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#0e121d] border border-[#1b2336] text-slate-400 text-xs space-y-1">
            <span className="font-semibold text-slate-300 block">
              No verified application impact identified
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              No direct references to the changed API fields were detected in the repository scan. Code patch generation is withheld to prevent fabricating changes.
            </p>
          </div>
        )}
      </div>

      {/* 3. FAILURE PATH */}
      {report?.failurePath && report.failurePath.length > 0 && (
        <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
          <div className="border-b border-[#141a27] pb-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              3. Failure Path (Reconstructed)
            </h2>
            <p className="text-[10px] text-slate-500 mt-1 font-sans">
              Reconstructed likely failure path based on static analysis, not an observed production crash.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {report.failurePath.map((step, idx) => {
              const isLast = idx === report.failurePath.length - 1;

              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0e121d] border border-[#182236]">
                    <div className="w-6 h-6 rounded-full bg-[#161d2d] border border-[#242f46] flex items-center justify-center text-slate-300 text-[11px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-xs font-mono">
                          {step.step}
                        </span>
                        {step.file && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({step.file}{step.line ? `:${step.line}` : ""})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {!isLast && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. ROOT CAUSE */}
      {report?.rootCause && (
        <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-3 shadow-xl">
          <div className="border-b border-[#141a27] pb-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-400" />
              4. Root Cause
            </h2>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {report.rootCause}
          </p>
        </div>
      )}

      {/* 5. RECOMMENDED FIX */}
      {report?.recommendedFix && (
        <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-3 shadow-xl">
          <div className="border-b border-[#141a27] pb-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              5. Recommended Fix
            </h2>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {report.recommendedFix}
          </p>
        </div>
      )}

      {/* 6. PROPOSED PATCH */}
      <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#141a27] pb-3">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            6. Proposed Patch
          </h2>

          {report?.proposedPatch && (
            <button
              onClick={handleCopyPatch}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#131926] hover:bg-[#1a2233] border border-[#20283b] text-slate-300 text-xs transition-colors"
            >
              {copiedPatch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Patch</span>
                </>
              )}
            </button>
          )}
        </div>

        {report?.proposedPatch ? (
          <div className="space-y-2">
            <div className="p-4 rounded-lg bg-[#040609] border border-[#151c2c] overflow-x-auto text-[11px] font-mono leading-relaxed">
              {report.proposedPatch.split("\n").map((line, idx) => {
                const isAdd = line.startsWith("+");
                const isDel = line.startsWith("-");
                const isHeader = line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@");

                return (
                  <div
                    key={idx}
                    className={`py-0.5 px-1.5 rounded ${
                      isAdd
                        ? "bg-emerald-950/40 text-emerald-300 font-semibold"
                        : isDel
                        ? "bg-rose-950/40 text-rose-300 font-semibold"
                        : isHeader
                        ? "text-cyan-400/90 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-500 font-sans italic">
              Proposed patches are non-destructive recommendations for developer review. Autopsy never automatically modifies repository files or applies patches.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#0e121d] border border-[#1b2336] text-slate-400 text-xs">
            Line-level application evidence unavailable. Proposed patch omitted to prevent fabricating arbitrary code changes.
          </div>
        )}
      </div>

      {/* 7. CONFIDENCE & EVIDENCE */}
      {report?.confidenceEvidence && (
        <div className="border border-[#182030] bg-[#0a0d14] rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#141a27] pb-3">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              7. Confidence & Supporting Evidence
            </h2>

            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase border ${
                report.confidence === "high"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/50"
                  : report.confidence === "medium"
                  ? "bg-amber-950/80 text-amber-300 border-amber-800/50"
                  : "bg-slate-900 text-slate-400 border-slate-700"
              }`}
            >
              Confidence: {report.confidence.toUpperCase()}
            </span>
          </div>

          <ul className="space-y-2 text-slate-300 text-xs">
            {report.confidenceEvidence.map((ev, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold text-sm leading-none">•</span>
                <span className="font-sans leading-relaxed">{ev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 8. REPORT FOOTER (Spec Requirement) */}
      <div className="border-t border-[#161d2d] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
        <div>
          Detected by: <span className="text-slate-300 font-semibold">Deterministic diff engine</span>
          {" | "}
          Investigated by: <span className="text-slate-300 font-semibold">Gemini (gemini-3.8-flash)</span>
        </div>

        <div>
          Report timestamp: {report?.generatedAt ? new Date(report.generatedAt).toUTCString() : new Date().toUTCString()}
        </div>
      </div>
    </div>
  );
}
