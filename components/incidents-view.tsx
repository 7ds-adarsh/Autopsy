"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Sparkles,
  Radio,
  Clock,
  ShieldAlert,
} from "lucide-react";

export interface IncidentListItem {
  id: string;
  monitorId: string;
  monitorName: string | null;
  monitorEndpoint?: string | null;
  monitorMethod?: string | null;
  severity: string;
  isSimulation: boolean;
  status: string;
  createdAt: string;
  reportId: string | null;
  whatChanged?: string | null;
  diff?: {
    changes?: Array<{ path: string; type: string; severity?: string }>;
  } | null;
}

interface IncidentsViewProps {
  initialIncidents: IncidentListItem[];
}

export function IncidentsView({ initialIncidents }: IncidentsViewProps) {
  const [filter, setFilter] = useState<"all" | "simulations" | "real">("all");

  const filteredIncidents = initialIncidents.filter((inc) => {
    if (filter === "simulations") return inc.isSimulation;
    if (filter === "real") return !inc.isSimulation;
    return true;
  });

  const criticalCount = initialIncidents.filter(
    (i) => i.severity === "critical"
  ).length;
  const simulationCount = initialIncidents.filter((i) => i.isSimulation).length;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#181c28] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Incident Registry
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-[#131826] text-rose-400 border border-rose-900/40">
              {initialIncidents.length} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detected contract mutations, deterministic diffs, and forensic autopsy reports
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0e121d] border border-[#1b2336] text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === "all"
                ? "bg-rose-600 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({initialIncidents.length})
          </button>
          <button
            onClick={() => setFilter("real")}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === "real"
                ? "bg-rose-600 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Live Checks ({initialIncidents.length - simulationCount})
          </button>
          <button
            onClick={() => setFilter("simulations")}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === "simulations"
                ? "bg-rose-600 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Simulations ({simulationCount})
          </button>
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="border border-dashed border-[#1f2535] bg-[#0c0e14] rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-600/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {filter === "all"
                ? "No active incidents"
                : `No ${filter} incidents found`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              All monitored API contracts match their captured baselines. When a breaking change is detected or simulated, forensic autopsy reports will appear here.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/apis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              View Monitored APIs
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((inc) => {
            const changes = inc.diff?.changes || [];
            const removed = changes.filter((c) => c.type === "removed");
            const added = changes.filter((c) => c.type === "added");

            return (
              <div
                key={inc.id}
                className="border border-[#1a2130] bg-[#0c1017] rounded-xl p-5 hover:border-[#252f46] transition-all space-y-3 shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#161c28]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Severity Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        inc.severity === "critical"
                          ? "bg-rose-950/90 text-rose-400 border-rose-800/60"
                          : inc.severity === "high"
                          ? "bg-orange-950/90 text-orange-400 border-orange-800/60"
                          : "bg-amber-950/90 text-amber-400 border-amber-800/60"
                      }`}
                    >
                      {inc.severity}
                    </span>

                    {/* Simulation badge */}
                    {inc.isSimulation ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        [SIMULATION]
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/50">
                        [LIVE CHECK]
                      </span>
                    )}

                    <h2 className="text-sm font-bold text-slate-100 font-mono">
                      {inc.monitorName || "API Monitor"}
                    </h2>

                    {inc.monitorMethod && inc.monitorEndpoint && (
                      <span className="text-xs text-slate-400 font-mono">
                        {inc.monitorMethod} {inc.monitorEndpoint}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(inc.createdAt).toLocaleString()}
                    </span>

                    <Link
                      href={`/incidents/${inc.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      <span>Autopsy Report</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Diff summary or plain explanation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 max-w-2xl">
                    {inc.whatChanged ? (
                      <p className="text-slate-300 line-clamp-2 leading-relaxed">
                        {inc.whatChanged}
                      </p>
                    ) : (
                      <p className="text-slate-400">
                        Deterministic schema differences identified across contract payloads.
                      </p>
                    )}
                  </div>

                  {/* Schema tags */}
                  <div className="flex items-center gap-2 shrink-0">
                    {removed.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-950/50 border border-rose-900/40 text-rose-300 text-[10px]">
                        -{removed.length} removed ({removed.map((r) => r.path).join(", ")})
                      </span>
                    )}
                    {added.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-900/40 text-emerald-300 text-[10px]">
                        +{added.length} added
                      </span>
                    )}
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
