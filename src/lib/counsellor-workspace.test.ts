import { describe, expect, it } from "vitest";
import {
  attentionMatchesKpiFilter,
  attentionMatchesListFilter,
  buildCounsellorAttentionItems,
  buildCounsellorPrioritySummary,
  computeCounsellorWorkbenchMetrics,
  counsellorHasActionableNext,
  isTaskDueOnOrBeforeToday,
  isTaskDueToday,
  isTaskPastDue,
  profileTabForAttentionKind,
  resolveAttentionOpenTarget,
  resolveCounsellorNotificationHref,
  studentMatchesKpiFilter,
  urgencyGroupFromPriority,
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
  hasDueTodayTask: false,
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
    expect(metrics.awaitingInitialAssessment).toBe(1);
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

  it("builds one attention item per student with priority and actionable metadata", () => {
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
    const returned = items.find((i) => i.studentId === "a");
    const task = items.find((i) => i.studentId === "b");
    expect(returned?.kind).toBe("handover");
    expect(returned?.urgencyGroup).toBe("critical");
    expect(returned?.primaryActionLabel).toBeTruthy();
    expect(returned?.profileTab).toBe("applications");
    expect(returned?.nextResponsibleRole).toBe("Counsellor");
    expect(task?.kind).toBe("task");
    expect(task?.title).toBe("Overdue follow-up task");
    expect(task?.profileTab).toBe("overview");
  });

  it("keeps actionRequired total consistent with uncapped attention students", () => {
    const students = Array.from({ length: 12 }, (_, i) => ({
      ...base,
      id: `s${i}`,
      caseId: `GR-${i}`,
      name: `Student ${i}`,
      lastActivity: `2026-10-${String(10 + (i % 9)).padStart(2, "0")}T12:00:00.000Z`,
      hasAssessment: false,
    }));
    const metrics = computeCounsellorWorkbenchMetrics({
      students,
      applicationsInProgressCount: 0,
      followUpsDueCount: 0,
      docsToReviewCount: 0,
      deadlinesThisWeekCount: 0,
    });
    const capped = buildCounsellorAttentionItems(students, 10);
    const uncapped = buildCounsellorAttentionItems(students, students.length);
    expect(metrics.actionRequired).toBe(12);
    expect(capped).toHaveLength(10);
    expect(uncapped).toHaveLength(12);
    expect(metrics.actionRequired).toBe(uncapped.length);
    expect(metrics.actionRequired).toBeGreaterThan(capped.length);
  });

  it("maps attention kinds to profile tabs", () => {
    expect(profileTabForAttentionKind("document")).toBe("documents");
    expect(profileTabForAttentionKind("task")).toBe("overview");
    expect(profileTabForAttentionKind("handover")).toBe("applications");
    expect(profileTabForAttentionKind("lifecycle")).toBe("assessment");
  });

  it("derives urgency groups only from workflow priority bands", () => {
    expect(urgencyGroupFromPriority(1)).toBe("critical");
    expect(urgencyGroupFromPriority(2)).toBe("high");
    expect(urgencyGroupFromPriority(5)).toBe("normal");
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

  it("distinguishes overdue vs due-today tasks", () => {
    const now = new Date(2026, 9, 22, 15, 0, 0); // local 22 Oct 2026
    const dueToday = new Date(2026, 9, 22, 8, 0, 0).toISOString();
    const overdue = new Date(2026, 9, 21, 12, 0, 0).toISOString();
    const tomorrow = new Date(2026, 9, 23, 12, 0, 0).toISOString();
    expect(isTaskDueOnOrBeforeToday(dueToday, now)).toBe(true);
    expect(isTaskDueToday(dueToday, now)).toBe(true);
    expect(isTaskPastDue(dueToday, now)).toBe(false);
    expect(isTaskPastDue(overdue, now)).toBe(true);
    expect(isTaskDueOnOrBeforeToday(tomorrow, now)).toBe(false);
  });

  it("labels due-today tasks without calling them overdue", () => {
    const items = buildCounsellorAttentionItems([
      { ...base, id: "due", hasDueTodayTask: true, hasAssessment: true, hasConsent: true },
    ]);
    expect(items[0]?.kind).toBe("task");
    expect(items[0]?.title).toBe("Follow-up task due today");
  });

  it("filters KPI and attention lists from persisted snap fields", () => {
    expect(studentMatchesKpiFilter({ ...base, hasAssessment: false }, "awaiting_assessment")).toBe(
      true,
    );
    expect(studentMatchesKpiFilter({ ...base, hasConsent: true }, "consent_recorded")).toBe(true);
    expect(
      studentMatchesKpiFilter(
        { ...base, openFeeRequestStatus: "open", hasAssessment: true, hasConsent: true },
        "awaiting_response",
      ),
    ).toBe(true);
    expect(
      attentionMatchesKpiFilter(
        { kind: "task", title: "Follow-up" },
        { ...base, hasDueTodayTask: true },
        "follow_ups",
      ),
    ).toBe(true);
    expect(
      attentionMatchesListFilter(
        { urgencyGroup: "critical", at: "2026-10-22T12:00:00.000Z", kind: "handover" },
        "urgent",
      ),
    ).toBe(true);
  });

  it("routes task attention to tasks workspace", () => {
    expect(resolveAttentionOpenTarget({ kind: "task", studentId: "s1" }).to).toBe("/staff/tasks");
    expect(
      resolveAttentionOpenTarget({ kind: "lifecycle", studentId: "s1", profileTab: "assessment" }),
    ).toEqual({
      to: "/staff/students/$studentId",
      params: { studentId: "s1" },
      search: { tab: "assessment" },
    });
  });

  it("builds a compact priority summary from live metrics", () => {
    expect(
      buildCounsellorPrioritySummary({
        actionRequired: 2,
        followUpsDue: 1,
        awaitingInitialAssessment: 0,
        awaitingResponse: 3,
      }),
    ).toContain("2 need action");
    expect(
      buildCounsellorPrioritySummary({
        actionRequired: 0,
        followUpsDue: 0,
        awaitingInitialAssessment: 0,
        awaitingResponse: 0,
      }),
    ).toBe("No urgent priorities today");
  });
});
