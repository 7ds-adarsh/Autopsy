"use client";

import { ApiCandidate, DirectFieldReference } from "@/lib/scanner/patterns";
import { PlusCircle, FileCode, CheckCircle2, AlertCircle, ArrowUpRight, Code, ShieldCheck, Tag } from "lucide-react";
import Link from "next/link";

interface ApiCandidatesListProps {
  candidates: ApiCandidate[];
  repositoryName: string;
  repositoryId: string;
  onAddMonitor?: (candidate: ApiCandidate) => void;
}

export function ApiCandidatesList({
  candidates,
  repositoryName,
  repositoryId,
}: ApiCandidatesListProps) {
  if (candidates.length === 0) {
    return (
      <div className="border border-[#1a202c] bg-[#0c1017] rounded-lg p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-300 font-medium">No API calls detected in this repository</p>
        <p className="text-xs text-slate-500 mt-1">
          The scanner checked source files for HTTP clients, base URLs, and response fields.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            Discovered API Candidates ({candidates.length})
          </h3>
          <p className="text-xs text-slate-400">
            Identified from static code patterns in <span className="font-mono text-slate-300">{repositoryName}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {candidates.map((candidate, idx) => {
          const confidenceColor =
            candidate.confidence === "high"
              ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
              : candidate.confidence === "medium"
              ? "bg-amber-950/40 text-amber-400 border-amber-800/40"
              : "bg-slate-800/40 text-slate-400 border-slate-700/40";

          const configureParams = new URLSearchParams({
            repoId: repositoryId,
            endpoint: candidate.endpoint,
            method: candidate.method || "GET",
            file: candidate.file,
            confidence: candidate.confidence,
          });

          const directRefs = candidate.directReferences || [];
          const observed = candidate.observedFields || [];

          return (
            <div
              key={`${candidate.file}-${candidate.line}-${idx}`}
              className="border border-[#1a2130] bg-[#0b0e14] hover:border-[#273248] rounded-lg p-5 transition-all space-y-4"
            >
              {/* Header: Method, Endpoint, Confidence Badge, CTA */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#161d2d] text-rose-400 border border-rose-900/40">
                    {candidate.method || "GET"}
                  </span>
                  <span className="font-mono text-xs text-slate-200 font-semibold break-all">
                    {candidate.endpoint}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${confidenceColor}`}
                  >
                    {candidate.confidence} confidence
                  </span>
                </div>

                <Link
                  href={`/apis/configure?${configureParams.toString()}`}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm font-mono"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Monitor
                </Link>
              </div>

              {/* 1. HTTP Invocation Source */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300">HTTP Invocation:</span>
                    <span className="text-slate-400">{candidate.file}</span>
                    <span className="text-slate-600">:</span>
                    <span className="text-rose-400">line {candidate.line}</span>
                  </div>
                </div>

                <div className="bg-[#05070a] border border-[#141924] rounded p-2.5 overflow-x-auto">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {candidate.evidence}
                  </pre>
                </div>
              </div>

              {/* 2. Direct Response-Field References Found in Code */}
              <div className="space-y-2 pt-1 border-t border-[#141a26]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-rose-400" />
                      Direct Response-Field References
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
                      {directRefs.length} verified
                    </span>
                  </div>
                  {directRefs.length > 0 && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Exact code line attribution
                    </span>
                  )}
                </div>

                {directRefs.length > 0 ? (
                  <div className="space-y-2">
                    {directRefs.map((ref, rIdx) => (
                      <div
                        key={`${ref.expression}-${ref.line}-${rIdx}`}
                        className="bg-[#07090f] border border-[#171f2d] rounded-md p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">
                              {candidate.file}:<strong className="text-rose-400">{ref.line}</strong>
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#101622] text-rose-300 border border-rose-900/30">
                              {ref.expression}
                            </span>
                          </div>
                          <span className="text-slate-500">field: {ref.field}</span>
                        </div>
                        <pre className="text-xs font-mono text-emerald-300/90 bg-[#040508] p-2 rounded border border-[#111622] overflow-x-auto">
                          {ref.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-[#080b10] border border-[#131822] text-xs font-mono text-slate-500">
                    No direct property references (e.g. <span className="text-slate-400">response.field</span>) detected in application code.
                  </div>
                )}
              </div>

              {/* 3. Indirect / Contextual Observations */}
              {observed.length > 0 && (
                <div className="pt-2 border-t border-[#141a26] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <Tag className="w-3 h-3 text-slate-500" />
                    <span>Contextual API Fields Observed (Indirect):</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {observed.map((f) => (
                      <span
                        key={f}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#10141e] text-slate-400 border border-[#171e2c]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
