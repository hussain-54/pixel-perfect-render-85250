import { describe, expect, it } from "vitest";
import {
  describeSignupFeeOperationalStatus,
  formatSignupFeeAmount,
  signupFeeVoucherNumber,
  voucherPrintFilename,
} from "./signup-fee-voucher";

describe("signup-fee-voucher", () => {
  it("derives a stable voucher number from the persisted fee id", () => {
    const feeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(signupFeeVoucherNumber(feeId)).toBe("GR-SF-AAAAAAAABBBB");
    expect(signupFeeVoucherNumber(feeId)).toBe(signupFeeVoucherNumber(feeId));
  });

  it("does not mark unpaid vouchers as verified", () => {
    expect(describeSignupFeeOperationalStatus("unpaid").voucherBadge).toBe("Payment Pending");
    expect(describeSignupFeeOperationalStatus("claimed").voucherBadge).toMatch(/Awaiting Finance/i);
    expect(describeSignupFeeOperationalStatus("verified").voucherBadge).toBe("Verified");
  });

  it("formats amounts without inventing currency codes", () => {
    expect(formatSignupFeeAmount(5000, "PKR")).toContain("PKR");
    expect(formatSignupFeeAmount(5000, "PKR")).toContain("5");
  });

  it("builds a print-safe filename from case and voucher", () => {
    expect(voucherPrintFilename("GR-100", "GR-SF-ABC")).toContain("GR-100");
    expect(voucherPrintFilename("GR-100", "GR-SF-ABC")).toContain("GR-SF-ABC");
  });
});
