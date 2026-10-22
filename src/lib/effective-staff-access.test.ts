import { describe, expect, it } from "vitest";
import {
  cloneDefaultPermissionMatrix,
  getPermissionLevelFromMatrix,
  mergePermissionMatrixCells,
  type PermissionMatrix,
} from "./business-permissions";
import {
  specialtyNavFromEffectiveMatrix,
  isFrontDeskSpecialtyHardDenyPath,
} from "./effective-staff-access";
import { isFrontDeskDeniedPath } from "./staff-business-access";
import { buildStaffNav } from "./staff-nav";
import { canVerifySignupFeeAction } from "./staff-business-access";

function withFrontDeskCell(
  module: "fees_payments" | "banking_finance",
  level: 0 | 1 | 2 | 3,
): PermissionMatrix {
  return mergePermissionMatrixCells(
    [{ businessRole: "front_desk_student_affairs", module, level }],
    cloneDefaultPermissionMatrix(),
  );
}

describe("effective staff access — Front Desk Finance grant/revoke", () => {
  it("Scenario A: grant banking_finance View → nav + path allow; verify still denied", () => {
    const matrix = withFrontDeskCell("banking_finance", 1);

    expect(
      getPermissionLevelFromMatrix(matrix, "front_desk_student_affairs", "banking_finance"),
    ).toBe(1);

    const nav = specialtyNavFromEffectiveMatrix("front_desk_student_affairs", matrix).map(
      (i) => i.to,
    );
    expect(nav).toContain("/staff/finance"); // default fees View
    expect(nav).toContain("/staff/banking");
    expect(nav).not.toContain("/staff/reports"); // hard-deny
    expect(nav).not.toContain("/staff/marketing"); // product deny

    expect(isFrontDeskDeniedPath("/staff/banking", matrix, "front_desk_student_affairs")).toBe(
      false,
    );
    expect(isFrontDeskDeniedPath("/staff/finance", matrix, "front_desk_student_affairs")).toBe(
      false,
    );

    const sidebar = buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to);
    expect(sidebar).toEqual(
      expect.arrayContaining([
        "/staff/front-desk",
        "/staff/register",
        "/staff/intake",
        "/staff/finance",
        "/staff/banking",
      ]),
    );

    // Verification remains a separate gate — matrix View does not unlock verify.
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
  });

  it("Scenario B: revoke banking_finance → nav + path deny", () => {
    const matrix = withFrontDeskCell("banking_finance", 0);

    const nav = specialtyNavFromEffectiveMatrix("front_desk_student_affairs", matrix).map(
      (i) => i.to,
    );
    expect(nav).not.toContain("/staff/banking");
    expect(isFrontDeskDeniedPath("/staff/banking", matrix, "front_desk_student_affairs")).toBe(
      true,
    );

    const sidebar = buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to);
    expect(sidebar).not.toContain("/staff/banking");
    expect(sidebar).toContain("/staff/front-desk");
  });

  it("Scenario A2: grant fees_payments View when previously revoked → finance nav + path", () => {
    const matrix = withFrontDeskCell("fees_payments", 1);
    expect(
      getPermissionLevelFromMatrix(matrix, "front_desk_student_affairs", "fees_payments"),
    ).toBe(1);
    expect(isFrontDeskDeniedPath("/staff/finance", matrix, "front_desk_student_affairs")).toBe(
      false,
    );
    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).toContain(
      "/staff/finance",
    );
  });

  it("Scenario B2: revoke fees_payments → finance nav + path deny", () => {
    const matrix = withFrontDeskCell("fees_payments", 0);
    expect(isFrontDeskDeniedPath("/staff/finance", matrix, "front_desk_student_affairs")).toBe(
      true,
    );
    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).not.toContain(
      "/staff/finance",
    );
  });

  it("Scenario C: one role's matrix cells do not invent another role's grants", () => {
    const matrix = withFrontDeskCell("banking_finance", 3);
    expect(getPermissionLevelFromMatrix(matrix, "counsellor_consultant", "banking_finance")).toBe(
      0,
    );
    expect(
      specialtyNavFromEffectiveMatrix("counsellor_consultant", matrix).map((i) => i.to),
    ).not.toContain("/staff/banking");
  });

  it("keeps Front Desk reports hard-denied even when matrix View=1", () => {
    const matrix = mergePermissionMatrixCells(
      [{ businessRole: "front_desk_student_affairs", module: "reports", level: 1 }],
      cloneDefaultPermissionMatrix(),
    );
    expect(isFrontDeskSpecialtyHardDenyPath("/staff/reports")).toBe(true);
    expect(
      specialtyNavFromEffectiveMatrix("front_desk_student_affairs", matrix).map((i) => i.to),
    ).not.toContain("/staff/reports");
    expect(isFrontDeskDeniedPath("/staff/reports", matrix)).toBe(true);
  });
});
