import { describe, it, expect } from "vitest";
import {
  computeDiff,
  normalizeResponse,
  classifySeverity,
  type DiffResult,
} from "./schema-diff";

describe("schema-diff: normalizeResponse", () => {
  it("passes plain objects through unchanged", () => {
    const obj = { id: "1", name: "test" };
    expect(normalizeResponse(obj)).toEqual(obj);
  });

  it("wraps arrays in _root key", () => {
    expect(normalizeResponse([1, 2, 3])).toEqual({ _root: [1, 2, 3] });
  });

  it("returns empty object for null/undefined", () => {
    expect(normalizeResponse(null)).toEqual({});
    expect(normalizeResponse(undefined)).toEqual({});
  });
});

describe("schema-diff: computeDiff — no changes", () => {
  it("returns hasChanges: false for identical objects", () => {
    const baseline = { id: "123", amount: 100, status: "paid" };
    const current = { id: "456", amount: 200, status: "pending" }; // same structure, diff values
    const result = computeDiff(baseline, current);
    expect(result.hasChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.overallSeverity).toBe("none");
  });

  it("ignores property ordering", () => {
    const baseline = { a: "x", b: 1, c: true };
    const current = { c: false, a: "y", b: 99 };
    const result = computeDiff(baseline, current);
    expect(result.hasChanges).toBe(false);
  });
});

describe("schema-diff: removed field (breaking)", () => {
  it("detects a removed top-level field", () => {
    const baseline = { customer_id: "cus_123", amount: 100 };
    const current = { amount: 100 };
    const result = computeDiff(baseline, current);

    expect(result.hasChanges).toBe(true);
    expect(result.overallSeverity).toBe("breaking");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      type: "removed",
      path: "customer_id",
      oldType: "string",
      severity: "breaking",
    });
  });

  it("detects a removed nested field", () => {
    const baseline = { customer: { id: "cus_123", email: "a@b.com" } };
    const current = { customer: { id: "cus_123" } };
    const result = computeDiff(baseline, current);

    expect(result.hasChanges).toBe(true);
    const removed = result.changes.find((c) => c.path === "customer.email");
    expect(removed).toBeDefined();
    expect(removed!.type).toBe("removed");
    expect(removed!.severity).toBe("breaking");
  });
});

describe("schema-diff: added field (additive)", () => {
  it("detects an added top-level field", () => {
    const baseline = { amount: 100 };
    const current = { amount: 100, currency: "usd" };
    const result = computeDiff(baseline, current);

    expect(result.hasChanges).toBe(true);
    expect(result.overallSeverity).toBe("additive");
    expect(result.changes[0]).toMatchObject({
      type: "added",
      path: "currency",
      newType: "string",
      severity: "additive",
    });
  });
});

describe("schema-diff: type changed (breaking)", () => {
  it("detects a string→object type change", () => {
    const baseline = { customer_id: "cus_123", amount: 100 };
    // Canonical fixture: customer_id removed, customer.id added as nested object
    const current = { customer: { id: "cus_123" }, amount: 100 };
    const result = computeDiff(baseline, current);

    expect(result.hasChanges).toBe(true);
    expect(result.overallSeverity).toBe("breaking");

    const removed = result.changes.find(
      (c) => c.type === "removed" && c.path === "customer_id"
    );
    expect(removed).toBeDefined();

    const added = result.changes.find(
      (c) => c.type === "added" && c.path === "customer"
    );
    expect(added).toBeDefined();
  });

  it("detects a number→string type change", () => {
    const baseline = { price: 100 };
    const current = { price: "100" };
    const result = computeDiff(baseline, current);

    expect(result.changes[0]).toMatchObject({
      type: "type_changed",
      path: "price",
      oldType: "number",
      newType: "string",
      severity: "breaking",
    });
  });

  it("detects an object→string type change", () => {
    const baseline = { address: { street: "123 Main St", city: "Portland" } };
    const current = { address: "123 Main St, Portland" };
    const result = computeDiff(baseline, current);

    expect(result.changes[0]).toMatchObject({
      type: "type_changed",
      path: "address",
      oldType: "object",
      newType: "string",
      severity: "breaking",
    });
  });
});

describe("schema-diff: nested field renamed (breaking removal + additive add)", () => {
  it("detects rename as a removal + addition", () => {
    const baseline = { payment: { customer_id: "cus_123", amount: 100 } };
    const current = { payment: { customer: { id: "cus_123" }, amount: 100 } };
    const result = computeDiff(baseline, current);

    expect(result.hasChanges).toBe(true);
    expect(result.overallSeverity).toBe("breaking");

    const removed = result.changes.find(
      (c) => c.type === "removed" && c.path === "payment.customer_id"
    );
    expect(removed).toBeDefined();

    const added = result.changes.find(
      (c) => c.type === "added" && c.path === "payment.customer"
    );
    expect(added).toBeDefined();
  });
});

describe("schema-diff: classifySeverity", () => {
  it("returns low for additive-only changes", () => {
    const diff: DiffResult = {
      hasChanges: true,
      changes: [
        { type: "added", path: "currency", newType: "string", severity: "additive" },
      ],
      overallSeverity: "additive",
    };
    expect(classifySeverity(diff)).toBe("low");
  });

  it("returns critical for breaking changes", () => {
    const diff: DiffResult = {
      hasChanges: true,
      changes: [
        { type: "removed", path: "customer_id", oldType: "string", severity: "breaking" },
      ],
      overallSeverity: "breaking",
    };
    expect(classifySeverity(diff)).toBe("critical");
  });

  it("returns critical for multiple breaking changes", () => {
    const diff: DiffResult = {
      hasChanges: true,
      changes: [
        { type: "removed", path: "a", oldType: "string", severity: "breaking" },
        { type: "removed", path: "b", oldType: "string", severity: "breaking" },
      ],
      overallSeverity: "breaking",
    };
    expect(classifySeverity(diff)).toBe("critical");
  });
});
