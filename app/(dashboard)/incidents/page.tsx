import { Flame, CheckCircle2 } from "lucide-react";

export default function IncidentsPage() {
  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
      <div className="border-b border-[#181c28] pb-6">
        <h1 className="text-xl font-bold text-slate-100 font-mono">Incident Registry</h1>
        <p className="text-xs text-slate-400">Detected breaking changes, schema diffs, and autopsy records</p>
      </div>

      <div className="border border-dashed border-[#1f2535] bg-[#0c0e14] rounded-xl p-12 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-600/30 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">No active incidents</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          All monitored API contracts match their captured baselines. When a breaking change is detected or simulated, it will appear here.
        </p>
      </div>
    </div>
  );
}
