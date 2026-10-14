/**
 * Server-side staff business-role gates (Front Desk Phase 2).
 * Always resolve business_role from TrustedSession / profiles — never from client body.
 */
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  canEditModule,
  hasMinPermission,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
} from "@/lib/business-permissions";
import {
  canPerformFrontDeskIntake,
  canRecordIntakeSignupFee,
  canVerifySignupFeeAction,
  isFrontDeskBusinessRole,
  normalizeTrustedBusinessRole,
} from "@/lib/staff-business-access";

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
 * Phase 3 — enforce approved business-role × module matrix on server actions.
 * Technical admin/super_admin bypass. Uses TrustedSession.businessRole only
 * (profiles), never client-supplied roles. Default matrix when DB matrix unavailable
 * at call site — callers that load DB matrix may pass resolved role on session.
 */
export function requireModulePermission(
  session: TrustedSession,
  module: BusinessModule,
  minimum: PermissionLevel,
  actionLabel?: string,
): void {
  if (rolesAtLeastAdmin(session.role)) return;
  const businessRole = businessRoleFromSession(session);
  if (!businessRole) {
    throw new AuthError(
      "Your business role is not configured. Contact an administrator before continuing.",
      403,
    );
  }
  if (!hasMinPermission(businessRole, module, minimum)) {
    const label = actionLabel ?? module;
    throw new AuthError(`You do not have permission for ${label}.`, 403);
  }
}
