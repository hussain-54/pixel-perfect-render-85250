import { describe, expect, it } from "vitest";
import {
  assertTimelineOwner,
  buildStudentJourneyTimeline,
  type StudentJourneyTimelineSource,
} from "./student-journey-timeline";

function baseSource(
  overrides: Partial<StudentJourneyTimelineSource> = {},
): StudentJourneyTimelineSource {
  return {
    student: {
      id: "stu-1",
      createdAt: "2026-01-01T10:00:00Z",
      portalActivatedAt: null,
      assignedConsultantId: null,
      journeyStage: "profile_submitted",
      inquirySource: "walk-in",
    },
    signupFee: null,
    appointments: [],
    assessments: [],
    agreements: [],
    handovers: [],
    documents: [],
    applications: [],
    offers: [],
    universityFees: [],
    visas: [],
    nowIso: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("student journey timeline", () => {
  it("includes registration from persisted student created_at only", () => {
    const tl = buildStudentJourneyTimeline(baseSource());
    expect(tl.items).toHaveLength(1);
    expect(tl.items[0]?.category).toBe("registration");
    expect(tl.items[0]?.status).toBe("completed");
    expect(tl.items[0]?.at).toBe("2026-01-01T10:00:00Z");
  });

  it("does not invent completed signup fee when none exists", () => {
    const tl = buildStudentJourneyTimeline(baseSource());
    expect(tl.items.find((i) => i.category === "signup_fee")).toBeUndefined();
  });

  it("keeps claimed signup fee distinct from verified and blocks activation completion", () => {
    const tl = buildStudentJourneyTimeline(
      baseSource({
        signupFee: {
          id: "fee-1",
          status: "claimed",
          createdAt: "2026-01-02T10:00:00Z",
          verifiedAt: null,
          amount: 5000,
          currency: "PKR",
        },
      }),
    );
    const fee = tl.items.find((i) => i.category === "signup_fee");
    expect(fee?.status).toBe("claimed");
    expect(fee?.pendingAction).toMatch(/claimed is not verified/i);
    expect(
      tl.items.find((i) => i.category === "activation" && i.status === "completed"),
    ).toBeUndefined();
  });

  it("marks returned handovers and rejected docs distinctly", () => {
    const tl = buildStudentJourneyTimeline(
      baseSource({
        handovers: [
          {
            id: "h1",
            status: "returned",
            handedOverAt: "2026-02-01T12:00:00Z",
            summary: "Missing IELTS",
          },
        ],
        documents: [
          {
            id: "d1",
            label: "Passport",
            status: "rejected",
            createdAt: "2026-02-02T12:00:00Z",
            updatedAt: "2026-02-03T12:00:00Z",
          },
        ],
      }),
    );
    expect(tl.items.find((i) => i.category === "handover")?.status).toBe("returned");
    expect(tl.items.find((i) => i.category === "document")?.status).toBe("rejected");
  });

  it("flags overdue university fees without treating claimed as verified", () => {
    const tl = buildStudentJourneyTimeline(
      baseSource({
        universityFees: [
          {
            id: "uf1",
            kind: "application_fee",
            label: "App fee",
            status: "claimed",
            amount: 100,
            currency: "USD",
            createdAt: "2026-01-10T00:00:00Z",
            verifiedAt: null,
            dueDate: "2026-02-01",
          },
        ],
      }),
    );
    const fee = tl.items.find((i) => i.category === "university_fee");
    expect(fee?.status).toBe("overdue");
    expect(fee?.pendingAction).toMatch(/claimed ≠ verified|claimed/i);
  });

  it("sorts chronological by timestamp", () => {
    const tl = buildStudentJourneyTimeline(
      baseSource({
        signupFee: {
          id: "fee-1",
          status: "verified",
          createdAt: "2026-01-02T10:00:00Z",
          verifiedAt: "2026-01-03T10:00:00Z",
        },
        student: {
          id: "stu-1",
          createdAt: "2026-01-01T10:00:00Z",
          portalActivatedAt: "2026-01-03T11:00:00Z",
          assignedConsultantId: "c1",
          journeyStage: "consultation_completed",
        },
      }),
    );
    const ats = tl.items.map((i) => i.at).filter(Boolean) as string[];
    expect([...ats].sort((a, b) => a.localeCompare(b))).toEqual(ats);
  });

  it("enforces student ownership for timeline access", () => {
    expect(
      assertTimelineOwner({
        sessionStudentId: "stu-1",
        timelineStudentId: "stu-2",
        isStaff: false,
      }),
    ).toBe(false);
    expect(
      assertTimelineOwner({
        sessionStudentId: "stu-1",
        timelineStudentId: "stu-1",
        isStaff: false,
      }),
    ).toBe(true);
    expect(
      assertTimelineOwner({
        sessionStudentId: null,
        timelineStudentId: "stu-1",
        isStaff: true,
      }),
    ).toBe(true);
  });
});
