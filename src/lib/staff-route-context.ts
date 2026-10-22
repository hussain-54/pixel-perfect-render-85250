import type { BusinessRole, PermissionMatrix } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";

/** Shape of staff layout route context used by specialty child beforeLoad hooks. */
export type StaffAuthContextSlice = {
  auth?: {
    role?: AppRole;
    businessRole?: BusinessRole | null;
  };
  permissionMatrix?: PermissionMatrix | null;
};

export function readStaffAuthContext(context: unknown): {
  appRole: AppRole | null;
  businessRole: BusinessRole | null;
  matrix: PermissionMatrix | null;
} {
  const ctx = context as StaffAuthContextSlice;
  return {
    appRole: ctx.auth?.role ?? null,
    businessRole: ctx.auth?.businessRole ?? null,
    matrix: ctx.permissionMatrix ?? null,
  };
}

/**
 * Prefer a freshly loaded authorization matrix over layout context.
 * Layout context can be stale across sibling navigations / open tabs after Admin edits.
 */
export function preferFreshPermissionMatrix(
  fresh: PermissionMatrix | null | undefined,
  fromContext: PermissionMatrix | null | undefined,
): PermissionMatrix | null {
  return fresh ?? fromContext ?? null;
}
