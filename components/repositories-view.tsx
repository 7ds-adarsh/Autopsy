"use client";

import { useState } from "react";
import { GitBranch, GitFork, RefreshCw, Plus, CheckCircle2, Search, ArrowRight, ShieldCheck, ExternalLink } from "lucide-react";
import { ApiCandidatesList } from "@/components/api-candidates-list";
import { ApiCandidate } from "@/lib/scanner/patterns";
import { useRouter } from "next/navigation";

export interface RepositoryItem {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  installationId: string | null;
  defaultBranch: string | null;
  createdAt: string;
}

interface RepositoriesViewProps {
  initialRepositories: RepositoryItem[];
}

export function RepositoriesView({ initialRepositories }: RepositoriesViewProps) {
  const router = useRouter();
  const [repos, setRepos] = useState<RepositoryItem[]>(initialRepositories);
  const [connecting, setConnecting] = useState(false);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{
    [repoId: string]: {
      candidates: ApiCandidate[];
      filesScanned: number;
      filesIgnored: number;
      scannedAt: string;
    };
  }>({});
  const [error, setError] = useState<string | null>(null);

  // Connect the demo fixture repository
  async function handleConnectDemoRepo() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: "acme-corp",
          name: "checkout-service",
          installationId: "fixture-demo-1001",
          defaultBranch: "main",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to connect demo repository");
      }

      const newRepo = await res.json();
      setRepos((prev) => [newRepo, ...prev.filter((r) => r.id !== newRepo.id)]);
      
      // Auto-trigger scan on connection for seamless experience
      await handleScan(newRepo.id);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to connect repository");
    } finally {
      setConnecting(false);
    }
  }

  // Trigger repository scan
  async function handleScan(repoId: string) {
    setScanningRepoId(repoId);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${repoId}/scan`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Scan request failed");
      }

      const data = await res.json();
      setScanResults((prev) => ({
        ...prev,
        [repoId]: {
          candidates: data.candidates || [],
          filesScanned: data.filesScanned || 0,
          filesIgnored: data.filesIgnored || 0,
          scannedAt: data.scannedAt || new Date().toISOString(),
        },
      }));
    } catch (err: any) {
      setError(err.message || "Failed to scan repository");
    } finally {
      setScanningRepoId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Connect Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#181c28] pb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 font-mono">Connected Repositories</h1>
          <p className="text-xs text-slate-400">
            Source code repositories scanned for API dependencies, outbound calls, and impact
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectDemoRepo}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-rose-950/30 disabled:opacity-50"
          >
            {connecting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Connect Demo Repo (acme/checkout-service)
          </button>

          <a
            href="/api/github/app/callback?installation_id=fixture-demo-1001"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141926] hover:bg-[#1a2235] border border-[#212a3d] text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            GitHub App
          </a>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Empty State */}
      {repos.length === 0 ? (
        <div className="border border-dashed border-[#1f2535] bg-[#0c0e14] rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#151926] border border-[#232a3d] flex items-center justify-center text-slate-400 mx-auto">
            <GitFork className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No repositories linked yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Connect a GitHub repository or load the demo fixture repository to run a deterministic code scan for outbound API integrations.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleConnectDemoRepo}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-rose-950/40"
            >
              <Plus className="w-4 h-4" />
              Connect Demo Fixture (acme/checkout-service)
            </button>
          </div>
        </div>
      ) : (
        /* Repository Cards */
        <div className="space-y-6">
          {repos.map((repo) => {
            const result = scanResults[repo.id];
            const isScanning = scanningRepoId === repo.id;

            return (
              <div
                key={repo.id}
                className="border border-[#1a202c] bg-[#0c1017] rounded-xl p-6 space-y-5"
              >
                {/* Repo Meta bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#161c28]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#141926] border border-[#20293d] flex items-center justify-center text-slate-300">
                      <GitBranch className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-100 font-mono">
                          {repo.fullName}
                        </h2>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#131926] text-slate-400 border border-[#1d263b]">
                          branch: {repo.defaultBranch || "main"}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Installation: {repo.installationId || "fixture-demo"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleScan(repo.id)}
                      disabled={isScanning}
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-[#161c2a] hover:bg-[#1e273b] border border-[#232d42] text-xs font-mono font-medium text-slate-200 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-rose-400 ${
                          isScanning ? "animate-spin" : ""
                        }`}
                      />
                      {isScanning ? "Scanning code..." : "Scan Repository"}
                    </button>
                  </div>
                </div>

                {/* Scan Status Summary */}
                {result && (
                  <div className="flex items-center gap-4 text-xs font-mono bg-[#080b10] border border-[#141a26] p-3 rounded-lg text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Scan complete</span>
                    </div>
                    <span>•</span>
                    <span>Scanned: <strong className="text-slate-200">{result.filesScanned}</strong> files</span>
                    <span>•</span>
                    <span>Ignored: <strong className="text-slate-200">{result.filesIgnored}</strong> (vendor/build/lockfiles)</span>
                    <span>•</span>
                    <span>Found: <strong className="text-rose-400">{result.candidates.length}</strong> API candidates</span>
                  </div>
                )}

                {/* Candidates List */}
                {result ? (
                  <ApiCandidatesList
                    candidates={result.candidates}
                    repositoryName={repo.fullName}
                    repositoryId={repo.id}
                  />
                ) : (
                  <div className="p-4 rounded-lg bg-[#080b10] border border-[#141a26] flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-mono">
                      Repository linked. Ready to analyze source code for outbound API calls.
                    </p>
                    <button
                      onClick={() => handleScan(repo.id)}
                      disabled={isScanning}
                      className="text-xs font-mono text-rose-400 hover:text-rose-300 underline font-medium"
                    >
                      Run initial scan →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
