import { describe, expect, it } from "vitest";
import {
  countIntakeStatusFilters,
  filterIntakeRowsByStatus,
  isCreatedToday,
} from "./front-desk-intake-filters";

describe("front-desk intake status filters", () => {
  const now = new Date();
  const todayIso = now.toISOString();
  const olderIso = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const rows = [
    {
      id: "a",
      createdAt: todayIso,
      assignmentStatus: "pending" as const,
      signupFeeStatus: "unpaid",
      portalActivatedAt: null,
    },
    {
      id: "b",
      createdAt: olderIso,
      assignmentStatus: "assigned" as const,
      signupFeeStatus: "claimed",
      portalActivatedAt: null,
    },
    {
      id: "c",
      createdAt: olderIso,
      assignmentStatus: "assigned" as const,
      signupFeeStatus: "verified",
      portalActivatedAt: null,
    },
    {
      id: "d",
      createdAt: olderIso,
      assignmentStatus: "assigned" as const,
      signupFeeStatus: "verified",
      portalActivatedAt: olderIso,
    },
    {
      id: "e",
      createdAt: olderIso,
      assignmentStatus: "assigned" as const,
      signupFeeStatus: "rejected",
      portalActivatedAt: null,
    },
  ];

  it("counts each status from real field values without inventing statuses", () => {
    const counts = countIntakeStatusFilters({ rows, feeRequests: [], now });
    expect(counts.all).toBe(5);
    expect(counts.new_today).toBe(1);
    expect(counts.assigned).toBe(4);
    expect(counts.awaiting_counsellor).toBe(1);
    expect(counts.fee_pending).toBe(1);
    expect(counts.awaiting_finance).toBe(1);
    expect(counts.finance_verified).toBe(2);
    expect(counts.portal_pending).toBe(1);
    expect(counts.needs_attention).toBe(2); // pending a + rejected e
  });

  it("does not mix unpaid into awaiting finance or verified", () => {
    const awaiting = filterIntakeRowsByStatus({
      rows,
      filter: "awaiting_finance",
      now,
    });
    expect(awaiting.map((r) => r.id)).toEqual(["b"]);
    const verified = filterIntakeRowsByStatus({
      rows,
      filter: "finance_verified",
      now,
    });
    expect(verified.map((r) => r.id).sort()).toEqual(["c", "d"]);
  });

  it("detects new today from local calendar day", () => {
    expect(isCreatedToday(todayIso, now)).toBe(true);
    expect(isCreatedToday(olderIso, now)).toBe(false);
  });
});
