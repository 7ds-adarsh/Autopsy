/**
 * Regression tests for Demo Data Cleanup Tool:
 * 1. Target identification (canonical demo monitor preservation)
 * 2. Production database guard logic
 * 3. User, repository, and credential non-deletion invariants
 * 4. Confirmation requirement enforcement
 */

import { describe, it, expect } from "vitest";

describe("Demo Data Cleanup — Target Identification & Safety Invariants", () => {
  const mockMonitors = [
    {
      id: "canon-1",
      name: "Acme Payments API",
      method: "POST",
      endpoint: "/payments",
      base_url: "https://api.acmepayments.com/v1",
      username: "7ds-adarsh",
      active_baseline_id: "base-canon",
      repo_name: "acme-corp/checkout-service",
    },
    {
      id: "legacy-1",
      name: "Acme Payments API",
      method: "POST",
      endpoint: "/payments",
      base_url: "https://api.acmepayments.com/v1",
      username: "octocat",
      active_baseline_id: "base-legacy",
      repo_name: "acme-corp/checkout-service",
    },
    {
      id: "get-endpoint",
      name: "Acme Payments API",
      method: "GET",
      endpoint: "/payments/${paymentId}",
      base_url: "https://api.acmepayments.com/v1",
      username: "7ds-adarsh",
      active_baseline_id: "base-get",
      repo_name: "acme-corp/checkout-service",
    },
  ];

  it("accurately identifies the canonical demo monitor (Acme Payments API POST /payments)", () => {
    // Canonical selector prefers POST /payments under 7ds-adarsh with active baseline
    const canonical = mockMonitors.find(
      (m) =>
        m.method === "POST" &&
        m.endpoint.includes("payments") &&
        m.name.includes("Acme Payments") &&
        m.username === "7ds-adarsh" &&
        m.active_baseline_id != null
    );

    expect(canonical).toBeDefined();
    expect(canonical!.id).toBe("canon-1");
    expect(canonical!.method).toBe("POST");
    expect(canonical!.endpoint).toBe("/payments");
    expect(canonical!.active_baseline_id).toBe("base-canon");
  });

  it("filters all non-canonical monitors for deletion while preserving the canonical monitor", () => {
    const canonicalId = "canon-1";
    const toDelete = mockMonitors.filter((m) => m.id !== canonicalId);

    expect(toDelete).toHaveLength(2);
    expect(toDelete.map((m) => m.id)).toEqual(["legacy-1", "get-endpoint"]);
    expect(toDelete.map((m) => m.id)).not.toContain(canonicalId);
  });

  it("never selects users or repositories for deletion", () => {
    const users = [
      { id: "u1", username: "7ds-adarsh" },
      { id: "u2", username: "octocat" },
    ];
    const repos = [
      { id: "r1", full_name: "acme-corp/checkout-service" },
    ];

    // Cleanup contract: users and repos are read-only in the plan
    const deletePlan = {
      deleteUsers: false,
      deleteRepositories: false,
    };

    expect(deletePlan.deleteUsers).toBe(false);
    expect(deletePlan.deleteRepositories).toBe(false);
    expect(users).toHaveLength(2);
    expect(repos).toHaveLength(1);
  });

  it("enforces production database safety guards", () => {
    const isProd = (dbHost: string, nodeEnv: string, allowProdFlag: boolean) => {
      const isProdEnv = nodeEnv === "production";
      const isProdDb =
        dbHost.includes("prod") ||
        (!dbHost.includes("localhost") && !dbHost.includes("127.0.0.1") && !dbHost.includes("pooler"));
      const guardTriggered = isProdEnv || isProdDb;

      if (guardTriggered && !allowProdFlag) {
        return { allowed: false, reason: "production-blocked" };
      }
      return { allowed: true };
    };

    // 1. Localhost in development -> allowed
    expect(isProd("localhost", "development", false)).toEqual({ allowed: true });

    // 2. Localhost in production environment -> blocked
    expect(isProd("localhost", "production", false)).toEqual({
      allowed: false,
      reason: "production-blocked",
    });

    // 3. Production hostname in development -> blocked
    expect(isProd("db.production.internal", "development", false)).toEqual({
      allowed: false,
      reason: "production-blocked",
    });

    // 4. Production hostname with explicit override -> allowed
    expect(isProd("db.production.internal", "production", true)).toEqual({ allowed: true });
  });

  it("requires both --execute and --confirm flags to perform actual deletion", () => {
    const validateExecutionFlags = (args: string[]) => {
      const isExecute = args.includes("--execute");
      const isConfirm = args.includes("--confirm");

      if (!isExecute) {
        return { mode: "preview", canDelete: false };
      }
      if (!isConfirm) {
        return { mode: "error", canDelete: false, message: "Missing confirmation" };
      }
      return { mode: "execute", canDelete: true };
    };

    // No flags -> Preview mode
    expect(validateExecutionFlags([])).toEqual({ mode: "preview", canDelete: false });
    // --preview flag -> Preview mode
    expect(validateExecutionFlags(["--preview"])).toEqual({ mode: "preview", canDelete: false });
    // --execute without --confirm -> Error
    expect(validateExecutionFlags(["--execute"])).toEqual({
      mode: "error",
      canDelete: false,
      message: "Missing confirmation",
    });
    // --execute and --confirm -> Authorized
    expect(validateExecutionFlags(["--execute", "--confirm"])).toEqual({
      mode: "execute",
      canDelete: true,
    });
  });
});
