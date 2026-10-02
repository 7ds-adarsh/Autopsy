import { Settings, Shield, Key } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
      <div className="border-b border-[#181c28] pb-6">
        <h1 className="text-xl font-bold text-slate-100 font-mono">Settings & Credentials</h1>
        <p className="text-xs text-slate-400">Security configuration, encryption keys, and environment status</p>
      </div>

      <div className="space-y-4">
        <div className="border border-[#1a1f2c] bg-[#0c0e14] rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
            <Shield className="w-4 h-4 text-emerald-400" />
            Security & Credential Boundary
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            API credentials are encrypted with AES-256-GCM using your local <code className="font-mono text-slate-300">ENCRYPTION_KEY</code>.
            Decryption happens strictly in-memory during monitor execution and is never stored unencrypted or transmitted to the client.
          </p>
        </div>

        <div className="border border-[#1a1f2c] bg-[#0c0e14] rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
            <Key className="w-4 h-4 text-rose-400" />
            AI Provider
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gemini model: <code className="font-mono text-slate-300">gemini-3.8-flash</code> via <code className="font-mono text-slate-300">@google/genai</code>.
            Prompt payloads contain only structural diff summaries and affected code snippets. API credentials and full repository trees are strictly excluded.
          </p>
        </div>
      </div>
    </div>
  );
}
