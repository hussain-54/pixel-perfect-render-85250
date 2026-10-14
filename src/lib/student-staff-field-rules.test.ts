import { describe, expect, it } from "vitest";
import {
  canCallFrontDeskAssignCounsellor,
  canListActiveCounsellorDesks,
  FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS,
  FRONT_DESK_ASSIGN_RETURN_COLUMNS,
  frontDeskAssignExcludesSensitive,
  frontDeskAssignReturnsColumn,
  isEligibleCounsellorDesk,
  studentStaffFieldUpdateDenied,
  type StudentStaffFieldActor,
} from "./student-staff-field-rules";

const base: StudentStaffFieldActor = {
  isAdmin: false,
  isAssignedConsultant: false,
  canVerifySignupFee: false,
  isRegistrarOwner: false,
  isOwningStudent: false,
};

describe("enforce_student_staff_fields mirror (Phase 2 remediated)", () => {
  it("allows admin updates including registered_by", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, isAdmin: true },
        changedFields: ["email", "journey_stage", "registered_by"],
        registeredByChanged: true,
      }),
    ).toBeNull();
  });

  it("allows assigned counsellor updates", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, isAssignedConsultant: true },
        changedFields: ["journey_stage", "phone", "dob"],
        registeredByChanged: false,
      }),
    ).toBeNull();
  });

  it("allows fee verifier to set portal_activated_at (+ updated_at)", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, canVerifySignupFee: true },
        changedFields: ["portal_activated_at", "updated_at"],
        registeredByChanged: false,
      }),
    ).toBeNull();
  });

  it("denies fee verifier changing unrelated student fields", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, canVerifySignupFee: true },
        changedFields: ["portal_activated_at", "email"],
        registeredByChanged: false,
      }),
    ).toMatch(/Fee verifiers may only/);
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, canVerifySignupFee: true },
        changedFields: ["assigned_consultant_id"],
        registeredByChanged: false,
      }),
    ).toMatch(/Fee verifiers may only/);
  });

  it("allows Front Desk registrar counsellor assignment on owned row", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: { ...base, isRegistrarOwner: true },
        changedFields: ["assigned_consultant_id", "updated_at"],
        registeredByChanged: false,
      }),
    ).toBeNull();
  });

  it("denies Front Desk changing dob, last_activity_at, identity, registered_by, journey", () => {
    const registrar = { ...base, isRegistrarOwner: true };
    for (const field of [
      "dob",
      "last_activity_at",
      "email",
      "full_name",
      "phone",
      "journey_stage",
      "portal_activated_at",
      "case_id",
    ]) {
      expect(
        studentStaffFieldUpdateDenied({
          actor: registrar,
          changedFields: ["assigned_consultant_id", field],
          registeredByChanged: false,
        }),
      ).toMatch(/Registrars may only/);
    }
    expect(
      studentStaffFieldUpdateDenied({
        actor: registrar,
        changedFields: ["assigned_consultant_id"],
        registeredByChanged: true,
      }),
    ).toMatch(/registered_by cannot be changed/);
  });

  it("denies unauthorized users from student updates", () => {
    expect(
      studentStaffFieldUpdateDenied({
        actor: base,
        changedFields: ["assigned_consultant_id"],
        registeredByChanged: false,
      }),
    ).toMatch(/Not allowed/);
  });
});

describe("front_desk_assign_counsellor / desk list mirrors", () => {
  it("narrows assign RPC return (excludes DOB / activation / profile_id)", () => {
    expect(frontDeskAssignReturnsColumn("assigned_consultant_id")).toBe(true);
    expect(frontDeskAssignReturnsColumn("dob")).toBe(false);
    expect(frontDeskAssignExcludesSensitive("dob")).toBe(true);
    expect(frontDeskAssignExcludesSensitive("portal_activated_at")).toBe(true);
    expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).not.toContain("dob");
    for (const col of FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS) {
      expect(FRONT_DESK_ASSIGN_RETURN_COLUMNS).not.toContain(col);
    }
  });

  it("rejects non-Front-Desk/non-admin callers for assign RPC", () => {
    expect(
      canCallFrontDeskAssignCounsellor({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: false,
      }),
    ).toBe(false);
    expect(
      canCallFrontDeskAssignCounsellor({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: true,
      }),
    ).toBe(true);
    expect(
      canCallFrontDeskAssignCounsellor({
        isAuthenticated: false,
        isAdmin: true,
        isFrontDesk: true,
      }),
    ).toBe(false);
  });

  it("requires active counsellor_consultant desks", () => {
    expect(
      isEligibleCounsellorDesk({
        status: "active",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(true);
    expect(
      isEligibleCounsellorDesk({
        status: "inactive",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      isEligibleCounsellorDesk({
        status: "active",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
  });

  it("allows manager, Front Desk, and admin to list counsellor desks", () => {
    expect(
      canListActiveCounsellorDesks({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: false,
        isManager: true,
      }),
    ).toBe(true);
    expect(
      canListActiveCounsellorDesks({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: true,
        isManager: false,
      }),
    ).toBe(true);
    expect(
      canListActiveCounsellorDesks({
        isAuthenticated: true,
        isAdmin: true,
        isFrontDesk: false,
        isManager: false,
      }),
    ).toBe(true);
    expect(
      canListActiveCounsellorDesks({
        isAuthenticated: true,
        isAdmin: false,
        isFrontDesk: false,
        isManager: false,
      }),
    ).toBe(false);
  });
});
