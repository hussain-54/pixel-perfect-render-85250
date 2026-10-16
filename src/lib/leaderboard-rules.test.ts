import { describe, expect, it } from "vitest";
import {
  attributeEventsToConsultants,
  buildLeaderboardRows,
  canViewConsultantLeaderboard,
  countByConsultantId,
  filterTimedConsultantEvents,
  formatLeaderboardValue,
  isSubmittedApplication,
  metricIsPeriodAware,
  resolveLeaderboardWindow,
} from "./leaderboard-rules";

describe("leaderboard rules", () => {
  it("resolves real date windows (no fake multipliers)", () => {
    const now = new Date("2026-10-16T12:00:00.000Z");
    expect(resolveLeaderboardWindow("all", now)).toEqual({ start: null, end: "2026-10-16" });
    expect(resolveLeaderboardWindow("week", now)).toEqual({
      start: "2026-10-10",
      end: "2026-10-16",
    });
    expect(resolveLeaderboardWindow("month", now).start).toBe("2026-09-17");
  });

  it("marks snapshot metrics as not period-aware", () => {
    expect(metricIsPeriodAware("students")).toBe(false);
    expect(metricIsPeriodAware("completedCases")).toBe(false);
    expect(metricIsPeriodAware("appointmentsCompleted")).toBe(true);
    expect(metricIsPeriodAware("offers")).toBe(true);
  });

  it("counts by consultant and filters timed events", () => {
    expect(countByConsultantId(["c1", null, "c1", "c2"]).get("c1")).toBe(2);
    const counts = filterTimedConsultantEvents(
      [
        { consultantId: "c1", dateRaw: "2026-10-01T10:00:00Z" },
        { consultantId: "c1", dateRaw: "2026-09-01T10:00:00Z" },
        { consultantId: "c2", dateRaw: "2026-10-05" },
        { consultantId: null, dateRaw: "2026-10-05" },
      ],
      "2026-10-01",
      "2026-10-16",
    );
    expect(counts.get("c1")).toBe(1);
    expect(counts.get("c2")).toBe(1);
  });

  it("attributes offers/visa via subject→consultant map", () => {
    const map = new Map<string, string | null>([
      ["app1", "c1"],
      ["app2", "c2"],
      ["app3", null],
    ]);
    const counts = attributeEventsToConsultants(
      [
        { subjectId: "app1", dateRaw: "2026-10-02" },
        { subjectId: "app2", dateRaw: "2026-10-03" },
        { subjectId: "app3", dateRaw: "2026-10-03" },
      ],
      map,
      null,
      "2026-12-31",
    );
    expect(counts.get("c1")).toBe(1);
    expect(counts.get("c2")).toBe(1);
    expect(counts.has("")).toBe(false);
  });

  it("detects submitted applications without inventing stages", () => {
    expect(isSubmittedApplication({ stage: "draft", submittedAt: null })).toBe(false);
    expect(isSubmittedApplication({ stage: "draft", submittedAt: "2026-01-01" })).toBe(true);
    expect(isSubmittedApplication({ stage: "submitted", submittedAt: null })).toBe(true);
  });

  it("ranks available values and leaves unavailable unranked", () => {
    const consultants = [
      { id: "c1", name: "Ada", department: "UK", status: "Active" as const },
      { id: "c2", name: "Bea", department: "CA", status: "Active" as const },
      { id: "c3", name: "Cal", department: "DE", status: "Inactive" as const },
    ];
    const students = new Map([
      ["c1", 5],
      ["c2", 5],
      ["c3", 1],
    ]);
    const ranked = buildLeaderboardRows(
      consultants,
      {
        students,
        appointmentsCompleted: null,
        applicationsSubmitted: null,
        offers: null,
        visaCases: null,
        completedCases: null,
      },
      "students",
    );
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(1);
    expect(ranked[2]?.value).toBe(1);
    expect(ranked[2]?.rank).toBe(3);

    const unavailable = buildLeaderboardRows(
      consultants,
      {
        students: null,
        appointmentsCompleted: null,
        applicationsSubmitted: null,
        offers: null,
        visaCases: null,
        completedCases: null,
      },
      "offers",
    );
    expect(unavailable.every((r) => r.value == null && r.rank == null)).toBe(true);
    expect(formatLeaderboardValue(null)).toBe("Not available");
    expect(formatLeaderboardValue(0)).toBe("0");
  });

  it("empty consultant list yields empty ranking", () => {
    expect(
      buildLeaderboardRows(
        [],
        {
          students: new Map(),
          appointmentsCompleted: new Map(),
          applicationsSubmitted: new Map(),
          offers: new Map(),
          visaCases: new Map(),
          completedCases: new Map(),
        },
        "students",
      ),
    ).toEqual([]);
  });

  it("authorizes firm-wide leaderboard for admin/manager only", () => {
    expect(
      canViewConsultantLeaderboard({ appRole: "admin", businessRole: "admin" }),
    ).toBe(true);
    expect(
      canViewConsultantLeaderboard({ appRole: "consultant", businessRole: "manager" }),
    ).toBe(true);
    expect(
      canViewConsultantLeaderboard({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canViewConsultantLeaderboard({ appRole: "student", businessRole: null }),
    ).toBe(false);
  });
});
