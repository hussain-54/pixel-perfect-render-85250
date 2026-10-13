import { describe, expect, it } from "vitest";
import { SITE_ORIGIN } from "./seo";
import {
  CHANGE_PASSWORD_PATH,
  PASSWORD_RECOVERY_PATH,
  passwordRecoveryRedirectUrl,
  resolveAuthAppOrigin,
} from "./auth-redirects";

describe("auth redirects", () => {
  it("builds recovery URL under /reset-password, never /sign-in", () => {
    expect(passwordRecoveryRedirectUrl(SITE_ORIGIN)).toBe(
      `${SITE_ORIGIN}${PASSWORD_RECOVERY_PATH}`,
    );
    expect(passwordRecoveryRedirectUrl("https://globalroots.pk/")).toBe(
      "https://globalroots.pk/reset-password",
    );
    expect(passwordRecoveryRedirectUrl("https://globalroots.pk")).not.toContain("/sign-in");
    expect(CHANGE_PASSWORD_PATH).toBe("/change-password");
  });

  it("prefers env origin, then production canonical, then request", () => {
    expect(
      resolveAuthAppOrigin({
        envOrigin: "https://custom.example",
        requestOrigin: "http://localhost:3000",
        isProduction: true,
      }),
    ).toBe("https://custom.example");

    expect(
      resolveAuthAppOrigin({
        envOrigin: "",
        requestOrigin: "https://preview.vercel.app",
        isProduction: true,
      }),
    ).toBe(SITE_ORIGIN);

    expect(
      resolveAuthAppOrigin({
        envOrigin: "",
        requestOrigin: "http://localhost:8080",
        isProduction: false,
      }),
    ).toBe("http://localhost:8080");
  });
});
