/**
 * Monitor Executor — executes real monitor checks and simulations.
 * Both paths converge on runIncidentPipeline() — the only difference is the response source
 * and the isSimulation flag.
 *
 * Error classification:
 *   200 → success → pipeline
 *   401/403 → auth-error → log + update lastStatus: error (no incident)
 *   5xx/timeout/DNS → transport-error → log + update lastStatus: error (no incident)
 */

import { db } from "../db/client";
import { apiMonitors, apiCredentials } from "../db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "../crypto/credentials";
import { executeHttpRequest } from "./http-client";
import { runIncidentPipeline } from "../pipeline/incident-pipeline";
import type { AffectedFile } from "../ai/provider";
import { getIO } from "../socket/server";

export type CheckResult =
  | { status: "healthy" | "incident"; incidentId?: string }
  | { status: "auth-error" | "transport-error" | "server-error" | "no-baseline"; message: string }
  | { status: "error"; message: string };

/**
 * Executes a real HTTP check for a monitor.
 * Classifies response, then runs pipeline only on success.
 */
export async function executeMonitorCheck(monitorId: string): Promise<CheckResult> {
  getIO()?.emit("check:started", { monitorId });

  // 1. Load monitor config
  const [monitor] = await db
    .select()
    .from(apiMonitors)
    .where(eq(apiMonitors.id, monitorId));

  if (!monitor) {
    return { status: "error", message: `Monitor ${monitorId} not found` };
  }

  if (!monitor.activeBaselineId) {
    console.log(`[Executor] Monitor ${monitorId}: no active baseline — skipping check`);
    return { status: "no-baseline", message: "No active baseline configured" };
  }

  // 2. Decrypt credentials if present
  let credential: string | undefined;
  if (monitor.authType !== "none") {
    const [cred] = await db
      .select({ encryptedValue: apiCredentials.encryptedValue })
      .from(apiCredentials)
      .where(eq(apiCredentials.monitorId, monitorId));

    if (cred?.encryptedValue) {
      try {
        credential = decrypt(cred.encryptedValue);
      } catch (err) {
        console.error(`[Executor] Failed to decrypt credential for monitor ${monitorId}:`, err);
        await db
          .update(apiMonitors)
          .set({ lastStatus: "error", updatedAt: new Date() })
          .where(eq(apiMonitors.id, monitorId));
        return { status: "error", message: "Credential decryption failed" };
      }
    }
  }

  // 3. Assemble target URL and call external API
  const fullUrl = monitor.endpoint.startsWith("http")
    ? monitor.endpoint
    : `${monitor.baseUrl.replace(/\/$/, "")}/${monitor.endpoint.replace(/^\//, "")}`;

  const httpResult = await executeHttpRequest({
    url: fullUrl,
    method: monitor.method as "GET" | "POST",
    pathParams: (monitor.pathParams as Record<string, string>) ?? undefined,
    queryParams: (monitor.queryParams as Record<string, string>) ?? undefined,
    headers: (monitor.additionalHeaders as Record<string, string>) ?? undefined,
    authType: monitor.authType as "none" | "api_key" | "bearer",
    authHeaderName: monitor.authHeaderName ?? undefined,
    credential,
  });

  // 4. Classify response
  if (httpResult.status === "auth-error") {
    console.warn(`[Executor] Monitor ${monitorId}: auth-error (${httpResult.statusCode})`);
    await db
      .update(apiMonitors)
      .set({ lastCheckedAt: new Date(), lastStatus: "error", updatedAt: new Date() })
      .where(eq(apiMonitors.id, monitorId));
    return { status: "auth-error", message: `Authentication failed (HTTP ${httpResult.statusCode})` };
  }

  if (httpResult.status === "transport-error") {
    console.warn(`[Executor] Monitor ${monitorId}: transport-error — ${httpResult.errorMessage}`);
    await db
      .update(apiMonitors)
      .set({ lastCheckedAt: new Date(), lastStatus: "error", updatedAt: new Date() })
      .where(eq(apiMonitors.id, monitorId));
    return { status: "transport-error", message: httpResult.errorMessage || "Transport error" };
  }

  if (httpResult.status === "server-error") {
    console.warn(`[Executor] Monitor ${monitorId}: server-error (${httpResult.statusCode})`);
    await db
      .update(apiMonitors)
      .set({ lastCheckedAt: new Date(), lastStatus: "error", updatedAt: new Date() })
      .where(eq(apiMonitors.id, monitorId));
    return { status: "server-error", message: `Server error (HTTP ${httpResult.statusCode})` };
  }

  // 5. Success — run incident pipeline
  const result = await runIncidentPipeline(monitorId, httpResult.data, false);
  return {
    status: result.hasChanges ? "incident" : "healthy",
    incidentId: result.incidentId,
  };
}

/**
 * Executes a simulation: skips the HTTP call, uses the provided fixture JSON,
 * runs the same pipeline with isSimulation: true.
 * If canonicalEvidence is provided, it is injected as affectedFiles for Gemini.
 */
export async function executeSimulation(
  monitorId: string,
  simulatedResponse: unknown,
  canonicalEvidence?: AffectedFile[]
): Promise<CheckResult> {
  getIO()?.emit("simulation:started", { monitorId });

  const [monitor] = await db
    .select({ id: apiMonitors.id, activeBaselineId: apiMonitors.activeBaselineId })
    .from(apiMonitors)
    .where(eq(apiMonitors.id, monitorId));

  if (!monitor) {
    return { status: "error", message: `Monitor ${monitorId} not found` };
  }

  if (!monitor.activeBaselineId) {
    return { status: "no-baseline", message: "No active baseline configured — capture a baseline first" };
  }

  const result = await runIncidentPipeline(monitorId, simulatedResponse, true, canonicalEvidence);
  return {
    status: result.hasChanges ? "incident" : "healthy",
    incidentId: result.incidentId,
  };
}
