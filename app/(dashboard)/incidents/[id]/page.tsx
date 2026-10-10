import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { incidents, apiMonitors, autopsyReports, repositories, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AutopsyReportView, AutopsyReportData } from "@/components/autopsy-report-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentReportPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  let userId = session?.user?.id;
  if (!userId) {
    const [firstUser] = await db.select().from(users).limit(1);
    userId = firstUser?.id;
  }

  // Load incident
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) {
    notFound();
  }

  // Load monitor details and verify ownership
  const [monitor] = await db
    .select({
      id: apiMonitors.id,
      userId: apiMonitors.userId,
      name: apiMonitors.name,
      endpoint: apiMonitors.endpoint,
      baseUrl: apiMonitors.baseUrl,
      method: apiMonitors.method,
      repositoryName: repositories.fullName,
    })
    .from(apiMonitors)
    .leftJoin(repositories, eq(apiMonitors.repositoryId, repositories.id))
    .where(eq(apiMonitors.id, incident.monitorId));

  if (!monitor || (userId && monitor.userId !== userId)) {
    notFound();
  }

  // Load autopsy report (if exists)
  const [report] = await db
    .select()
    .from(autopsyReports)
    .where(eq(autopsyReports.incidentId, id));

  const data: AutopsyReportData = {
    incident: {
      id: incident.id,
      monitorId: incident.monitorId,
      severity: incident.severity,
      isSimulation: incident.isSimulation,
      status: incident.status,
      createdAt: incident.createdAt.toISOString(),
      diff: incident.diff as any,
    },
    monitor: {
      name: monitor.name,
      endpoint: monitor.endpoint,
      baseUrl: monitor.baseUrl,
      method: monitor.method,
      repositoryName: monitor.repositoryName,
    },
    report: report
      ? {
          id: report.id,
          whatChanged: report.whatChanged,
          applicationImpact: report.applicationImpact as any,
          failurePath: report.failurePath as any,
          rootCause: report.rootCause,
          recommendedFix: report.recommendedFix,
          proposedPatch: report.proposedPatch,
          confidence: report.confidence as "high" | "medium" | "low",
          confidenceEvidence: report.confidenceEvidence as string[],
          generatedAt: report.generatedAt.toISOString(),
        }
      : null,
  };

  return <AutopsyReportView data={data} />;
}
