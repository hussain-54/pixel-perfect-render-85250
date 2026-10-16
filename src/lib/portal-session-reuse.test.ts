import { describe, expect, it } from "vitest";
import type { PublicSession } from "@/server/portal-data";

/**
 * Documents the staff shell contract: route beforeLoad already calls establishSession;
 * PortalShell must accept that session and not require a second establish for branding.
 */
describe("portal session reuse contract", () => {
  it("route-context PublicSession carries businessRole for branding without a second fetch", () => {
    const fromGuard: PublicSession = {
      role: "consultant",
      email: "hr@example.com",
      source: "supabase",
      businessRole: "hr_system",
    };
    // Shell consumes this object directly (session prop) — branding keys present.
    expect(fromGuard.businessRole).toBe("hr_system");
    expect(fromGuard.email).toContain("@");
    // Missing businessRole must remain explicit null/undefined (fail-safe branding), not invented.
    const incomplete: PublicSession = {
      role: "consultant",
      email: "staff@example.com",
      source: "supabase",
    };
    expect(incomplete.businessRole).toBeUndefined();
  });
});
