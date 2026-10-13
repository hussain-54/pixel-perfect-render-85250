import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { findDemoAccount, findDemoAccountByEmail, isDemoAuthEnabled } from "@/lib/demo-auth";
import {
  portalHomeByRole,
  normalizeAppRole,
  resolveAppRoleFromTrustedSources,
  type AppRole,
  type PortalHome,
} from "@/lib/roles";
import { passwordRecoveryRedirectUrl } from "@/lib/auth-redirects";
import { validatePasswordConfirmation } from "@/lib/password-policy";
import { accessTokenNeedsRefresh } from "@/lib/session-auth";
import {
  clearSession,
  establishSession,
  getPortalSession,
  type PublicSession,
} from "@/server/portal-data";

export type { AppRole, PortalHome };
export { portalHomeByRole, normalizeAppRole };

/** @deprecated Use AppRole — kept for older imports. */
export type AuthRole = AppRole;

const REMEMBER_EMAIL_KEY = "gr_remember_email";
const DEMO_SESSION_KEY = "gr_demo_session";

export type SignInResult =
  { ok: true; role: AppRole; redirectTo: PortalHome } | { ok: false; error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setRememberedEmail(email: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (email) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

function setClientDemoSession(
  role: AppRole,
  email: string,
  remember: boolean,
  consultantId?: string,
) {
  if (typeof window === "undefined" || !isDemoAuthEnabled()) return;
  const payload = JSON.stringify({ role, email, consultantId, at: Date.now() });
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, payload);
    if (remember) localStorage.setItem(DEMO_SESSION_KEY, payload);
    else localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getDemoSession(): {
  role: AppRole;
  email: string;
  consultantId?: string;
} | null {
  if (typeof window === "undefined" || !isDemoAuthEnabled()) return null;
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY) ?? localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      role?: unknown;
      email?: unknown;
      consultantId?: unknown;
    };
    const role = normalizeAppRole(parsed.role);
    if (!role || typeof parsed.email !== "string") return null;
    return {
      role,
      email: parsed.email,
      ...(typeof parsed.consultantId === "string" ? { consultantId: parsed.consultantId } : {}),
    };
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Trusted role resolution — profiles then app_metadata. Never user_metadata. */
async function resolveSupabaseRole(user: User): Promise<AppRole> {
  let profileRole: unknown;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!error) profileRole = data?.role;
  } catch {
    /* profiles table may not exist yet */
  }

  return resolveAppRoleFromTrustedSources({
    profileRole,
    appMetadataRole: user.app_metadata?.["role"],
  });
}

async function authHeaders(): Promise<HeadersInit | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (session && accessTokenNeedsRefresh(session.expires_at ?? null)) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session) {
        session = refreshed.data.session;
      }
    }
    const token = session?.access_token;
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  } catch {
    return undefined;
  }
}

/** Headers for authorized server functions (Supabase Bearer when available). */
export async function getAuthRequestHeaders(): Promise<HeadersInit | undefined> {
  return authHeaders();
}

export async function getAuthSession(): Promise<PublicSession | null> {
  // Prefer live JWT → establishSession so profiles.role changes are not masked by a stale cookie.
  if (isSupabaseConfigured()) {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (data.session?.access_token) {
        try {
          return await establishSession({ data: { accessToken: data.session.access_token } });
        } catch {
          // Do not invent an authenticated session from a JWT the server rejected.
          return null;
        }
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const headers = await authHeaders();
    const cookieSession = await getPortalSession(headers ? { headers } : undefined);
    if (cookieSession) return cookieSession;
  } catch {
    /* fall through */
  }

  if (isDemoAuthEnabled()) {
    const demo = getDemoSession();
    if (demo) {
      // Re-derive role from the allow-list — never trust a client-edited role claim.
      const account = findDemoAccountByEmail(demo.email);
      if (account) {
        const role = normalizeAppRole(account.role);
        if (role) {
          return {
            role,
            email: account.email,
            source: "demo" as const,
            ...(account.consultantId ? { consultantId: account.consultantId } : {}),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Unified sign-in. Demo accounts only when demo auth is enabled.
 * Role is never selected in the UI.
 */
export async function signInWithPassword(options: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<SignInResult> {
  const email = normalizeEmail(options.email);
  const password = options.password;
  const remember = Boolean(options.remember);

  if (!email || !password) {
    return { ok: false, error: "Please enter your email and password to continue." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  if (remember) setRememberedEmail(email);
  else setRememberedEmail(null);

  // Prefer known demo accounts when demo auth is enabled so Supabase "Invalid login
  // credentials" does not surface for consultant@ / ayesha@ / admin@ demo logins.
  if (isDemoAuthEnabled()) {
    const demo = findDemoAccount(email, password);
    if (demo) {
      try {
        const established = await establishSession({
          data: { demoEmail: email, demoPassword: password },
        });
        setClientDemoSession(
          established.role,
          established.email,
          remember,
          established.consultantId,
        );
        return {
          ok: true,
          role: established.role,
          redirectTo: portalHomeByRole[established.role],
        };
      } catch {
        return { ok: false, error: "Unable to sign in right now. Please try again." };
      }
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data.user && data.session?.access_token) {
        clearDemoSession();
        // Persist httpOnly portal cookie via server validation of the live JWT.
        const established = await establishSession({
          data: { accessToken: data.session.access_token },
        });
        const role = established.role;
        // Optional password change remains available in-portal; never block entry.
        return { ok: true, role, redirectTo: portalHomeByRole[role] };
      }

      const supabaseMsg = error?.message ?? "Invalid email or password. Please try again.";
      if (/invalid login credentials/i.test(supabaseMsg)) {
        return { ok: false, error: "Invalid email or password. Please try again." };
      }
      return { ok: false, error: supabaseMsg };
    } catch {
      return { ok: false, error: "Unable to sign in right now. Please try again." };
    }
  }

  if (!isDemoAuthEnabled()) {
    return {
      ok: false,
      error: "Authentication is not configured for this environment.",
    };
  }

  return { ok: false, error: "Invalid email or password. Please try again." };
}

export async function signOut(): Promise<void> {
  clearDemoSession();
  if (isSupabaseConfigured()) {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* ignore */
    }
  }
  try {
    await clearSession();
  } catch {
    /* ignore */
  }
}

export async function requestPasswordReset(
  emailRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Password reset will be available once authentication is fully connected.",
    };
  }

  try {
    const supabase = getSupabase();
    const origin =
      typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : undefined;
    const redirectTo = passwordRecoveryRedirectUrl(origin);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to send reset email right now. Please try again." };
  }
}

export type PasswordUpdateResult = { ok: true; message: string } | { ok: false; error: string };

/** Recovery-session password update (after email link lands on /reset-password). */
export async function updatePasswordFromRecovery(
  newPassword: string,
  confirmPassword: string,
): Promise<PasswordUpdateResult> {
  const check = validatePasswordConfirmation(newPassword, confirmPassword);
  if (!check.ok) return { ok: false, error: check.error };

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  try {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        ok: false,
        error: "This reset link is invalid or has expired. Request a new password reset email.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      const msg = error.message || "Could not update password.";
      if (/session|expired|invalid/i.test(msg)) {
        return {
          ok: false,
          error: "This reset link is invalid or has expired. Request a new password reset email.",
        };
      }
      return { ok: false, error: msg };
    }

    const { data: after } = await supabase.auth.getSession();
    if (after.session?.access_token) {
      try {
        await establishSession({ data: { accessToken: after.session.access_token } });
      } catch {
        /* cookie refresh optional after recovery */
      }
    }

    return { ok: true, message: "Password updated. You can sign in with your new password." };
  } catch {
    return { ok: false, error: "Unable to update password right now. Please try again." };
  }
}

/**
 * Authenticated change-password.
 * Verifies the current password on the server, then updates via the user's
 * Supabase session (not Auth Admin) so the live session is not revoked.
 */
export async function changeOwnPassword(options: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<PasswordUpdateResult> {
  const check = validatePasswordConfirmation(options.newPassword, options.confirmPassword);
  if (!check.ok) return { ok: false, error: check.error };
  if (!options.currentPassword) {
    return { ok: false, error: "Enter your current password to continue." };
  }
  if (options.currentPassword === options.newPassword) {
    return { ok: false, error: "New password must be different from the current password." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  try {
    const { portalVerifyCurrentPassword } = await import("@/server/portal-password");
    const headers = await authHeaders();
    if (!headers) {
      return { ok: false, error: "Sign in required. Your session may have expired." };
    }
    await portalVerifyCurrentPassword({
      headers,
      data: { currentPassword: options.currentPassword },
    });

    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: options.newPassword });
    if (error) {
      return { ok: false, error: error.message || "Could not update password." };
    }

    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      await establishSession({ data: { accessToken: data.session.access_token } });
    }

    return { ok: true, message: "Password updated successfully." };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const cleaned = raw.replace(/^\d+:/, "").trim() || "Could not change password.";
    return { ok: false, error: cleaned };
  }
}

export async function signUpStudent(options: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<SignInResult> {
  const fullName = options.fullName.trim();
  const email = normalizeEmail(options.email);
  const password = options.password;
  const phone = options.phone?.trim() ?? "";

  if (!fullName) return { ok: false, error: "Please enter your full name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Account creation will be available once authentication is fully connected.",
    };
  }

  try {
    const supabase = getSupabase();
    // Do not put role in user_metadata — roles are assigned via profiles / app_metadata only.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(phone ? { phone } : {}),
        },
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user) {
      return {
        ok: false,
        error: "Check your email to confirm your account, then sign in.",
      };
    }

    if (data.session?.access_token) {
      const established = await establishSession({
        data: { accessToken: data.session.access_token },
      });
      // Link Front Desk CRM registration to this Auth user (email match only).
      if (established.role === "student") {
        try {
          const { claimOwnStudentRecord } = await import("@/services");
          await claimOwnStudentRecord();
        } catch {
          /* registration may not exist yet — portal will explain on first load */
        }
      }
      return {
        ok: true,
        role: established.role,
        redirectTo: portalHomeByRole[established.role],
      };
    }

    return {
      ok: false,
      error: "Account created. Check your email to confirm, then sign in.",
    };
  } catch {
    return { ok: false, error: "Unable to create your account right now. Please try again." };
  }
}
