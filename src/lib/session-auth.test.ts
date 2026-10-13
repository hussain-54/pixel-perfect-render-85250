import { describe, expect, it } from "vitest";
import { portalHomeByRole } from "./roles";
import {
  ROLE_REDIRECT_CASES,
  accessTokenNeedsRefresh,
  sessionValidationFailureMessage,
  shouldForcePasswordChangeOnLogin,
} from "./session-auth";

describe("session auth helpers", () => {
  it("refreshes access tokens near expiry", () => {
    const now = 1_700_000_000_000;
    expect(accessTokenNeedsRefresh(now / 1000 + 30, now)).toBe(true);
    expect(accessTokenNeedsRefresh(now / 1000 + 3600, now)).toBe(false);
    expect(accessTokenNeedsRefresh(null, now)).toBe(false);
  });

  it("maps Auth session failures to a safe sign-in message without leaking details", () => {
    const msg = sessionValidationFailureMessage("Auth session missing!");
    expect(msg).toContain("sign in again");
    expect(msg.toLowerCase()).not.toContain("jwt");
    expect(msg.toLowerCase()).not.toContain("bearer");
  });

  it("never forces first-login password change from app_metadata", () => {
    expect(shouldForcePasswordChangeOnLogin({ must_change_password: true })).toBe(false);
    expect(shouldForcePasswordChangeOnLogin({ must_change_password: false })).toBe(false);
    expect(shouldForcePasswordChangeOnLogin(null)).toBe(false);
  });

  it("keeps role-based portal homes stable", () => {
    for (const c of ROLE_REDIRECT_CASES) {
      expect(portalHomeByRole[c.role]).toBe(c.expectedHome);
    }
  });
});
