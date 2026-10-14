/**
 * Pure mirror of enforce_profile_role_guard after …14030000.
 * Does not prove remote triggers — unit-locks intended admin-only role mutations.
 */

export type AppRoleGuard = "student" | "consultant" | "admin" | "super_admin";

export type BusinessRoleGuard =
  | "front_desk_student_affairs"
  | "counsellor_consultant"
  | "admission_team"
  | "student_portal"
  | "accounts_banking_finance"
  | "hr_system"
  | "digital_manager"
  | "office_ops"
  | "manager"
  | "admin"
  | null;

function isAdminAppRole(role: AppRoleGuard | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Returns error message when the UPDATE must be denied; null when allowed.
 * Mirrors: non-admin cannot change profiles.role or profiles.business_role.
 */
export function profileRoleGuardDenied(input: {
  callerAppRole: AppRoleGuard | null;
  /** When auth.uid() is null (service_role), caller lookup yields null — denied. */
  roleChanged: boolean;
  businessRoleChanged: boolean;
}): string | null {
  if (input.roleChanged && !isAdminAppRole(input.callerAppRole)) {
    return "Role changes require admin privileges";
  }
  if (input.businessRoleChanged && !isAdminAppRole(input.callerAppRole)) {
    return "Business role changes require admin privileges";
  }
  return null;
}

/** Negative cases: self-promotion targets that must be blocked for non-admins. */
export const PRIVILEGED_BUSINESS_ROLE_SELF_PROMOTE_TARGETS: readonly BusinessRoleGuard[] = [
  "front_desk_student_affairs",
  "manager",
  "accounts_banking_finance",
  "admin",
  "admission_team",
  "counsellor_consultant",
];
