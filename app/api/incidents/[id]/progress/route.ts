/**
 * GET /api/incidents/[id]/progress
 *
 * Returns the persisted pipeline event log for an incident so the client can
 * reconstruct the current pipeline state via polling. Replaces Socket.IO
 * real-time events for Vercel serverless deployment.
 *
 * Access control: same ownership check as the incident detail endpoint.
 * Never returns credentials or repository file content.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { incidents, apiMonitors, autopsyReports, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPipelineEvents } from "@/lib/pipeline/pipeline-events";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth: prefer session; fall back to first user in dev (matches other routes)
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
    if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = firstUser.id;
  }

  // Load incident and verify ownership via monitor
  const [incident] = await db
    .select({ id: incidents.id, monitorId: incidents.monitorId })
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const [monitor] = await db
    .select({ userId: apiMonitors.userId })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, incident.monitorId));

  if (!monitor || monitor.userId !== userId) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // Fetch persisted pipeline events
  const events = await getPipelineEvents(id);

  // Check whether the autopsy report is ready (so client knows when to stop polling)
  const [report] = await db
    .select({ id: autopsyReports.id, confidence: autopsyReports.confidence })
    .from(autopsyReports)
    .where(eq(autopsyReports.incidentId, id));

  const isComplete =
    report != null ||
    events.some((e) => e.stage === "complete" && e.status === "done");

  return NextResponse.json({
    incidentId: id,
    events: events.map((e) => ({
      id: e.id,
      stage: e.stage,
      status: e.status,
      detail: e.detail,
      payload: e.payload,
      createdAt: e.createdAt,
    })),
    isComplete,
    reportReady: report != null,
  });
}
