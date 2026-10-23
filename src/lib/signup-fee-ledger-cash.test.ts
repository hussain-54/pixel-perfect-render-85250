import { describe, expect, it } from "vitest";
import {
  aggregateVerifiedSignupFeeCash,
  expectedStatusForSignupFeeAction,
  isTerminalSignupFeeStatus,
  sanitizeSignupFeeSearchTerm,
  signupFeeLedgerOverviewBuckets,
} from "./signup-fee-ledger";

describe("signup fee ledger cash rules", () => {
  it("counts only verified as cash and never treats waived as received", () => {
    const cash = aggregateVerifiedSignupFeeCash([
      { status: "verified", amount: 1000, currency: "PKR", verifiedAt: "2026-10-23T08:00:00.000Z" },
      { status: "waived", amount: 5000, currency: "PKR", verifiedAt: "2026-10-23T08:00:00.000Z" },
      { status: "claimed", amount: 2000, currency: "PKR", verifiedAt: null },
      { status: "rejected", amount: 3000, currency: "PKR", verifiedAt: null },
      { status: "verified", amount: 50, currency: "USD", verifiedAt: "2026-10-22T08:00:00.000Z" },
    ]);
    expect(cash.verifiedByCurrency).toEqual([
      { currency: "PKR", total: 1000 },
      { currency: "USD", total: 50 },
    ]);
  });

  it("scopes today totals by verified_at", () => {
    const cash = aggregateVerifiedSignupFeeCash(
      [
        {
          status: "verified",
          amount: 100,
          currency: "PKR",
          verifiedAt: "2026-10-23T10:00:00.000Z",
        },
        {
          status: "verified",
          amount: 200,
          currency: "PKR",
          verifiedAt: "2026-10-22T10:00:00.000Z",
        },
      ],
      { todayStartIso: "2026-10-23T00:00:00.000Z" },
    );
    expect(cash.verifiedTodayByCurrency).toEqual([{ currency: "PKR", total: 100 }]);
  });

  it("keeps overview buckets distinct", () => {
    expect(
      signupFeeLedgerOverviewBuckets(["unpaid", "claimed", "verified", "waived", "rejected"]),
    ).toEqual({ pending: 2, verified: 1, waived: 1, rejected: 1 });
  });

  it("maps actions and terminal statuses for concurrent guards", () => {
    expect(expectedStatusForSignupFeeAction("verify")).toBe("verified");
    expect(isTerminalSignupFeeStatus("claimed")).toBe(false);
    expect(isTerminalSignupFeeStatus("verified")).toBe(true);
  });

  it("sanitizes search wildcards", () => {
    expect(sanitizeSignupFeeSearchTerm("  Ada_%  ")).toBe("Ada");
  });
});
