import { describe, expect, it } from "vitest";
import {
  buildAdmissionAttentionItems,
  computeAdmissionWorkbenchMetrics,
  deriveAdmissionNextAction,
  formatApplicationRef,
  resolveAdmissionNotificationHref,
} from "./admission-workspace";

describe("admission-workspace", () => {
  it("keeps handover review distinct from application stages", () => {
    const next = deriveAdmissionNextAction({
      stage: "Under Review",
      handoverStatus: "submitted",
      docsNeedingAttention: false,
      deadlineWarning: false,
    });
    expect(next.label).toMatch(/handover/i);
  });

  it("computes KPIs without treating registration as an application", () => {
    const metrics = computeAdmissionWorkbenchMetrics({
      viewerUserId: "me",
      applications: [
        {
          id: "a1",
          studentId: "s1",
          studentName: "Ada",
          studentCaseId: "GR-1",
          university: "U1",
          program: "Law",
          stage: "Docs Pending",
          officerId: "me",
          deadline: "2026-11-01",
          daysLeft: 5,
          deadlineWarning: true,
        },
        {
          id: "a2",
          studentId: "s2",
          studentName: "Bob",
          studentCaseId: "GR-2",
          university: "U2",
          program: "CS",
          stage: "Submitted",
          officerId: "other",
          deadline: "",
          daysLeft: null,
          deadlineWarning: false,
        },
        {
          id: "a3",
          studentId: "s3",
          studentName: "Cara",
          studentCaseId: "GR-3",
          university: "U3",
          program: "MBA",
          stage: "Offer Received",
          officerId: "me",
          deadline: "",
          daysLeft: null,
          deadlineWarning: false,
        },
      ],
      handovers: [
        {
          id: "h1",
          studentId: "s4",
          studentName: "Dan",
          studentCaseId: "GR-4",
          status: "submitted",
          summary: "Ready",
          missingInformation: null,
          handedOverAt: "2026-10-20T00:00:00.000Z",
          toOwnerId: null,
        },
        {
          id: "h2",
          studentId: "s5",
          studentName: "Eve",
          studentCaseId: "GR-5",
          status: "returned",
          summary: "Need docs",
          missingInformation: "Passport",
          handedOverAt: "2026-10-19T00:00:00.000Z",
          toOwnerId: null,
        },
      ],
      documents: [],
    });
    expect(metrics.assignedToMe).toBe(2);
    expect(metrics.awaitingInitialReview).toBe(1);
    expect(metrics.submittedToUniversity).toBe(1);
    expect(metrics.offersDecisionsReceived).toBe(1);
    expect(metrics.returnedForCorrection).toBe(1);
    expect(metrics.documentsMissing).toBe(1);
    expect(metrics.actionRequired).toBeGreaterThanOrEqual(2);
  });

  it("prioritises submitted handovers in attention list", () => {
    const items = buildAdmissionAttentionItems({
      applications: [],
      handovers: [
        {
          id: "h1",
          studentId: "s1",
          studentName: "Ada",
          studentCaseId: "GR-1",
          status: "submitted",
          summary: "Please review",
          missingInformation: null,
          handedOverAt: "2026-10-21T00:00:00.000Z",
          toOwnerId: null,
        },
      ],
    });
    expect(items[0]?.kind).toBe("handover");
  });

  it("resolves notification deep links to applications when possible", () => {
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/applications",
        studentId: "abc",
      }),
    ).toBe("/staff/applications?focus=handovers&studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: null,
        studentId: "abc",
      }),
    ).toBe("/staff/applications?focus=handovers&studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/applications",
        studentId: null,
      }),
    ).toBe("/staff/applications?focus=handovers");
  });

  it("formats handover status labels for staff UI", async () => {
    const { formatAdmissionHandoverStatusLabel } = await import("./admission-workspace");
    expect(formatAdmissionHandoverStatusLabel("submitted")).toBe("Sent to Admission");
    expect(formatAdmissionHandoverStatusLabel("accepted")).toBe("Received by Admission");
    expect(formatAdmissionHandoverStatusLabel("returned")).toBe("Returned for Clarification");
  });

  it("formats application refs without inventing business ids", () => {
    expect(formatApplicationRef({ id: "12345678-abcd", portalRef: "APP-9" })).toBe("APP-9");
    expect(formatApplicationRef({ id: "12345678-abcd-efgh", portalRef: null })).toBe("12345678…");
  });
});
