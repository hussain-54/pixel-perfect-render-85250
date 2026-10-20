/**
 * Front Desk student portal Auth provisioning rules.
 * Service-role clients must not UPDATE profiles.role / profiles.business_role
 * (enforce_profile_role_guard requires admin JWT — see …14030000).
 */

import { profileRoleGuardDenied } from "@/lib/profile-role-guard-rules";

export const STUDENT_PORTAL_BUSINESS_ROLE = "student_portal" as const;

/** Fields safe to patch via service-role after handle_new_user creates the profile. */
export const SERVICE_ROLE_SAFE_PROFILE_PATCH_FIELDS = ["email", "full_name", "phone"] as const;

export function serviceRoleMaySetBusinessRoleOnUpdate(): boolean {
  return false;
}

/**
 * Whether a service-role (auth.uid() null) UPDATE that touches role/business_role
 * would be rejected by enforce_profile_role_guard.
 */
export function serviceRoleProfileRoleUpdateDenied(input: {
  roleChanged: boolean;
  businessRoleChanged: boolean;
}): string | null {
  return profileRoleGuardDenied({
    callerAppRole: null,
    roleChanged: input.roleChanged,
    businessRoleChanged: input.businessRoleChanged,
  });
}

/** Build the profile patch Front Desk provisioning may send via service role. */
export function buildServiceRoleStudentProfilePatch(input: {
  email: string;
  fullName: string;
}): { email: string; full_name: string } {
  return {
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName.trim() || input.email.trim().toLowerCase(),
  };
}

/**
 * Profile rows eligible for idempotent link retry after a partial Auth create.
 * Staff / privileged business roles must never be reused as student logins.
 */
export function canReuseExistingStudentProfileForLink(input: {
  role: string | null | undefined;
  businessRole: string | null | undefined;
  profileLinkedStudentId: string | null | undefined;
  targetStudentId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.role && input.role !== "student") {
    return { ok: false, reason: "staff_role" };
  }
  if (
    input.businessRole &&
    input.businessRole !== STUDENT_PORTAL_BUSINESS_ROLE &&
    input.businessRole !== null
  ) {
    return { ok: false, reason: "staff_business_role" };
  }
  if (input.profileLinkedStudentId && input.profileLinkedStudentId !== input.targetStudentId) {
    return { ok: false, reason: "linked_other_student" };
  }
  return { ok: true };
}

export function provisionPartialFailureMessage(stage: "auth" | "profile" | "link"): string {
  switch (stage) {
    case "auth":
      return "Account creation failed before a login was created. No student portal account was linked.";
    case "profile":
      return "Login was created but profile setup failed. Retry provisioning to finish linking — do not create a second account for the same email.";
    case "link":
      return "Login exists but could not be linked to this CRM student. Retry linking or contact an administrator if the email is already used elsewhere.";
  }
}

/** This Front Desk path must never call invite or password-recovery email APIs. */
export function frontDeskProvisionSendsAuthEmail(): boolean {
  return false;
}
