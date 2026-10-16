/**
 * Specialty desk portal access — HR / Digital / Accounts / Office Ops / Manager.
 *
 * Architecture (smallest safe fix):
 * - Technical appRole stays `consultant` (RLS is_consultant, desk FKs unchanged).
 * - Module UIs live under `/staff/*` mirrors — NOT by opening `/admin` to consultants.
 * - Admin/super_admin remain the only appRoles for `/admin`.
 * - Server matrix + RLS stay authoritative; this file only drives nav/home/route allowlists.
 */
import {
  canViewModule,
  type BusinessModule,
  type BusinessRole,
} from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";

export type SpecialtyStaffPath =
  | "/staff/hr"
  | "/staff/marketing"
  | "/staff/finance"
  | "/staff/banking"
  | "/staff/operations"
  | "/staff/reports";

export type StaffLandingPath =
  | "/staff/dashboard"
  | "/staff/front-desk"
  | SpecialtyStaffPath;

/** Desks whose primary work is specialty modules (not counsellor CRM). */
export const SPECIALTY_ONLY_BUSINESS_ROLES = [
  "accounts_banking_finance",
  "hr_system",
  "digital_manager",
  "office_ops",
] as const;

export type SpecialtyOnlyBusinessRole = (typeof SPECIALTY_ONLY_BUSINESS_ROLES)[number];

export type SpecialtyNavDef = {
  to: SpecialtyStaffPath;
  label: string;
  module: BusinessModule;
};

/** Module routes available inside the staff shell for specialty/manager desks. */
export const SPECIALTY_STAFF_NAV: readonly SpecialtyNavDef[] = [
  { to: "/staff/finance", label: "Fees & Payments", module: "fees_payments" },
  { to: "/staff/banking", label: "Banking & Finance", module: "banking_finance" },
  { to: "/staff/hr", label: "HR & Attendance", module: "hr_attendance" },
  { to: "/staff/marketing", label: "Digital Marketing", module: "digital_marketing" },
  { to: "/staff/operations", label: "Office Ops", module: "orders_sales_purchase" },
  { to: "/staff/reports", label: "Reports", module: "reports" },
] as const;

export function isSpecialtyOnlyBusinessRole(
  businessRole: BusinessRole | null | undefined,
): businessRole is SpecialtyOnlyBusinessRole {
  return (
    businessRole === "accounts_banking_finance" ||
    businessRole === "hr_system" ||
    businessRole === "digital_manager" ||
    businessRole === "office_ops"
  );
}

export function specialtyNavForBusinessRole(
  businessRole: BusinessRole | null | undefined,
): SpecialtyNavDef[] {
  if (!businessRole) return [];
  return SPECIALTY_STAFF_NAV.filter((item) => canViewModule(businessRole, item.module));
}

/** Landing path after sign-in for consultant appRole + business_role. */
export function staffLandingPathForBusinessRole(
  appRole: AppRole,
  businessRole: BusinessRole | null | undefined,
): StaffLandingPath | "/admin/dashboard" | "/student/dashboard" {
  if (appRole === "student") return "/student/dashboard";
  if (rolesAtLeastAdmin(appRole)) return "/admin/dashboard";
  if (businessRole === "front_desk_student_affairs") return "/staff/front-desk";

  switch (businessRole) {
    case "hr_system":
      return "/staff/hr";
    case "digital_manager":
      return "/staff/marketing";
    case "accounts_banking_finance":
      return "/staff/finance";
    case "office_ops":
      return "/staff/operations";
    default:
      return "/staff/dashboard";
  }
}

/**
 * Module required for a specialty staff path (null = not a specialty module path).
 */
export function specialtyModuleForPath(path: string): BusinessModule | null {
  const hit = SPECIALTY_STAFF_NAV.find(
    (item) => path === item.to || path.startsWith(`${item.to}/`),
  );
  return hit?.module ?? null;
}

/**
 * Whether a specialty-only desk may open this staff path.
 * Counsellor CRM paths are denied; specialty module paths require matrix View.
 */
export function specialtyOnlyPathAllowed(
  businessRole: BusinessRole | null | undefined,
  path: string,
): boolean {
  if (!isSpecialtyOnlyBusinessRole(businessRole)) return true;
  if (path === "/staff" || path === "/staff/") return true;
  if (path === "/change-password" || path.startsWith("/change-password")) return true;

  const module = specialtyModuleForPath(path);
  if (module) return canViewModule(businessRole, module);

  // Deny counsellor CRM / FD paths for specialty-only desks.
  return false;
}

/** Manager keeps CRM nav and also receives specialty module links. */
export function shouldIncludeCounsellorCrmNav(
  businessRole: BusinessRole | null | undefined,
): boolean {
  if (!businessRole) return true; // fail open to counsellor desk when role unset
  if (businessRole === "front_desk_student_affairs") return false;
  if (isSpecialtyOnlyBusinessRole(businessRole)) return false;
  return true; // counsellor, admission_team, manager
}

export function consultantMayAccessAdminPortal(): boolean {
  // Explicit product rule: never open /admin via consultant appRole.
  return false;
}
