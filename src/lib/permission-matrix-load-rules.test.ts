import { describe, expect, it } from "vitest";
import {
  resolveAuthorizationMatrixOutcome,
  resolveMatrixLoadPlane,
} from "./permission-matrix-load-rules";
import { AuthError } from "@/server/portal-auth";
import { requireModulePermission } from "@/server/staff-access";
import type { TrustedSession } from "@/server/portal-auth";

describe("permission matrix load plane", () => {
  it("keeps demo separate from live planes", () => {
    expect(resolveMatrixLoadPlane({ sessionSource: "demo", isProduction: true })).toBe("demo");
    expect(resolveMatrixLoadPlane({ sessionSource: "supabase", isProduction: false })).toBe(
      "live_dev",
    );
    expect(resolveMatrixLoadPlane({ sessionSource: "supabase", isProduction: true })).toBe(
      "live_production",
    );
  });
});

describe("authorization matrix fail-closed rules", () => {
  it("demo always uses defaults", () => {
    expect(
      resolveAuthorizationMatrixOutcome({ plane: "demo", errorMessage: "relation missing" }),
    ).toBe("defaults");
  });

  it("live_dev: missing/empty table uses defaults; unexpected errors unavailable", () => {
    expect(
      resolveAuthorizationMatrixOutcome({
        plane: "live_dev",
        errorMessage: 'relation "business_module_permissions" does not exist',
      }),
    ).toBe("defaults");
    expect(resolveAuthorizationMatrixOutcome({ plane: "live_dev", rowCount: 0 })).toBe("defaults");
    expect(
      resolveAuthorizationMatrixOutcome({
        plane: "live_dev",
        errorMessage: "permission denied for table business_module_permissions",
      }),
    ).toBe("unavailable");
    expect(resolveAuthorizationMatrixOutcome({ plane: "live_dev", rowCount: 12 })).toBe("database");
  });

  it("live_production: missing/empty/unexpected never silently authorize via defaults", () => {
    expect(
      resolveAuthorizationMatrixOutcome({
        plane: "live_production",
        errorMessage: 'relation "business_module_permissions" does not exist',
      }),
    ).toBe("unavailable");
    expect(resolveAuthorizationMatrixOutcome({ plane: "live_production", rowCount: 0 })).toBe(
      "unavailable",
    );
    expect(
      resolveAuthorizationMatrixOutcome({
        plane: "live_production",
        errorMessage: "JWT expired",
      }),
    ).toBe("unavailable");
    expect(resolveAuthorizationMatrixOutcome({ plane: "live_production", rowCount: 120 })).toBe(
      "database",
    );
  });
});

describe("requireModulePermission unavailable fail-closed (demo path still works)", () => {
  it("allows demo session with configured business role", async () => {
    const session: TrustedSession = {
      email: "a@example.com",
      source: "demo",
      userId: "u1",
      role: "consultant",
      businessRole: "admission_team",
    };
    await expect(requireModulePermission(session, "admissions", 2)).resolves.toBeUndefined();
  });

  it("surfaces AuthError for unconfigured role on demo", async () => {
    const session: TrustedSession = {
      email: "a@example.com",
      source: "demo",
      userId: "u1",
      role: "consultant",
      businessRole: null,
    };
    await expect(requireModulePermission(session, "admissions", 1)).rejects.toThrow(AuthError);
  });

  it("documents production empty/RLS-denied matrix as unavailable (fail closed)", () => {
    expect(
      resolveAuthorizationMatrixOutcome({
        plane: "live_production",
        errorMessage: null,
        rowCount: 0,
      }),
    ).toBe("unavailable");
  });
});
