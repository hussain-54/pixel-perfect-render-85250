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
    expect(metrics.depositCasPending).toBe(0);
    expect(metrics.visaInProgress).toBe(0);
    expect(metrics.overdueTasks).toBe(0);
    expect(metrics.refusedRejected).toBe(0);
    expect(metrics.pipeline.submitted).toBe(1);
    expect(metrics.pipeline.offers).toBe(1);
    expect(metrics.actionRequired).toBeGreaterThanOrEqual(2);
  });

  it("counts deposit/CAS, visa, overdue tasks, and rejected apps", () => {
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
          stage: "Rejected",
          officerId: "me",
          deadline: "",
          daysLeft: null,
          deadlineWarning: false,
        },
      ],
      handovers: [],
      documents: [],
      deposits: [{ studentId: "s2", status: "due" }],
      casRecords: [{ studentId: "s3", status: "requested" }],
      visas: [
        { studentId: "s4", stage: "filed", decision: "pending" },
        { studentId: "s5", stage: "decision", decision: "approved" },
      ],
      overdueTaskCount: 3,
    });
    expect(metrics.depositCasPending).toBe(2);
    expect(metrics.visaInProgress).toBe(1);
    expect(metrics.overdueTasks).toBe(3);
    expect(metrics.refusedRejected).toBe(1);
    expect(metrics.pipeline.visa).toBe(1);
    expect(metrics.pipeline.refused).toBe(1);
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

  it("splitPortalHref keeps path and query for router navigate", async () => {
    const { splitPortalHref } = await import("./utils");
    expect(splitPortalHref("/staff/documents?tab=missing&studentId=abc")).toEqual({
      to: "/staff/documents",
      search: { tab: "missing", studentId: "abc" },
    });
    expect(splitPortalHref("/staff/offers")).toEqual({
      to: "/staff/offers",
      search: {},
    });
  });

  it("resolves notification deep links without collapsing every path to handovers", () => {
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/applications",
        studentId: "abc",
      }),
    ).toBe("/staff/applications?focus=handovers&studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/applications?focus=offers",
        studentId: "abc",
      }),
    ).toBe("/staff/applications?focus=offers&studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/documents",
        studentId: "abc",
      }),
    ).toBe("/staff/documents?studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/offers",
        studentId: null,
      }),
    ).toBe("/staff/offers");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/finance",
        studentId: "abc",
      }),
    ).toBe("/staff/finance?studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/finance?feeId=fee-1&ledger=university",
        studentId: "abc",
      }),
    ).toBe("/staff/finance?feeId=fee-1&ledger=university&studentId=abc");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: "/staff/students/abc",
        studentId: "abc",
      }),
    ).toBe("/staff/students/abc?tab=applications");
    expect(
      resolveAdmissionNotificationHref({
        linkPath: null,
        studentId: "abc",
      }),
    ).toBe("/staff/applications?focus=handovers&studentId=abc");
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
