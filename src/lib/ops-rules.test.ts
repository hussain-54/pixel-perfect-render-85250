import { describe, expect, it } from "vitest";
import {
  canMutateOfficeOps,
  canViewOfficeOps,
  canViewOpsExpenses,
  expenseImpliesVerifiedPayment,
  isStudentFeeEntity,
  isValidPurchaseTransition,
  validateMoneyAmount,
  validateReceiveQuantity,
} from "./ops-rules";

describe("office operations rules", () => {
  it("authorizes office_ops and manager; accounts is not mutate via ops module", () => {
    expect(canViewOfficeOps({ appRole: "consultant", businessRole: "office_ops" })).toBe(true);
    expect(canMutateOfficeOps({ appRole: "consultant", businessRole: "office_ops" })).toBe(true);
    expect(
      canMutateOfficeOps({ appRole: "consultant", businessRole: "accounts_banking_finance" }),
    ).toBe(false);
    expect(
      canViewOpsExpenses({ appRole: "consultant", businessRole: "accounts_banking_finance" }),
    ).toBe(true);
    expect(canMutateOfficeOps({ appRole: "admin", businessRole: null })).toBe(true);
    expect(canMutateOfficeOps({ appRole: "super_admin", businessRole: null })).toBe(true);
  });

  it("enforces purchase status transitions", () => {
    expect(isValidPurchaseTransition("draft", "submitted")).toBe(true);
    expect(isValidPurchaseTransition("submitted", "approved")).toBe(true);
    expect(isValidPurchaseTransition("draft", "approved")).toBe(false);
    expect(isValidPurchaseTransition("received", "approved")).toBe(false);
  });

  it("validates receive quantity integrity", () => {
    expect(validateReceiveQuantity({ ordered: 10, alreadyReceived: 4, receiving: 6 })).toEqual({
      ok: true,
      nextReceived: 10,
      fullyReceived: true,
    });
    expect(validateReceiveQuantity({ ordered: 10, alreadyReceived: 4, receiving: 7 }).ok).toBe(
      false,
    );
    expect(validateReceiveQuantity({ ordered: 10, alreadyReceived: 0, receiving: 0 }).ok).toBe(
      false,
    );
  });

  it("validates money and keeps expenses distinct from verified payments / student fees", () => {
    expect(validateMoneyAmount(-1).ok).toBe(false);
    expect(validateMoneyAmount(0).ok).toBe(true);
    expect(expenseImpliesVerifiedPayment("reviewed")).toBe(false);
    expect(isStudentFeeEntity("ops_expenses")).toBe(false);
    expect(isStudentFeeEntity("university_fee_obligations")).toBe(true);
    expect(isStudentFeeEntity("signup_fee_payments")).toBe(true);
  });
});
