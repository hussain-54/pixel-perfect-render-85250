import { describe, expect, it } from "vitest";
import {
  assessmentFormPdfFilename,
  describePersistedSignupFeeStatus,
  displayOrBlank,
  registrationFormPdfFilename,
} from "./registration-form-a4";

describe("registration form A4 helpers", () => {
  it("maps persisted fee statuses without inventing verification", () => {
    expect(describePersistedSignupFeeStatus(null).label).toBe("Voucher unpaid / not claimed");
    expect(describePersistedSignupFeeStatus("unpaid").label).toBe("Voucher unpaid / not claimed");
    expect(describePersistedSignupFeeStatus("claimed").label).toBe("Claimed — awaiting Finance");
    expect(describePersistedSignupFeeStatus("claimed").isAuthorized).toBe(false);
    expect(describePersistedSignupFeeStatus("verified").label).toBe("Verified");
    expect(describePersistedSignupFeeStatus("verified").isAuthorized).toBe(true);
    expect(describePersistedSignupFeeStatus("waived").label).toBe("Waived");
    expect(describePersistedSignupFeeStatus("rejected").label).toBe("Rejected");
  });

  it("builds PDF filenames from case ID without personal names", () => {
    expect(registrationFormPdfFilename("GR-MVBOX0HH")).toBe("GR-MVBOX0HH-registration-form");
    expect(registrationFormPdfFilename("GR/TEST 1")).toBe("GR-TEST-1-registration-form");
    expect(assessmentFormPdfFilename("GR-MVBOX0HH")).toBe("GR-MVBOX0HH-assessment-form");
    expect(assessmentFormPdfFilename("GR/TEST 1")).toBe("GR-TEST-1-assessment-form");
  });

  it("never renders undefined/null as text", () => {
    expect(displayOrBlank(undefined)).toBe("—");
    expect(displayOrBlank(null)).toBe("—");
    expect(displayOrBlank("  ")).toBe("—");
    expect(displayOrBlank("Ali")).toBe("Ali");
  });
});
