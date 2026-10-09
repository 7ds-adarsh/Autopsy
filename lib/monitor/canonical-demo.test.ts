/**
 * Regression tests for canonical demo evidence gating.
 *
 * These tests enforce the safety contract:
 *   - Canonical evidence flows ONLY when useCanonicalDemo === true.
 *   - Absence of simulatedResponse does NOT imply canonical evidence.
 *   - A monitor with no repository linked never receives canonical evidence.
 *   - The canonical demo path produces the expected non-redundant patch inputs.
 */

import { describe, it, expect } from "vitest";
import {
  resolveSimulationConfig,
  CANONICAL_FIXTURE,
  CANONICAL_CODE_EVIDENCE,
} from "./canonical-demo";

describe("resolveSimulationConfig — canonical evidence gating", () => {
  // -------------------------------------------------------------------------
  // Test 1: Explicit opt-in → canonical fixture + canonical evidence injected
  // -------------------------------------------------------------------------
  it("injects CANONICAL_CODE_EVIDENCE only when useCanonicalDemo === true", () => {
    const config = resolveSimulationConfig({ useCanonicalDemo: true });

    expect(config.isCanonicalDemo).toBe(true);
    expect(config.simulatedResponse).toEqual(CANONICAL_FIXTURE);
    expect(config.canonicalEvidence).toBe(CANONICAL_CODE_EVIDENCE);
    expect(config.canonicalEvidence).toHaveLength(3);

    // All evidence must carry the correct provenance marker
    for (const item of config.canonicalEvidence!) {
      expect(item.source).toBe("canonical_demo_fixture");
    }
  });

  // -------------------------------------------------------------------------
  // Test 2: Custom simulatedResponse → no canonical evidence, even without flag
  // -------------------------------------------------------------------------
  it("does NOT inject canonical evidence when a custom simulatedResponse is provided", () => {
    const customFixture = {
      id: "pay_custom_001",
      amount: 1000,
      currency: "eur",
      status: "pending",
    };

    const config = resolveSimulationConfig({ simulatedResponse: customFixture });

    expect(config.isCanonicalDemo).toBe(false);
    expect(config.simulatedResponse).toEqual(customFixture);
    expect(config.canonicalEvidence).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Test 3: No body (no linked repo, no flags) → no canonical evidence
  // Simulates a monitor without a linked repository or any special flags.
  // -------------------------------------------------------------------------
  it("does NOT inject canonical evidence when no body is provided (null body)", () => {
    const config = resolveSimulationConfig(null);

    expect(config.isCanonicalDemo).toBe(false);
    // Default fixture is used as the response payload (convenience)
    expect(config.simulatedResponse).toEqual(CANONICAL_FIXTURE);
    // But NO code evidence — the user's repo has not been scanned
    expect(config.canonicalEvidence).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Test 4: Body without simulatedResponse AND without useCanonicalDemo flag
  // This is the former broken case: absence of simulatedResponse must NOT
  // trigger canonical evidence injection.
  // -------------------------------------------------------------------------
  it("does NOT inject canonical evidence when simulatedResponse is absent but useCanonicalDemo is not set", () => {
    // e.g. a monitor with no repository linked, no custom response, no demo flag
    const config = resolveSimulationConfig({});

    expect(config.isCanonicalDemo).toBe(false);
    expect(config.canonicalEvidence).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Test 5: Canonical demo evidence carries file+line references for the patch
  // Verifies the canonical evidence is structured correctly for Gemini to
  // generate a clean payment.customer_id → payment.customer.id patch.
  // -------------------------------------------------------------------------
  it("canonical evidence contains expected file references for the non-redundant patch", () => {
    const config = resolveSimulationConfig({ useCanonicalDemo: true });
    const evidence = config.canonicalEvidence!;

    // Primary reference: line 19 of src/services/payment.ts
    const primaryRef = evidence.find(
      (e) => e.file === "src/services/payment.ts" && e.line === 19
    );
    expect(primaryRef).toBeDefined();
    expect(primaryRef!.snippet).toContain("payment.customer_id");
    expect(primaryRef!.confidence).toBe("high");
    expect(primaryRef!.source).toBe("canonical_demo_fixture");

    // No evidence item should suggest keeping customer_id as a fallback
    for (const item of evidence) {
      expect(item.snippet).not.toMatch(/customer_id.*\|\|/);
      expect(item.snippet).not.toMatch(/\|\|.*customer_id/);
    }
  });
});
