/**
 * Verification Script: Canonical Monitor Simulation End-to-End
 *
 * Verifies Requirement 8:
 * "After cleanup, verify that the canonical monitor and baseline still work
 * and that a new canonical simulation creates a new incident and report."
 */

import { pool } from "../lib/db/client";
import { executeSimulation } from "../lib/monitor/executor";
import { CANONICAL_FIXTURE, CANONICAL_CODE_EVIDENCE } from "../lib/monitor/canonical-demo";

async function verifyCanonicalSimulation() {
  console.log("\n================================================================================");
  console.log("    API AUTOPSY — CANONICAL MONITOR SIMULATION VERIFICATION");
  console.log("================================================================================\n");

  try {
    // 1. Locate canonical monitor
    const monRes = await pool.query(`
      SELECT m.id, m.name, m.endpoint, m.method, m.base_url, m.active_baseline_id, m.last_status,
             b.capture_method, b.response_body
      FROM api_monitors m
      LEFT JOIN baselines b ON m.active_baseline_id = b.id
      WHERE m.name ILIKE '%acme payments%' AND m.method = 'POST'
      LIMIT 1
    `);

    if (monRes.rows.length === 0) {
      throw new Error("Canonical demo monitor not found in database!");
    }

    const monitor = monRes.rows[0];
    console.log(`[Canonical Monitor] ID:       ${monitor.id}`);
    console.log(`                    Name:     ${monitor.name}`);
    console.log(`                    Endpoint: ${monitor.method} ${monitor.base_url}${monitor.endpoint}`);
    console.log(`                    Status:   ${monitor.last_status}`);
    console.log(`[Active Baseline]   ID:       ${monitor.active_baseline_id} (${monitor.capture_method})`);

    if (!monitor.active_baseline_id) {
      throw new Error("Canonical monitor has no active baseline!");
    }

    // 2. Trigger canonical simulation
    console.log("\n[Simulation] Executing canonical simulation scenario with CANONICAL_FIXTURE & CANONICAL_CODE_EVIDENCE...");
    const startTime = Date.now();
    const result = await executeSimulation(
      monitor.id,
      CANONICAL_FIXTURE,
      CANONICAL_CODE_EVIDENCE
    );
    const elapsed = Date.now() - startTime;
    console.log(`[Simulation] Completed in ${elapsed}ms. Result:`, result);

    if (result.status !== "incident" || !result.incidentId) {
      throw new Error(`Simulation failed to produce an incident. Result: ${JSON.stringify(result)}`);
    }

    // 3. Verify created incident record
    const incRes = await pool.query(
      `SELECT id, monitor_id, baseline_id, severity, status, is_simulation, diff, created_at
       FROM incidents WHERE id = $1`,
      [result.incidentId]
    );

    if (incRes.rows.length === 0) {
      throw new Error(`Incident ${result.incidentId} not found in database!`);
    }

    const inc = incRes.rows[0];
    console.log("\n--------------------------------------------------------------------------------");
    console.log("INCIDENT VERIFICATION");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• Incident ID:    ${inc.id}`);
    console.log(`• Severity:       ${inc.severity.toUpperCase()}`);
    console.log(`• Status:         ${inc.status}`);
    console.log(`• Is Simulation:  ${inc.is_simulation}`);
    console.log(`• Changes Count:  ${inc.diff?.changes?.length ?? 0}`);
    if (inc.diff?.changes) {
      for (const ch of inc.diff.changes) {
        console.log(`    - [${ch.type.toUpperCase()}] ${ch.path}: ${ch.description}`);
      }
    }

    // 4. Verify autopsy report
    const repRes = await pool.query(
      `SELECT id, incident_id, what_changed, root_cause, recommended_fix, confidence,
              proposed_patch, application_impact, generated_at
       FROM autopsy_reports WHERE incident_id = $1`,
      [inc.id]
    );

    if (repRes.rows.length === 0) {
      throw new Error(`No autopsy report generated for incident ${inc.id}!`);
    }

    const report = repRes.rows[0];
    console.log("\n--------------------------------------------------------------------------------");
    console.log("AUTOPSY REPORT VERIFICATION");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• Report ID:       ${report.id}`);
    console.log(`• Confidence:      ${report.confidence}`);
    console.log(`• What Changed:    ${report.what_changed}`);
    console.log(`• Root Cause:      ${report.root_cause}`);
    console.log(`• Recommended Fix: ${report.recommended_fix?.substring(0, 100)}...`);
    console.log(`• App Impact References: ${Array.isArray(report.application_impact) ? report.application_impact.length : 0}`);
    if (Array.isArray(report.application_impact)) {
      for (const imp of report.application_impact) {
        console.log(`    - ${imp.file}:${imp.line} (${imp.source ?? "unknown source"})`);
      }
    }
    console.log(`• Proposed Patch Present: ${Boolean(report.proposed_patch)}`);

    // 5. Verify pipeline events
    const evtRes = await pool.query(
      `SELECT stage, status, detail FROM pipeline_events WHERE incident_id = $1 ORDER BY created_at`,
      [inc.id]
    );
    console.log(`\n• Pipeline Events Count: ${evtRes.rows.length}`);
    for (const evt of evtRes.rows) {
      console.log(`    - [${evt.stage.toUpperCase()}] status: ${evt.status} — ${evt.detail}`);
    }

    console.log("\n================================================================================");
    console.log("✅ REQUIREMENT 8 VERIFIED: CANONICAL SIMULATION SUCCEEDED AND GENERATED REPORT!");
    console.log("================================================================================\n");
  } finally {
    await pool.end();
  }
}

verifyCanonicalSimulation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
