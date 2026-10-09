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

// Canonical code evidence for the known payment.customer_id → payment.customer.id break.
// These are injected when using the canonical fixture so Gemini has precise line-level
// code references to generate a correct, non-redundant proposed patch.
export const CANONICAL_CODE_EVIDENCE = [
  {
    file: "src/services/payment.ts",
    line: 19,
    snippet:
      " 17:   const payment = response.data;\n 18:\n> 19:   const customerId = payment.customer_id;\n 20:   const chargeId   = payment.charge_id;\n 21:   return { customerId, chargeId };",
    confidence: "high" as const,
  },
  {
    file: "src/services/payment.ts",
    line: 25,
    snippet:
      " 23:   if (!payment.customer_id) {\n 24:     logger.warn('Missing customer_id in payment response');\n> 25:     throw new PaymentError('customer_id required');\n 26:   }\n 27:   return payment.customer_id;",
    confidence: "high" as const,
  },
  {
    file: "src/hooks/usePayment.ts",
    line: 36,
    snippet:
      " 34:   const data = await fetchPayment(paymentId);\n 35:   setPayment(data);\n> 36:   setCustomerId(data.customer_id);\n 37: };",
    confidence: "medium" as const,
  },
];

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
  let isCanonical = false;
  try {
    const body = await req.json();
    // Accept either a custom simulatedResponse or default to canonical fixture
    simulatedResponse = body.simulatedResponse ?? CANONICAL_FIXTURE;
    isCanonical = !body.simulatedResponse;
  } catch {
    simulatedResponse = CANONICAL_FIXTURE;
    isCanonical = true;
  }

  try {
    const result = await executeSimulation(
      id,
      simulatedResponse,
      isCanonical ? CANONICAL_CODE_EVIDENCE : undefined
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[API /simulate] Monitor ${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
