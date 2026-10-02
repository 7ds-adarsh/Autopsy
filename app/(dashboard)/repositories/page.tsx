import { GitFork, Plus } from "lucide-react";

export default function RepositoriesPage() {
  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#181c28] pb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 font-mono">Connected Repositories</h1>
          <p className="text-xs text-slate-400">Repositories scanned for API usage, dependencies, and code impact</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Connect Repository
        </button>
      </div>

      <div className="border border-dashed border-[#1f2535] bg-[#0c0e14] rounded-xl p-12 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-[#151926] border border-[#232a3d] flex items-center justify-center text-slate-400 mx-auto">
          <GitFork className="w-5 h-5 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">No repositories linked yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          In Slice 2, you can install the GitHub App to automatically discover outbound API integrations from your code.
        </p>
      </div>
    </div>
  );
}
