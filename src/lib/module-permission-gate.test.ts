import { describe, expect, it } from "vitest";
import { canEditModule, canViewModule, hasMinPermission } from "./business-permissions";
import { requireModulePermission } from "@/server/staff-access";
import type { TrustedSession } from "@/server/portal-auth";
import { AuthError } from "@/server/portal-auth";

function session(partial: Partial<TrustedSession> & Pick<TrustedSession, "role">): TrustedSession {
  return {
    email: "t@example.com",
    source: "supabase",
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

  it("requireModulePermission allows admin and denies counsellor admission edits", () => {
    expect(() =>
      requireModulePermission(session({ role: "admin", businessRole: "admin" }), "admissions", 2),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "admissions",
        2,
        "creating applications",
      ),
    ).toThrow(AuthError);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
      ),
    ).not.toThrow();
  });

  it("requireModulePermission fails closed without business role", () => {
    expect(() =>
      requireModulePermission(session({ role: "consultant", businessRole: null }), "documents", 1),
    ).toThrow(/business role is not configured/i);
  });

  it("Phase 3C offers (counselling): admission may view but not mutate; counsellor may edit", () => {
    expect(canViewModule("admission_team", "counselling")).toBe(true);
    expect(canEditModule("admission_team", "counselling")).toBe(false);
    expect(canEditModule("counsellor_consultant", "counselling")).toBe(true);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "counselling",
        1,
        "offers and visa",
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "counselling",
        2,
        "offers and visa mutations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "counselling",
        2,
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "accounts_banking_finance" }),
        "counselling",
        1,
      ),
    ).toThrow(AuthError);
  });

  it("Phase 3C finance (fees_payments): counsellor view-only; admission may record; accounts full", () => {
    expect(canViewModule("counsellor_consultant", "fees_payments")).toBe(true);
    expect(canEditModule("counsellor_consultant", "fees_payments")).toBe(false);
    expect(canEditModule("admission_team", "fees_payments")).toBe(true);
    expect(hasMinPermission("accounts_banking_finance", "fees_payments", 3)).toBe(true);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "fees_payments",
        1,
        "university fee queue",
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "fees_payments",
        2,
        "creating university fee obligations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "fees_payments",
        2,
        "claiming university fee payments",
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "fees_payments",
        1,
      ),
    ).toThrow(AuthError);
  });

  it("Phase 3C front desk remains denied counselling mutations by matrix level and separate FD gate", () => {
    expect(canEditModule("front_desk_student_affairs", "counselling")).toBe(false);
    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "front_desk_student_affairs" }),
        "counselling",
        2,
      ),
    ).toThrow(AuthError);
    // FD may edit fees_payments by matrix; university fee verify stays behind canVerify + denyFrontDesk.
    expect(canEditModule("front_desk_student_affairs", "fees_payments")).toBe(true);
  });

  it("Phase 3D tasks/students: counsellor may mutate; admission view-only; accounts unauthorized for edit", () => {
    expect(canViewModule("counsellor_consultant", "students")).toBe(true);
    expect(canEditModule("counsellor_consultant", "students")).toBe(true);
    expect(canViewModule("admission_team", "students")).toBe(true);
    expect(canEditModule("admission_team", "students")).toBe(false);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "students",
        2,
        "task mutations",
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "students",
        2,
        "task mutations",
      ),
    ).toThrow(AuthError);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "hr_system" }),
        "students",
        1,
        "task operations",
      ),
    ).toThrow(AuthError);
  });

  it("Phase 3D reports/activity: view grants export; hr may view reports; missing role fails closed", () => {
    expect(canViewModule("counsellor_consultant", "reports")).toBe(true);
    expect(canViewModule("hr_system", "reports")).toBe(true);
    expect(canViewModule("digital_manager", "reports")).toBe(true);

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "reports",
        1,
        "officer reports",
      ),
    ).not.toThrow();

    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "student_portal" }),
        "reports",
        1,
        "report exports",
      ),
    ).toThrow(AuthError);

    expect(() =>
      requireModulePermission(session({ role: "consultant", businessRole: null }), "reports", 1),
    ).toThrow(/business role is not configured/i);
  });

  it("Phase 3D admissions create still works for admission_team with students view-only", () => {
    expect(canEditModule("admission_team", "admissions")).toBe(true);
    expect(canEditModule("admission_team", "students")).toBe(false);
    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "admission_team" }),
        "admissions",
        2,
        "creating applications from student workspace",
      ),
    ).not.toThrow();
    expect(() =>
      requireModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "admissions",
        2,
        "creating applications from student workspace",
      ),
    ).toThrow(AuthError);
  });
});
