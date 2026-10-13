import { describe, expect, it } from "vitest";
import {
  canDecideLeave,
  canDecideLeaveRequest,
  canMutateHr,
  canRehireTerminated,
  canViewHr,
  isDuplicateAttendanceKey,
  isValidEmploymentTransition,
  summarizeAttendance,
  validateAttendanceDate,
  validateEmployeeCreate,
  validateLeaveRange,
} from "./hr-rules";

describe("HR access and employment rules", () => {
  it("allows HR/Admin to view and mutate; denies counsellor mutate", () => {
    expect(canViewHr({ appRole: "admin", businessRole: "admin" })).toBe(true);
    expect(canMutateHr({ appRole: "consultant", businessRole: "hr_system" })).toBe(true);
    expect(canMutateHr({ appRole: "consultant", businessRole: "counsellor_consultant" })).toBe(
      false,
    );
    expect(canViewHr({ appRole: "consultant", businessRole: "counsellor_consultant" })).toBe(true);
  });

  it("keeps Admin and Super Admin distinct for rehire", () => {
    expect(canRehireTerminated("admin")).toBe(false);
    expect(canRehireTerminated("super_admin")).toBe(true);
    expect(
      isValidEmploymentTransition({ from: "terminated", to: "active", appRole: "admin" }),
    ).toBe(false);
    expect(
      isValidEmploymentTransition({ from: "terminated", to: "active", appRole: "super_admin" }),
    ).toBe(true);
  });

  it("validates employee create fields", () => {
    expect(validateEmployeeCreate({ employeeCode: "", fullName: "A" }).ok).toBe(false);
    expect(validateEmployeeCreate({ employeeCode: "E1", fullName: "Ann" }).ok).toBe(true);
  });
});

describe("HR attendance rules", () => {
  it("rejects future dates and accepts today", () => {
    expect(validateAttendanceDate("2026-12-31", "2026-03-01T00:00:00Z").ok).toBe(false);
    expect(validateAttendanceDate("2026-03-01", "2026-03-01T12:00:00Z").ok).toBe(true);
  });

  it("detects duplicate employee/date keys", () => {
    expect(
      isDuplicateAttendanceKey([{ employeeId: "e1", workDate: "2026-01-01" }], "e1", "2026-01-01"),
    ).toBe(true);
    expect(
      isDuplicateAttendanceKey([{ employeeId: "e1", workDate: "2026-01-01" }], "e1", "2026-01-02"),
    ).toBe(false);
  });

  it("summarizes attendance statuses without fabricating rows", () => {
    const s = summarizeAttendance([
      { status: "present" },
      { status: "late" },
      { status: "present" },
    ]);
    expect(s.present).toBe(2);
    expect(s.late).toBe(1);
    expect(s.absent).toBe(0);
  });
});

describe("HR leave decisions", () => {
  it("requires HR/Manager for approve/reject; owner may cancel pending", () => {
    expect(canDecideLeave({ appRole: "consultant", businessRole: "counsellor_consultant" })).toBe(
      false,
    );
    expect(canDecideLeave({ appRole: "consultant", businessRole: "hr_system" })).toBe(true);

    expect(
      canDecideLeaveRequest({
        currentStatus: "pending",
        action: "approve",
        isOwner: true,
        canDecide: false,
      }).ok,
    ).toBe(false);

    expect(
      canDecideLeaveRequest({
        currentStatus: "pending",
        action: "cancel",
        isOwner: true,
        canDecide: false,
      }),
    ).toEqual({ ok: true, next: "cancelled" });

    expect(
      canDecideLeaveRequest({
        currentStatus: "pending",
        action: "approve",
        isOwner: false,
        canDecide: true,
      }),
    ).toEqual({ ok: true, next: "approved" });
  });

  it("validates leave date range", () => {
    expect(validateLeaveRange("2026-02-10", "2026-02-09").ok).toBe(false);
    expect(validateLeaveRange("2026-02-10", "2026-02-12").ok).toBe(true);
  });
});
