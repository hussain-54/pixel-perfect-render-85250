/**
 * Phase 3 regression: Finance ↔ Front Desk fee/request sync and ledger rules.
 * Pure unit mirrors — not live RLS/JWT proof.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  feeVerificationTabForStatus,
  requestCompletedWithoutFeeAuthorization,
  requestStuckAfterFeeDecision,
  signupFeeIsTerminalDecision,
} from "./fee-verification-workflow";
import { canActivatePortalFromFeeStatus, isSignupFeeVerified } from "./signup-fee-gate";
import { canVerifySignupFeeAction } from "./staff-business-access";
import {
  clampSignupFeeLedgerPage,
  signupFeeLedgerOverviewBuckets,
  signupFeeLedgerRowMatchesSearch,
  signupFeeStatusesForLedgerFilter,
} from "./signup-fee-ledger";
import { canVerifyUniversityFeePayment } from "./university-fee-auth";
import {
  FEE_VERIFIER_QUEUE_STATUSES,
  studentHasOpenFeeQueue,
} from "./r1-fee-verifier-select-rules";

const SYNC_MIGRATION = "20261020180000_verify_signup_fee_resolve_counselling_request.sql";

describe("Phase 3 — Finance verifies → Front Desk request terminal", () => {
  it("1–2: verified/waived/rejected fees are terminal; request in_progress becomes reconcile candidate until resolved", () => {
    for (const fee of ["verified", "waived", "rejected"] as const) {
      expect(signupFeeIsTerminalDecision(fee)).toBe(true);
      expect(
        requestStuckAfterFeeDecision({
          requestStatus: "in_progress",
          signupFeeStatus: fee,
        }),
      ).toBe(true);
      expect(feeVerificationTabForStatus("resolved")).toBe("completed");
    }
  });

  it("3: fee already verified before request reconcile is safe (stuck → sync from fee truth)", () => {
    expect(
      requestStuckAfterFeeDecision({
        requestStatus: "open",
        signupFeeStatus: "verified",
      }),
    ).toBe(true);
    // Reconcile must not invent verification — only close when fee is terminal.
    expect(signupFeeIsTerminalDecision("claimed")).toBe(false);
  });

  it("4: resolved request without verified/waived fee cannot satisfy fee gate", () => {
    expect(
      requestCompletedWithoutFeeAuthorization({
        requestStatus: "resolved",
        signupFeeStatus: "claimed",
      }),
    ).toBe(true);
    expect(feeStatusAllowsAdmissionHandover("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
  });

  it("5: claimed payment stays unverified until authorized verification", () => {
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(studentHasOpenFeeQueue("claimed")).toBe(true);
    expect(FEE_VERIFIER_QUEUE_STATUSES).toContain("claimed");
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
  });

  it("6: rejected and waived are distinct terminal outcomes", () => {
    expect(isSignupFeeVerified("rejected")).toBe(false);
    expect(isSignupFeeVerified("waived")).toBe(true);
    expect(feeStatusAllowsAdmissionHandover("rejected")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("waived")).toBe(true);
    expect(signupFeeIsTerminalDecision("rejected")).toBe(true);
    expect(signupFeeIsTerminalDecision("waived")).toBe(true);
  });
});

describe("Phase 3 — Finance ledger completeness", () => {
  it("7: signup claimed filter is the actionable Finance review queue", () => {
    expect(signupFeeStatusesForLedgerFilter("claimed")).toEqual(["claimed"]);
    expect(signupFeeStatusesForLedgerFilter("unpaid")).toEqual(["unpaid"]);
    expect(signupFeeStatusesForLedgerFilter("pending")).toEqual(["unpaid", "claimed"]);
    expect(signupFeeStatusesForLedgerFilter("verified")).toEqual(["verified"]);
  });

  it("8: university verify auth is separate from signup verify auth", () => {
    expect(
      canVerifyUniversityFeePayment({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    // University ledger filter values are not signup statuses — keep ledgers distinct.
    expect(signupFeeStatusesForLedgerFilter("all")).toBeNull();
  });

  it("9: historical verified/rejected/waived remain addressable via ledger filters", () => {
    expect(signupFeeStatusesForLedgerFilter("verified")).toEqual(["verified"]);
    expect(signupFeeStatusesForLedgerFilter("rejected")).toEqual(["rejected"]);
    expect(signupFeeStatusesForLedgerFilter("waived")).toEqual(["waived"]);
    const buckets = signupFeeLedgerOverviewBuckets([
      "claimed",
      "verified",
      "verified",
      "rejected",
      "waived",
      "unpaid",
    ]);
    expect(buckets).toEqual({ pending: 2, verified: 2, rejected: 1, waived: 1 });
  });

  it("10: search and pagination return complete matching pages without silent clamp-to-empty", () => {
    const rows = [
      {
        studentName: "Alpha",
        caseId: "GR-AAA",
        referenceReceipt: "R-1",
        paymentMethod: "cash",
        studentId: "s1",
      },
      {
        studentName: "Bravo",
        caseId: "GR-MVBOX0HH",
        referenceReceipt: null,
        paymentMethod: "bank",
        studentId: "s2",
      },
    ];
    expect(
      rows.filter((r) => signupFeeLedgerRowMatchesSearch(r, "MVBOX")).map((r) => r.caseId),
    ).toEqual(["GR-MVBOX0HH"]);
    expect(rows.filter((r) => signupFeeLedgerRowMatchesSearch(r, "R-1"))).toHaveLength(1);
    expect(clampSignupFeeLedgerPage({ limit: 999, offset: -5 })).toEqual({ limit: 200, offset: 0 });
    expect(clampSignupFeeLedgerPage({ limit: 50, offset: 50 })).toEqual({ limit: 50, offset: 50 });
  });
});

describe("Phase 3 — authorization and failure modes", () => {
  it("11–12: Front Desk and Counsellor cannot verify signup fees; Accounts can", () => {
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
  });

  it("13: duplicate claim does not count as verified or activate portal", () => {
    // Two claimed rows still unpaid for activation; only verified/waived unlock.
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
    expect(studentHasOpenFeeQueue("claimed")).toBe(true);
  });

  it("14: partial success surfaces as stuck request when fee terminal and request open", () => {
    // Mirrors pre-migration split update: fee verified, request still in_progress.
    expect(
      requestStuckAfterFeeDecision({
        requestStatus: "in_progress",
        signupFeeStatus: "verified",
      }),
    ).toBe(true);
    expect(feeStatusAllowsAdmissionHandover("verified")).toBe(true);
  });

  it("15: claim display never pretends missing fee data is verified", () => {
    const missing = describeFeeClaimDisplay({
      signupFeeStatus: null,
      feeAmount: null,
      feeCurrency: null,
      feePaymentMethod: null,
      feeReferenceReceipt: null,
    });
    expect(missing.hasFeeRecord).toBe(false);
    expect(missing.claimLabel).toMatch(/No signup fee record/i);
    expect(feeStatusAllowsAdmissionHandover(null)).toBe(false);
  });

  it("16: fee gate still requires verified/waived after request lifecycle", () => {
    expect(feeStatusAllowsAdmissionHandover("unpaid")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("claimed")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("rejected")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("verified")).toBe(true);
    expect(feeStatusAllowsAdmissionHandover("waived")).toBe(true);
  });
});

describe(`Phase 3 — migration contract ${SYNC_MIGRATION}`, () => {
  it("verify RPC resolves counselling requests; reconcile never invents fee verification", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations", SYNC_MIGRATION), "utf8");
    expect(sql).toMatch(/create or replace function public\.verify_signup_fee_and_activate/i);
    expect(sql).toMatch(/counselling_fee_verification_requests/);
    expect(sql).toMatch(/status = 'resolved'/);
    expect(sql).toMatch(/reconcile_counselling_fee_request_from_fee/);
    expect(sql).toMatch(/fee is not in a terminal/);
    // Reconcile updates requests only — must not UPDATE signup_fee_payments to invent verify.
    const reconcileBlock = sql.slice(sql.indexOf("reconcile_counselling_fee_request_from_fee"));
    expect(reconcileBlock).toMatch(/update public\.counselling_fee_verification_requests/i);
    expect(reconcileBlock).not.toMatch(/update public\.signup_fee_payments/i);
  });
});
