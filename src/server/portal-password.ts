/**
 * Employee password change / clear must-change flag — server-only.
 * Never returns or logs plaintext passwords.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { AuthError, requireTrustedSession } from "@/server/portal-auth";
import { requireAdminSupabase, isAdminSupabaseConfigured } from "@/server/supabase-admin";
import { validatePasswordConfirmation, validatePasswordStrength } from "@/lib/password-policy";

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

export type ChangeOwnPasswordInput = {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
};

/**
 * Authenticated employee changes password.
 * When must_change_password is set, currentPassword is optional (session already
 * proved knowledge of the temporary password). Otherwise currentPassword is required.
 * Clears trusted app_metadata.must_change_password via Admin API only.
 */
export const portalChangeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: ChangeOwnPasswordInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      if (session.source !== "supabase" || !session.userId || !session.email) {
        throw new AuthError("Password change requires a live account session.", 403);
      }
      if (!isAdminSupabaseConfigured()) {
        throw new AuthError(
          "Password change is unavailable until the server Auth Admin key is configured.",
          503,
        );
      }

      const match = validatePasswordConfirmation(data.newPassword, data.confirmPassword);
      if (!match.ok) throw new AuthError(match.error, 400);

      const mustChange = Boolean(session.mustChangePassword);
      const current = data.currentPassword ?? "";

      if (!mustChange) {
        if (!current) {
          throw new AuthError("Enter your current password to continue.", 400);
        }
        const strengthCurrent = validatePasswordStrength(current);
        // Current password may predate policy; only require non-empty above.
        void strengthCurrent;
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
      }

      if (current && data.newPassword === current) {
        throw new AuthError("New password must be different from the current password.", 400);
      }

      const admin = requireAdminSupabase();
      const { error: updateErr } = await admin.auth.admin.updateUserById(session.userId, {
        password: data.newPassword,
        app_metadata: { must_change_password: false },
      });
      if (updateErr) {
        throw new AuthError(updateErr.message || "Could not update password.", 400);
      }

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: mustChange ? "account.password_changed_required" : "account.password_changed",
          entity_type: "profiles",
          entity_id: session.userId,
          metadata: { by: session.userId },
        });
      } catch {
        /* audit optional */
      }

      return {
        ok: true as const,
        message: mustChange
          ? "Password updated. You can continue to your portal."
          : "Password updated successfully.",
      };
    } catch (error) {
      toError(error);
    }
  });

/** After a recovery-session client password update, clear the force-change flag. */
export const portalClearMustChangePassword = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const session = await requireTrustedSession();
      if (session.source !== "supabase" || !session.userId) {
        throw new AuthError("Sign in required.", 401);
      }
      if (!session.mustChangePassword) {
        return { ok: true as const, cleared: false as const };
      }
      if (!isAdminSupabaseConfigured()) {
        throw new AuthError(
          "Could not clear the password-change requirement (Auth Admin not configured).",
          503,
        );
      }
      const admin = requireAdminSupabase();
      const { error } = await admin.auth.admin.updateUserById(session.userId, {
        app_metadata: { must_change_password: false },
      });
      if (error) throw new AuthError(error.message, 400);
      return { ok: true as const, cleared: true as const };
    } catch (error) {
      toError(error);
    }
  },
);
