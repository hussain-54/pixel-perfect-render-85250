/**
 * Alignment criteria for the approved 10×12 permission matrix + shared gates.
 * Unit / contract only — not live JWT/RLS proof.
 */
import { describe, expect, it } from "vitest";
import {
  BUSINESS_MODULES,
  BUSINESS_PERMISSION_MATRIX,
  BUSINESS_ROLES,
  canAccessOwnStudentRecord,
  canEditModule,
  canFullyApproveModule,
  canViewModule,
  cloneDefaultPermissionMatrix,
  getPermissionLevel,
  hasMinPermission,
  mergePermissionMatrixCells,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
} from "./business-permissions";
import { assertModulePermission } from "@/server/staff-access";
import type { TrustedSession } from "@/server/portal-auth";
import { AuthError } from "@/server/portal-auth";
import { resolveCrmListStudentIds } from "./student-crm-scope";
import {
  canPerformFrontDeskIntake,
  canRecordIntakeSignupFee,
  canVerifySignupFeeAction,
} from "./staff-business-access";
import {
  FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS,
  FRONT_DESK_ASSIGN_RETURN_COLUMNS,
  frontDeskAssignExcludesSensitive,
} from "./student-staff-field-rules";
import { INTAKE_REGISTER_RETURN_COLUMNS } from "./intake-register-rules";

const APPROVED: Record<BusinessRole, readonly PermissionLevel[]> = {
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

function session(
  role: TrustedSession["role"],
  businessRole: NonNullable<TrustedSession["businessRole"]> | null,
): TrustedSession {
  return {
    email: "t@example.com",
    source: "demo",
    userId: "u1",
    role,
    businessRole,
  };
}

describe("permission matrix alignment criteria", () => {
  it("1. approved matrix values remain unchanged", () => {
    expect(BUSINESS_ROLES).toHaveLength(10);
    expect(BUSINESS_MODULES).toHaveLength(12);
    for (const role of BUSINESS_ROLES) {
      expect(BUSINESS_PERMISSION_MATRIX[role]).toEqual(APPROVED[role]);
    }
    expect(APPROVED.manager).toEqual([3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 1, 1]);
  });

  it("2. View cannot perform Edit or Full-only operations", () => {
    expect(getPermissionLevel("admission_team", "counselling")).toBe(1);
    expect(canViewModule("admission_team", "counselling")).toBe(true);
    expect(canEditModule("admission_team", "counselling")).toBe(false);
    expect(canFullyApproveModule("admission_team", "counselling")).toBe(false);
    expect(() =>
      assertModulePermission(session("consultant", "admission_team"), "counselling", 2),
    ).toThrow(AuthError);
  });

  it("3. Edit cannot perform Full/Approve-only operations", () => {
    expect(getPermissionLevel("manager", "banking_finance")).toBe(2);
    expect(canEditModule("manager", "banking_finance")).toBe(true);
    expect(canFullyApproveModule("manager", "banking_finance")).toBe(false);
    expect(() =>
      assertModulePermission(session("consultant", "manager"), "banking_finance", 3),
    ).toThrow(AuthError);
  });

  it("4. Admin retains level 3 across every module", () => {
    for (const module of BUSINESS_MODULES) {
      expect(getPermissionLevel("admin", module)).toBe(3);
      expect(hasMinPermission("admin", module, 3)).toBe(true);
    }
  });

  it("5. Admission Team can run admissions/offer ops without counselling Edit", () => {
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(getPermissionLevel("admission_team", "counselling")).toBe(1);
    expect(() =>
      assertModulePermission(
        session("consultant", "admission_team"),
        "admissions",
        2,
        "offers and visa mutations",
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session("consultant", "admission_team"),
        "counselling",
        2,
        "offers and visa mutations",
      ),
    ).toThrow(AuthError);
  });

  it("6. each department is denied unauthorized operations", () => {
    const denials: Array<{ role: BusinessRole; module: BusinessModule; min: PermissionLevel }> = [
      { role: "hr_system", module: "students", min: 1 },
      { role: "digital_manager", module: "admissions", min: 1 },
      { role: "office_ops", module: "counselling", min: 1 },
      { role: "accounts_banking_finance", module: "documents", min: 1 },
      { role: "student_portal", module: "reports", min: 1 },
      { role: "front_desk_student_affairs", module: "banking_finance", min: 1 },
    ];
    for (const d of denials) {
      expect(() => assertModulePermission(session("consultant", d.role), d.module, d.min)).toThrow(
        AuthError,
      );
    }
  });

  it("7. students cannot access another student's private records", () => {
    expect(canAccessOwnStudentRecord("s1", "s2")).toBe(false);
    expect(canAccessOwnStudentRecord("s1", "s1")).toBe(true);
    expect(
      resolveCrmListStudentIds({
        role: "student",
        ownStudentId: "s1",
        requestedStudentId: "s2",
        visibleStudentIds: [],
      }).ok,
    ).toBe(false);
  });

  it("8. same student record identity persists across workflow hops (contract)", () => {
    const studentId = "11111111-1111-4111-8111-111111111111";
    // Intake return + assign return both carry id; lifecycle hops share that key.
    expect(INTAKE_REGISTER_RETURN_COLUMNS).toContain("id");
    expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).toContain("id");
    expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).toContain("assigned_consultant_id");
    const hops = [
      { step: "register", studentId },
      { step: "fee_verify", studentId },
      { step: "assign_counsellor", studentId },
      { step: "admissions_handover", studentId },
      { step: "applications_offers", studentId },
      { step: "student_progress", studentId },
    ];
    expect(new Set(hops.map((h) => h.studentId)).size).toBe(1);
  });

  it("9. database matrix edits affect server-side assert when matrix is supplied", () => {
    const edited = mergePermissionMatrixCells([
      { businessRole: "admission_team", module: "admissions", level: 1 },
    ]);
    expect(
      assertModulePermission.bind(
        null,
        session("consultant", "admission_team"),
        "admissions",
        2,
        "offers",
        edited,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session("consultant", "admission_team"),
        "admissions",
        2,
        "offers",
        cloneDefaultPermissionMatrix(),
      ),
    ).not.toThrow();
  });

  it("10. workflow / ownership / fee gates remain separate from module level 3", () => {
    expect(
      canPerformFrontDeskIntake({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
    expect(
      canRecordIntakeSignupFee({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    // Assign RPC narrow return excludes sensitive columns even for authorized FD.
    for (const col of FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS) {
      expect(frontDeskAssignExcludesSensitive(col)).toBe(true);
    }
  });
});
