import { describe, expect, it } from "vitest";
import {
  buildStudentNextActions,
  resolveStudentNotificationHref,
  studentApplicationNextAction,
  studentApplicationStageExplain,
} from "./student-portal-workspace";

describe("student-portal-workspace", () => {
  it("keeps notification deep links inside /student only", () => {
    expect(resolveStudentNotificationHref({ linkPath: "/student/documents" })).toBe(
      "/student/documents",
    );
    expect(resolveStudentNotificationHref({ linkPath: "/staff/dashboard" })).toBe(
      "/student/notifications",
    );
    expect(resolveStudentNotificationHref({ linkPath: null })).toBe("/student/notifications");
  });

  it("does not claim university submission for Under Review", () => {
    expect(studentApplicationStageExplain("Under Review")).toMatch(/not yet submitted/i);
    expect(studentApplicationNextAction("Submitted")).toMatch(/university/i);
  });

  it("prioritises fee and document actions", () => {
    const actions = buildStudentNextActions({
      profilePercent: 90,
      feeStatus: "rejected",
      portalActivated: false,
      docsNeedingAction: 2,
      appsDocsPending: 0,
      hasCounsellor: true,
      hasUpcomingAppointment: true,
      pendingTimelineCount: 0,
    });
    expect(actions[0]?.id).toBe("fee");
    expect(actions.some((a) => a.id === "docs")).toBe(true);
  });
});
