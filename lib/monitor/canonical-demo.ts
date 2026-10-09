/**
 * Canonical Demo Fixture and Simulation Config Resolver.
 *
 * This module owns:
 *   - CANONICAL_FIXTURE: the built-in breaking API response used for demos.
 *   - CANONICAL_CODE_EVIDENCE: pre-known code references for the demo break.
 *   - resolveSimulationConfig(): pure function that decides what response and
 *     evidence to use based on the parsed request body.
 *
 * IMPORTANT SAFETY RULE:
 *   Canonical evidence is ONLY injected when the caller explicitly opts in via
 *   `useCanonicalDemo: true` in the request body.
 *
 *   Absence of `simulatedResponse` does NOT imply the caller wants canonical
 *   evidence — it only implies they accept the canonical fixture as the default
 *   response payload. Evidence provenance is kept strictly separate.
 */

import type { AffectedFile } from "../ai/provider";

// ---------------------------------------------------------------------------
// Canonical breaking fixture
// Breaking change: top-level `customer_id` (string) removed; nested `customer`
// object (with `id` + `email`) added in its place.
// ---------------------------------------------------------------------------
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
} as const;

// ---------------------------------------------------------------------------
// Canonical code evidence
// Pre-known references to `payment.customer_id` in the demo application code.
// source="canonical_demo_fixture" ensures downstream systems (Gemini, UI) never
// present this as evidence retrieved from the user's actual repository.
// ---------------------------------------------------------------------------
export const CANONICAL_CODE_EVIDENCE: AffectedFile[] = [
  {
    file: "src/services/payment.ts",
    line: 19,
    snippet:
      " 17:   const payment = response.data;\n 18:\n> 19:   const customerId = payment.customer_id;\n 20:   const chargeId   = payment.charge_id;\n 21:   return { customerId, chargeId };",
    confidence: "high",
    source: "canonical_demo_fixture",
  },
  {
    file: "src/services/payment.ts",
    line: 25,
    snippet:
      " 23:   if (!payment.customer_id) {\n 24:     logger.warn('Missing customer_id in payment response');\n> 25:     throw new PaymentError('customer_id required');\n 26:   }\n 27:   return payment.customer_id;",
    confidence: "high",
    source: "canonical_demo_fixture",
  },
  {
    file: "src/hooks/usePayment.ts",
    line: 36,
    snippet:
      " 34:   const data = await fetchPayment(paymentId);\n 35:   setPayment(data);\n> 36:   setCustomerId(data.customer_id);\n 37: };",
    confidence: "medium",
    source: "canonical_demo_fixture",
  },
];

// ---------------------------------------------------------------------------
// Simulation config resolver
// Pure function — no I/O, fully unit-testable.
//
// Canonical evidence is injected ONLY when body.useCanonicalDemo === true.
// Absence of simulatedResponse is a response-payload default, not an evidence
// signal. A monitor without a linked repository simply gets no code evidence.
// ---------------------------------------------------------------------------
export interface SimulationConfig {
  simulatedResponse: unknown;
  /**
   * Evidence to inject into the pipeline, or undefined.
   * undefined means: fall back to live repository scan (which may return []).
   */
  canonicalEvidence: AffectedFile[] | undefined;
  /** Whether this run is using the built-in canonical demo scenario end-to-end. */
  isCanonicalDemo: boolean;
}

export function resolveSimulationConfig(parsedBody: unknown): SimulationConfig {
  const body =
    parsedBody !== null && typeof parsedBody === "object"
      ? (parsedBody as Record<string, unknown>)
      : null;

  // Canonical demo requires an EXPLICIT opt-in flag.
  // This is the only path that injects CANONICAL_CODE_EVIDENCE.
  if (body?.useCanonicalDemo === true) {
    return {
      simulatedResponse: CANONICAL_FIXTURE,
      canonicalEvidence: CANONICAL_CODE_EVIDENCE,
      isCanonicalDemo: true,
    };
  }

  // Custom response — use whatever the caller provided.
  // No canonical evidence regardless of repositoryId presence.
  if (body?.simulatedResponse !== undefined) {
    return {
      simulatedResponse: body.simulatedResponse,
      canonicalEvidence: undefined,
      isCanonicalDemo: false,
    };
  }

  // No body or body without either flag — use canonical fixture as response
  // payload (convenience default) but do NOT inject code evidence.
  return {
    simulatedResponse: CANONICAL_FIXTURE,
    canonicalEvidence: undefined,
    isCanonicalDemo: false,
  };
}
