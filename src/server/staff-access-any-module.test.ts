import { describe, expect, it } from "vitest";
import { cloneDefaultPermissionMatrix, getPermissionLevelFromMatrix } from "@/lib/business-permissions";
import { AuthError } from "@/server/portal-auth";
import { forbidAdmissionMockDataPlane } from "@/server/staff-access";

/**
 * Documents the Admission Team exception for shared desk mutations:
 * students Edit OR admissions Edit (see requireAnyModulePermission).
 */
describe("Admission Team shared desk mutation gates", () => {
  const matrix = cloneDefaultPermissionMatrix();

  it("allows Admission via admissions Edit while students stays View", () => {
    const students = getPermissionLevelFromMatrix(matrix, "admission_team", "students");
    const admissions = getPermissionLevelFromMatrix(matrix, "admission_team", "admissions");
    expect(students).toBe(1);
    expect(admissions).toBe(3);
    const canMutateTasksOrAppointments = students >= 2 || admissions >= 2;
    expect(canMutateTasksOrAppointments).toBe(true);
  });

  it("allows Counsellor via students Edit", () => {
    const students = getPermissionLevelFromMatrix(matrix, "counsellor_consultant", "students");
    const admissions = getPermissionLevelFromMatrix(matrix, "counsellor_consultant", "admissions");
    expect(students).toBe(2);
    expect(admissions).toBe(1);
    const canMutateTasksOrAppointments = students >= 2 || admissions >= 2;
    expect(canMutateTasksOrAppointments).toBe(true);
  });

  it("does not grant Front Desk task/appointment mutations via admissions", () => {
    const students = getPermissionLevelFromMatrix(matrix, "front_desk_student_affairs", "students");
    const admissions = getPermissionLevelFromMatrix(
      matrix,
      "front_desk_student_affairs",
      "admissions",
    );
    const canMutateTasksOrAppointments = students >= 2 || admissions >= 2;
    // Front Desk has students Edit but is denied by denyFrontDeskConsultantWorkflows separately.
    expect(students).toBe(2);
    expect(admissions).toBe(1);
    expect(canMutateTasksOrAppointments).toBe(true);
  });
});

describe("forbidAdmissionMockDataPlane", () => {
  it("blocks admission_team on demo sessions", () => {
    expect(() =>
      forbidAdmissionMockDataPlane({
        role: "consultant",
        email: "x@example.com",
        source: "demo",
        businessRole: "admission_team",
      }),
    ).toThrow(AuthError);
  });

  it("allows admission_team on supabase sessions", () => {
    expect(() =>
      forbidAdmissionMockDataPlane({
        role: "consultant",
        email: "x@example.com",
        source: "supabase",
        userId: "uid",
        businessRole: "admission_team",
      }),
    ).not.toThrow();
  });

  it("does not block counsellor demo sessions", () => {
    expect(() =>
      forbidAdmissionMockDataPlane({
        role: "consultant",
        email: "consultant@globalroots.pk",
        source: "demo",
        businessRole: "counsellor_consultant",
      }),
    ).not.toThrow();
  });
});
