/**
 * Approved business-role × module permission foundation (Phase 3A).
 *
 * Pure, testable matrix evaluation only. Does not replace portal-auth /
 * requireRoles / RLS. Server actions remain authoritative when wired later.
 * Local checks alone do not enforce production security.
 *
 * Trusted technical AppRole → business role mapping is intentional and narrow.
 * Display labels and client-supplied role strings must never be used as input.
 */

import type { AppRole } from "@/lib/roles";

/** Permission levels from the approved Role-Based Access source. */
export type PermissionLevel = 0 | 1 | 2 | 3;

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  0: "No access",
  1: "View",
  2: "Edit",
  3: "Full/Approve",
};

/** Twelve modules in exact approved order (matrix column index 0..11). */
export const BUSINESS_MODULES = [
  "students",
  "counselling",
  "admissions",
  "documents",
  "fees_payments",
  "banking_finance",
  "hr_attendance",
  "digital_marketing",
  "orders_sales_purchase",
  "reports",
  "users_roles",
  "settings",
] as const;

export type BusinessModule = (typeof BUSINESS_MODULES)[number];

export const BUSINESS_MODULE_LABELS: Record<BusinessModule, string> = {
  students: "Students",
  counselling: "Counselling",
  admissions: "Admissions",
  documents: "Documents",
  fees_payments: "Fees & Payments",
  banking_finance: "Banking & Finance",
  hr_attendance: "HR & Attendance",
  digital_marketing: "Digital Marketing",
  orders_sales_purchase: "Orders / Sales / Purchase",
  reports: "Reports",
  users_roles: "Users & Roles",
  settings: "Settings",
};

/**
 * Ten approved business roles (matrix rows). Stable ids + human-readable names.
 * These are not identical to technical AppRole values.
 */
export const BUSINESS_ROLES = [
  "front_desk_student_affairs",
  "counsellor_consultant",
  "admission_team",
  "student_portal",
  "accounts_banking_finance",
  "hr_system",
  "digital_manager",
  "office_ops",
  "manager",
  "admin",
] as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const BUSINESS_ROLE_LABELS: Record<BusinessRole, string> = {
  front_desk_student_affairs: "Front Desk & Student Affairs",
  counsellor_consultant: "Counsellor / Consultant",
  admission_team: "Admission Team",
  student_portal: "Student Portal",
  accounts_banking_finance: "Accounts / Banking / Finance",
  hr_system: "HR System",
  digital_manager: "Digital Manager",
  office_ops: "Office Ops (Orders/Sales/Purchase)",
  manager: "Manager",
  admin: "Admin",
};

type MatrixRow = readonly [
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
  PermissionLevel,
];

/**
 * Default approved 10×12 matrix (seed / fail-closed fallback).
 * Runtime Admin edits persist in `business_module_permissions` and are merged
 * server-side; this constant remains the documented baseline.
 */
export const BUSINESS_PERMISSION_MATRIX: Record<BusinessRole, MatrixRow> = {
  front_desk_student_affairs: [2, 1, 1, 2, 2, 0, 1, 1, 0, 1, 0, 0],
  counsellor_consultant: [2, 3, 1, 2, 1, 0, 1, 0, 0, 1, 0, 0],
  admission_team: [1, 1, 3, 3, 2, 0, 1, 0, 0, 1, 0, 0],
  student_portal: [1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0],
  accounts_banking_finance: [1, 0, 1, 0, 3, 3, 1, 0, 2, 2, 0, 0],
  hr_system: [0, 0, 0, 1, 0, 0, 3, 0, 0, 1, 1, 0],
  digital_manager: [1, 0, 0, 1, 0, 0, 1, 3, 0, 2, 0, 0],
  office_ops: [0, 0, 0, 1, 1, 1, 1, 0, 3, 2, 0, 0],
  manager: [3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 1, 1],
  admin: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
};

export type PermissionMatrix = Record<BusinessRole, MatrixRow>;

export type PermissionMatrixCell = {
  businessRole: BusinessRole;
  module: BusinessModule;
  level: PermissionLevel;
};

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Deep-clone the default matrix for safe mutation / merge. */
export function cloneDefaultPermissionMatrix(): PermissionMatrix {
  const out = {} as PermissionMatrix;
  for (const role of BUSINESS_ROLES) {
    out[role] = [...BUSINESS_PERMISSION_MATRIX[role]] as unknown as MatrixRow;
  }
  return out;
}

/** Apply DB (or API) cells onto the default matrix; unknown ids ignored. */
export function mergePermissionMatrixCells(
  cells: readonly PermissionMatrixCell[],
  base: PermissionMatrix = cloneDefaultPermissionMatrix(),
): PermissionMatrix {
  const next = {} as PermissionMatrix;
  for (const role of BUSINESS_ROLES) {
    next[role] = [...base[role]] as unknown as MatrixRow;
  }
  for (const cell of cells) {
    if (!isBusinessRole(cell.businessRole) || !isBusinessModule(cell.module)) continue;
    if (!isPermissionLevel(cell.level)) continue;
    const index = BUSINESS_MODULES.indexOf(cell.module);
    if (index < 0) continue;
    const row = [...next[cell.businessRole]] as PermissionLevel[];
    row[index] = cell.level;
    next[cell.businessRole] = row as unknown as MatrixRow;
  }
  // Admin business-role display row is always Full on every module.
  next.admin = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
  return next;
}

export function flattenPermissionMatrix(matrix: PermissionMatrix): PermissionMatrixCell[] {
  const cells: PermissionMatrixCell[] = [];
  for (const role of BUSINESS_ROLES) {
    for (let i = 0; i < BUSINESS_MODULES.length; i++) {
      const module = BUSINESS_MODULES[i];
      if (!module) continue;
      cells.push({
        businessRole: role,
        module,
        level: matrix[role][i] ?? 0,
      });
    }
  }
  return cells;
}

export function getPermissionLevelFromMatrix(
  matrix: PermissionMatrix,
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
): PermissionLevel {
  if (!businessRole || !isBusinessRole(businessRole)) return 0;
  if (!module || !isBusinessModule(module)) return 0;
  const index = BUSINESS_MODULES.indexOf(module);
  if (index < 0) return 0;
  return matrix[businessRole][index] ?? 0;
}

/**
 * Validate a persisted permission cell change.
 * - Rejects unknown role/module/level.
 * - Admin matrix row cannot be lowered (always Full) — protects Users & Roles / Settings.
 * - Does not grant technical app_role=admin (that remains profiles.role / RPC only).
 */
export function validatePermissionMatrixChange(input: {
  businessRole: unknown;
  module: unknown;
  level: unknown;
}):
  | { ok: true; businessRole: BusinessRole; module: BusinessModule; level: PermissionLevel }
  | { ok: false; error: string } {
  if (!isBusinessRole(input.businessRole)) {
    return { ok: false, error: "Unknown business role." };
  }
  if (!isBusinessModule(input.module)) {
    return { ok: false, error: "Unknown permission module." };
  }
  if (!isPermissionLevel(input.level)) {
    return { ok: false, error: "Invalid permission level." };
  }
  if (input.businessRole === "admin" && input.level !== 3) {
    return {
      ok: false,
      error:
        "The Admin role must retain Full access on every module (including Users & Roles and Settings).",
    };
  }
  return {
    ok: true,
    businessRole: input.businessRole,
    module: input.module,
    level: input.level,
  };
}

/**
 * Prevent accidental lockout of the last protected technical administrator.
 * Counts profiles with app_role admin or super_admin (not business_role alone).
 */
export function wouldRemoveLastProtectedAdmin(input: {
  protectedAdminCount: number;
  targetIsProtectedAdmin: boolean;
  nextIsProtectedAdmin: boolean;
}): { ok: true } | { ok: false; error: string } {
  const count = input.protectedAdminCount;
  if (count < 0) {
    return { ok: false, error: "Could not verify protected administrators." };
  }
  if (input.targetIsProtectedAdmin && !input.nextIsProtectedAdmin && count <= 1) {
    return {
      ok: false,
      error: "Cannot demote or deactivate the last protected administrator.",
    };
  }
  return { ok: true };
}

export function isProtectedTechnicalAdmin(appRole: AppRole | null | undefined): boolean {
  return appRole === "admin" || appRole === "super_admin";
}

export function isBusinessRole(value: unknown): value is BusinessRole {
  return typeof value === "string" && (BUSINESS_ROLES as readonly string[]).includes(value);
}

export function isBusinessModule(value: unknown): value is BusinessModule {
  return typeof value === "string" && (BUSINESS_MODULES as readonly string[]).includes(value);
}

/**
 * Map a trusted technical AppRole (from portal-auth / profiles / app_metadata)
 * onto at most one business role for matrix evaluation.
 *
 * Fail closed (null) when no secure, documented mapping exists.
 *
 * Documented mappings:
 * - student → student_portal
 * - consultant → counsellor_consultant only (NOT Admission Team / Front Desk)
 * - admin → admin (highest business role; full matrix)
 * - super_admin → admin for matrix evaluation only (no Super Admin matrix row;
 *   technical reference preserved; not a separate product feature)
 *
 * Missing dependency: distinct Front Desk, Admission Team, Accounts, HR,
 * Digital Manager, Office Ops, and Manager identities are not present on the
 * trusted session today — those business roles cannot be resolved from AppRole.
 */
export function resolveBusinessRoleFromTrustedAppRole(
  appRole: AppRole | null | undefined,
): BusinessRole | null {
  if (!appRole) return null;
  switch (appRole) {
    case "student":
      return "student_portal";
    case "consultant":
      return "counsellor_consultant";
    case "admin":
      return "admin";
    case "super_admin":
      // Highest business role is Admin; no separate Super Admin matrix row.
      return "admin";
    default:
      return null;
  }
}

/** Never derive business roles from display names or client-supplied labels. */
export function resolveBusinessRoleFromDisplayLabel(_label: string): null {
  return null;
}

export function getPermissionLevel(
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
): PermissionLevel {
  if (!businessRole || !isBusinessRole(businessRole)) return 0;
  if (!module || !isBusinessModule(module)) return 0;
  const row = BUSINESS_PERMISSION_MATRIX[businessRole];
  const index = BUSINESS_MODULES.indexOf(module);
  if (index < 0) return 0;
  return row[index] ?? 0;
}

export function hasMinPermission(
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
  minimum: PermissionLevel,
): boolean {
  if (minimum < 0 || minimum > 3) return false;
  return getPermissionLevel(businessRole, module) >= minimum;
}

export function canViewModule(
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
): boolean {
  return hasMinPermission(businessRole, module, 1);
}

export function canEditModule(
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
): boolean {
  return hasMinPermission(businessRole, module, 2);
}

export function canFullyApproveModule(
  businessRole: BusinessRole | null | undefined,
  module: BusinessModule | null | undefined,
): boolean {
  return hasMinPermission(businessRole, module, 3);
}

/**
 * Student record isolation is independent of module permission levels.
 * A student with Documents Edit (2) still cannot access another student's records.
 */
export function canAccessOwnStudentRecord(
  authenticatedStudentId: string | null | undefined,
  targetStudentId: string | null | undefined,
): boolean {
  if (!authenticatedStudentId || !targetStudentId) return false;
  return authenticatedStudentId === targetStudentId;
}

/**
 * Fee / admission workflow gates are never satisfied by module permission alone —
 * including Admin Full/Approve (3) on Fees or Admissions.
 */
export function modulePermissionBypassesWorkflowGate(
  _businessRole: BusinessRole | null | undefined,
  _module: BusinessModule | null | undefined,
): false {
  return false;
}
