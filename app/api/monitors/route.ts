import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiMonitors, apiCredentials, users, repositories } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto/credentials";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = firstUser.id;
  }

  // Load monitors for user (NEVER joining or returning credentials)
  const monitorsList = await db
    .select({
      id: apiMonitors.id,
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
    .where(eq(apiMonitors.userId, userId))
    .orderBy(desc(apiMonitors.createdAt));

  return NextResponse.json(monitorsList);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;

  if (!userId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = firstUser.id;
  }

  try {
    const body = await req.json();
    const {
      name,
      baseUrl,
      endpoint,
      method = "GET",
      repositoryId,
      pathParams,
      queryParams,
      additionalHeaders,
      authType = "none",
      authHeaderName,
      credential,
      discoverySource = "manual",
      discoveryConfidence,
    } = body;

    if (!name || !baseUrl || !endpoint) {
      return NextResponse.json(
        { error: "Name, baseUrl, and endpoint are required" },
        { status: 400 }
      );
    }

    // 1. Insert Monitor record
    const [monitor] = await db
      .insert(apiMonitors)
      .values({
        userId,
        repositoryId: repositoryId || null,
        name,
        baseUrl,
        endpoint,
        method: method.toUpperCase(),
        pathParams: pathParams || null,
        queryParams: queryParams || null,
        additionalHeaders: additionalHeaders || null,
        authType,
        authHeaderName: authHeaderName || null,
        discoverySource,
        discoveryConfidence: discoveryConfidence || null,
        monitoringEnabled: true,
        intervalMinutes: 5,
        lastStatus: "pending",
      })
      .returning();

    // 2. Encrypt and store credential securely in isolated table if provided
    if (credential && authType !== "none") {
      const encryptedValue = encrypt(credential);
      await db.insert(apiCredentials).values({
        monitorId: monitor.id,
        encryptedValue,
      });
    }

    // Return monitor record (WITHOUT credential)
    return NextResponse.json(monitor, { status: 201 });
  } catch (error) {
    console.error("[API Monitors] Error creating monitor:", error);
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}
