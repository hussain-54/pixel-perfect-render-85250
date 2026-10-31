/**
 * Server-side staff business-role gates (Front Desk Phase 2 + Phase 3 matrix).
 * Always resolve business_role from TrustedSession / profiles — never from client body.
 */
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  cloneDefaultPermissionMatrix,
  getPermissionLevelFromMatrix,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
  type PermissionMatrix,
} from "@/lib/business-permissions";
import {
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

/**
 * Admission Team must never use the demo/mock CRM plane.
 * Real AO work requires Supabase auth + profiles.business_role = admission_team.
 */
export function forbidAdmissionMockDataPlane(session: TrustedSession): void {
  if (businessRoleFromSession(session) !== "admission_team") return;
  if (session.source === "supabase") return;
  throw new AuthError(
    "Admission Team requires a live staff sign-in connected to Supabase. Demo or mock Admission data is disabled.",
    403,
  );
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

export async function requireFrontDeskIntakePermission(
  session: TrustedSession,
): Promise<BusinessRole> {
  const businessRole = businessRoleFromSession(session);
  if (rolesAtLeastAdmin(session.role)) return businessRole ?? "admin";
  if (!businessRole) {
    throw new AuthError("You do not have permission to register students.", 403);
  }
  // Persisted matrix Students Edit — Admin revoke must stop intake registration.
  try {
    await requireModulePermission(session, "students", 2, "registering students");
  } catch (error) {
    if (error instanceof AuthError && error.status === 503) throw error;
    throw new AuthError("You do not have permission to register students.", 403);
  }
  return businessRole;
}

/**
 * Fee *recording* (claim) — Edit on fees_payments from the persisted matrix.
 * Does not grant verify/waive (Accounts workflow + requireSignupFeeVerifyPermission).
 */
export async function requireSignupFeeRecordPermission(session: TrustedSession): Promise<void> {
  await requireModulePermission(session, "fees_payments", 2, "recording signup fees");
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
  forbidAdmissionMockDataPlane(session);
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

/**
 * Pass when the caller meets any of the listed module minimums.
 * Used for shared desk actions (e.g. tasks/appointments) that Admission Team
 * operates via admissions Edit while Counsellors use students Edit.
 */
export async function requireAnyModulePermission(
  session: TrustedSession,
  options: Array<{ module: BusinessModule; minimum: PermissionLevel }>,
  actionLabel: string,
): Promise<void> {
  forbidAdmissionMockDataPlane(session);
  if (rolesAtLeastAdmin(session.role)) return;
  if (!options.length) {
    throw new AuthError(`You do not have permission for ${actionLabel}.`, 403);
  }

  const loaded = await loadAuthorizationMatrix(session);
  if (loaded.source === "unavailable") {
    throw new AuthError(
      "Permission matrix is temporarily unavailable. Try again or contact an administrator.",
      503,
    );
  }

  const businessRole = businessRoleFromSession(session);
  if (!businessRole) {
    throw new AuthError(
      "Your business role is not configured. Contact an administrator before continuing.",
      403,
    );
  }

  for (const opt of options) {
    const level = getPermissionLevelFromMatrix(loaded.matrix, businessRole, opt.module);
    if (level >= opt.minimum) return;
  }
  throw new AuthError(`You do not have permission for ${actionLabel}.`, 403);
}
