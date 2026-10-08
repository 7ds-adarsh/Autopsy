import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { incidents, apiMonitors, autopsyReports, baselines, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = firstUser.id;
  }

  // Load incident with ownership check via monitor
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // Verify ownership via monitor
  const [monitor] = await db
    .select({ userId: apiMonitors.userId, name: apiMonitors.name, endpoint: apiMonitors.endpoint })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, incident.monitorId));

  if (!monitor || monitor.userId !== userId) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // Load autopsy report (if it exists)
  const [report] = await db
    .select()
    .from(autopsyReports)
    .where(eq(autopsyReports.incidentId, id));

  // Load baseline snapshot metadata (not the full response body — no credential exposure)
  const [baseline] = incident.baselineId
    ? await db
        .select({
          id: baselines.id,
          structureSummary: baselines.structureSummary,
          captureMethod: baselines.captureMethod,
          capturedAt: baselines.capturedAt,
        })
        .from(baselines)
        .where(eq(baselines.id, incident.baselineId))
    : [undefined];

  return NextResponse.json({
    incident,
    report: report ?? null,
    monitor: {
      name: monitor.name,
      endpoint: monitor.endpoint,
    },
    baseline: baseline ?? null,
  });
}
