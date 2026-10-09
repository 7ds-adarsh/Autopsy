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
  /**
   * Provenance: where this evidence came from.
   * - "live_repo_scan" — fetched from the user's actual GitHub repository
   * - "canonical_demo_fixture" — injected from the built-in demo scenario;
   *   NOT from the user's repository
   */
  source?: "live_repo_scan" | "canonical_demo_fixture";
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
