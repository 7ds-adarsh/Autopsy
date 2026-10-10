"use client";

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  X,
  Play,
  FileCode,
  Layers,
} from "lucide-react";
import { CANONICAL_FIXTURE } from "@/lib/monitor/canonical-demo";

interface SimulateDialogProps {
  monitorId: string;
  baselineResponse?: unknown;
  isOpen: boolean;
  onClose: () => void;
  onSimulationStarted: (incidentId?: string) => void;
}

export function SimulateDialog({
  monitorId,
  baselineResponse,
  isOpen,
  onClose,
  onSimulationStarted,
}: SimulateDialogProps) {
  const defaultPayload = baselineResponse
    ? JSON.stringify(baselineResponse, null, 2)
    : JSON.stringify(
        {
          id: "pay_live_8392",
          customer_id: "cus_8392",
          amount: 4999,
          currency: "usd",
          status: "succeeded",
        },
        null,
        2
      );

  const [simulatedText, setSimulatedText] = useState(defaultPayload);
  const [useCanonicalDemo, setUseCanonicalDemo] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleLoadCanonical() {
    setSimulatedText(JSON.stringify(CANONICAL_FIXTURE, null, 2));
    setUseCanonicalDemo(true);
    setJsonError(null);
    setApiError(null);
  }

  function handleTextChange(val: string) {
    setSimulatedText(val);
    setApiError(null);
    // If user modifies text away from canonical, uncheck canonical demo flag
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      const isStillCanonical =
        parsed?.customer?.id === "cus_8392" && parsed?.customer_id === undefined;
      if (!isStillCanonical) {
        setUseCanonicalDemo(false);
      }
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON syntax");
      setUseCanonicalDemo(false);
    }
  }

  async function handleRunSimulation() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(simulatedText);
    } catch (e: any) {
      setJsonError("Please provide valid JSON before running simulation");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/monitors/${monitorId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedResponse: parsed,
          useCanonicalDemo: useCanonicalDemo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Simulation execution failed");
      }

      onSimulationStarted(data.incidentId);
      onClose();
    } catch (err: any) {
      setApiError(err.message || "Failed to trigger simulation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#090c13] border border-[#1e273a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#182030] bg-[#0c101a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wide">
                Simulate Breaking API Change
              </h2>
              <p className="text-[11px] text-slate-400">
                Exercise the exact same incident & autopsy pipeline as a real third-party change
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#141a27] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Persistent Disclaimer */}
        <div className="px-6 py-2.5 bg-amber-950/20 border-b border-amber-900/30 flex items-center gap-2.5 text-[11px] font-mono text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Simulation Sandbox:</strong> This is a controlled simulation. It does not indicate that the external provider actually changed its live API.
          </span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 font-mono text-xs">
          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              Simulated New Response Payload:
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadCanonical}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-200 text-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Load Breaking Example (customer_id → customer.id)
              </button>

              <button
                type="button"
                onClick={() => handleTextChange(defaultPayload)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#131926] hover:bg-[#1a2233] border border-[#20283b] text-slate-400 text-xs transition-colors"
                title="Reset to baseline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          {/* JSON Textarea */}
          <div className="space-y-1.5">
            <textarea
              value={simulatedText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={12}
              spellCheck={false}
              className={`w-full p-4 rounded-lg bg-[#05070a] border text-slate-200 font-mono text-xs focus:outline-none transition-colors ${
                jsonError
                  ? "border-rose-600 focus:border-rose-500"
                  : "border-[#1d2538] focus:border-purple-500"
              }`}
              placeholder="Paste or edit simulated JSON response..."
            />
            {jsonError && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {jsonError}
              </p>
            )}
          </div>

          {/* Canonical demo scenario toggle */}
          <div className="p-3.5 rounded-lg bg-[#0e121d] border border-[#1f283d] space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useCanonicalDemo}
                onChange={(e) => setUseCanonicalDemo(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 text-[11px]">
                  Designated Canonical Demo Scenario
                </span>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Injects canonical demo code evidence (`payment.customer_id`) for reproducible hackathon demo. Leave unchecked when testing custom simulated responses to prevent fabricating repository impact.
                </p>
              </div>
            </label>
          </div>

          {apiError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
              {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#182030] bg-[#0c101a] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[#131926] hover:bg-[#1a2233] border border-[#20283b] text-slate-300 text-xs font-mono transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={isSubmitting || !!jsonError}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-semibold text-xs tracking-wide transition-colors shadow-lg shadow-purple-950/40 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Launching Pipeline...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
