/**
 * Employee password helpers — server-only.
 * Never returns or logs plaintext passwords.
 *
 * Password updates for signed-in employees are performed with the user's
 * Supabase session on the client (auth.updateUser) so Auth Admin password
 * rotation does not revoke the active session_id (which previously caused
 * "Invalid or expired session" on the next portal request).
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { AuthError, requireTrustedSession } from "@/server/portal-auth";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Password operation failed.");
}

function supabaseAnonEnv() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL?.trim()) ||
    process.env["VITE_SUPABASE_URL"]?.trim() ||
    process.env["SUPABASE_URL"]?.trim() ||
    "";
  const key =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    process.env["SUPABASE_ANON_KEY"]?.trim() ||
    "";
  return { url, key };
}

export type VerifyCurrentPasswordInput = {
  currentPassword: string;
};

/**
 * Confirms the caller knows their current password before a client-side
 * session-preserving password update.
 */
export const portalVerifyCurrentPassword = createServerFn({ method: "POST" })
  .validator((data: VerifyCurrentPasswordInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      if (session.source !== "supabase" || !session.userId || !session.email) {
        throw new AuthError("Password change requires a live account session.", 403);
      }
      const current = data.currentPassword ?? "";
      if (!current) {
        throw new AuthError("Enter your current password to continue.", 400);
      }

      const { url, key } = supabaseAnonEnv();
      if (!url || !key) throw new AuthError("Authentication is not configured.", 503);

      const probe = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error: verifyErr } = await probe.auth.signInWithPassword({
        email: session.email,
        password: current,
      });
      if (verifyErr) {
        throw new AuthError("Current password is incorrect.", 401);
      }
      try {
        await probe.auth.signOut();
      } catch {
        /* best-effort */
      }

      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });
