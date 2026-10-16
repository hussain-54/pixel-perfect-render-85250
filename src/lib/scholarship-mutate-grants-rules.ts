/**
 * Local contract for scholarships mutate helper EXECUTE grants.
 * Does not prove remote ACL — owner must apply migration and verify.
 */

export const SCHOLARSHIPS_MUTATE_FN = "can_mutate_scholarships_catalog";

export const SCHOLARSHIPS_MUTATE_GRANTS_MIGRATION =
  "20261016120000_scholarships_mutate_fn_grants_harden.sql";

export const SCHOLARSHIPS_MUTATE_RLS_MIGRATION =
  "20261016110000_scholarships_mutate_rls_tighten.sql";

/** Roles that may receive EXECUTE after hardening (app + RLS callers). */
export const SCHOLARSHIPS_MUTATE_FN_EXECUTE_ROLES = ["authenticated"] as const;

/** Roles that must not retain EXECUTE. */
export const SCHOLARSHIPS_MUTATE_FN_REVOKED_ROLES = ["public", "anon"] as const;

/** Business roles that the SECURITY DEFINER body treats as mutate-capable. */
export const SCHOLARSHIPS_MUTATE_FN_BUSINESS_ROLES = [
  "admission_team",
  "manager",
  "admin",
] as const;

export function scholarshipsMutateFnAllowsBusinessRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (SCHOLARSHIPS_MUTATE_FN_BUSINESS_ROLES as readonly string[]).includes(role);
}

/**
 * Static checks on migration SQL text (regression against accidental re-grant to anon).
 */
export function assertScholarshipsMutateGrantsSql(sql: string): {
  ok: true;
} | {
  ok: false;
  error: string;
} {
  const normalized = sql.toLowerCase();
  if (!normalized.includes("can_mutate_scholarships_catalog")) {
    return { ok: false, error: "Migration must target can_mutate_scholarships_catalog." };
  }
  if (!/revoke\s+all\s+on\s+function\s+public\.can_mutate_scholarships_catalog\s*\(\s*\)\s+from\s+public/.test(normalized)) {
    return { ok: false, error: "Must revoke ALL/EXECUTE from PUBLIC." };
  }
  if (!/revoke\s+all\s+on\s+function\s+public\.can_mutate_scholarships_catalog\s*\(\s*\)\s+from\s+anon/.test(normalized)) {
    return { ok: false, error: "Must revoke ALL/EXECUTE from anon." };
  }
  if (!/grant\s+execute\s+on\s+function\s+public\.can_mutate_scholarships_catalog\s*\(\s*\)\s+to\s+authenticated/.test(normalized)) {
    return { ok: false, error: "Must grant EXECUTE to authenticated." };
  }
  // Must not re-open anon after revoke.
  const grantAnon = /grant\s+execute\s+on\s+function\s+public\.can_mutate_scholarships_catalog\s*\(\s*\)\s+to\s+anon/.test(
    normalized,
  );
  if (grantAnon) {
    return { ok: false, error: "Must not GRANT EXECUTE to anon." };
  }
  // Do not rewrite function body / RLS in this grants-only migration.
  if (/create\s+or\s+replace\s+function\s+public\.can_mutate_scholarships_catalog/.test(normalized)) {
    return { ok: false, error: "Grants migration must not replace function body." };
  }
  if (/create\s+policy\s+scholarships_(insert|update)/.test(normalized)) {
    return { ok: false, error: "Grants migration must not recreate RLS policies." };
  }
  return { ok: true };
}
