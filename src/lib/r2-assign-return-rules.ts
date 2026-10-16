/**
 * R2 — front_desk_assign_counsellor narrow return contract (…14080000).
 * Mirrors local migration + Database types; does not prove remote apply.
 */

import {
  FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS,
  FRONT_DESK_ASSIGN_RETURN_COLUMNS,
} from "./student-staff-field-rules";

export const R2_MIGRATION_FILENAME =
  "20261014080000_front_desk_assign_counsellor_narrow_return.sql" as const;

/** Production catalog residual until …14080000 is applied. */
export const R2_PRODUCTION_RETURN = "public.students" as const;

export const R2_NARROW_RETURN_COLUMNS = FRONT_DESK_ASSIGN_RETURN_COLUMNS;
export const R2_SENSITIVE_EXCLUDED_COLUMNS = FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS;

export function assignRpcResultHasSensitiveColumn(
  columns: readonly string[],
  sensitive: string = "dob",
): boolean {
  return columns.includes(sensitive);
}

export function assignRpcResultIsNarrow(columns: readonly string[]): boolean {
  if (columns.length !== R2_NARROW_RETURN_COLUMNS.length) return false;
  const set = new Set(columns);
  for (const col of R2_NARROW_RETURN_COLUMNS) {
    if (!set.has(col)) return false;
  }
  for (const col of R2_SENSITIVE_EXCLUDED_COLUMNS) {
    if (set.has(col)) return false;
  }
  return true;
}

export const R2_REMOTE_PROOF_REQUIRED = [
  "pg_get_function_result(front_desk_assign_counsellor(uuid,uuid)) is TABLE/narrow — not students",
  "FD JWT rpc assign: response keys exclude dob, portal_activated_at, profile_id, registration_notes",
  "FD JWT rpc assign still updates assigned_consultant_id on owned row",
  "anon EXECUTE denied; authenticated EXECUTE granted",
] as const;
