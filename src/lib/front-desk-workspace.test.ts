import { describe, expect, it } from "vitest";
import {
  buildFrontDeskAttentionItems,
  buildFrontDeskRecordTimeline,
  computeFrontDeskDashboardMetrics,
  deriveFrontDeskNextAction,
  frontDeskNextActionCta,
  isJourneyApplicationInProgress,
  resolveFrontDeskNotificationHref,
} from "./front-desk-workspace";

const intakeBase = {
  id: "s1",
  caseId: "GR-1",
  fullName: "Ada Student",
  counsellorName: null as string | null,
  assignmentStatus: "pending" as const,
  signupFeeStatus: "unpaid" as string | null,
  journeyStage: "profile_submitted",
  portalActivatedAt: null as string | null,
  profileId: null as string | null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
};

describe("front-desk-workspace", () => {
  it("treats application journey stages separately from early intake", () => {
    expect(isJourneyApplicationInProgress("profile_submitted")).toBe(false);
    expect(isJourneyApplicationInProgress("university_shortlisting")).toBe(false);
    expect(isJourneyApplicationInProgress("application_submitted")).toBe(true);
    expect(isJourneyApplicationInProgress("visa_preparation")).toBe(true);
  });

  it("prioritizes fee sync over assignment when request is stuck", () => {
    const next = deriveFrontDeskNextAction({
      assignmentStatus: "pending",
      signupFeeStatus: "verified",
      openFeeRequest: {
        status: "in_progress",
        forwardedAt: "2026-10-03T00:00:00.000Z",
        signupFeeStatus: "verified",
      },
    });
    expect(next.code).toBe("sync_fee_request");
  });

  it("asks to assign counsellor when no open fee action", () => {
    const next = deriveFrontDeskNextAction({
      assignmentStatus: "pending",
      signupFeeStatus: "claimed",
      openFeeRequest: null,
    });
    expect(next.code).toBe("assign_counsellor");
  });

  it("ignores cancelled coordination when a fee ledger row already exists", () => {
    const next = deriveFrontDeskNextAction({
      assignmentStatus: "assigned",
      signupFeeStatus: "claimed",
      openFeeRequest: {
        status: "cancelled",
        forwardedAt: "2026-10-01T00:00:00.000Z",
        signupFeeStatus: "claimed",
      },
    });
    expect(next.code).toBe("await_finance");
    expect(next.label).toMatch(/awaiting Finance/i);
  });

  it("excludes historical cancelled coordination from actionable KPI counts", () => {
    const metrics = computeFrontDeskDashboardMetrics({
      intakeRows: [
        {
          ...intakeBase,
          id: "hina",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "claimed",
        },
      ],
      feeRequests: [
        {
          id: "old-cancelled",
          studentId: "hina",
          caseId: "GR-1",
          fullName: "Hina Khan",
          status: "cancelled",
          signupFeeStatus: "claimed",
          summary: "Had fee ledger",
          coordinatorNote: "Forwarded then cancelled",
          forwardedAt: "2026-09-01T00:00:00.000Z",
          resolvedAt: "2026-09-02T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          feeVerifiedAt: null,
        },
      ],
    });
    expect(metrics.actionRequired).toBe(0);
    expect(metrics.feeVerification).toBe(1);
    expect(metrics.unpaidVouchers).toBe(0);
    expect(metrics.proofsAwaitingFinance).toBe(1);
    expect(metrics.verifiedFees).toBe(0);
  });

  it("keeps needs-correction cancelled in attention but not historical cancelled", () => {
    const items = buildFrontDeskAttentionItems({
      intakeRows: [
        {
          ...intakeBase,
          id: "corr",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: null,
        },
        {
          ...intakeBase,
          id: "hist",
          caseId: "GR-2",
          fullName: "Hist",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "claimed",
        },
      ],
      feeRequests: [
        {
          id: "c1",
          studentId: "corr",
          caseId: "GR-1",
          fullName: "Ada",
          status: "cancelled",
          signupFeeStatus: null,
          summary: "Fix docs",
          coordinatorNote: null,
          forwardedAt: null,
          resolvedAt: "2026-10-05T00:00:00.000Z",
          createdAt: "2026-10-04T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
          feeVerifiedAt: null,
        },
        {
          id: "c2",
          studentId: "hist",
          caseId: "GR-2",
          fullName: "Hist",
          status: "cancelled",
          signupFeeStatus: "claimed",
          summary: "Old",
          coordinatorNote: null,
          forwardedAt: "2026-09-01T00:00:00.000Z",
          resolvedAt: "2026-09-02T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          feeVerifiedAt: null,
        },
      ],
    });
    expect(items.some((i) => i.kind === "fee_correction" && i.studentId === "corr")).toBe(true);
    expect(items.some((i) => i.studentId === "hist")).toBe(false);
    expect(items.some((i) => /historical/i.test(i.title))).toBe(false);
  });

  it("separates unpaid vouchers from claimed proofs and portal-pending", () => {
    const metrics = computeFrontDeskDashboardMetrics({
      intakeRows: [
        { ...intakeBase, id: "u1", signupFeeStatus: "unpaid" },
        {
          ...intakeBase,
          id: "c1",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "claimed",
        },
        {
          ...intakeBase,
          id: "v1",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "verified",
          portalActivatedAt: null,
        },
        {
          ...intakeBase,
          id: "v2",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "verified",
          portalActivatedAt: "2026-10-10T00:00:00.000Z",
        },
      ],
      feeRequests: [],
    });
    expect(metrics.unpaidVouchers).toBe(1);
    expect(metrics.proofsAwaitingFinance).toBe(1);
    expect(metrics.feeVerification).toBe(2);
    expect(metrics.verifiedFees).toBe(2);
    expect(metrics.portalLinkPending).toBe(1);
    expect(metrics.assignedToCounsellors).toBe(3);
    expect(frontDeskNextActionCta("assign_counsellor")).toBe("Assign counsellor");
  });

  it("computes KPIs without double-counting action required", () => {
    const metrics = computeFrontDeskDashboardMetrics({
      intakeRows: [
        {
          ...intakeBase,
          id: "a",
          assignmentStatus: "pending",
          signupFeeStatus: "verified",
        },
        {
          ...intakeBase,
          id: "b",
          assignmentStatus: "assigned",
          counsellorName: "C",
          signupFeeStatus: "claimed",
          journeyStage: "application_submitted",
        },
      ],
      feeRequests: [
        {
          id: "r1",
          studentId: "a",
          caseId: "GR-1",
          fullName: "Ada",
          status: "open",
          signupFeeStatus: "claimed",
          summary: "Please verify",
          coordinatorNote: null,
          forwardedAt: null,
          resolvedAt: null,
          createdAt: "2026-10-04T00:00:00.000Z",
          updatedAt: "2026-10-04T00:00:00.000Z",
          feeVerifiedAt: null,
        },
      ],
    });
    expect(metrics.totalRegistrations).toBe(2);
    expect(metrics.awaitingCounsellor).toBe(1);
    expect(metrics.feeVerification).toBe(1);
    expect(metrics.applicationsInProgress).toBe(1);
    // student a is both unassigned and open-fee — counted once
    expect(metrics.actionRequired).toBe(1);
  });

  it("builds attention items for open fee and unassigned without fee", () => {
    const items = buildFrontDeskAttentionItems({
      intakeRows: [
        { ...intakeBase, id: "a" },
        {
          ...intakeBase,
          id: "b",
          caseId: "GR-2",
          fullName: "Bob",
          assignmentStatus: "pending",
        },
      ],
      feeRequests: [
        {
          id: "r1",
          studentId: "a",
          caseId: "GR-1",
          fullName: "Ada",
          status: "open",
          signupFeeStatus: "claimed",
          summary: "Verify fee",
          coordinatorNote: null,
          forwardedAt: null,
          resolvedAt: null,
          createdAt: "2026-10-05T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
          feeVerifiedAt: null,
        },
      ],
    });
    expect(items.some((i) => i.kind === "fee_open" && i.studentId === "a")).toBe(true);
    expect(items.some((i) => i.kind === "unassigned" && i.studentId === "b")).toBe(true);
    expect(items.some((i) => i.kind === "unassigned" && i.studentId === "a")).toBe(false);
  });

  it("keeps timeline kinds distinct", () => {
    const timeline = buildFrontDeskRecordTimeline({
      student: {
        ...intakeBase,
        assignmentStatus: "assigned",
        counsellorName: "Counselor One",
        signupFeeStatus: "claimed",
        journeyStage: "consultation_completed",
        registrarName: "Front Desk",
      },
      feeRequests: [
        {
          id: "r1",
          studentId: "s1",
          caseId: "GR-1",
          fullName: "Ada",
          status: "in_progress",
          signupFeeStatus: "claimed",
          summary: "Please verify",
          coordinatorNote: "Sent",
          forwardedAt: "2026-10-03T12:00:00.000Z",
          resolvedAt: null,
          createdAt: "2026-10-03T10:00:00.000Z",
          updatedAt: "2026-10-03T12:00:00.000Z",
          feeVerifiedAt: null,
        },
      ],
    });
    const kinds = new Set(timeline.map((t) => t.kind));
    expect(kinds.has("registration")).toBe(true);
    expect(kinds.has("counsellor")).toBe(true);
    expect(kinds.has("signup_fee")).toBe(true);
    expect(kinds.has("fee_verification")).toBe(true);
    expect(kinds.has("journey")).toBe(true);
  });

  it("resolves notification hrefs to FD-safe record paths", () => {
    expect(
      resolveFrontDeskNotificationHref({
        linkPath: "/staff/front-desk",
        studentId: "abc",
      }),
    ).toBe("/staff/intake/abc");
    expect(
      resolveFrontDeskNotificationHref({
        linkPath: "/staff/students/xyz",
        studentId: null,
      }),
    ).toBe("/staff/intake/xyz");
    expect(
      resolveFrontDeskNotificationHref({
        linkPath: "/staff/applications",
        studentId: null,
      }),
    ).toBe("/staff/front-desk");
  });
});
