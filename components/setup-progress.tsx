import { Check } from "lucide-react";

interface SetupProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

export function SetupProgress({ currentStep }: SetupProgressProps) {
  const steps = [
    { number: "01", title: "Repository", desc: currentStep > 1 ? "Connected" : "Connect source code" },
    { number: "02", title: "API Endpoint", desc: currentStep > 2 ? "Configured" : "Select & verify endpoint" },
    { number: "03", title: "Baseline", desc: currentStep > 3 ? "Captured" : "Establish known-good contract" },
    { number: "04", title: "Monitoring", desc: currentStep === 4 ? "Active" : "Continuous inspection" },
  ];

  return (
    <div className="border border-[#1f2533] bg-[#0d1017] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1b202e]">
        <div>
          <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400">Setup Workflow</h3>
          <p className="text-sm font-medium text-slate-200">Connect, baseline, and monitor API contracts</p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          Step {currentStep} of 4
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isPending = stepNum > currentStep;

          return (
            <div
              key={step.number}
              className={`p-3 rounded-md border transition-all ${
                isCurrent
                  ? "bg-[#141926] border-rose-500/50 shadow-sm shadow-rose-950/20"
                  : isDone
                  ? "bg-[#0b0e14] border-emerald-900/40 opacity-80"
                  : "bg-[#080a0f] border-[#161a24] opacity-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-slate-400 font-semibold">
                  {step.number}
                </span>
                {isDone ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <Check className="w-3 h-3 text-emerald-400" /> Done
                  </span>
                ) : isCurrent ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Current
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-slate-600">Pending</span>
                )}
              </div>
              <h4 className={`text-xs font-semibold ${isCurrent ? "text-slate-100" : "text-slate-300"}`}>
                {step.title}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
