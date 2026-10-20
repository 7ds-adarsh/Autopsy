import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, apiCredentials, baselines, users } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto/credentials";
import { executeHttpRequest, extractStructureSummary } from "@/lib/monitor/http-client";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { captureMethod = "live", sampleJson } = body;

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

    // 1. Load monitor
    const [monitor] = await db
      .select()
      .from(apiMonitors)
      .where(eq(apiMonitors.id, id))
      .limit(1);

    if (!monitor || monitor.userId !== userId) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    let responsePayload: any = null;

    if (captureMethod === "sample") {
      if (!sampleJson) {
        return NextResponse.json(
          { error: "sampleJson is required when captureMethod is sample" },
          { status: 400 }
        );
      }
      responsePayload = typeof sampleJson === "string" ? JSON.parse(sampleJson) : sampleJson;
    } else {
      // Live capture: decrypt credential and fetch live response
      let decryptedCredential: string | undefined;
      if (monitor.authType !== "none") {
        const [credRecord] = await db
          .select()
          .from(apiCredentials)
          .where(eq(apiCredentials.monitorId, monitor.id))
          .limit(1);

        if (credRecord) {
          decryptedCredential = decrypt(credRecord.encryptedValue);
        }
      }

      const fullUrl = monitor.endpoint.startsWith("http")
        ? monitor.endpoint
        : `${monitor.baseUrl.replace(/\/$/, "")}/${monitor.endpoint.replace(/^\//, "")}`;

      const result = await executeHttpRequest({
        url: fullUrl,
        method: monitor.method,
        headers: (monitor.additionalHeaders as Record<string, string>) || {},
        queryParams: (monitor.queryParams as Record<string, string>) || {},
        pathParams: (monitor.pathParams as Record<string, string>) || {},
        authType: monitor.authType as "none" | "api_key" | "bearer",
        authHeaderName: monitor.authHeaderName || undefined,
        credential: decryptedCredential,
      });

      if (result.status !== "success") {
        return NextResponse.json(
          {
            error: `Failed to capture live response: ${result.errorMessage || "HTTP " + result.statusCode}`,
            result,
          },
          { status: 400 }
        );
      }

      responsePayload = result.data;
    }

    // 2. Compute Structural Schema Summary
    const structureSummary = extractStructureSummary(responsePayload);

    // 3. Store Baseline record in database
    const [newBaseline] = await db
      .insert(baselines)
      .values({
        monitorId: monitor.id,
        responseBody: responsePayload,
        structureSummary,
        captureMethod,
      })
      .returning();

    // 4. Update monitor active baseline
    await db
      .update(apiMonitors)
      .set({
        activeBaselineId: newBaseline.id,
        lastStatus: "healthy",
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiMonitors.id, monitor.id));

    return NextResponse.json({
      baseline: newBaseline,
      structureSummary,
    });
  } catch (error: any) {
    console.error("[API Baseline] Error capturing baseline:", error);
    return NextResponse.json(
      { error: error.message || "Failed to establish baseline" },
      { status: 500 }
    );
  }
}
