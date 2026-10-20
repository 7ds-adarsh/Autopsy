import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeSimulation } from "@/lib/monitor/executor";
import {
  resolveSimulationConfig,
  CANONICAL_FIXTURE,
  CANONICAL_CODE_EVIDENCE,
} from "@/lib/monitor/canonical-demo";

// Configure Vercel Function timeout for this route.
// Gemini analysis may take up to 30s. 60s gives a safe margin.
// The incident + diff are persisted before Gemini is called so a timeout
// never loses the deterministic diff result.
export const maxDuration = 60;

// Re-export for consumers that need them (e.g. tests)
export { CANONICAL_FIXTURE, CANONICAL_CODE_EVIDENCE };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  // Verify ownership
  const [monitor] = await db
    .select({ id: apiMonitors.id, userId: apiMonitors.userId })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, id));

  if (!monitor || monitor.userId !== userId) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  // Parse the request body (may be absent or malformed — both are handled)
  let parsedBody: unknown = null;
  try {
    parsedBody = await req.json();
  } catch {
    // No body or invalid JSON — treated as null by resolveSimulationConfig
  }

  // Canonical evidence is injected ONLY when the caller explicitly opts in via
  // useCanonicalDemo: true.  Absence of simulatedResponse alone does not qualify.
  const { simulatedResponse, canonicalEvidence, isCanonicalDemo } =
    resolveSimulationConfig(parsedBody);

  if (isCanonicalDemo) {
    console.log(`[API /simulate] Monitor ${id}: running canonical demo scenario`);
  }

  try {
    const result = await executeSimulation(id, simulatedResponse, canonicalEvidence);
    return NextResponse.json({ ...result, isSimulation: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[API /simulate] Monitor ${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
