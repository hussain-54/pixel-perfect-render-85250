/**
 * Staff business-role access helpers (Front Desk Phase 2).
 * Pure / testable — server handlers remain authoritative.
 * Never trust client-supplied business roles as input to these helpers.
 */

import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  canEditModule,
  canViewModule,
  canViewModuleInMatrix,
  isBusinessRole,
  type BusinessModule,
  type BusinessRole,
  type PermissionMatrix,
} from "@/lib/business-permissions";
import {
  specialtyModuleForPath,
  staffLandingPathForBusinessRole,
} from "@/lib/specialty-desk-access";

/**
 * Modules Front Desk must not reach via counsellor CRM / admin workflows
 * regardless of matrix View. Specialty desk modules (fees, banking, HR, …)
 * are controlled by the persisted Admin matrix instead — see
 * `frontDeskPathAllowedWithMatrix` / specialty nav.
 */
export const FRONT_DESK_DENIED_MODULES = [
  "admissions",
  "counselling", // view in matrix ≠ assessment / private notes / full counselling workspace
  "users_roles",
  "settings",
] as const;

/**
 * Specialty modules that used to be hard-denied for Front Desk even when Admin
 * granted View. Kept for regression documentation; runtime nav uses the matrix.
 */
export const FRONT_DESK_LEGACY_SPECIALTY_DENY_MODULES = [
  "banking_finance",
  "hr_attendance",
  "digital_marketing",
  "orders_sales_purchase",
] as const;

export type FrontDeskDeniedModule = (typeof FRONT_DESK_DENIED_MODULES)[number];

/**
 * Staff routes Front Desk must not open.
 * Keep in sync with `src/routes/staff/route.tsx` beforeLoad (single source of truth for tests).
 */
export const FRONT_DESK_DENIED_PATH_PREFIXES = [
  "/staff/applications",
  "/staff/documents",
  "/staff/offers",
  "/staff/tasks",
  "/staff/leads",
  "/staff/reports",
  "/staff/activity",
  "/staff/students", // roster + detailed workspace
  "/staff/appointments",
  "/staff/dashboard",
] as const;

export function isFrontDeskBusinessRole(businessRole: BusinessRole | null | undefined): boolean {
  return businessRole === "front_desk_student_affairs";
}

export function isCounsellorBusinessRole(businessRole: BusinessRole | null | undefined): boolean {
  return businessRole === "counsellor_consultant";
}

/**
 * Trusted profiles.business_role only. Invalid/missing → null (fail closed for FD gates).
 * Does not map technical consultant → counsellor.
 */
export function normalizeTrustedBusinessRole(value: unknown): BusinessRole | null {
  if (!isBusinessRole(value)) return null;
  return value;
}

/** Staff/admin/student landing — specialty desks land on their module under `/staff`. */
export function staffHomeForBusinessRole(
  appRole: AppRole,
  businessRole: BusinessRole | null | undefined,
): ReturnType<typeof staffLandingPathForBusinessRole> {
  return staffLandingPathForBusinessRole(appRole, businessRole);
}

export function frontDeskNavAllowed(path: string): boolean {
  const allowed = ["/staff/front-desk", "/staff/register", "/staff/intake", "/change-password"];
  // `/staff/intake/:id` is covered by the `/staff/intake` prefix check below.
  if (allowed.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  return false;
}

/**
 * Front Desk path deny list. When `matrix` is provided, specialty module paths
 * (`/staff/finance`, `/staff/banking`, …) follow Admin-persisted View access
 * except `/staff/reports` which remains hard-denied for Front Desk.
 */
export function isFrontDeskDeniedPath(
  path: string,
  matrix?: PermissionMatrix | null,
  businessRole: BusinessRole | null | undefined = "front_desk_student_affairs",
): boolean {
  if (frontDeskNavAllowed(path)) return false;
  // Bare /staff index is OK (layout); dashboard itself is denied and redirects to front-desk.
  if (path === "/staff" || path === "/staff/") return false;

  // Reports + Digital Marketing stay hard-denied for Front Desk (product/server denies).
  if (path === "/staff/reports" || path.startsWith("/staff/reports/")) return true;
  if (path === "/staff/marketing" || path.startsWith("/staff/marketing/")) return true;

  const specialtyModule = specialtyModuleForPath(path);
  if (specialtyModule) {
    if (matrix) {
      return !canViewModuleInMatrix(matrix, businessRole, specialtyModule);
    }
    // Without a matrix, use compile-time defaults (FD already has fees_payments View).
    return !canViewModule(businessRole, specialtyModule);
  }

  return FRONT_DESK_DENIED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix),
  );
}

/**
 * Students Edit required for Front Desk intake register/update of intake fields.
 * Admins always allowed. Missing business role fails closed for consultants.
 */
export function canPerformFrontDeskIntake(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null | undefined;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (!isFrontDeskBusinessRole(input.businessRole)) return false;
  return canEditModule(input.businessRole, "students");
}

/**
 * Fee *recording* (claim) for intake — Edit on fees_payments.
 * Does not grant verify/waive/approve (Full/Approve + Accounts workflow).
 */
export function canRecordIntakeSignupFee(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null | undefined;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (isFrontDeskBusinessRole(input.businessRole)) {
    return canEditModule(input.businessRole, "fees_payments");
  }
  // Existing counsellor/admission paths use broader intake rules elsewhere.
  return canEditModule(input.businessRole, "fees_payments");
}

export function canVerifySignupFeeAction(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null | undefined;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (isFrontDeskBusinessRole(input.businessRole)) return false;
  return (
    input.businessRole === "accounts_banking_finance" ||
    input.businessRole === "manager" ||
    input.businessRole === "admin"
  );
}

/**
 * M1 residual: students_select_intake_registrar until …14060000 is applied + REST-proven.
 * Local drop migration prepared (Option 5); do not claim fixed without staging JWT deny.
 * See m1-registrar-select-rules.ts / docs/testing/M1-REGISTRAR-SELECT-FOLLOWUP.md.
 */
/** Columns safe for Front Desk intake summaries (server-enforced select list). */
export const FRONT_DESK_INTAKE_SELECT_COLUMNS = [
  "id",
  "case_id",
  "full_name",
  "email",
  "phone",
  "whatsapp",
  "city",
  "destination",
  "program",
  "study_level",
  "inquiry_source",
  "inquiry_channel",
  "intake_date",
  "registration_notes",
  "next_follow_up_at",
  "assigned_consultant_id",
  "registered_by",
  "journey_stage",
  "portal_activated_at",
  "archived_at",
  "created_at",
  "updated_at",
] as const;

export type FrontDeskIntakeSelectColumn = (typeof FRONT_DESK_INTAKE_SELECT_COLUMNS)[number];

export function assertNoClientOwnershipEscalation(input: {
  clientRegisteredBy?: string | null | undefined;
  sessionUserId: string | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (input.clientRegisteredBy != null && input.clientRegisteredBy !== "") {
    return {
      ok: false,
      error: "Ownership cannot be supplied by the client.",
    };
  }
  if (!input.sessionUserId) {
    return { ok: false, error: "Authenticated user required for intake ownership." };
  }
  return { ok: true };
}

export function moduleDeniedForFrontDesk(module: BusinessModule): boolean {
  return (FRONT_DESK_DENIED_MODULES as readonly string[]).includes(module);
}

/**
 * Who may call list_active_counsellor_desks (aligned with remediated Phase 2 RPC).
 * Manager has students Full and reassignment paths in app — not all consultants.
 */
export function canListCounsellorDesksForSession(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null | undefined;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (isFrontDeskBusinessRole(input.businessRole)) return true;
  if (input.businessRole === "manager") return true;
  return false;
}
