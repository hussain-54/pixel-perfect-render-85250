import { describe, expect, it } from "vitest";
import {
  canActivatePortalFromFeeStatus,
  isPortalActivated,
  isSignupFeeVerified,
  studentPortalAccessAllowed,
} from "./signup-fee-gate";

describe("signup fee gate", () => {
  it("only verified or waived fees unlock activation", () => {
    expect(isSignupFeeVerified("verified")).toBe(true);
    expect(isSignupFeeVerified("waived")).toBe(true);
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(isSignupFeeVerified("unpaid")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
  });

  it("requires portal_activated_at for live students", () => {
    expect(isPortalActivated(null)).toBe(false);
    expect(isPortalActivated("2026-10-12T00:00:00Z")).toBe(true);
    expect(studentPortalAccessAllowed({ source: "demo", portalActivatedAt: null })).toBe(true);
    expect(studentPortalAccessAllowed({ source: "supabase", portalActivatedAt: null })).toBe(false);
    expect(
      studentPortalAccessAllowed({
        source: "supabase",
        portalActivatedAt: "2026-10-12T00:00:00Z",
      }),
    ).toBe(true);
  });
});
