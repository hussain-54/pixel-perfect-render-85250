/**
 * Contract for write_audit_event EXECUTE grants (intake audit after registration).
 */

export const WRITE_AUDIT_EVENT_FN = "write_audit_event";

export const WRITE_AUDIT_GRANTS_MIGRATION =
  "20261017100000_write_audit_event_execute_grants.sql";

export const WRITE_AUDIT_FN_EXECUTE_ROLES = ["authenticated"] as const;
export const WRITE_AUDIT_FN_REVOKED_ROLES = ["public", "anon"] as const;

export function assertWriteAuditGrantsSql(sql: string): { ok: true } | { ok: false; error: string } {
  const normalized = sql.toLowerCase();
  if (!normalized.includes("write_audit_event")) {
    return { ok: false, error: "Must target write_audit_event." };
  }
  if (
    !/revoke\s+all\s+on\s+function\s+public\.write_audit_event\s*\([^)]*\)\s+from\s+public/.test(
      normalized,
    )
  ) {
    return { ok: false, error: "Must revoke from PUBLIC." };
  }
  if (
    !/revoke\s+all\s+on\s+function\s+public\.write_audit_event\s*\([^)]*\)\s+from\s+anon/.test(
      normalized,
    )
  ) {
    return { ok: false, error: "Must revoke from anon." };
  }
  if (
    !/grant\s+execute\s+on\s+function\s+public\.write_audit_event\s*\([^)]*\)\s+to\s+authenticated/.test(
      normalized,
    )
  ) {
    return { ok: false, error: "Must grant EXECUTE to authenticated." };
  }
  if (
    /grant\s+execute\s+on\s+function\s+public\.write_audit_event\s*\([^)]*\)\s+to\s+anon/.test(
      normalized,
    )
  ) {
    return { ok: false, error: "Must not GRANT EXECUTE to anon." };
  }
  if (/create\s+or\s+replace\s+function\s+public\.write_audit_event/.test(normalized)) {
    return { ok: false, error: "Grants migration must not replace function body." };
  }
  return { ok: true };
}

/** Map PostgREST/PG errors for audit failures after a successful intake create. */
export function mapWriteAuditPermissionError(raw: string): {
  isPermissionDenied: boolean;
  staffMessage: string;
} {
  const isPermissionDenied = /permission denied for function write_audit_event|42501/i.test(raw);
  return {
    isPermissionDenied,
    staffMessage: isPermissionDenied
      ? "Student was saved, but the audit log could not be written (missing database EXECUTE grant on write_audit_event). Apply migration 20261017100000_write_audit_event_execute_grants.sql. Do not re-register the same email."
      : "Student may have been saved, but audit logging failed. Check Intake list before retrying.",
  };
}
