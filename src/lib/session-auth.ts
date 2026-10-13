/**
 * Pure helpers for portal session / JWT handling (unit-testable).
 * Never log tokens.
 */

/** True when the access token should be refreshed before the next server call. */
export function accessTokenNeedsRefresh(
  expiresAtSec: number | null | undefined,
  nowMs: number = Date.now(),
  skewMs: number = 60_000,
): boolean {
  if (expiresAtSec == null || !Number.isFinite(expiresAtSec)) return false;
  return expiresAtSec * 1000 <= nowMs + skewMs;
}

/** Map Auth API failures to a safe client-facing message (no token material). */
export function sessionValidationFailureMessage(authErrorMessage?: string | null): string {
  const raw = (authErrorMessage ?? "").toLowerCase();
  if (
    raw.includes("session_not_found") ||
    raw.includes("session from session_id") ||
    raw.includes("session missing") ||
    raw.includes("auth session missing")
  ) {
    return "Invalid or expired session. Please sign in again.";
  }
  if (raw.includes("expired") || raw.includes("invalid jwt") || raw.includes("invalid claim")) {
    return "Invalid or expired session. Please sign in again.";
  }
  return "Invalid or expired session. Please sign in again.";
}

export type RoleRedirectCase = {
  role: "student" | "consultant" | "admin" | "super_admin";
  expectedHome: "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";
};

export const ROLE_REDIRECT_CASES: readonly RoleRedirectCase[] = [
  { role: "student", expectedHome: "/student/dashboard" },
  { role: "consultant", expectedHome: "/staff/dashboard" },
  { role: "admin", expectedHome: "/admin/dashboard" },
  { role: "super_admin", expectedHome: "/admin/dashboard" },
] as const;

/** Forced first-login password change must never block portal entry. */
export function shouldForcePasswordChangeOnLogin(_appMetadata: unknown): boolean {
  return false;
}
