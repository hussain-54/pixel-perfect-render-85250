/**
 * Server-side staff business-role gates (Front Desk Phase 2 + Phase 3 matrix).
 * Always resolve business_role from TrustedSession / profiles — never from client body.
 */
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  canEditModule,
  cloneDefaultPermissionMatrix,
  getPermissionLevelFromMatrix,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
  type PermissionMatrix,
} from "@/lib/business-permissions";
import {
  canPerformFrontDeskIntake,
  canRecordIntakeSignupFee,
  canVerifySignupFeeAction,
  isFrontDeskBusinessRole,
  normalizeTrustedBusinessRole,
} from "@/lib/staff-business-access";
import { loadAuthorizationMatrix } from "@/server/permission-matrix-store";

/**
 * Prefer session.businessRole (resolved at auth from profiles).
 * Fail closed to null — do not map consultant → counsellor here.
 */
export function businessRoleFromSession(session: TrustedSession): BusinessRole | null {
  return normalizeTrustedBusinessRole(session.businessRole);
}

/** Deny Front Desk from consultant / admission / privileged staff modules. */
export function denyFrontDeskConsultantWorkflows(
  session: TrustedSession,
  actionLabel = "this action",
): void {
  const businessRole = businessRoleFromSession(session);
  if (isFrontDeskBusinessRole(businessRole)) {
    throw new AuthError(`Front Desk is not authorized for ${actionLabel}.`, 403);
  }
}

/** Require configured business role for consultant desk operations that need one. */
export function requireConfiguredStaffBusinessRole(session: TrustedSession): BusinessRole {
  if (rolesAtLeastAdmin(session.role)) {
    return businessRoleFromSession(session) ?? "admin";
  }
  const br = businessRoleFromSession(session);
  if (!br) {
    throw new AuthError(
      "Your business role is not configured. Contact an administrator before continuing.",
      403,
    );
  }
  return br;
}

export function requireFrontDeskIntakePermission(session: TrustedSession): BusinessRole {
  const businessRole = businessRoleFromSession(session);
  if (
    !canPerformFrontDeskIntake({
      appRole: session.role,
      businessRole,
    }) &&
    !rolesAtLeastAdmin(session.role)
  ) {
    // Counsellors / admission with students Edit may still register via intake.
    if (session.role === "consultant" && businessRole && canEditModule(businessRole, "students")) {
      return businessRole;
    }
    throw new AuthError("You do not have permission to register students.", 403);
  }
  if (rolesAtLeastAdmin(session.role)) return businessRole ?? "admin";
  if (!businessRole) {
    throw new AuthError("You do not have permission to register students.", 403);
  }
  return businessRole;
}

export function requireSignupFeeRecordPermission(session: TrustedSession): void {
  const businessRole = businessRoleFromSession(session);
  if (
    !canRecordIntakeSignupFee({
      appRole: session.role,
      businessRole,
    })
  ) {
    throw new AuthError("You do not have permission to record signup fees.", 403);
  }
}

export function requireSignupFeeVerifyPermission(session: TrustedSession): void {
  const businessRole = businessRoleFromSession(session);
  if (
    !canVerifySignupFeeAction({
      appRole: session.role,
      businessRole,
    })
  ) {
    throw new AuthError("You do not have permission to verify signup fees.", 403);
  }
}

export function assertFrontDeskOrAdmin(session: TrustedSession): void {
  if (rolesAtLeastAdmin(session.role)) return;
  if (!isFrontDeskBusinessRole(businessRoleFromSession(session))) {
    throw new AuthError("Front Desk access required.", 403);
  }
}

/**
 * Front Desk coordination queue + Accounts/Finance fee verifiers (and admin).
 * Does not grant fee VERIFY — that remains requireSignupFeeVerifyPermission.
 */
export function assertFrontDeskOrFeeVerifierOrAdmin(session: TrustedSession): void {
  if (rolesAtLeastAdmin(session.role)) return;
  const businessRole = businessRoleFromSession(session);
  if (isFrontDeskBusinessRole(businessRole)) return;
  if (
    canVerifySignupFeeAction({
      appRole: session.role,
      businessRole,
    })
  ) {
    return;
  }
  throw new AuthError("Front Desk or Accounts/Finance access required.", 403);
}

/**
 * Synchronous matrix check (unit tests + callers with a resolved matrix).
 * Technical admin/super_admin bypass. Never trusts client-supplied roles.
 */
export function assertModulePermission(
  session: TrustedSession,
  module: BusinessModule,
  minimum: PermissionLevel,
  actionLabel?: string,
  matrix: PermissionMatrix = cloneDefaultPermissionMatrix(),
): void {
  if (rolesAtLeastAdmin(session.role)) return;
  const businessRole = businessRoleFromSession(session);
  if (!businessRole) {
    throw new AuthError(
      "Your business role is not configured. Contact an administrator before continuing.",
      403,
    );
  }
  const level = getPermissionLevelFromMatrix(matrix, businessRole, module);
  if (level < minimum) {
    const label = actionLabel ?? module;
    throw new AuthError(`You do not have permission for ${label}.`, 403);
  }
}

/**
 * Phase 3 — enforce approved business-role × module matrix on server actions.
 * Loads the authorization matrix (DB authoritative on live plane when available).
 */
export async function requireModulePermission(
  session: TrustedSession,
  module: BusinessModule,
  minimum: PermissionLevel,
  actionLabel?: string,
): Promise<void> {
  if (rolesAtLeastAdmin(session.role)) return;

  const loaded = await loadAuthorizationMatrix(session);
  if (loaded.source === "unavailable") {
    throw new AuthError(
      "Permission matrix is temporarily unavailable. Try again or contact an administrator.",
      503,
    );
  }

  assertModulePermission(session, module, minimum, actionLabel, loaded.matrix);
}
