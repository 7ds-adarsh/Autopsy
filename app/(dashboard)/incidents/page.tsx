import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { incidents, apiMonitors, autopsyReports, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { IncidentsView, IncidentListItem } from "@/components/incidents-view";

export default async function IncidentsPage() {
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  let incidentItems: IncidentListItem[] = [];

  if (userId) {
    const rows = await db
      .select({
        id: incidents.id,
        monitorId: incidents.monitorId,
        severity: incidents.severity,
        isSimulation: incidents.isSimulation,
        status: incidents.status,
        createdAt: incidents.createdAt,
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

    incidentItems = rows.map((r) => ({
      id: r.id,
      monitorId: r.monitorId,
      monitorName: r.monitorName,
      monitorEndpoint: r.monitorEndpoint,
      monitorMethod: r.monitorMethod,
      severity: r.severity,
      isSimulation: r.isSimulation,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reportId: r.reportId,
      whatChanged: r.whatChanged,
      diff: r.diff as any,
    }));
  }

  return (
    <div className="p-8 max-w-6xl w-full mx-auto">
      <IncidentsView initialIncidents={incidentItems} />
    </div>
  );
}
