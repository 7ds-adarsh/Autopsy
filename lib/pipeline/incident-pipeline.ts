/**
 * Shared Incident Pipeline.
 * Called by both real monitoring (executeMonitorCheck) and simulation (executeSimulation).
 * The only difference between paths is the `isSimulation` flag stored on the incident.
 *
 * On success with no changes: updates lastCheckedAt and emits monitor:checked.
 * On structural change: creates incident, runs impact analysis, calls Gemini, saves report.
 * On Gemini failure: saves incident with report status 'failed' — does NOT lose the incident.
 */

import { db } from "../db/client";
import {
  apiMonitors,
  baselines,
  incidents,
  autopsyReports,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { getIO } from "../socket/server";
import {
  normalizeResponse,
  computeDiff,
  classifySeverity,
  type DiffResult,
} from "../diff/schema-diff";
import { runRepositoryImpact } from "../impact/repository-impact";
import { GeminiProvider } from "../ai/gemini";
import type { AutopsyInput } from "../ai/provider";

const aiProvider = new GeminiProvider();

export async function runIncidentPipeline(
  monitorId: string,
  newResponse: unknown,
  isSimulation: boolean
): Promise<{ incidentId?: string; hasChanges: boolean }> {
  const io = getIO();

  // 1. Normalize new response
  const normalizedNew = normalizeResponse(newResponse);

  // 2. Load active baseline
  const [monitor] = await db
    .select()
    .from(apiMonitors)
    .where(eq(apiMonitors.id, monitorId));

  if (!monitor) {
    throw new Error(`Monitor ${monitorId} not found`);
  }

  if (!monitor.activeBaselineId) {
    console.warn(`[Pipeline] Monitor ${monitorId} has no active baseline — skipping`);
    return { hasChanges: false };
  }

  const [baseline] = await db
    .select()
    .from(baselines)
    .where(eq(baselines.id, monitor.activeBaselineId));

  if (!baseline) {
    console.warn(`[Pipeline] Baseline ${monitor.activeBaselineId} not found — skipping`);
    return { hasChanges: false };
  }

  const normalizedBaseline = normalizeResponse(baseline.responseBody);

  // 3. Run structural diff
  const diff: DiffResult = computeDiff(normalizedBaseline, normalizedNew);

  // 4. No changes — update lastCheckedAt and exit cleanly
  if (!diff.hasChanges) {
    await db
      .update(apiMonitors)
      .set({ lastCheckedAt: new Date(), lastStatus: "healthy" })
      .where(eq(apiMonitors.id, monitorId));

    io?.emit("monitor:checked", {
      monitorId,
      status: "healthy",
      checkedAt: new Date().toISOString(),
    });

    console.log(`[Pipeline] Monitor ${monitorId}: no changes detected`);
    return { hasChanges: false };
  }

  // 5. Classify severity
  const severity = classifySeverity(diff);
  console.log(`[Pipeline] Monitor ${monitorId}: changes detected — severity: ${severity}`);

  // 6. Create incident record
  const [incident] = await db
    .insert(incidents)
    .values({
      monitorId,
      baselineId: baseline.id,
      severity,
      diff: diff as unknown as Record<string, unknown>,
      isSimulation,
      status: "open",
    })
    .returning();

  // Update monitor status
  await db
    .update(apiMonitors)
    .set({
      lastCheckedAt: new Date(),
      lastStatus: "incident",
      updatedAt: new Date(),
    })
    .where(eq(apiMonitors.id, monitorId));

  // 7. Emit incident:created
  io?.emit("incident:created", {
    incidentId: incident.id,
    monitorId,
    severity,
    isSimulation,
  });

  console.log(`[Pipeline] Incident created: ${incident.id}`);

  // 8. Repository impact analysis
  let affectedFiles: Awaited<ReturnType<typeof runRepositoryImpact>> = [];
  try {
    affectedFiles = await runRepositoryImpact(monitorId, diff);
    console.log(`[Pipeline] Impact analysis: ${affectedFiles.length} affected file(s)`);
  } catch (err) {
    console.error("[Pipeline] Impact analysis failed:", err);
    // Non-fatal — continue to Gemini with empty affected files
  }

  // 9. Emit autopsy:started
  io?.emit("autopsy:started", { incidentId: incident.id });

  // 10. Build AutopsyInput — credentials and full repo explicitly excluded
  const autopsyInput: AutopsyInput = {
    previousStructure: normalizedBaseline,
    newStructure: normalizedNew,
    diff,
    affectedFiles,
    repositoryMetadata: {
      name: monitor.name,
    },
  };

  // 11. Call AI provider
  io?.emit("autopsy:progress", {
    incidentId: incident.id,
    step: "ai_analysis",
    message: "Sending evidence to Gemini for analysis...",
  });

  try {
    const report = await aiProvider.analyzeAutopsy(autopsyInput);

    // 12. Save autopsy report
    const [savedReport] = await db
      .insert(autopsyReports)
      .values({
        incidentId: incident.id,
        whatChanged: report.whatChanged,
        applicationImpact: report.applicationImpact as unknown as Record<string, unknown>[],
        failurePath: report.failurePath as unknown as Record<string, unknown>[],
        rootCause: report.rootCause,
        recommendedFix: report.recommendedFix,
        proposedPatch: report.proposedPatch ?? null,
        confidence: report.confidence,
        confidenceEvidence: report.confidenceEvidence as unknown as string[],
      })
      .returning();

    // 13. Emit autopsy:completed
    io?.emit("autopsy:completed", {
      incidentId: incident.id,
      reportId: savedReport.id,
    });

    console.log(`[Pipeline] Autopsy report saved: ${savedReport.id}`);
    return { incidentId: incident.id, hasChanges: true };
  } catch (geminiErr) {
    // Gemini failure: save incident but mark report as failed — do NOT lose the incident
    console.error("[Pipeline] Gemini analysis failed:", geminiErr);

    // Save a placeholder report indicating failure
    const errorMessage =
      geminiErr instanceof Error ? geminiErr.message : String(geminiErr);

    await db.insert(autopsyReports).values({
      incidentId: incident.id,
      whatChanged: `Autopsy report generation failed: ${errorMessage}`,
      applicationImpact: affectedFiles as unknown as Record<string, unknown>[],
      failurePath: [
        {
          step: "AI Analysis Failed",
          description: `Gemini could not generate the report. Incident is recorded with diff data. Error: ${errorMessage}`,
        },
      ],
      rootCause: "Autopsy report generation failed. Review the diff data directly.",
      recommendedFix: "Retry the simulation or check the Gemini API key and model configuration.",
      proposedPatch: null,
      confidence: "low",
      confidenceEvidence: ["Gemini analysis failed — only deterministic diff is available"],
    });

    io?.emit("autopsy:completed", {
      incidentId: incident.id,
      reportId: null,
      error: "Gemini analysis failed",
    });

    return { incidentId: incident.id, hasChanges: true };
  }
}
