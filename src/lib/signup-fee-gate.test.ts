import { describe, expect, it } from "vitest";
import {
  canActivatePortalFromFeeStatus,
  formatFeeActivationPartialFailure,
  isPortalActivated,
  isSignupFeeVerified,
  mapVerifySignupFeeRpcError,
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

  it("surfaces partial failure when fee persists but activation fails", () => {
    const msg = formatFeeActivationPartialFailure({
      feeStatus: "verified",
      activationError: "permission denied",
    });
    expect(msg).toContain("verified");
    expect(msg).toContain("permission denied");
    expect(msg.toLowerCase()).toContain("activation failed");
    expect(msg.toLowerCase()).not.toContain("completed successfully");
  });
});

describe("mapVerifySignupFeeRpcError (pure — not a DB integration test)", () => {
  it("maps authorization denial", () => {
    const mapped = mapVerifySignupFeeRpcError("not authorized to verify signup fees");
    expect(mapped.status).toBe(403);
    expect(mapped.message.toLowerCase()).toContain("accounts");
  });

  it("maps missing fee / student and invalid action", () => {
    expect(mapVerifySignupFeeRpcError("signup fee row not found for student").status).toBe(404);
    expect(mapVerifySignupFeeRpcError("student row missing during activation").status).toBe(404);
    expect(mapVerifySignupFeeRpcError("invalid action").status).toBe(400);
  });

  it("maps missing RPC and authentication", () => {
    expect(mapVerifySignupFeeRpcError("Could not find the function").status).toBe(503);
    expect(mapVerifySignupFeeRpcError("authentication required").status).toBe(401);
  });

  it("maps reconcile terminal-fee and authorization errors", () => {
    expect(mapVerifySignupFeeRpcError("fee is not in a terminal verified/waived/rejected state").status).toBe(
      400,
    );
    expect(mapVerifySignupFeeRpcError("not authorized to reconcile fee verification requests").status).toBe(
      403,
    );
  });

  it("does not forward raw unexpected SQL details", () => {
    const mapped = mapVerifySignupFeeRpcError(
      'duplicate key value violates unique constraint "signup_fee_payments_pkey"',
    );
    expect(mapped.status).toBe(400);
    expect(mapped.message.toLowerCase()).not.toContain("duplicate key");
    expect(mapped.message.toLowerCase()).toContain("could not verify");
  });
});
