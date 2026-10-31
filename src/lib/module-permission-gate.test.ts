import { describe, expect, it } from "vitest";
import {
  canEditModule,
  canViewModule,
  cloneDefaultPermissionMatrix,
  getPermissionLevel,
  hasMinPermission,
  mergePermissionMatrixCells,
} from "./business-permissions";
import { assertModulePermission, requireModulePermission } from "@/server/staff-access";
import type { TrustedSession } from "@/server/portal-auth";
import { AuthError } from "@/server/portal-auth";
import { canVerifySignupFeeAction } from "./staff-business-access";

function session(partial: Partial<TrustedSession> & Pick<TrustedSession, "role">): TrustedSession {
  return {
    email: "t@example.com",
    source: "demo",
    userId: "u1",
    businessRole: null,
    ...partial,
  };
}

describe("Phase 3 module permission gates (unit)", () => {
  it("counsellor may view admissions but not edit; admission_team may edit", () => {
    expect(canViewModule("counsellor_consultant", "admissions")).toBe(true);
    expect(canEditModule("counsellor_consultant", "admissions")).toBe(false);
    expect(canEditModule("admission_team", "admissions")).toBe(true);
    expect(hasMinPermission("admission_team", "admissions", 3)).toBe(true);
  });

  it("counsellor may edit documents; front desk may edit documents; accounts may not", () => {
    expect(canEditModule("counsellor_consultant", "documents")).toBe(true);
    expect(canEditModule("front_desk_student_affairs", "documents")).toBe(true);
    expect(canViewModule("accounts_banking_finance", "documents")).toBe(false);
  });

  it("assertModulePermission allows admin and denies counsellor admission edits", () => {
    expect(() =>
      assertModulePermission(session({ role: "admin", businessRole: "admin" }), "admissions", 2),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "admissions",
        2,
        "creating applications",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
      ),
    ).not.toThrow();
  });

  it("assertModulePermission fails closed without business role", () => {
    expect(() =>
      assertModulePermission(session({ role: "consultant", businessRole: null }), "documents", 1),
    ).toThrow(/business role is not configured/i);
  });

  it("offers/visa gate on admissions: Admission Team Full; counsellor View-only for mutations", () => {
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(getPermissionLevel("admission_team", "counselling")).toBe(1);
    expect(canEditModule("admission_team", "admissions")).toBe(true);
    expect(canEditModule("admission_team", "counselling")).toBe(false);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        1,
        "offers and visa",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
        "offers and visa mutations",
      ),
    ).not.toThrow();

    // Must not require counselling Edit for Admission Team offer work.
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "counselling",
        2,
        "offers and visa mutations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "admissions",
        2,
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "accounts_banking_finance" }),
        "admissions",
        1,
      ),
    ).not.toThrow();
  });

  it("finance (fees_payments): counsellor view-only; admission may record; accounts full", () => {
    expect(canViewModule("counsellor_consultant", "fees_payments")).toBe(true);
    expect(canEditModule("counsellor_consultant", "fees_payments")).toBe(false);
    expect(canEditModule("admission_team", "fees_payments")).toBe(true);
    expect(hasMinPermission("accounts_banking_finance", "fees_payments", 3)).toBe(true);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "fees_payments",
        1,
        "university fee viewing",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "fees_payments",
        2,
        "creating university fee obligations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "fees_payments",
        2,
        "claiming university fee payments",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "fees_payments",
        1,
      ),
    ).toThrow(AuthError);
  });

  it("front desk remains denied counselling mutations by matrix level", () => {
    expect(canEditModule("front_desk_student_affairs", "counselling")).toBe(false);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "front_desk_student_affairs" }),
        "counselling",
        2,
      ),
    ).toThrow(AuthError);
    expect(canEditModule("front_desk_student_affairs", "fees_payments")).toBe(true);
  });

  it("tasks/students: counsellor may mutate; admission view-only; accounts unauthorized for edit", () => {
    expect(canViewModule("counsellor_consultant", "students")).toBe(true);
    expect(canEditModule("counsellor_consultant", "students")).toBe(true);
    expect(canViewModule("admission_team", "students")).toBe(true);
    expect(canEditModule("admission_team", "students")).toBe(false);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "students",
        2,
        "task mutations",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "students",
        2,
        "task mutations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "students",
        1,
        "task operations",
      ),
    ).toThrow(AuthError);
  });

  it("reports/activity: view grants export; hr may view reports; missing role fails closed", () => {
    expect(canViewModule("counsellor_consultant", "reports")).toBe(true);
    expect(canViewModule("hr_system", "reports")).toBe(true);
    expect(canViewModule("digital_manager", "reports")).toBe(true);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "reports",
        1,
        "officer reports",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "student_portal" }),
        "reports",
        1,
        "report exports",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(session({ role: "consultant", businessRole: null }), "reports", 1),
    ).toThrow(/business role is not configured/i);
  });

  it("admissions create still works for admission_team with students view-only", () => {
    expect(canEditModule("admission_team", "admissions")).toBe(true);
    expect(canEditModule("admission_team", "students")).toBe(false);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
        "creating applications from student workspace",
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "admissions",
        2,
        "creating applications from student workspace",
      ),
    ).toThrow(AuthError);
  });

  it("View cannot Edit; Edit cannot Full/Approve-only", () => {
    // Admission Team counselling=1
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "counselling",
        1,
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "counselling",
        2,
      ),
    ).toThrow(AuthError);

    // Manager banking_finance=2 (Edit, not Full)
    expect(getPermissionLevel("manager", "banking_finance")).toBe(2);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "manager" }),
        "banking_finance",
        2,
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "manager" }),
        "banking_finance",
        3,
      ),
    ).toThrow(AuthError);
  });

  it("Admin retains level 3 across every module", () => {
    for (const module of [
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
    ] as const) {
      expect(getPermissionLevel("admin", module)).toBe(3);
      expect(() =>
        assertModulePermission(session({ role: "admin", businessRole: "admin" }), module, 3),
      ).not.toThrow();
    }
  });

  it("department denials: HR/Digital/Ops denied unauthorized modules", () => {
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "admissions",
        1,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "digital_manager" }),
        "counselling",
        1,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "office_ops" }),
        "students",
        1,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "office_ops" }),
        "orders_sales_purchase",
        3,
      ),
    ).not.toThrow();
  });

  it("persisted matrix cells change assertModulePermission authorization", () => {
    const lowered = mergePermissionMatrixCells([
      { businessRole: "admission_team", module: "admissions", level: 1 },
    ]);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
        "offers",
        lowered,
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
        "offers",
        cloneDefaultPermissionMatrix(),
      ),
    ).not.toThrow();
  });

  it("Front Desk banking_finance grant/revoke is enforced server-side via matrix", () => {
    const granted = mergePermissionMatrixCells([
      { businessRole: "front_desk_student_affairs", module: "banking_finance", level: 1 },
    ]);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "front_desk_student_affairs" }),
        "banking_finance",
        1,
        "banking",
        granted,
      ),
    ).not.toThrow();

    const revoked = mergePermissionMatrixCells([
      { businessRole: "front_desk_student_affairs", module: "banking_finance", level: 0 },
    ]);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "front_desk_student_affairs" }),
        "banking_finance",
        1,
        "banking",
        revoked,
      ),
    ).toThrow(AuthError);

    // View ≠ verify (Accounts workflow stays separate).
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
  });

  it("requireModulePermission rejects Admission Team demo plane; counsellor still uses demo defaults", async () => {
    await expect(
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team", source: "demo" }),
        "admissions",
        2,
      ),
    ).rejects.toThrow(/live staff sign-in|Demo or mock Admission/i);

    // Counsellor demo may use default matrix (no Supabase load) — admissions Edit denied.
    await expect(
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant", source: "demo" }),
        "admissions",
        2,
      ),
    ).rejects.toThrow(AuthError);

    // Counsellor students Edit still allowed on demo defaults.
    await expect(
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant", source: "demo" }),
        "students",
        2,
      ),
    ).resolves.toBeUndefined();
  });

  it("HR / Digital Marketing / Orders gates honor lowered persisted matrix cells", () => {
    const lowered = mergePermissionMatrixCells([
      { businessRole: "hr_system", module: "hr_attendance", level: 1 },
      { businessRole: "digital_manager", module: "digital_marketing", level: 1 },
      { businessRole: "office_ops", module: "orders_sales_purchase", level: 1 },
    ]);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "hr_attendance",
        2,
        "HR record changes",
        lowered,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "digital_manager" }),
        "digital_marketing",
        2,
        "Digital Marketing changes",
        lowered,
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "office_ops" }),
        "orders_sales_purchase",
        2,
        "Office Operations changes",
        lowered,
      ),
    ).toThrow(AuthError);

    // Default matrix still grants department edit/full on their home modules.
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "hr_attendance",
        2,
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "digital_manager" }),
        "digital_marketing",
        2,
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "office_ops" }),
        "orders_sales_purchase",
        2,
      ),
    ).not.toThrow();
  });
});
