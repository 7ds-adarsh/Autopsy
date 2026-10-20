/**
 * Pipeline Events — persisted progress for Vercel-compatible polling.
 *
 * The incident pipeline calls emitPipelineEvent() at each stage instead of (or
 * alongside) Socket.IO io.emit(). The polling endpoint /api/incidents/[id]/progress
 * reads these rows and returns them to the client so the LivePipelineProgress
 * component can reconstruct state after a refresh or missed Socket.IO event.
 *
 * SAFETY: credentials and repo file contents are never stored in pipeline events.
 */

import { db } from "../db/client";
import { pipelineEvents } from "../db/schema";
import { eq, asc } from "drizzle-orm";

export type StageId =
  | "started"
  | "diff"
  | "incident"
  | "impact"
  | "gemini"
  | "complete";

export type StageStatus = "running" | "done" | "failed" | "skipped";

export interface PipelineEventPayload {
  // Diff stage
  hasChanges?: boolean;
  changes?: Array<{ path: string; type: string }>;
  severity?: string;
  // Impact stage
  affectedFilesCount?: number;
  affectedFiles?: Array<{ file: string; line?: number; source?: string }>;
  // Gemini/complete stage
  reportId?: string | null;
  error?: string;
}

/**
 * Writes a single pipeline stage event to the database.
 * Non-fatal — if the write fails, the pipeline continues.
 */
export async function emitPipelineEvent(
  incidentId: string,
  monitorId: string,
  stage: StageId,
  status: StageStatus,
  detail?: string,
  payload?: PipelineEventPayload
): Promise<void> {
  try {
    await db.insert(pipelineEvents).values({
      incidentId,
      monitorId,
      stage,
      status,
      detail: detail ?? null,
      payload: payload ? (payload as Record<string, unknown>) : null,
    });
  } catch (err) {
    // Non-fatal — never block the pipeline for a progress write
    console.warn(`[PipelineEvents] Failed to write event ${stage}/${status}:`, err);
  }
}

/**
 * Reads all pipeline events for an incident, ordered by insertion time.
 * Used by the polling endpoint to reconstruct current pipeline state.
 */
export async function getPipelineEvents(incidentId: string) {
  return db
    .select()
    .from(pipelineEvents)
    .where(eq(pipelineEvents.incidentId, incidentId))
    .orderBy(asc(pipelineEvents.createdAt));
}
