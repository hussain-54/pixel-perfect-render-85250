/**
 * Pure rules for authorization-matrix load outcomes.
 * Demo vs production fail-closed behavior — unit-testable without Supabase.
 */

export type MatrixLoadPlane = "demo" | "live_dev" | "live_production";

export type MatrixLoadOutcome = "database" | "defaults" | "unavailable";

export function resolveMatrixLoadPlane(input: {
  sessionSource: "demo" | "supabase" | string;
  isProduction: boolean;
}): MatrixLoadPlane {
  if (input.sessionSource !== "supabase") return "demo";
  return input.isProduction ? "live_production" : "live_dev";
}

/**
 * Decide matrix source from a live query result.
 * - demo: always defaults (caller short-circuits before DB).
 * - live_dev: missing/empty table → defaults (local until migration).
 * - live_production: missing/empty/unexpected → unavailable (fail closed).
 */
export function resolveAuthorizationMatrixOutcome(input: {
  plane: MatrixLoadPlane;
  errorMessage?: string | null;
  rowCount?: number | null;
}): MatrixLoadOutcome {
  if (input.plane === "demo") return "defaults";

  const err = input.errorMessage?.trim() ?? "";
  if (err) {
    const relationMissing = /does not exist|relation/i.test(err);
    if (relationMissing) {
      return input.plane === "live_production" ? "unavailable" : "defaults";
    }
    // RLS / network / unexpected — never authorize from silent defaults.
    return "unavailable";
  }

  const count = input.rowCount ?? 0;
  if (count <= 0) {
    return input.plane === "live_production" ? "unavailable" : "defaults";
  }

  return "database";
}
