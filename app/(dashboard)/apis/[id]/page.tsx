import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  apiMonitors,
  apiCredentials,
  repositories,
  baselines,
  incidents,
  users,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MonitorDetailView, MonitorDetailData } from "@/components/monitor-detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MonitorDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  // Load monitor with repository details
  const [monitor] = await db
    .select({
      id: apiMonitors.id,
      userId: apiMonitors.userId,
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
    notFound();
  }

  // Check if credential exists
  const [cred] = await db
    .select({ id: apiCredentials.id })
    .from(apiCredentials)
    .where(eq(apiCredentials.monitorId, id))
    .limit(1);

  // Load active baseline
  let activeBaseline: any = null;
  if (monitor.activeBaselineId) {
    const [b] = await db
      .select()
      .from(baselines)
      .where(eq(baselines.id, monitor.activeBaselineId))
      .limit(1);

    if (b) {
      activeBaseline = {
        id: b.id,
        responseBody: b.responseBody,
        structureSummary: b.structureSummary,
        captureMethod: b.captureMethod,
        capturedAt: b.capturedAt.toISOString(),
      };
    }
  }

  // Load latest incident for this monitor
  const [latestIncident] = await db
    .select({
      id: incidents.id,
      severity: incidents.severity,
      isSimulation: incidents.isSimulation,
      status: incidents.status,
      createdAt: incidents.createdAt,
      diff: incidents.diff,
    })
    .from(incidents)
    .where(eq(incidents.monitorId, id))
    .orderBy(desc(incidents.createdAt))
    .limit(1);

  const initialData: MonitorDetailData = {
    id: monitor.id,
    name: monitor.name,
    baseUrl: monitor.baseUrl,
    endpoint: monitor.endpoint,
    method: monitor.method,
    pathParams: monitor.pathParams as Record<string, string> | null,
    queryParams: monitor.queryParams as Record<string, string> | null,
    additionalHeaders: monitor.additionalHeaders as Record<string, string> | null,
    authType: monitor.authType,
    authHeaderName: monitor.authHeaderName,
    hasCredential: !!cred,
    discoverySource: monitor.discoverySource,
    discoveryConfidence: monitor.discoveryConfidence,
    monitoringEnabled: monitor.monitoringEnabled,
    intervalMinutes: monitor.intervalMinutes,
    lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
    lastStatus: monitor.lastStatus,
    activeBaselineId: monitor.activeBaselineId,
    createdAt: monitor.createdAt.toISOString(),
    repositoryId: monitor.repositoryId,
    repositoryName: monitor.repositoryName,
    activeBaseline,
    latestIncident: latestIncident
      ? {
          id: latestIncident.id,
          severity: latestIncident.severity,
          isSimulation: latestIncident.isSimulation,
          status: latestIncident.status,
          createdAt: latestIncident.createdAt.toISOString(),
          diff: latestIncident.diff,
        }
      : null,
  };

  return <MonitorDetailView initialMonitor={initialData} />;
}
