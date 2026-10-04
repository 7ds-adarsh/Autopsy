import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, apiCredentials, repositories, baselines, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [monitor] = await db
    .select({
      id: apiMonitors.id,
      name: apiMonitors.name,
      baseUrl: apiMonitors.baseUrl,
      endpoint: apiMonitors.endpoint,
      method: apiMonitors.method,
      pathParams: apiMonitors.pathParams,
      queryParams: apiMonitors.queryParams,
      additionalHeaders: apiMonitors.additionalHeaders,
      authType: apiMonitors.authType,
      authHeaderName: apiMonitors.authHeaderName,
      discoverySource: apiMonitors.discoverySource,
      discoveryConfidence: apiMonitors.discoveryConfidence,
      monitoringEnabled: apiMonitors.monitoringEnabled,
      intervalMinutes: apiMonitors.intervalMinutes,
      lastCheckedAt: apiMonitors.lastCheckedAt,
      lastStatus: apiMonitors.lastStatus,
      activeBaselineId: apiMonitors.activeBaselineId,
      createdAt: apiMonitors.createdAt,
      repositoryId: apiMonitors.repositoryId,
      repositoryName: repositories.fullName,
    })
    .from(apiMonitors)
    .leftJoin(repositories, eq(apiMonitors.repositoryId, repositories.id))
    .where(eq(apiMonitors.id, id))
    .limit(1);

  if (!monitor) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  // Check if credential exists without revealing it
  const [cred] = await db
    .select({ id: apiCredentials.id })
    .from(apiCredentials)
    .where(eq(apiCredentials.monitorId, id))
    .limit(1);

  // If monitor has an active baseline, fetch it
  let activeBaseline: any = null;
  if (monitor.activeBaselineId) {
    const [b] = await db
      .select()
      .from(baselines)
      .where(eq(baselines.id, monitor.activeBaselineId))
      .limit(1);
    activeBaseline = b || null;
  }

  return NextResponse.json({
    ...monitor,
    hasCredential: !!cred,
    activeBaseline,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { monitoringEnabled, intervalMinutes, name } = body;

    const updates: any = {};
    if (typeof monitoringEnabled === "boolean") updates.monitoringEnabled = monitoringEnabled;
    if (typeof intervalMinutes === "number") updates.intervalMinutes = intervalMinutes;
    if (typeof name === "string") updates.name = name;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(apiMonitors)
      .set(updates)
      .where(eq(apiMonitors.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API Monitors] Error updating monitor:", error);
    return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await db.delete(apiMonitors).where(eq(apiMonitors.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Monitors] Error deleting monitor:", error);
    return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
  }
}
