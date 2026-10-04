import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, repositories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MonitorsView, MonitorItem } from "@/components/monitors-view";

export default async function ApisPage() {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  let monitorItems: MonitorItem[] = [];
  if (userId) {
    const records = await db
      .select({
        id: apiMonitors.id,
        name: apiMonitors.name,
        baseUrl: apiMonitors.baseUrl,
        endpoint: apiMonitors.endpoint,
        method: apiMonitors.method,
        authType: apiMonitors.authType,
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
      .where(eq(apiMonitors.userId, userId))
      .orderBy(desc(apiMonitors.createdAt));

    monitorItems = records.map((m) => ({
      ...m,
      lastCheckedAt: m.lastCheckedAt ? m.lastCheckedAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  return (
    <div className="p-8 max-w-6xl w-full mx-auto">
      <MonitorsView initialMonitors={monitorItems} />
    </div>
  );
}
