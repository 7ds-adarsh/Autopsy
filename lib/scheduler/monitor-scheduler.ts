/**
 * Monitor Scheduler — singleton setInterval, 5-minute default.
 * Guards against duplicate initialization during Next.js hot reload.
 * Tracks in-flight checks to avoid concurrent runs for the same monitor.
 */

import { db } from "../db/client";
import { apiMonitors } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { executeMonitorCheck } from "../monitor/executor";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let initialized = false;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
const inFlightChecks = new Set<string>(); // monitorIds currently being checked

async function runSchedulerTick(): Promise<void> {
  console.log("[Scheduler] Tick — checking active monitors...");

  let activeMonitors: { id: string }[];
  try {
    activeMonitors = await db
      .select({ id: apiMonitors.id })
      .from(apiMonitors)
      .where(and(eq(apiMonitors.monitoringEnabled, true)));
  } catch (err) {
    console.error("[Scheduler] Failed to load monitors:", err);
    return;
  }

  if (activeMonitors.length === 0) {
    console.log("[Scheduler] No active monitors to check");
    return;
  }

  for (const monitor of activeMonitors) {
    if (inFlightChecks.has(monitor.id)) {
      console.log(`[Scheduler] Monitor ${monitor.id}: check already in flight — skipping`);
      continue;
    }

    inFlightChecks.add(monitor.id);
    // Fire-and-forget: don't await so monitors run in parallel
    executeMonitorCheck(monitor.id)
      .then((result) => {
        console.log(`[Scheduler] Monitor ${monitor.id}: ${result.status}`);
      })
      .catch((err) => {
        console.error(`[Scheduler] Monitor ${monitor.id} check failed:`, err);
      })
      .finally(() => {
        inFlightChecks.delete(monitor.id);
      });
  }
}

/**
 * Initialize the monitor scheduler singleton.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (initialized) {
    console.log("[Scheduler] Already initialized — skipping duplicate init");
    return;
  }

  initialized = true;
  console.log(
    `[Scheduler] Starting monitor scheduler (interval: ${intervalMs / 1000}s)`
  );

  // First tick after a short delay to let the server finish starting
  setTimeout(() => {
    runSchedulerTick().catch(console.error);
  }, 10_000); // 10-second startup delay

  schedulerInterval = setInterval(() => {
    runSchedulerTick().catch(console.error);
  }, intervalMs);

  // Don't hold the Node.js process open just for the scheduler
  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }
}

/**
 * Stop the scheduler (used in tests / graceful shutdown).
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  initialized = false;
  inFlightChecks.clear();
}
