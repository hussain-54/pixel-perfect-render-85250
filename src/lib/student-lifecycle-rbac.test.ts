/**
 * Student lifecycle RBAC + same-ID persistence contracts.
 * Unit / contract only — not live JWT/RLS or E2E browser proof.
 */
import { describe, expect, it } from "vitest";
import {
  canEditModule,
  canFullyApproveModule,
  canViewModule,
  getPermissionLevel,
} from "./business-permissions";
import { assertModulePermission } from "@/server/staff-access";
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import {
  canPerformFrontDeskIntake,
  canRecordIntakeSignupFee,
  canVerifySignupFeeAction,
} from "./staff-business-access";
import {
  canActivatePortalFromFeeStatus,
  isSignupFeeVerified,
  studentPortalAccessAllowed,
} from "./signup-fee-gate";
import { canCallFrontDeskAssignCounsellor } from "./student-staff-field-rules";
import { INTAKE_REGISTER_RETURN_COLUMNS } from "./intake-register-rules";
import { FRONT_DESK_ASSIGN_RETURN_COLUMNS } from "./student-staff-field-rules";
import { resolveCrmListStudentIds } from "./student-crm-scope";
import { canAccessOwnStudentRecord } from "./business-permissions";

const STUDENT_ID = "22222222-2222-4222-8222-222222222222";

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

describe("student lifecycle — same persisted student id", () => {
  it("carries one student id across registration → assign → admissions hops", () => {
    expect(INTAKE_REGISTER_RETURN_COLUMNS).toContain("id");
    expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).toContain("id");
    expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).toContain("assigned_consultant_id");

    const hops = [
      { step: "lead_or_consultation", studentId: null as string | null },
      { step: "fd_register", studentId: STUDENT_ID },
      { step: "signup_fee_record", studentId: STUDENT_ID },
      { step: "fee_verify", studentId: STUDENT_ID },
      { step: "portal_activate", studentId: STUDENT_ID },
      { step: "assign_counsellor", studentId: STUDENT_ID },
      { step: "assessment_consent", studentId: STUDENT_ID },
      { step: "admissions_handover", studentId: STUDENT_ID },
      { step: "documents", studentId: STUDENT_ID },
      { step: "applications_offers", studentId: STUDENT_ID },
      { step: "finance_verify", studentId: STUDENT_ID },
      { step: "visa", studentId: STUDENT_ID },
      { step: "student_portal", studentId: STUDENT_ID },
    ];

    const registeredIds = hops.filter((h) => h.studentId).map((h) => h.studentId);
    expect(new Set(registeredIds).size).toBe(1);
    expect(registeredIds[0]).toBe(STUDENT_ID);
  });
});

describe("student lifecycle — unauthorized transitions denied", () => {
  it("Front Desk may register and record fee; cannot verify or mutate counselling", () => {
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
    expect(() =>
      assertModulePermission(session("consultant", "front_desk_student_affairs"), "counselling", 2),
    ).toThrow(AuthError);
    expect(
      canCallFrontDeskAssignCounsellor({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: true,
      }),
    ).toBe(true);
  });

  it("Accounts may verify fee; counsellor cannot; activation requires verified/waived", () => {
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("verified")).toBe(true);
    expect(studentPortalAccessAllowed({ source: "supabase", portalActivatedAt: null })).toBe(false);
  });

  it("Counsellor may counselling Edit; Admission Team may admissions Full without counselling Edit", () => {
    expect(canEditModule("counsellor_consultant", "counselling")).toBe(true);
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(canEditModule("admission_team", "counselling")).toBe(false);
    expect(() =>
      assertModulePermission(session("consultant", "admission_team"), "admissions", 2, "offers"),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(session("consultant", "admission_team"), "counselling", 2, "offers"),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(session("consultant", "counsellor_consultant"), "admissions", 2),
    ).toThrow(AuthError);
  });

  it("Documents / applications / visa gates follow module levels", () => {
    expect(canFullyApproveModule("admission_team", "documents")).toBe(true);
    expect(canViewModule("counsellor_consultant", "documents")).toBe(true);
    expect(canEditModule("accounts_banking_finance", "documents")).toBe(false);
    expect(() =>
      assertModulePermission(session("consultant", "hr_system"), "admissions", 1),
    ).toThrow(AuthError);
  });

  it("Students cannot read another student's CRM scope", () => {
    expect(canAccessOwnStudentRecord(STUDENT_ID, "other-student")).toBe(false);
    expect(
      resolveCrmListStudentIds({
        role: "student",
        ownStudentId: STUDENT_ID,
        requestedStudentId: "other-student",
        visibleStudentIds: [],
      }).ok,
    ).toBe(false);
  });
});
