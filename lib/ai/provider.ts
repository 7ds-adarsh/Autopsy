/**
 * AI Provider interface and shared types.
 * GeminiProvider implements this interface; the pipeline uses the interface only.
 */

import type { DiffResult } from "../diff/schema-diff";

export interface AffectedFile {
  file: string;
  line?: number;        // present when confidently identified
  snippet?: string;     // surrounding code, ≤5 lines
  confidence: "high" | "medium" | "low";
  note?: string;        // e.g. "Line-level attribution unavailable"
}

export interface AutopsyInput {
  previousStructure: Record<string, unknown>;
  newStructure: Record<string, unknown>;
  diff: DiffResult;
  affectedFiles: AffectedFile[];
  repositoryMetadata: {
    name: string;
    primaryLanguage?: string;
  };
  // Explicitly excluded: credentials, full repo contents, raw baselines
}

export interface AutopsyReport {
  whatChanged: string;
  applicationImpact: {
    file: string;
    line?: number;
    snippet?: string;
    explanation: string;
  }[];
  failurePath: {
    step: string;
    description: string;
  }[];
  rootCause: string;
  recommendedFix: string;
  proposedPatch?: string;   // unified diff format
  confidence: "high" | "medium" | "low";
  confidenceEvidence: string[];
}

export interface AIProvider {
  analyzeAutopsy(input: AutopsyInput): Promise<AutopsyReport>;
}
