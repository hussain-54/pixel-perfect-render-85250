/**
 * Canonical Auth redirect targets for recovery / password change.
 * Production Site URL and Redirect allow-list must include these paths
 * on https://globalroots.pk (see SITE_ORIGIN).
 */
import { SITE_ORIGIN } from "@/lib/seo";

export const PASSWORD_RECOVERY_PATH = "/reset-password";
export const CHANGE_PASSWORD_PATH = "/change-password";

/** Build absolute recovery redirect (never points at /sign-in). */
export function passwordRecoveryRedirectUrl(origin?: string | null): string {
  const base = (origin?.trim() || SITE_ORIGIN).replace(/\/$/, "");
  return `${base}${PASSWORD_RECOVERY_PATH}`;
}

export function changePasswordPath(): typeof CHANGE_PASSWORD_PATH {
  return CHANGE_PASSWORD_PATH;
}

/**
 * Prefer APP_ORIGIN / SITE_URL env, then canonical production origin in
 * production runtimes, then the current request origin for local/preview.
 */
export function resolveAuthAppOrigin(opts: {
  envOrigin?: string | null;
  requestOrigin?: string | null;
  isProduction?: boolean;
}): string {
  const fromEnv = opts.envOrigin?.trim().replace(/\/$/, "") || "";
  if (fromEnv) return fromEnv;
  if (opts.isProduction) return SITE_ORIGIN;
  const fromRequest = opts.requestOrigin?.trim().replace(/\/$/, "") || "";
  if (fromRequest) return fromRequest;
  return SITE_ORIGIN;
}
