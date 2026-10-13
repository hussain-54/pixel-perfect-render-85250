import { describe, expect, it } from "vitest";
import type { AppRole } from "./roles";
import {
  BUSINESS_MODULES,
  BUSINESS_PERMISSION_MATRIX,
  BUSINESS_ROLES,
  BUSINESS_ROLE_LABELS,
  canAccessOwnStudentRecord,
  canEditModule,
  canFullyApproveModule,
  canViewModule,
  getPermissionLevel,
  hasMinPermission,
  isBusinessModule,
  isBusinessRole,
  modulePermissionBypassesWorkflowGate,
  resolveBusinessRoleFromDisplayLabel,
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
} from "./business-permissions";
import {
  activityForStudent,
  crmListOrEmpty,
  isMockCrmAllowed,
  shouldShowDemoSessionIndicator,
} from "./portal-data-plane";

const APPROVED_MATRIX: Record<BusinessRole, readonly PermissionLevel[]> = {
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

describe("business permission matrix (exact approved values)", () => {
  it("defines exactly 10 roles and 12 modules in order", () => {
    expect(BUSINESS_ROLES).toHaveLength(10);
    expect(BUSINESS_MODULES).toHaveLength(12);
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

  it("matches every matrix row and module position", () => {
    for (const role of BUSINESS_ROLES) {
      expect(BUSINESS_PERMISSION_MATRIX[role]).toEqual(APPROVED_MATRIX[role]);
      for (let i = 0; i < BUSINESS_MODULES.length; i++) {
        const module = BUSINESS_MODULES[i];
        expect(getPermissionLevel(role, module)).toBe(APPROVED_MATRIX[role][i]);
      }
    }
  });

  it("exposes human-readable labels for all business roles", () => {
    expect(BUSINESS_ROLE_LABELS.admin).toBe("Admin");
    expect(BUSINESS_ROLE_LABELS.admission_team).toBe("Admission Team");
    expect(BUSINESS_ROLE_LABELS.counsellor_consultant).toBe("Counsellor / Consultant");
  });
});

describe("permission levels 0–3", () => {
  it("treats level 0 as no access", () => {
    expect(getPermissionLevel("hr_system", "students")).toBe(0);
    expect(canViewModule("hr_system", "students")).toBe(false);
    expect(canEditModule("hr_system", "students")).toBe(false);
    expect(canFullyApproveModule("hr_system", "students")).toBe(false);
    expect(hasMinPermission("hr_system", "students", 1)).toBe(false);
  });

  it("treats level 1 as view-only", () => {
    expect(getPermissionLevel("student_portal", "students")).toBe(1);
    expect(canViewModule("student_portal", "students")).toBe(true);
    expect(canEditModule("student_portal", "students")).toBe(false);
    expect(hasMinPermission("student_portal", "students", 1)).toBe(true);
    expect(hasMinPermission("student_portal", "students", 2)).toBe(false);
  });

  it("treats level 2 as edit", () => {
    expect(getPermissionLevel("student_portal", "documents")).toBe(2);
    expect(canEditModule("student_portal", "documents")).toBe(true);
    expect(canFullyApproveModule("student_portal", "documents")).toBe(false);
  });

  it("treats level 3 as full/approve", () => {
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(canFullyApproveModule("admission_team", "admissions")).toBe(true);
    expect(hasMinPermission("admission_team", "admissions", 3)).toBe(true);
  });
});

describe("Admin business role", () => {
  it("has Full/Approve (3) on every module", () => {
    for (const module of BUSINESS_MODULES) {
      expect(getPermissionLevel("admin", module)).toBe(3);
      expect(canFullyApproveModule("admin", module)).toBe(true);
    }
  });
});

describe("student own-record isolation", () => {
  it("is independent of module permission levels", () => {
    // Student has Documents Edit (2) but still cannot access another student.
    expect(getPermissionLevel("student_portal", "documents")).toBe(2);
    expect(canAccessOwnStudentRecord("stu-a", "stu-a")).toBe(true);
    expect(canAccessOwnStudentRecord("stu-a", "stu-b")).toBe(false);
    expect(canAccessOwnStudentRecord(null, "stu-a")).toBe(false);
    expect(canAccessOwnStudentRecord("stu-a", "")).toBe(false);
  });
});

describe("fail closed for unknown roles and modules", () => {
  it("rejects unknown business role/module identifiers", () => {
    expect(isBusinessRole("not_a_role")).toBe(false);
    expect(isBusinessModule("not_a_module")).toBe(false);
    expect(getPermissionLevel("not_a_role" as BusinessRole, "students")).toBe(0);
    expect(getPermissionLevel("admin", "not_a_module" as BusinessModule)).toBe(0);
    expect(hasMinPermission(null, "students", 1)).toBe(false);
    expect(hasMinPermission("admin", null, 1)).toBe(false);
  });

  it("never resolves business roles from display labels", () => {
    expect(resolveBusinessRoleFromDisplayLabel("Admin")).toBeNull();
    expect(resolveBusinessRoleFromDisplayLabel("Admission Team")).toBeNull();
    expect(resolveBusinessRoleFromDisplayLabel("Counsellor / Consultant")).toBeNull();
  });
});

describe("trusted AppRole → business role mapping", () => {
  it("maps only documented technical roles and fails closed otherwise", () => {
    expect(resolveBusinessRoleFromTrustedAppRole("student")).toBe("student_portal");
    expect(resolveBusinessRoleFromTrustedAppRole("consultant")).toBe("counsellor_consultant");
    expect(resolveBusinessRoleFromTrustedAppRole("admin")).toBe("admin");
    expect(resolveBusinessRoleFromTrustedAppRole("super_admin")).toBe("admin");
    expect(resolveBusinessRoleFromTrustedAppRole(null)).toBeNull();
    expect(resolveBusinessRoleFromTrustedAppRole(undefined)).toBeNull();
  });

  it("does not grant consultant the Admission Team or Front Desk matrix", () => {
    const business = resolveBusinessRoleFromTrustedAppRole("consultant");
    expect(business).toBe("counsellor_consultant");
    expect(getPermissionLevel(business, "admissions")).toBe(1); // counsellor row, not admission 3
    expect(getPermissionLevel(business, "counselling")).toBe(3);
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(getPermissionLevel("front_desk_student_affairs", "fees_payments")).toBe(2);
    // consultant technical role must not evaluate as front desk / admission team
    expect(business).not.toBe("admission_team");
    expect(business).not.toBe("front_desk_student_affairs");
  });

  it("does not map technical roles onto unrelated department business roles", () => {
    const mapped: Array<[AppRole, BusinessRole | null]> = [
      ["student", "student_portal"],
      ["consultant", "counsellor_consultant"],
      ["admin", "admin"],
      ["super_admin", "admin"],
    ];
    for (const [app, expected] of mapped) {
      expect(resolveBusinessRoleFromTrustedAppRole(app)).toBe(expected);
    }
    // Unmapped business roles remain unreachable from AppRole alone
    const reachable = new Set(
      (["student", "consultant", "admin", "super_admin"] as AppRole[]).map((r) =>
        resolveBusinessRoleFromTrustedAppRole(r),
      ),
    );
    expect(reachable.has("front_desk_student_affairs")).toBe(false);
    expect(reachable.has("admission_team")).toBe(false);
    expect(reachable.has("accounts_banking_finance")).toBe(false);
    expect(reachable.has("hr_system")).toBe(false);
    expect(reachable.has("digital_manager")).toBe(false);
    expect(reachable.has("office_ops")).toBe(false);
    expect(reachable.has("manager")).toBe(false);
  });
});

describe("workflow gates vs module permissions", () => {
  it("never lets module Full/Approve bypass fee or admission workflow gates", () => {
    expect(modulePermissionBypassesWorkflowGate("admin", "fees_payments")).toBe(false);
    expect(modulePermissionBypassesWorkflowGate("admin", "admissions")).toBe(false);
    expect(modulePermissionBypassesWorkflowGate("accounts_banking_finance", "fees_payments")).toBe(
      false,
    );
    expect(getPermissionLevel("admin", "fees_payments")).toBe(3);
  });
});

describe("Phase 1 CRM / session helpers unchanged", () => {
  it("keeps Supabase sessions off mock CRM and demo indicator on demo only", () => {
    expect(isMockCrmAllowed("supabase")).toBe(false);
    expect(isMockCrmAllowed("demo")).toBe(true);
    expect(crmListOrEmpty("supabase", [{ id: "s1" }])).toEqual([]);
    expect(activityForStudent({ s1: [{ id: "a" }] }, "s2")).toEqual([]);
    expect(shouldShowDemoSessionIndicator("demo")).toBe(true);
    expect(shouldShowDemoSessionIndicator("supabase")).toBe(false);
  });
});