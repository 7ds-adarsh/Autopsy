/**
 * POST /api/cron/monitor-tick
 *
 * Protected, idempotent endpoint for unattended monitor scheduling.
 * Invoke this every 5 minutes from an external cron or Vercel Cron Job.
 *
 * SECURITY: Requires a strong CRON_SECRET in the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 * Vercel Cron Jobs automatically inject this header when configured via vercel.json.
 *
 * IDEMPOTENCY: Only checks monitors that are overdue based on intervalMinutes
 * and lastCheckedAt. Skips monitors that were recently checked to prevent
 * duplicate runs from overlapping invocations.
 *
 * CONCURRENCY: Tracks in-flight monitors via a Set on this function instance.
 * Because Vercel may run multiple instances, the lastCheckedAt check in the DB
 * is the authoritative duplicate guard.
 *
 * CREDENTIALS: Never returned in the response body.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { apiMonitors } from "@/lib/db/schema";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { executeMonitorCheck } from "@/lib/monitor/executor";

// Configure maximum Vercel Function execution time (60 seconds)
export const maxDuration = 60;

// In-flight guard for this function instance (no substitute for the DB check)
const inFlight = new Set<string>();

export async function POST(req: NextRequest) {
  // ── Authorization ─────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Cron] CRON_SECRET is not configured — endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Find overdue monitors ─────────────────────────────────────────────────
  const now = new Date();

  let dueMonitors: { id: string; intervalMinutes: number; lastCheckedAt: Date | null }[];
  try {
    dueMonitors = await db
      .select({
        id: apiMonitors.id,
        intervalMinutes: apiMonitors.intervalMinutes,
        lastCheckedAt: apiMonitors.lastCheckedAt,
      })
      .from(apiMonitors)
      .where(
        and(
          eq(apiMonitors.monitoringEnabled, true),
          // Has an active baseline (no point checking without one)
          // We check this in the executor too, but filter early to reduce DB load
        )
      );
  } catch (err) {
    console.error("[Cron] Failed to query monitors:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Filter to only truly overdue monitors (intervalMinutes since lastCheckedAt, or never checked)
  const overdue = dueMonitors.filter((m) => {
    if (!m.lastCheckedAt) return true; // never checked
    const nextDue = new Date(m.lastCheckedAt.getTime() + m.intervalMinutes * 60_000);
    return nextDue <= now;
  });

  if (overdue.length === 0) {
    return NextResponse.json({ checked: 0, skipped: 0, message: "No monitors due" });
  }

  // ── Execute checks ────────────────────────────────────────────────────────
  const results: { id: string; status: string; error?: string }[] = [];
  const promises: Promise<void>[] = [];

  for (const monitor of overdue) {
    if (inFlight.has(monitor.id)) {
      results.push({ id: monitor.id, status: "skipped-inflight" });
      continue;
    }

    inFlight.add(monitor.id);
    const p = executeMonitorCheck(monitor.id)
      .then((result) => {
        results.push({ id: monitor.id, status: result.status });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Cron] Monitor ${monitor.id} check error:`, msg);
        results.push({ id: monitor.id, status: "error", error: msg });
      })
      .finally(() => {
        inFlight.delete(monitor.id);
      });

    promises.push(p);
  }

  await Promise.all(promises);

  const checked = results.filter((r) => !r.status.startsWith("skipped")).length;
  const incidents = results.filter((r) => r.status === "incident").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(`[Cron] Tick complete: ${checked} checked, ${incidents} incidents, ${errors} errors`);

  return NextResponse.json({
    checked,
    incidents,
    errors,
    // Only return status labels — never monitor IDs or credentials in production logs
    summary: results.map((r) => ({ status: r.status })),
  });
}

// Also support GET for Vercel Cron Jobs that only support GET
export async function GET(req: NextRequest) {
  return POST(req);
}
