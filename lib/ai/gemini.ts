/**
 * GeminiProvider — AIProvider implementation using @google/genai.
 * Model is configurable via GEMINI_MODEL env var.
 * On Gemini failure: throws so the pipeline can mark the incident report as 'failed'
 * without losing the incident record.
 */

import { GoogleGenAI } from "@google/genai";
import type { AIProvider, AutopsyInput, AutopsyReport } from "./provider";

const DEFAULT_MODEL = "gemini-3.8-flash";

function buildPrompt(input: AutopsyInput): string {
  return `You are an API incident investigator. You will receive:
- The previous API response structure (the baseline)
- The new API response structure (what was detected)
- A deterministic diff describing exactly what changed structurally
- Code snippets from the application that reference the changed fields

Your job is to reason over this evidence and produce a structured incident report.

RULES:
- Do NOT invent files, functions, or code that are not in the evidence provided.
- Clearly distinguish what you know from evidence versus what you are inferring.
- confidence should be "high" if you have direct code evidence of the break, "medium" if you are inferring, "low" if you have minimal evidence.
- The failurePath should describe how the API change propagates to a user-visible failure, step by step.
- Keep descriptions technical and precise. This is a developer-facing forensic report, not marketing copy.

PROPOSED PATCH RULES (critical — read carefully):
- The proposedPatch MUST be a proper unified diff (--- a/file / +++ b/file format).
- The patch MUST show only the minimal, correct change needed to fix the break.
- The patch MUST completely REMOVE the old broken field access and REPLACE it with the new correct one.
- Do NOT write a patch that retains the broken access path as a fallback (e.g., "|| payment.customer_id" or "|| payment.customer?.id"). That is a no-op and will be rejected.
- Example of a CORRECT patch when payment.customer_id moved to payment.customer.id:
  --- a/src/services/payment.ts
  +++ b/src/services/payment.ts
  @@ -19,1 +19,1 @@
  -  const customerId = payment.customer_id;
  +  const customerId = payment.customer.id;
- If you cannot determine the exact corrected field path with confidence, omit proposedPatch entirely rather than guessing or writing a no-op.

EVIDENCE PROVENANCE:
- Each entry in affectedFiles may have a "source" field: "live_repo_scan" means it was retrieved from the user's actual repository; "canonical_demo_fixture" means it is pre-loaded demo evidence, NOT from the user's repository.
- When source="canonical_demo_fixture", include a note in confidenceEvidence such as: "Code evidence is from the canonical demo scenario, not retrieved from a live repository scan."
- Never present demo-fixture evidence as if it were retrieved from the user's repository.

EVIDENCE:
${JSON.stringify(input, null, 2)}

Respond ONLY with a JSON object matching this exact schema (no markdown, no code fences):
{
  "whatChanged": "<single paragraph describing the structural change>",
  "applicationImpact": [
    {
      "file": "<relative file path>",
      "line": <line number or omit>,
      "snippet": "<relevant code snippet or omit>",
      "explanation": "<why this code breaks>"
    }
  ],
  "failurePath": [
    { "step": "<step label>", "description": "<what happens at this step>" }
  ],
  "rootCause": "<root cause paragraph>",
  "recommendedFix": "<concrete fix recommendation>",
  "proposedPatch": "<unified diff string or omit>",
  "confidence": "high" | "medium" | "low",
  "confidenceEvidence": ["<evidence item 1>", "<evidence item 2>"]
}`;
}

export class GeminiProvider implements AIProvider {
  private model: string;

  constructor() {
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  public getModel(): string {
    return this.model;
  }

  async analyzeAutopsy(input: AutopsyInput): Promise<AutopsyReport> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt(input);

    let responseText = "";
    let lastError: unknown = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: this.model,
          contents: prompt,
        });
        responseText = response.text ?? "";
        lastError = null;
        break;
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const isTransient = message.includes("503") || message.includes("429") || message.includes("high demand") || message.includes("RESOURCE_EXHAUSTED");
        if (attempt < maxAttempts && isTransient) {
          console.warn(`[GeminiProvider] Transient error on attempt ${attempt}/${maxAttempts} (${message}). Retrying in ${attempt * 2}s...`);
          await new Promise((res) => setTimeout(res, attempt * 2000));
        } else {
          break;
        }
      }
    }

    const FALLBACK_MODEL = "gemini-3.5-flash";

    if ((lastError || !responseText) && this.model !== FALLBACK_MODEL) {
      console.warn(`[GeminiProvider] Primary model ${this.model} encountered error. Attempting fallback to ${FALLBACK_MODEL}...`);
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
        });
        responseText = fallbackResponse.text ?? "";
        lastError = null;
      } catch (fallbackErr) {
        console.error(`[GeminiProvider] Fallback model ${FALLBACK_MODEL} also failed:`, fallbackErr);
      }
    }

    if (lastError || !responseText) {
      const message = lastError instanceof Error ? lastError.message : String(lastError || "Empty response from Gemini");
      throw new Error(`Gemini API call failed: ${message}`);
    }

    // Strip any accidental markdown code fences
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    let report: AutopsyReport;
    try {
      report = JSON.parse(cleaned) as AutopsyReport;
    } catch {
      throw new Error(
        `Gemini returned non-JSON response. Raw: ${cleaned.slice(0, 300)}`
      );
    }

    // Validate required fields
    if (
      typeof report.whatChanged !== "string" ||
      !Array.isArray(report.applicationImpact) ||
      !Array.isArray(report.failurePath) ||
      typeof report.rootCause !== "string" ||
      typeof report.recommendedFix !== "string" ||
      !["high", "medium", "low"].includes(report.confidence) ||
      !Array.isArray(report.confidenceEvidence)
    ) {
      throw new Error("Gemini response missing required AutopsyReport fields");
    }

    return report;
  }
}
