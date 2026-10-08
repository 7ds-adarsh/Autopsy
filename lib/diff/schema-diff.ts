/**
 * Schema Diff Engine — pure recursive structural diff of JSON objects.
 * Returns a DiffResult describing what changed between two API response structures.
 * Property ordering is ignored. Only structural changes are detected (not value changes).
 */

export interface FieldChange {
  type: "removed" | "added" | "type_changed" | "structure_changed";
  path: string;       // dot notation: "customer_id", "customer.id", "items[0].price"
  oldType?: string;   // "string", "object", "array", "number", "boolean", "null"
  newType?: string;
  severity: "breaking" | "additive";
}

export interface DiffResult {
  hasChanges: boolean;
  changes: FieldChange[];
  overallSeverity: "none" | "additive" | "breaking";
}

/** Returns a normalized type name for a JSON value. */
function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Recursively diff two objects at the given path prefix.
 * Mutates `changes` in place.
 */
function diffObjects(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  pathPrefix: string,
  changes: FieldChange[]
): void {
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const key of allKeys) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const inBaseline = Object.prototype.hasOwnProperty.call(baseline, key);
    const inCurrent = Object.prototype.hasOwnProperty.call(current, key);

    if (inBaseline && !inCurrent) {
      // Field removed — breaking
      changes.push({
        type: "removed",
        path: fullPath,
        oldType: typeOf(baseline[key]),
        severity: "breaking",
      });
    } else if (!inBaseline && inCurrent) {
      // Field added — additive (non-breaking)
      changes.push({
        type: "added",
        path: fullPath,
        newType: typeOf(current[key]),
        severity: "additive",
      });
    } else {
      // Field exists in both — check type
      const oldType = typeOf(baseline[key]);
      const newType = typeOf(current[key]);

      if (oldType !== newType) {
        // Type changed — breaking
        changes.push({
          type: "type_changed",
          path: fullPath,
          oldType,
          newType,
          severity: "breaking",
        });
      } else if (oldType === "object" && newType === "object") {
        // Both are objects — recurse
        diffObjects(
          baseline[key] as Record<string, unknown>,
          current[key] as Record<string, unknown>,
          fullPath,
          changes
        );
      } else if (oldType === "array" && newType === "array") {
        // For arrays: diff the first element's structure if both are non-empty object arrays
        const baseArr = baseline[key] as unknown[];
        const currArr = current[key] as unknown[];
        if (
          baseArr.length > 0 &&
          currArr.length > 0 &&
          typeOf(baseArr[0]) === "object" &&
          typeOf(currArr[0]) === "object"
        ) {
          diffObjects(
            baseArr[0] as Record<string, unknown>,
            currArr[0] as Record<string, unknown>,
            `${fullPath}[]`,
            changes
          );
        }
      }
      // primitives with same type — no structural change, ignore value differences
    }
  }
}

/**
 * Normalize a JSON value into a plain object/array structure suitable for diffing.
 * Non-object roots are wrapped so the diff engine always works with objects.
 */
export function normalizeResponse(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined) return {};
  if (Array.isArray(input)) return { _root: input };
  if (typeof input === "object") return input as Record<string, unknown>;
  return { _root: input };
}

/**
 * Compute a structural diff between two normalized JSON objects.
 * Order of properties is ignored.
 */
export function computeDiff(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>
): DiffResult {
  const changes: FieldChange[] = [];
  diffObjects(baseline, current, "", changes);

  const hasBreaking = changes.some((c) => c.severity === "breaking");
  const hasAdditive = changes.some((c) => c.severity === "additive");

  return {
    hasChanges: changes.length > 0,
    changes,
    overallSeverity: hasBreaking
      ? "breaking"
      : hasAdditive
      ? "additive"
      : "none",
  };
}

/**
 * Classify overall severity of an incident from a DiffResult.
 * Breaking changes → critical; additive only → low.
 */
export function classifySeverity(
  diff: DiffResult
): "low" | "medium" | "high" | "critical" {
  if (!diff.hasChanges) return "low";
  if (diff.overallSeverity === "additive") return "low";

  const hasBreaking = diff.changes.some((c) => c.severity === "breaking");
  if (hasBreaking) return "critical";

  return "medium";
}
