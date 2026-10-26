import { describe, expect, it } from "vitest";
import {
  ADMISSION_MUTATE_REQUIRES_ACCEPTED_OWNERSHIP,
  ADMISSION_STUDENTS_SELECT_USES_CAN_ACCESS,
  admissionCanMutateStudentViaHandover,
  admissionCanSelectStudentViaHandover,
} from "./admission-handover-access-rules";

describe("admission handover access rules", () => {
  it("documents SELECT alignment with can_access_student", () => {
    expect(ADMISSION_STUDENTS_SELECT_USES_CAN_ACCESS).toBe(true);
  });

  it("allows Admission Team SELECT on submitted or accepted handovers", () => {
    expect(
      admissionCanSelectStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "submitted",
      }),
    ).toBe(true);
    expect(
      admissionCanSelectStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "accepted",
      }),
    ).toBe(true);
    expect(
      admissionCanSelectStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "returned",
      }),
    ).toBe(false);
    expect(
      admissionCanSelectStudentViaHandover({
        businessRole: "front_desk_student_affairs",
        handoverStatus: "accepted",
      }),
    ).toBe(false);
  });

  it("requires accepted ownership for mutate", () => {
    expect(ADMISSION_MUTATE_REQUIRES_ACCEPTED_OWNERSHIP).toBe(true);
    expect(
      admissionCanMutateStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "submitted",
        toOwnerId: null,
        actorUserId: "u1",
      }),
    ).toBe(false);
    expect(
      admissionCanMutateStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "accepted",
        toOwnerId: "u1",
        actorUserId: "u1",
      }),
    ).toBe(true);
    expect(
      admissionCanMutateStudentViaHandover({
        businessRole: "admission_team",
        handoverStatus: "accepted",
        toOwnerId: "u2",
        actorUserId: "u1",
      }),
    ).toBe(false);
  });
});
