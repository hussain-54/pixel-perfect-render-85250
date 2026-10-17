/**
 * Contract for business_module_permissions RLS — authz SELECT vs admin writes.
 */

export const BUSINESS_MODULE_PERMISSIONS_SELECT_MIGRATION =
  "20261017120000_business_module_permissions_select_authenticated.sql";

export function assertBusinessModulePermissionsSelectSql(
  sql: string,
): { ok: true } | { ok: false; error: string } {
  const normalized = sql.toLowerCase();
  if (!normalized.includes("business_module_permissions")) {
    return { ok: false, error: "Must target business_module_permissions." };
  }
  if (
    !/create\s+policy\s+business_module_permissions_select_authenticated/.test(normalized)
  ) {
    return { ok: false, error: "Must create select_authenticated policy." };
  }
  if (!/for\s+select/.test(normalized) || !/to\s+authenticated/.test(normalized)) {
    return { ok: false, error: "SELECT policy must be for authenticated." };
  }
  if (!/auth\.uid\(\)\s+is\s+not\s+null/.test(normalized)) {
    return { ok: false, error: "SELECT policy must require auth.uid()." };
  }
  if (
    /grant\s+[\s\S]{0,80}on\s+[\s\S]{0,80}business_module_permissions[\s\S]{0,40}to\s+(public|anon)/.test(
      normalized,
    )
  ) {
    return { ok: false, error: "Must not grant table access to PUBLIC or anon." };
  }
  return { ok: true };
}

/** Staff-facing copy when authorization matrix cannot be loaded in production. */
export function permissionMatrixUnavailableMessage(): string {
  return "Permission matrix is temporarily unavailable. Try again or contact an administrator.";
}
