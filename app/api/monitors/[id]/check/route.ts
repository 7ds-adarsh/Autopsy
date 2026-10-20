import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeMonitorCheck } from "@/lib/monitor/executor";

// Real HTTP checks + Gemini autopsy can take up to 60s total.
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
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

  try {
    const result = await executeMonitorCheck(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[API /check] Monitor ${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
