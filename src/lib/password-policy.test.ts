import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  readMustChangePasswordFlag,
  validatePasswordConfirmation,
  validatePasswordStrength,
} from "./password-policy";

describe("password policy", () => {
  it("rejects weak passwords", () => {
    expect(validatePasswordStrength("").ok).toBe(false);
    expect(validatePasswordStrength("short1").ok).toBe(false);
    expect(validatePasswordStrength("a".repeat(PASSWORD_MIN_LENGTH)).ok).toBe(false);
    expect(validatePasswordStrength("1234567890").ok).toBe(false);
    expect(validatePasswordStrength("Password 12").ok).toBe(false);
  });

  it("accepts strong passwords", () => {
    expect(validatePasswordStrength("TempPass12").ok).toBe(true);
    expect(validatePasswordStrength("SecureStaff99!").ok).toBe(true);
  });

  it("requires matching confirmation", () => {
    expect(validatePasswordConfirmation("TempPass12", "TempPass13").ok).toBe(false);
    expect(validatePasswordConfirmation("TempPass12", "TempPass12").ok).toBe(true);
  });

  it("reads must_change_password only from trusted app_metadata shape", () => {
    expect(readMustChangePasswordFlag({ must_change_password: true })).toBe(true);
    expect(readMustChangePasswordFlag({ must_change_password: false })).toBe(false);
    expect(readMustChangePasswordFlag({ must_change_password: "true" })).toBe(false);
    expect(readMustChangePasswordFlag({ role: "admin" })).toBe(false);
    expect(readMustChangePasswordFlag(null)).toBe(false);
  });
});
