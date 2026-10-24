/**
 * Demo Data Cleanup Command for API Autopsy
 *
 * Prepares the development/demo database for a clean hackathon demonstration.
 *
 * SAFEGUARDS:
 * 1. Default mode is PREVIEW ONLY. No modifications occur without --execute --confirm.
 * 2. Strict production guard: Refuses to run if NODE_ENV=production or production DB host,
 *    unless --allow-production is explicitly provided.
 * 3. Never deletes users, repositories, or GitHub authentication records.
 * 4. Never truncates tables. Only selectively removes test records.
 * 5. Identifies and preserves the canonical demo monitor (Acme Payments API POST /payments),
 *    its active baseline, and its encrypted credentials.
 * 6. Never prints secret keys or credential values.
 */

import { pool } from "../lib/db/client";

interface CleanupPreview {
  databaseHost: string;
  databaseName: string;
  isProductionGuardTriggered: boolean;
  preserved: {
    users: Array<{ id: string; username: string; githubId: string }>;
    repositories: Array<{ id: string; fullName: string }>;
    canonicalMonitor: {
      id: string;
      name: string;
      method: string;
      endpoint: string;
      baseUrl: string;
      activeBaselineId: string | null;
      repositoryName: string | null;
    } | null;
    canonicalBaseline: { id: string; captureMethod: string } | null;
    canonicalCredentialExists: boolean;
  };
  toDelete: {
    nonCanonicalMonitors: Array<{
      id: string;
      name: string;
      method: string;
      endpoint: string;
      user: string;
    }>;
    baselines: Array<{ id: string; monitorId: string }>;
    credentials: Array<{ id: string; monitorId: string }>;
    incidents: Array<{
      id: string;
      monitorId: string;
      severity: string;
      isSimulation: boolean;
      createdAt: string;
    }>;
    autopsyReportsCount: number;
    pipelineEventsCount: number;
  };
}

export async function generateCleanupPlan(): Promise<CleanupPreview> {
  const dbUrl = process.env.DATABASE_URL || "";
  let dbHost = "localhost";
  let dbName = "autopsy";
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, "");
  } catch {
    // Keep defaults if unparseable
  }

  const isProdEnv = process.env.NODE_ENV === "production";
  const isProdDb =
    dbHost.includes("prod") ||
    dbName.includes("prod") ||
    (!dbHost.includes("localhost") && !dbHost.includes("127.0.0.1") && !dbHost.includes("pooler"));
  const isProductionGuardTriggered = isProdEnv || isProdDb;

  // 1. Fetch all users (never deleted)
  const usersRes = await pool.query(`SELECT id, username, github_id FROM users ORDER BY created_at`);
  const allUsers = usersRes.rows.map((r) => ({
    id: r.id,
    username: r.username,
    githubId: r.github_id,
  }));

  // 2. Fetch all repositories (never deleted)
  const reposRes = await pool.query(`SELECT id, full_name FROM repositories ORDER BY created_at`);
  const allRepos = reposRes.rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
  }));

  // 3. Identify Canonical Monitor: Acme Payments API, POST /v1/payments (or /payments)
  const monitorsRes = await pool.query(`
    SELECT m.id, m.user_id, m.name, m.base_url, m.endpoint, m.method, m.active_baseline_id,
           u.username, r.full_name as repo_name, m.created_at
    FROM api_monitors m
    LEFT JOIN users u ON m.user_id = u.id
    LEFT JOIN repositories r ON m.repository_id = r.id
    ORDER BY m.created_at
  `);

  // Target candidate: POST /payments under Acme Payments API linked to 7ds-adarsh or with active baseline
  let canonicalRow = monitorsRes.rows.find(
    (m) =>
      m.method === "POST" &&
      m.endpoint.includes("payments") &&
      m.name.includes("Acme Payments") &&
      m.username === "7ds-adarsh" &&
      m.active_baseline_id != null
  );

  // Fallback to any POST payments monitor with active baseline if 7ds-adarsh is absent
  if (!canonicalRow) {
    canonicalRow = monitorsRes.rows.find(
      (m) =>
        m.method === "POST" &&
        m.endpoint.includes("payments") &&
        m.active_baseline_id != null
    );
  }

  const canonicalMonitor = canonicalRow
    ? {
        id: canonicalRow.id,
        name: canonicalRow.name,
        method: canonicalRow.method,
        endpoint: canonicalRow.endpoint,
        baseUrl: canonicalRow.base_url,
        activeBaselineId: canonicalRow.active_baseline_id,
        repositoryName: canonicalRow.repo_name,
      }
    : null;

  // 4. Canonical Baseline and Credential
  let canonicalBaseline: { id: string; captureMethod: string } | null = null;
  let canonicalCredentialExists = false;

  if (canonicalMonitor?.activeBaselineId) {
    const baseRes = await pool.query(
      `SELECT id, capture_method FROM baselines WHERE id = $1`,
      [canonicalMonitor.activeBaselineId]
    );
    if (baseRes.rows[0]) {
      canonicalBaseline = {
        id: baseRes.rows[0].id,
        captureMethod: baseRes.rows[0].capture_method,
      };
    }

    const credRes = await pool.query(
      `SELECT id FROM api_credentials WHERE monitor_id = $1`,
      [canonicalMonitor.id]
    );
    canonicalCredentialExists = credRes.rows.length > 0;
  }

  // 5. Non-canonical monitors to delete
  const nonCanonicalMonitors = monitorsRes.rows
    .filter((m) => !canonicalMonitor || m.id !== canonicalMonitor.id)
    .map((m) => ({
      id: m.id,
      name: m.name,
      method: m.method,
      endpoint: m.endpoint,
      user: m.username || "unknown",
    }));

  const nonCanonicalMonitorIds = nonCanonicalMonitors.map((m) => m.id);

  // 6. Baselines to delete (all baselines except the canonical monitor's active baseline)
  let baselinesToDelete: Array<{ id: string; monitorId: string }> = [];
  if (canonicalBaseline) {
    const bRes = await pool.query(
      `SELECT id, monitor_id FROM baselines WHERE id != $1`,
      [canonicalBaseline.id]
    );
    baselinesToDelete = bRes.rows.map((r) => ({ id: r.id, monitorId: r.monitor_id }));
  } else {
    const bRes = await pool.query(`SELECT id, monitor_id FROM baselines`);
    baselinesToDelete = bRes.rows.map((r) => ({ id: r.id, monitorId: r.monitor_id }));
  }

  // 7. Credentials to delete (credentials belonging to non-canonical monitors)
  let credentialsToDelete: Array<{ id: string; monitorId: string }> = [];
  if (nonCanonicalMonitorIds.length > 0) {
    const cRes = await pool.query(
      `SELECT id, monitor_id FROM api_credentials WHERE monitor_id = ANY($1::uuid[])`,
      [nonCanonicalMonitorIds]
    );
    credentialsToDelete = cRes.rows.map((r) => ({ id: r.id, monitorId: r.monitor_id }));
  }

  // 8. Incidents to delete (ALL test incidents across all monitors, so canonical monitor starts fresh with 0 incidents)
  const incRes = await pool.query(`
    SELECT id, monitor_id, severity, is_simulation, created_at
    FROM incidents
    ORDER BY created_at
  `);
  const incidentsToDelete = incRes.rows.map((r) => ({
    id: r.id,
    monitorId: r.monitor_id,
    severity: r.severity,
    isSimulation: r.is_simulation,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
  }));

  // 9. Autopsy reports count
  const repRes = await pool.query(`SELECT COUNT(*) as count FROM autopsy_reports`);
  const autopsyReportsCount = parseInt(repRes.rows[0].count, 10);

  // 10. Pipeline events count (if table exists)
  let pipelineEventsCount = 0;
  try {
    const pRes = await pool.query(`SELECT COUNT(*) as count FROM pipeline_events`);
    pipelineEventsCount = parseInt(pRes.rows[0].count, 10);
  } catch {
    // Table may not exist yet in legacy db
    pipelineEventsCount = 0;
  }

  return {
    databaseHost: dbHost,
    databaseName: dbName,
    isProductionGuardTriggered,
    preserved: {
      users: allUsers,
      repositories: allRepos,
      canonicalMonitor,
      canonicalBaseline,
      canonicalCredentialExists,
    },
    toDelete: {
      nonCanonicalMonitors,
      baselines: baselinesToDelete,
      credentials: credentialsToDelete,
      incidents: incidentsToDelete,
      autopsyReportsCount,
      pipelineEventsCount,
    },
  };
}

export function printPreview(plan: CleanupPreview): void {
  console.log("\n================================================================================");
  console.log("            API AUTOPSY — DEMO DATA CLEANUP PREVIEW (DRY-RUN)");
  console.log("================================================================================\n");

  console.log(`[Target Database]   Host: ${plan.databaseHost} | Database: ${plan.databaseName}`);
  console.log(
    `[Environment Guard] ${
      plan.isProductionGuardTriggered
        ? "⚠️  PRODUCTION DATABASE DETECTED — Requires --allow-production to execute."
        : "✅  Development/Demo database confirmed safe for cleanup."
    }\n`
  );

  console.log("--------------------------------------------------------------------------------");
  console.log("1. PRESERVED RECORDS (Never Deleted or Modified)");
  console.log("--------------------------------------------------------------------------------");
  console.log(`• Users (${plan.preserved.users.length}):`);
  for (const u of plan.preserved.users) {
    console.log(`    - [User] ID: ${u.id} | username: "${u.username}" | githubId: ${u.githubId}`);
  }

  console.log(`\n• Repositories (${plan.preserved.repositories.length}):`);
  for (const r of plan.preserved.repositories) {
    console.log(`    - [Repo] ID: ${r.id} | full_name: "${r.fullName}"`);
  }

  console.log("\n• Canonical Demo Monitor (Identified):");
  if (plan.preserved.canonicalMonitor) {
    const m = plan.preserved.canonicalMonitor;
    console.log(`    - [Monitor] ID: ${m.id}`);
    console.log(`      Name:     "${m.name}"`);
    console.log(`      Endpoint: ${m.method} ${m.baseUrl}${m.endpoint}`);
    console.log(`      Baseline: ${m.activeBaselineId ? `ID: ${m.activeBaselineId} (PRESERVED)` : "MISSING"}`);
    console.log(`      Creds:    ${plan.preserved.canonicalCredentialExists ? "Encrypted token intact (PRESERVED)" : "None"}`);
    console.log(`      Repo:     ${m.repositoryName || "None"}`);
    console.log(`      Action:   RESET last_status → 'healthy' (ready for live demo simulation)`);
  } else {
    console.log("    ⚠️  No canonical monitor found matching Acme Payments API POST /payments!");
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("2. RECORDS TO BE REMOVED");
  console.log("--------------------------------------------------------------------------------");

  console.log(`• Non-Canonical Monitors to Delete: ${plan.toDelete.nonCanonicalMonitors.length}`);
  for (const m of plan.toDelete.nonCanonicalMonitors) {
    console.log(`    - [Delete Monitor] ID: ${m.id} | ${m.method} ${m.endpoint} | "${m.name}" (owner: ${m.user})`);
  }

  console.log(`\n• Non-Canonical Baselines to Delete:   ${plan.toDelete.baselines.length}`);
  console.log(`• Non-Canonical Credentials to Delete: ${plan.toDelete.credentials.length}`);
  console.log(`• Test Incidents to Delete:            ${plan.toDelete.incidents.length}`);
  for (const inc of plan.toDelete.incidents) {
    console.log(`    - [Delete Incident] ID: ${inc.id} | Sev: ${inc.severity.toUpperCase()} | Sim: ${inc.isSimulation} | Created: ${inc.createdAt}`);
  }
  console.log(`• Autopsy Reports to Delete:           ${plan.toDelete.autopsyReportsCount} (cascaded via foreign key)`);
  console.log(`• Pipeline Events to Delete:           ${plan.toDelete.pipelineEventsCount} (cascaded via foreign key)`);

  console.log("\n--------------------------------------------------------------------------------");
  console.log("3. RESULTING DEMO STATE");
  console.log("--------------------------------------------------------------------------------");
  console.log("  • Monitored APIs:     1 (Acme Payments API POST /payments, Status: HEALTHY)");
  console.log("  • Active Baselines:   1 (Established good contract)");
  console.log("  • Registered Users:   Unchanged (All accounts preserved)");
  console.log("  • Repositories:       Unchanged (All repositories preserved)");
  console.log("  • Active Incidents:   0 (Clean slate ready for live hackathon demo!)");
  console.log("  • Autopsy Reports:    0 (Clean registry ready for new report generation)");
  console.log("================================================================================\n");
}

export async function executeCleanup(plan: CleanupPreview): Promise<void> {
  if (!plan.preserved.canonicalMonitor) {
    throw new Error("Cannot execute cleanup: Canonical monitor not found.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("[Cleanup] Transaction started...");

    // 1. Delete pipeline_events if table exists
    try {
      const peRes = await client.query("DELETE FROM pipeline_events");
      console.log(`[Cleanup] Deleted ${peRes.rowCount ?? 0} pipeline event(s).`);
    } catch {
      // Table may not exist in legacy db
    }

    // 2. Delete autopsy_reports
    const arRes = await client.query("DELETE FROM autopsy_reports");
    console.log(`[Cleanup] Deleted ${arRes.rowCount ?? 0} autopsy report(s).`);

    // 3. Delete incidents
    const incRes = await client.query("DELETE FROM incidents");
    console.log(`[Cleanup] Deleted ${incRes.rowCount ?? 0} incident(s).`);

    // 4. Delete non-canonical credentials
    const nonCanonIds = plan.toDelete.nonCanonicalMonitors.map((m) => m.id);
    if (nonCanonIds.length > 0) {
      const credRes = await client.query(
        "DELETE FROM api_credentials WHERE monitor_id = ANY($1::uuid[])",
        [nonCanonIds]
      );
      console.log(`[Cleanup] Deleted ${credRes.rowCount ?? 0} test credential(s).`);
    }

    // 5. Delete non-canonical baselines
    if (plan.preserved.canonicalBaseline) {
      const baseRes = await client.query(
        "DELETE FROM baselines WHERE id != $1",
        [plan.preserved.canonicalBaseline.id]
      );
      console.log(`[Cleanup] Deleted ${baseRes.rowCount ?? 0} test baseline(s).`);
    }

    // 6. Delete non-canonical monitors
    if (nonCanonIds.length > 0) {
      const monRes = await client.query(
        "DELETE FROM api_monitors WHERE id = ANY($1::uuid[])",
        [nonCanonIds]
      );
      console.log(`[Cleanup] Deleted ${monRes.rowCount ?? 0} test monitor(s).`);
    }

    // 7. Reset canonical monitor to healthy status
    await client.query(
      `UPDATE api_monitors
       SET last_status = 'healthy', updated_at = NOW()
       WHERE id = $1`,
      [plan.preserved.canonicalMonitor.id]
    );
    console.log(`[Cleanup] Reset canonical monitor ${plan.preserved.canonicalMonitor.id} status to 'healthy'.`);

    await client.query("COMMIT");
    console.log("\n[Cleanup] Transaction committed successfully!");
    console.log("Database is now in a pristine state for the hackathon demo.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Cleanup] Error during execution — transaction rolled back:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyCleanState(canonicalMonitorId: string): Promise<boolean> {
  console.log("[Verification] Inspecting clean state...");

  const monRes = await pool.query(
    `SELECT id, name, last_status, active_baseline_id FROM api_monitors WHERE id = $1`,
    [canonicalMonitorId]
  );
  if (monRes.rows.length === 0) {
    console.error("FAIL: Canonical monitor not found!");
    return false;
  }

  const mon = monRes.rows[0];
  console.log(`• Canonical Monitor: ${mon.name} | Status: ${mon.last_status}`);

  if (mon.last_status !== "healthy") {
    console.error(`FAIL: Expected last_status to be 'healthy', got '${mon.last_status}'`);
    return false;
  }

  const baseRes = await pool.query(
    `SELECT id, capture_method FROM baselines WHERE id = $1`,
    [mon.active_baseline_id]
  );
  if (baseRes.rows.length === 0) {
    console.error("FAIL: Active baseline not found!");
    return false;
  }
  console.log(`• Active Baseline: ID ${baseRes.rows[0].id} (${baseRes.rows[0].capture_method})`);

  const incRes = await pool.query(`SELECT COUNT(*) as count FROM incidents`);
  const incCount = parseInt(incRes.rows[0].count, 10);
  console.log(`• Incident Count: ${incCount} (expected: 0)`);
  if (incCount !== 0) {
    console.error("FAIL: Incidents count is not 0!");
    return false;
  }

  const repRes = await pool.query(`SELECT COUNT(*) as count FROM autopsy_reports`);
  const repCount = parseInt(repRes.rows[0].count, 10);
  console.log(`• Autopsy Reports Count: ${repCount} (expected: 0)`);
  if (repCount !== 0) {
    console.error("FAIL: Autopsy reports count is not 0!");
    return false;
  }

  console.log("✅ Clean state verified successfully!\n");
  return true;
}

// CLI Entrypoint
async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isConfirm = args.includes("--confirm");
  const isAllowProduction = args.includes("--allow-production");
  const isVerifyOnly = args.includes("--verify");

  try {
    const plan = await generateCleanupPlan();

    if (isVerifyOnly) {
      if (!plan.preserved.canonicalMonitor) {
        console.error("No canonical monitor found.");
        process.exit(1);
      }
      const ok = await verifyCleanState(plan.preserved.canonicalMonitor.id);
      process.exit(ok ? 0 : 1);
    }

    printPreview(plan);

    if (!isExecute) {
      console.log("💡 This was a PREVIEW ONLY. No records were modified.");
      console.log("   To perform the cleanup, run:");
      console.log("   npm run demo:cleanup -- --execute --confirm\n");
      return;
    }

    // Safety guard enforcement
    if (plan.isProductionGuardTriggered && !isAllowProduction) {
      console.error(
        "❌ Refusing to execute: Production database detected!\n" +
        "   If you genuinely intend to clean this database, pass --allow-production."
      );
      process.exit(1);
    }

    if (!isConfirm) {
      console.error(
        "❌ Confirmation required: To execute deletion, you must pass both --execute AND --confirm."
      );
      process.exit(1);
    }

    await executeCleanup(plan);

    if (plan.preserved.canonicalMonitor) {
      await verifyCleanState(plan.preserved.canonicalMonitor.id);
    }
  } catch (err: any) {
    console.error("Command failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
