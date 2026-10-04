import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { apiMonitors, apiCredentials } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto/credentials";
import { executeHttpRequest } from "@/lib/monitor/http-client";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Load monitor from DB
    const [monitor] = await db
      .select()
      .from(apiMonitors)
      .where(eq(apiMonitors.id, id))
      .limit(1);

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // 2. Fetch and decrypt credential strictly in memory if required
    let decryptedCredential: string | undefined;
    if (monitor.authType !== "none") {
      const [credRecord] = await db
        .select()
        .from(apiCredentials)
        .where(eq(apiCredentials.monitorId, monitor.id))
        .limit(1);

      if (credRecord) {
        try {
          decryptedCredential = decrypt(credRecord.encryptedValue);
        } catch (decryptErr) {
          console.error("[Test Connection] Failed to decrypt stored credential:", decryptErr);
          return NextResponse.json(
            {
              status: "auth-error",
              statusCode: 401,
              durationMs: 0,
              errorMessage: "Failed to decrypt stored credential",
            },
            { status: 200 }
          );
        }
      }
    }

    // 3. Assemble target URL
    const fullUrl = monitor.endpoint.startsWith("http")
      ? monitor.endpoint
      : `${monitor.baseUrl.replace(/\/$/, "")}/${monitor.endpoint.replace(/^\//, "")}`;

    // 4. Execute external HTTP request (credentials never logged or returned)
    const result = await executeHttpRequest({
      url: fullUrl,
      method: monitor.method,
      headers: (monitor.additionalHeaders as Record<string, string>) || {},
      queryParams: (monitor.queryParams as Record<string, string>) || {},
      pathParams: (monitor.pathParams as Record<string, string>) || {},
      authType: monitor.authType as "none" | "api_key" | "bearer",
      authHeaderName: monitor.authHeaderName || undefined,
      credential: decryptedCredential,
      timeoutMs: 8000,
    });

    // 5. Update monitor check status
    const newStatus = result.status === "success" ? "healthy" : "error";
    await db
      .update(apiMonitors)
      .set({
        lastCheckedAt: new Date(),
        lastStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(apiMonitors.id, monitor.id));

    // Return result WITHOUT credential
    return NextResponse.json({
      status: result.status,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      data: result.data,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("[API Test Connection] Error testing monitor connection:", error);
    return NextResponse.json(
      {
        status: "transport-error",
        statusCode: 0,
        durationMs: 0,
        errorMessage: error.message || "Failed to test connection",
      },
      { status: 500 }
    );
  }
}
