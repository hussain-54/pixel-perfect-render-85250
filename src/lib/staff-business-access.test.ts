import { describe, expect, it } from "vitest";
import {
  assertNoClientOwnershipEscalation,
  canListCounsellorDesksForSession,
  canPerformFrontDeskIntake,
  canRecordIntakeSignupFee,
  canVerifySignupFeeAction,
  FRONT_DESK_INTAKE_SELECT_COLUMNS,
  frontDeskNavAllowed,
  isFrontDeskBusinessRole,
  isFrontDeskDeniedPath,
  moduleDeniedForFrontDesk,
  normalizeTrustedBusinessRole,
  staffHomeForBusinessRole,
} from "./staff-business-access";

describe("Front Desk trusted business role", () => {
  it("1. resolves only from trusted business_role values", () => {
    expect(normalizeTrustedBusinessRole("front_desk_student_affairs")).toBe(
      "front_desk_student_affairs",
    );
    expect(normalizeTrustedBusinessRole("Admin")).toBeNull();
    expect(normalizeTrustedBusinessRole("counsellor_consultant")).toBe("counsellor_consultant");
    expect(normalizeTrustedBusinessRole(null)).toBeNull();
    expect(isFrontDeskBusinessRole("front_desk_student_affairs")).toBe(true);
    expect(isFrontDeskBusinessRole("counsellor_consultant")).toBe(false);
  });

  it("2. Front Desk home and nav exclude consultant modules", () => {
    expect(staffHomeForBusinessRole("consultant", "front_desk_student_affairs")).toBe(
      "/staff/front-desk",
    );
    expect(staffHomeForBusinessRole("consultant", "counsellor_consultant")).toBe(
      "/staff/dashboard",
    );
    expect(staffHomeForBusinessRole("consultant", "hr_system")).toBe("/staff/hr");
    expect(staffHomeForBusinessRole("consultant", "digital_manager")).toBe("/staff/marketing");
    expect(frontDeskNavAllowed("/staff/register")).toBe(true);
    expect(frontDeskNavAllowed("/staff/intake")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/applications")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/offers")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/documents")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/tasks")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/students")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/students/abc")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/appointments")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/dashboard")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/front-desk")).toBe(false);
    expect(isFrontDeskDeniedPath("/staff/register")).toBe(false);
  });

  it("3–4. Front Desk workflow deny predicate + client ownership rejected", () => {
    // Mirrors server denyFrontDeskConsultantWorkflows gate
    expect(isFrontDeskBusinessRole("front_desk_student_affairs")).toBe(true);
    expect(isFrontDeskBusinessRole("counsellor_consultant")).toBe(false);
    expect(isFrontDeskBusinessRole("admission_team")).toBe(false);

    expect(
      assertNoClientOwnershipEscalation({
        clientRegisteredBy: "someone-else",
        sessionUserId: "u-fd",
      }).ok,
    ).toBe(false);
    expect(
      assertNoClientOwnershipEscalation({
        sessionUserId: "u-fd",
      }).ok,
    ).toBe(true);
  });

  it("5. missing business role fails closed for Front Desk intake", () => {
    expect(canPerformFrontDeskIntake({ appRole: "consultant", businessRole: null })).toBe(false);
    expect(
      canPerformFrontDeskIntake({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
  });

  it("6–12. intake columns, fee record vs verify, confidential modules denied", () => {
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
    expect(FRONT_DESK_INTAKE_SELECT_COLUMNS).toContain("registered_by");
    expect(FRONT_DESK_INTAKE_SELECT_COLUMNS).toContain("case_id");
    expect(FRONT_DESK_INTAKE_SELECT_COLUMNS).not.toContain("dob");
    expect(moduleDeniedForFrontDesk("admissions")).toBe(true);
    // banking_finance follows Admin matrix for View; not a hard CRM deny.
    expect(moduleDeniedForFrontDesk("banking_finance")).toBe(false);
    expect(moduleDeniedForFrontDesk("admissions")).toBe(true);
    expect(moduleDeniedForFrontDesk("students")).toBe(false);
  });

  it("13–14. Admin and counsellor / admission homes preserved", () => {
    expect(staffHomeForBusinessRole("admin", "admin")).toBe("/admin/dashboard");
    expect(staffHomeForBusinessRole("consultant", "admission_team")).toBe("/staff/dashboard");
    expect(staffHomeForBusinessRole("consultant", "counsellor_consultant")).toBe(
      "/staff/dashboard",
    );
    expect(staffHomeForBusinessRole("student", null)).toBe("/student/dashboard");
  });

  it("15. counsellor desk list: admin, Front Desk, manager only", () => {
    expect(
      canListCounsellorDesksForSession({
        appRole: "consultant",
        businessRole: "manager",
      }),
    ).toBe(true);
    expect(
      canListCounsellorDesksForSession({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
    expect(
      canListCounsellorDesksForSession({
        appRole: "admin",
        businessRole: "admin",
      }),
    ).toBe(true);
    expect(
      canListCounsellorDesksForSession({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canListCounsellorDesksForSession({
        appRole: "consultant",
        businessRole: "admission_team",
      }),
    ).toBe(false);
  });
});
