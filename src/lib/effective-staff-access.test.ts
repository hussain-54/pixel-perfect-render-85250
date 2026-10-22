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
import { isFrontDeskDeniedPath, canVerifySignupFeeAction } from "./staff-business-access";
import { buildStaffNav } from "./staff-nav";
import { canMutateMarketing, canViewMarketing } from "./marketing-rules";
import { assertModulePermission } from "@/server/staff-access";
import { AuthError } from "@/server/portal-auth";
import type { TrustedSession } from "@/server/portal-auth";

function withFrontDeskCell(
  module: "fees_payments" | "banking_finance" | "digital_marketing",
  level: 0 | 1 | 2 | 3,
): PermissionMatrix {
  return mergePermissionMatrixCells(
    [{ businessRole: "front_desk_student_affairs", module, level }],
    cloneDefaultPermissionMatrix(),
  );
}

function session(
  businessRole: NonNullable<TrustedSession["businessRole"]> | null,
): TrustedSession {
  return {
    email: "fd@example.com",
    source: "demo",
    userId: "u-fd",
    role: "consultant",
    businessRole,
  };
}

describe("effective staff access — Front Desk grant/revoke + open-session semantics", () => {
  it("Scenario A: grant banking_finance View → nav + path allow; verify still denied", () => {
    const matrix = withFrontDeskCell("banking_finance", 1);

    expect(
      getPermissionLevelFromMatrix(matrix, "front_desk_student_affairs", "banking_finance"),
    ).toBe(1);

    const nav = specialtyNavFromEffectiveMatrix("front_desk_student_affairs", matrix).map(
      (i) => i.to,
    );
    expect(nav).toContain("/staff/finance");
    expect(nav).toContain("/staff/banking");
    expect(nav).not.toContain("/staff/reports");

    expect(isFrontDeskDeniedPath("/staff/banking", matrix, "front_desk_student_affairs")).toBe(
      false,
    );

    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).toEqual(
      expect.arrayContaining(["/staff/front-desk", "/staff/banking", "/staff/finance"]),
    );

    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);

    expect(() =>
      assertModulePermission(
        session("front_desk_student_affairs"),
        "banking_finance",
        1,
        "banking",
        matrix,
      ),
    ).not.toThrow();
  });

  it("Scenario B: revoke banking_finance → nav + path + server deny", () => {
    const matrix = withFrontDeskCell("banking_finance", 0);
    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).not.toContain(
      "/staff/banking",
    );
    expect(isFrontDeskDeniedPath("/staff/banking", matrix, "front_desk_student_affairs")).toBe(
      true,
    );
    expect(() =>
      assertModulePermission(
        session("front_desk_student_affairs"),
        "banking_finance",
        1,
        "banking",
        matrix,
      ),
    ).toThrow(AuthError);
  });

  it("Scenario A3: grant digital_marketing View → nav + path; mutate still denied", () => {
    const matrix = withFrontDeskCell("digital_marketing", 1);
    expect(
      getPermissionLevelFromMatrix(matrix, "front_desk_student_affairs", "digital_marketing"),
    ).toBe(1);

    expect(
      specialtyNavFromEffectiveMatrix("front_desk_student_affairs", matrix).map((i) => i.to),
    ).toContain("/staff/marketing");
    expect(isFrontDeskDeniedPath("/staff/marketing", matrix, "front_desk_student_affairs")).toBe(
      false,
    );
    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).toContain(
      "/staff/marketing",
    );

    expect(
      canViewMarketing({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
    expect(
      canMutateMarketing({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);

    expect(() =>
      assertModulePermission(
        session("front_desk_student_affairs"),
        "digital_marketing",
        1,
        "marketing",
        matrix,
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session("front_desk_student_affairs"),
        "digital_marketing",
        2,
        "marketing edit",
        matrix,
      ),
    ).toThrow(AuthError);
  });

  it("Scenario B3: revoke digital_marketing → nav + path deny", () => {
    const matrix = withFrontDeskCell("digital_marketing", 0);
    expect(buildStaffNav("front_desk_student_affairs", matrix).map((i) => i.to)).not.toContain(
      "/staff/marketing",
    );
    expect(isFrontDeskDeniedPath("/staff/marketing", matrix, "front_desk_student_affairs")).toBe(
      true,
    );
    expect(() =>
      assertModulePermission(
        session("front_desk_student_affairs"),
        "digital_marketing",
        1,
        "marketing",
        matrix,
      ),
    ).toThrow(AuthError);
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
