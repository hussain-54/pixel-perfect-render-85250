/**
 * Shared password rules for staff onboarding and self-service changes.
 * Never log or persist plaintext passwords — validate only.
 */

export const PASSWORD_MIN_LENGTH = 10;

export type PasswordValidationResult = { ok: true } | { ok: false; error: string };

/** Strength rules for temporary and permanent account passwords. */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (typeof password !== "string" || !password) {
    return { ok: false, error: "Password is required." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.length > 128) {
    return { ok: false, error: "Password must be at most 128 characters." };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, error: "Password must include at least one letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: "Password must include at least one number." };
  }
  if (/\s/.test(password)) {
    return { ok: false, error: "Password must not contain spaces." };
  }
  return { ok: true };
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
): PasswordValidationResult {
  const strength = validatePasswordStrength(password);
  if (!strength.ok) return strength;
  if (password !== confirmPassword) {
    return { ok: false, error: "Password confirmation does not match." };
  }
  return { ok: true };
}

/** Trusted Auth Admin flag — never read user_metadata for this. */
export function readMustChangePasswordFlag(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object") return false;
  return (appMetadata as Record<string, unknown>)["must_change_password"] === true;
}
