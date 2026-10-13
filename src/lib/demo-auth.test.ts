import { describe, expect, it } from "vitest";
import { resolveDemoAuthEnabled } from "./demo-auth";

describe("demo auth gating", () => {
  it("never enables demo auth in production builds", () => {
    expect(
      resolveDemoAuthEnabled({
        PROD: true,
        DEV: false,
        VITE_ENABLE_DEMO_AUTH: "true",
      }),
    ).toBe(false);
    expect(
      resolveDemoAuthEnabled({
        PROD: true,
        DEV: true,
        VITE_ENABLE_DEMO_AUTH: "true",
      }),
    ).toBe(false);
  });

  it("enables demo auth only in development", () => {
    expect(resolveDemoAuthEnabled({ PROD: false, DEV: true })).toBe(true);
    expect(resolveDemoAuthEnabled({ PROD: false, DEV: false, VITE_ENABLE_DEMO_AUTH: "true" })).toBe(
      false,
    );
  });
});
