import { describe, expect, it } from "vitest";
import {
  PORTAL_SESSION_CACHE_TTL_MS,
  readPortalSessionCache,
  tokenFingerprint,
  writePortalSessionCache,
} from "./portal-session-cache-rules";

describe("portal session cache (same JWT short TTL)", () => {
  const token = "eyJhbGciOiJIUzI1NiJ9." + "a".repeat(40) + ".sig";

  it("hits only for the same token within TTL", () => {
    const entry = writePortalSessionCache(token, { email: "a@x.com" }, 1000);
    expect(readPortalSessionCache(entry, token, 1000 + PORTAL_SESSION_CACHE_TTL_MS - 1)).toEqual({
      email: "a@x.com",
    });
    expect(readPortalSessionCache(entry, token, 1000 + PORTAL_SESSION_CACHE_TTL_MS + 1)).toBeNull();
    expect(readPortalSessionCache(entry, token + "x", 1500)).toBeNull();
  });

  it("does not store the full token as the cache key material beyond fingerprint", () => {
    const fp = tokenFingerprint(token);
    expect(fp.includes(token)).toBe(false);
    expect(fp.length).toBeLessThan(token.length);
  });
});
