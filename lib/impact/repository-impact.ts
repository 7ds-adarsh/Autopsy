/**
 * Repository Impact Analyzer.
 * Given a DiffResult, finds which files in the repository reference the changed field paths.
 * Uses cached scan results from the repository or fetches via GitHub App client.
 * Never invents attribution — line-level is provided only when confidently found.
 */

import { db } from "../db/client";
import { repositories, apiMonitors } from "../db/schema";
import { eq } from "drizzle-orm";
import { getFileContent, getRepoFileTree } from "../github/app";
import type { DiffResult, FieldChange } from "../diff/schema-diff";
import type { AffectedFile } from "../ai/provider";

// Source file extensions to scan for field references
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rb", ".java", ".cs", ".php",
]);

/** Build search patterns for a field path like "customer_id" or "customer.id" */
function buildSearchPatterns(fieldPath: string): RegExp[] {
  // Use the last segment for property-access patterns (e.g. "customer_id" from "payment.customer_id")
  const parts = fieldPath.replace(/\[\]/g, "").split(".");
  const leaf = parts[parts.length - 1];

  return [
    new RegExp(`\\.${leaf}\\b`),                     // .customer_id
    new RegExp(`\\['${leaf}'\\]`),                    // ['customer_id']
    new RegExp(`\\["${leaf}"\\]`),                    // ["customer_id"]
    new RegExp(`\\b${leaf}\\s*:`),                    // customer_id: (destructuring)
    new RegExp(`\\b${leaf}\\b`),                      // bare identifier (lowest confidence)
  ];
}

/** Extract lines matching a pattern, returning { line, lineNumber, confidence } */
function findMatches(
  content: string,
  patterns: RegExp[]
): { lineNumber: number; line: string; confidence: "high" | "medium" | "low" }[] {
  const lines = content.split("\n");
  const results: { lineNumber: number; line: string; confidence: "high" | "medium" | "low" }[] = [];

  lines.forEach((line, idx) => {
    // Skip comments and import lines for cleaner evidence
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) {
      return;
    }

    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(line)) {
        const confidence: "high" | "medium" | "low" =
          i <= 1 ? "high" : i <= 3 ? "medium" : "low";
        results.push({ lineNumber: idx + 1, line: trimmed, confidence });
        break; // one result per line
      }
    }
  });

  return results;
}

/** Get surrounding snippet (up to 5 lines) around a matched line */
function getSnippet(content: string, lineNumber: number, context = 2): string {
  const lines = content.split("\n");
  const start = Math.max(0, lineNumber - 1 - context);
  const end = Math.min(lines.length, lineNumber + context);
  return lines
    .slice(start, end)
    .map((l, i) => {
      const ln = start + i + 1;
      return `${ln === lineNumber ? ">" : " "} ${ln}: ${l}`;
    })
    .join("\n");
}

/**
 * Search repository files for references to changed field paths.
 * Returns AffectedFile[] for each location found.
 */
export async function runRepositoryImpact(
  monitorId: string,
  diff: DiffResult
): Promise<AffectedFile[]> {
  if (!diff.hasChanges) return [];

  // Only look for breaking or interesting changes
  const interestingChanges = diff.changes.filter(
    (c): c is FieldChange => c.type === "removed" || c.type === "type_changed"
  );

  if (interestingChanges.length === 0) return [];

  // Load monitor → repository
  const [monitor] = await db
    .select({ repositoryId: apiMonitors.repositoryId })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, monitorId));

  if (!monitor?.repositoryId) {
    console.log("[Impact] No repository linked to monitor, skipping impact analysis");
    return [];
  }

  const [repo] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, monitor.repositoryId));

  if (!repo?.installationId) {
    console.log("[Impact] Repository has no installation ID, skipping");
    return [];
  }

  const affected: AffectedFile[] = [];

  try {
    // Fetch file tree
    const tree = await getRepoFileTree(repo.owner, repo.name, repo.installationId);
    const sourceFiles = tree.filter((f) => {
      const ext = "." + (f.path?.split(".").pop() ?? "");
      return SOURCE_EXTENSIONS.has(ext) && f.type === "blob";
    });

    // Search each source file for each changed field
    for (const file of sourceFiles.slice(0, 50)) { // cap at 50 files for POC
      let content: string;
      try {
        const result = await getFileContent(repo.owner, repo.name, file.path!, repo.installationId);
        if (!result) continue;
        content = result;
      } catch {
        continue;
      }

      for (const change of interestingChanges) {
        const patterns = buildSearchPatterns(change.path);
        const matches = findMatches(content, patterns);

        for (const match of matches.slice(0, 3)) { // max 3 matches per file per field
          affected.push({
            file: file.path!,
            line: match.lineNumber,
            snippet: getSnippet(content, match.lineNumber),
            confidence: match.confidence,
            source: "live_repo_scan",
          });
        }
      }
    }
  } catch (err) {
    console.error("[Impact] Repository impact analysis failed:", err);
    // Return empty rather than crashing the pipeline
    return [];
  }

  // Deduplicate by file+line
  const seen = new Set<string>();
  return affected.filter((a) => {
    const key = `${a.file}:${a.line ?? "?"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
