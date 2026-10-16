/**
 * Employee/account provisioning role options — mirrors existing enums only.
 * Never invents roles. Never offers super_admin for routine creation.
 */
import type { AppRole } from "@/lib/roles";
import { wouldRemoveLastProtectedAdmin, type BusinessRole } from "@/lib/business-permissions";

export type AccountProvisioningOption = {
  id: BusinessRole;
  label: string;
  appRole: AppRole;
  businessRole: BusinessRole;
  needsConsultantDesk: boolean;
  departmentSuggested?: string;
};

/** Allowed employee creation options (no super_admin). */
export const ACCOUNT_PROVISIONING_OPTIONS: readonly AccountProvisioningOption[] = [
  {
    id: "student_portal",
    label: "Student",
    appRole: "student",
    businessRole: "student_portal",
    needsConsultantDesk: false,
  },
  {
    id: "front_desk_student_affairs",
    label: "Front Desk",
    appRole: "consultant",
    businessRole: "front_desk_student_affairs",
    needsConsultantDesk: true,
    departmentSuggested: "Student Affairs",
  },
  {
    id: "counsellor_consultant",
    label: "Counsellor",
    appRole: "consultant",
    businessRole: "counsellor_consultant",
    needsConsultantDesk: true,
    departmentSuggested: "Counselling",
  },
  {
    id: "admission_team",
    label: "Admission Team",
    appRole: "consultant",
    businessRole: "admission_team",
    needsConsultantDesk: true,
    departmentSuggested: "Admissions",
  },
  {
    id: "accounts_banking_finance",
    label: "Accounts & Finance",
    appRole: "consultant",
    businessRole: "accounts_banking_finance",
    needsConsultantDesk: true,
    departmentSuggested: "Finance",
  },
  {
    id: "hr_system",
    label: "HR",
    appRole: "consultant",
    businessRole: "hr_system",
    needsConsultantDesk: true,
    departmentSuggested: "Human Resources",
  },
  {
    id: "digital_manager",
    label: "Digital Manager",
    appRole: "consultant",
    businessRole: "digital_manager",
    needsConsultantDesk: true,
    departmentSuggested: "Marketing",
  },
  {
    id: "office_ops",
    label: "Office Operations",
    appRole: "consultant",
    businessRole: "office_ops",
    needsConsultantDesk: true,
    departmentSuggested: "Operations",
  },
  {
    id: "manager",
    label: "Manager",
    appRole: "consultant",
    businessRole: "manager",
    needsConsultantDesk: true,
    departmentSuggested: "Management",
  },
  {
    id: "admin",
    label: "Admin",
    appRole: "admin",
    businessRole: "admin",
    needsConsultantDesk: false,
  },
] as const;

export function getProvisioningOption(businessRole: string): AccountProvisioningOption | null {
  return ACCOUNT_PROVISIONING_OPTIONS.find((o) => o.businessRole === businessRole) ?? null;
}

export function normalizeWorkEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidWorkEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeWorkEmail(email));
}

export function isValidPersonName(name: string): boolean {
  return name.trim().length >= 2;
}

/** Routine creation never allows super_admin. */
export function isCreatableAppRole(role: string): role is Exclude<AppRole, "super_admin"> {
  return role === "student" || role === "consultant" || role === "admin";
}

export function assertRolePair(appRole: AppRole, businessRole: BusinessRole): void {
  const option = getProvisioningOption(businessRole);
  if (!option) {
    throw new Error("Unsupported business role.");
  }
  if (option.appRole !== appRole) {
    throw new Error(
      `Business role ${businessRole} must use app role ${option.appRole}, not ${appRole}.`,
    );
  }
  if (appRole === "super_admin") {
    throw new Error("super_admin cannot be assigned through employee account creation.");
  }
}

export function appRoleForBusinessRole(businessRole: BusinessRole): AppRole {
  const option = getProvisioningOption(businessRole);
  if (!option) throw new Error("Unsupported business role.");
  return option.appRole;
}

/**
 * Pure guards for reassigning an existing account's business role (no Auth calls).
 * Used by portalUpdateAccountBusinessRole and unit tests.
 */
export function validateAccountRoleUpdate(input: {
  targetAppRole: string;
  nextBusinessRole: string;
  isSelf: boolean;
  protectedAdminCount: number;
}):
  | {
      ok: true;
      appRole: AppRole;
      businessRole: BusinessRole;
      needsConsultantDesk: boolean;
      option: AccountProvisioningOption;
    }
  | { ok: false; error: string; status: number } {
  if (input.targetAppRole === "super_admin") {
    return {
      ok: false,
      error: "super_admin accounts cannot be reassigned through this form.",
      status: 403,
    };
  }

  const option = getProvisioningOption(input.nextBusinessRole);
  if (!option) {
    return { ok: false, error: "Unsupported business role.", status: 400 };
  }
  try {
    assertRolePair(option.appRole, option.businessRole);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid role pair.",
      status: 400,
    };
  }
  // ACCOUNT_PROVISIONING_OPTIONS never includes super_admin; assertRolePair also blocks it.

  const targetIsProtectedAdmin =
    input.targetAppRole === "admin" || input.targetAppRole === "super_admin";
  const nextIsProtectedAdmin = option.appRole === "admin";

  if (input.isSelf && targetIsProtectedAdmin && !nextIsProtectedAdmin) {
    return {
      ok: false,
      error: "You cannot demote your own admin access.",
      status: 403,
    };
  }

  const guard = wouldRemoveLastProtectedAdmin({
    protectedAdminCount: input.protectedAdminCount,
    targetIsProtectedAdmin,
    nextIsProtectedAdmin,
  });
  if (!guard.ok) {
    return { ok: false, error: guard.error, status: 403 };
  }

  return {
    ok: true,
    appRole: option.appRole,
    businessRole: option.businessRole,
    needsConsultantDesk: option.needsConsultantDesk,
    option,
  };
}

export type AccountListItem = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  appRole: AppRole;
  businessRole: string | null;
  department: string | null;
  deskStatus: "active" | "inactive" | "n/a";
  createdAt: string | null;
  lastSignInAt: string | null;
  invited: boolean;
};
