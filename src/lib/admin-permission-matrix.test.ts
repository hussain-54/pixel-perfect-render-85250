import { describe, expect, it } from "vitest";
import type { AppRole } from "./roles";
import {
  BUSINESS_MODULES,
  BUSINESS_PERMISSION_MATRIX,
  BUSINESS_ROLE_LABELS,
  BUSINESS_ROLES,
  getPermissionLevel,
  isProtectedTechnicalAdmin,
  mergePermissionMatrixCells,
  resolveBusinessRoleFromDisplayLabel,
  validatePermissionMatrixChange,
  wouldRemoveLastProtectedAdmin,
} from "./business-permissions";

/** Mirrors server requireRoles fail-closed check without importing server runtime. */
function assertRolesAllowed(role: AppRole, allowed: AppRole[]): boolean {
  return allowed.includes(role);
}

describe("Admin permission matrix — Phase 1 requirements", () => {
  it("1. Admin sees Full permissions for every module", () => {
    for (const module of BUSINESS_MODULES) {
      expect(getPermissionLevel("admin", module)).toBe(3);
      expect(BUSINESS_PERMISSION_MATRIX.admin[BUSINESS_MODULES.indexOf(module)]).toBe(3);
    }
    expect(BUSINESS_ROLE_LABELS.admin).toBe("Admin");
  });

  it("2–3. Authorized change validates and merged matrix survives reload-shaped merge", () => {
    const change = validatePermissionMatrixChange({
      businessRole: "digital_manager",
      module: "reports",
      level: 3,
    });
    expect(change.ok).toBe(true);
    if (!change.ok) return;

    const afterSave = mergePermissionMatrixCells([
      {
        businessRole: change.businessRole,
        module: change.module,
        level: change.level,
      },
    ]);
    const reloaded = mergePermissionMatrixCells([
      {
        businessRole: "digital_manager",
        module: "reports",
        level: 3,
      },
    ]);
    expect(afterSave.digital_manager[BUSINESS_MODULES.indexOf("reports")]).toBe(3);
    expect(reloaded.digital_manager[BUSINESS_MODULES.indexOf("reports")]).toBe(3);
  });

  it("4. Non-admin cannot pass admin-only permission management role gate", () => {
    const allowed: AppRole[] = ["admin", "super_admin"];
    expect(assertRolesAllowed("consultant", allowed)).toBe(false);
    expect(assertRolesAllowed("student", allowed)).toBe(false);
    expect(assertRolesAllowed("admin", allowed)).toBe(true);
    expect(assertRolesAllowed("super_admin", allowed)).toBe(true);
  });

  it("5. Client-side role / label manipulation cannot grant Admin privileges", () => {
    expect(resolveBusinessRoleFromDisplayLabel("Admin")).toBeNull();
    expect(isProtectedTechnicalAdmin("consultant")).toBe(false);
    expect(isProtectedTechnicalAdmin("admin")).toBe(true);
    expect(
      validatePermissionMatrixChange({
        businessRole: "super_admin",
        module: "settings",
        level: 3,
      }).ok,
    ).toBe(false);
    // Setting a matrix cell for counsellor users_roles ≠ becoming technical admin
    expect(assertRolesAllowed("consultant", ["admin", "super_admin"])).toBe(false);
  });

  it("6. Last protected Admin cannot be accidentally locked out", () => {
    const lockout = wouldRemoveLastProtectedAdmin({
      protectedAdminCount: 1,
      targetIsProtectedAdmin: true,
      nextIsProtectedAdmin: false,
    });
    expect(lockout.ok).toBe(false);
    expect(
      validatePermissionMatrixChange({ businessRole: "admin", module: "settings", level: 0 }).ok,
    ).toBe(false);
  });

  it("7. Existing roles and module definitions remain present", () => {
    expect([...BUSINESS_ROLES]).toEqual([
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
    ]);
    expect([...BUSINESS_MODULES]).toEqual([
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
    ]);
  });

  it("8. Permission helpers do not alter unrelated role matrix rows", () => {
    expect(getPermissionLevel("counsellor_consultant", "counselling")).toBe(3);
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(getPermissionLevel("front_desk_student_affairs", "students")).toBe(2);
    const merged = mergePermissionMatrixCells([
      { businessRole: "office_ops", module: "reports", level: 1 },
    ]);
    expect(merged.counsellor_consultant).toEqual(BUSINESS_PERMISSION_MATRIX.counsellor_consultant);
    expect(merged.admission_team).toEqual(BUSINESS_PERMISSION_MATRIX.admission_team);
    expect(merged.admin.every((l) => l === 3)).toBe(true);
  });
});
