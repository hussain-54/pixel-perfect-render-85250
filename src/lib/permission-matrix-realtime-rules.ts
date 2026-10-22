/**
 * Pure helpers for permission-matrix Realtime invalidation.
 * Events are never authorization — only a signal to refetch via trusted server path.
 */

import { isBusinessRole, type BusinessRole } from "@/lib/business-permissions";

export const STAFF_EFFECTIVE_ACCESS_QUERY_KEY = ["staff", "effective-access"] as const;
export const ADMIN_PERMISSION_MATRIX_QUERY_KEY = ["admin", "permission-matrix"] as const;

export type PermissionMatrixChangeRow = {
  business_role?: unknown;
  module?: unknown;
  permission_level?: unknown;
};

/** Whether a postgres_changes payload row affects the signed-in staff business role. */
export function permissionMatrixChangeAffectsBusinessRole(
  row: PermissionMatrixChangeRow | null | undefined,
  businessRole: BusinessRole | null | undefined,
): boolean {
  if (!businessRole || !isBusinessRole(businessRole)) return false;
  if (!row || typeof row !== "object") return false;
  return row.business_role === businessRole;
}

/**
 * Decide whether to invalidate effective-access after a Realtime matrix event.
 * Prefer filtering to the viewer's role; if role unknown, do not invalidate (fail closed).
 */
export function shouldInvalidateEffectiveAccessForMatrixEvent(input: {
  businessRole: BusinessRole | null | undefined;
  newRow?: PermissionMatrixChangeRow | null;
  oldRow?: PermissionMatrixChangeRow | null;
}): boolean {
  const { businessRole, newRow, oldRow } = input;
  if (!businessRole || !isBusinessRole(businessRole)) return false;
  return (
    permissionMatrixChangeAffectsBusinessRole(newRow, businessRole) ||
    permissionMatrixChangeAffectsBusinessRole(oldRow, businessRole)
  );
}

export type PermissionMatrixLiveStatus =
  "connecting" | "live" | "reconnecting" | "offline" | "unsupported";

/** Map Supabase channel subscribe status → UI/live status (testable). */
export function mapPermissionMatrixChannelStatus(
  status: string,
): Exclude<PermissionMatrixLiveStatus, "unsupported"> {
  if (status === "SUBSCRIBED") return "live";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") return "reconnecting";
  if (status === "CLOSED") return "offline";
  return "connecting";
}
