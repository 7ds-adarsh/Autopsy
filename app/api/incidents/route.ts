import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { incidents, apiMonitors, autopsyReports, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = firstUser.id;
  }

  // Load incidents for all monitors belonging to this user
  const userMonitors = await db
    .select({ id: apiMonitors.id })
    .from(apiMonitors)
    .where(eq(apiMonitors.userId, userId));

  if (userMonitors.length === 0) {
    return NextResponse.json([]);
  }

  const monitorIds = userMonitors.map((m) => m.id);

  // Load incidents with autopsy report status
  const rows = await db
    .select({
      id: incidents.id,
      monitorId: incidents.monitorId,
      baselineId: incidents.baselineId,
      severity: incidents.severity,
      isSimulation: incidents.isSimulation,
      status: incidents.status,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      diff: incidents.diff,
      monitorName: apiMonitors.name,
      monitorEndpoint: apiMonitors.endpoint,
      monitorMethod: apiMonitors.method,
      reportId: autopsyReports.id,
      whatChanged: autopsyReports.whatChanged,
    })
    .from(incidents)
    .leftJoin(apiMonitors, eq(incidents.monitorId, apiMonitors.id))
    .leftJoin(autopsyReports, eq(autopsyReports.incidentId, incidents.id))
    .where(eq(apiMonitors.userId, userId))
    .orderBy(desc(incidents.createdAt));

  return NextResponse.json(rows);
}
