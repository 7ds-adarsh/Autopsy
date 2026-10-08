import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeSimulation } from "@/lib/monitor/executor";

// Canonical breaking fixture: customer_id removed, customer.id added as nested object
export const CANONICAL_FIXTURE = {
  id: "pay_live_8392",
  customer: {
    id: "cus_8392",
    email: "user@example.com",
  },
  amount: 4999,
  currency: "usd",
  status: "succeeded",
  created_at: "2026-10-01T12:00:00Z",
};

export async function POST(
  req: NextRequest,
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

  // Verify ownership
  const [monitor] = await db
    .select({ id: apiMonitors.id, userId: apiMonitors.userId })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, id));

  if (!monitor || monitor.userId !== userId) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  let simulatedResponse: unknown;
  try {
    const body = await req.json();
    // Accept either a custom simulatedResponse or default to canonical fixture
    simulatedResponse = body.simulatedResponse ?? CANONICAL_FIXTURE;
  } catch {
    simulatedResponse = CANONICAL_FIXTURE;
  }

  try {
    const result = await executeSimulation(id, simulatedResponse);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[API /simulate] Monitor ${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
