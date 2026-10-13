import { describe, expect, it } from "vitest";
import { adminConfigErrorMessage, getAdminEnvStatus } from "./supabase-admin";

describe("supabase-admin env probe", () => {
  it("reports configured only when URL and service-role key are both present", () => {
    expect(
      getAdminEnvStatus({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      }),
    ).toEqual({ hasUrl: true, hasServiceRoleKey: true, configured: true });
  });

  it("detects missing service-role key without exposing values", () => {
    const status = getAdminEnvStatus({
      VITE_SUPABASE_URL: "https://example.supabase.co",
    });
    expect(status).toEqual({ hasUrl: true, hasServiceRoleKey: false, configured: false });
    const msg = adminConfigErrorMessage(status);
    expect(msg).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(msg).toContain("Redeploy");
    expect(msg).not.toContain("https://example.supabase.co");
    expect(msg.toLowerCase()).not.toContain("service-role-placeholder");
  });

  it("never reads a VITE_ service-role key", () => {
    const status = getAdminEnvStatus({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_SERVICE_ROLE_KEY: "must-not-count",
    } as NodeJS.ProcessEnv);
    expect(status.hasServiceRoleKey).toBe(false);
    expect(status.configured).toBe(false);
  });

  it("accepts SUPABASE_SECRET_KEY as an alias for the service-role key", () => {
    expect(
      getAdminEnvStatus({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "secret-alias-placeholder",
      }).configured,
    ).toBe(true);
  });

  it("accepts SUPABASE_URL as an alternative to VITE_SUPABASE_URL", () => {
    expect(
      getAdminEnvStatus({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      }).configured,
    ).toBe(true);
  });
});
