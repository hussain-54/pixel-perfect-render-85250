import { describe, expect, it } from "vitest";
import {
  buildCounsellorAttentionItems,
  computeCounsellorWorkbenchMetrics,
  counsellorHasActionableNext,
  isTaskDueOnOrBeforeToday,
  resolveCounsellorNotificationHref,
} from "./counsellor-workspace";

const base = {
  id: "s1",
  caseId: "GR-1",
  name: "Ada",
  destination: "UK",
  stageLabel: "Profile Submitted",
  lastActivity: "2026-10-10T12:00:00.000Z",
  hasAssessment: false,
  hasConsent: false,
  signupFeeStatus: "unpaid" as string | null,
  openFeeRequestStatus: null as string | null,
  handoverStatus: null as string | null,
  docsPendingReview: 0,
  hasOverdueTask: false,
};

describe("counsellor-workspace", () => {
  it("does not treat awaiting fee/admission as counsellor action", () => {
    expect(
      counsellorHasActionableNext({
        hasSavedAssessment: true,
        hasConsent: true,
        signupFeeStatus: "claimed",
        openFeeRequestStatus: "in_progress",
        handoverStatus: null,
      }),
    ).toBe(false);
    expect(
      counsellorHasActionableNext({
        hasSavedAssessment: true,
        hasConsent: true,
        signupFeeStatus: "verified",
        openFeeRequestStatus: null,
        handoverStatus: "submitted",
      }),
    ).toBe(false);
  });

  it("counts consent as counselling completed, not registration alone", () => {
    const metrics = computeCounsellorWorkbenchMetrics({
      students: [
        { ...base, id: "a", hasConsent: false },
        { ...base, id: "b", hasConsent: true, hasAssessment: true },
      ],
      applicationsInProgressCount: 3,
      followUpsDueCount: 2,
      docsToReviewCount: 1,
      deadlinesThisWeekCount: 0,
    });
    expect(metrics.assignedStudents).toBe(2);
    expect(metrics.counsellingCompleted).toBe(1);
    expect(metrics.applicationsInProgress).toBe(3);
    expect(metrics.followUpsDue).toBe(2);
  });

  it("dedupes awaiting response across fee and handover for same student", () => {
    const metrics = computeCounsellorWorkbenchMetrics({
      students: [
        {
          ...base,
          id: "a",
          openFeeRequestStatus: "open",
          handoverStatus: "submitted",
        },
        { ...base, id: "b", handoverStatus: "submitted" },
      ],
      applicationsInProgressCount: 0,
      followUpsDueCount: 0,
      docsToReviewCount: 0,
      deadlinesThisWeekCount: 0,
    });
    expect(metrics.awaitingResponse).toBe(2);
  });

  it("builds one attention item per student with priority", () => {
    const items = buildCounsellorAttentionItems([
      {
        ...base,
        id: "a",
        handoverStatus: "returned",
        hasAssessment: true,
        hasConsent: true,
        signupFeeStatus: "verified",
        docsPendingReview: 2,
      },
      { ...base, id: "b", hasOverdueTask: true },
    ]);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.studentId === "a")?.kind).toBe("handover");
    expect(items.find((i) => i.studentId === "b")?.kind).toBe("task");
  });

  it("resolves notification hrefs to counsellor student records", () => {
    expect(
      resolveCounsellorNotificationHref({
        linkPath: "/staff/students",
        studentId: "abc",
      }),
    ).toBe("/staff/students/abc");
    expect(
      resolveCounsellorNotificationHref({
        linkPath: "/staff/front-desk",
        studentId: null,
      }),
    ).toBe("/staff/dashboard");
  });

  it("recognizes due-today tasks", () => {
    const now = new Date("2026-10-22T15:00:00.000Z");
    expect(isTaskDueOnOrBeforeToday("2026-10-22T08:00:00.000Z", now)).toBe(true);
    expect(isTaskDueOnOrBeforeToday("2026-10-23T12:00:00.000Z", now)).toBe(false);
  });
});
