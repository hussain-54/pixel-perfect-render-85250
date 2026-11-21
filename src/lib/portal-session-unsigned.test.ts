import { describe, expect, it } from "vitest";
import { decodePortalSession, encodePortalSession } from "./portal-session";

describe("portal session cookie encoding (unsigned — UI hint only)", () => {
  it("round-trips payload fields", () => {
    const raw = encodePortalSession({
      role: "student",
      email: "a@example.com",
      source: "supabase",
      businessRole: "student_portal",
      exp: Date.now() + 60_000,
    });
    const decoded = decodePortalSession(raw);
    expect(decoded?.role).toBe("student");
    expect(decoded?.email).toBe("a@example.com");
    expect(decoded?.source).toBe("supabase");
  });

  it("does not cryptographically bind role — tampered role decodes if exp valid", () => {
    const good = encodePortalSession({
      role: "student",
      email: "a@example.com",
      source: "supabase",
      exp: Date.now() + 60_000,
    });
    const parsed = JSON.parse(decodeURIComponent(good)) as Record<string, unknown>;
    parsed["role"] = "admin";
    const tampered = encodeURIComponent(JSON.stringify(parsed));
    const decoded = decodePortalSession(tampered);
    expect(decoded?.role).toBe("admin");
    // Authz must use requireTrustedSession + Bearer, not this cookie alone.
  });

  it("rejects expired payloads", () => {
    const raw = encodePortalSession({
      role: "consultant",
      email: "c@example.com",
      source: "demo",
      exp: Date.now() - 1,
    });
    expect(decodePortalSession(raw)).toBeNull();
  });
});
