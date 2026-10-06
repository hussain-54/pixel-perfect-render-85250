import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PortalRole } from "@/components/portal/PortalShell";

export type AuthRole = PortalRole;

export type PortalHome = "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";

export const portalHomeByRole: Record<AuthRole, PortalHome> = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
};

const REMEMBER_EMAIL_KEY = "gr_remember_email";
const DEMO_SESSION_KEY = "gr_demo_session";

/** Local demo accounts used when Supabase Auth users are not yet provisioned. */
const DEMO_ACCOUNTS: Array<{ email: string; password: string; role: AuthRole }> = [
  { email: "student@globalroots.pk", password: "demo1234", role: "student" },
  { email: "consultant@globalroots.pk", password: "demo1234", role: "staff" },
  { email: "admin@globalroots.pk", password: "demo1234", role: "admin" },
];

export type SignInResult =
  { ok: true; role: AuthRole; redirectTo: PortalHome } | { ok: false; error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRole(value: unknown): AuthRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  if (role === "student") return "student";
  if (role === "staff" || role === "consultant") return "staff";
  if (role === "admin") return "admin";
  return null;
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

function setDemoSession(role: AuthRole, email: string, remember: boolean) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ role, email, at: Date.now() });
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, payload);
    if (remember) localStorage.setItem(DEMO_SESSION_KEY, payload);
    else localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getDemoSession(): { role: AuthRole; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY) ?? localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: unknown; email?: unknown };
    const role = normalizeRole(parsed.role);
    if (!role || typeof parsed.email !== "string") return null;
    return { role, email: parsed.email };
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

async function resolveSupabaseRole(user: User): Promise<AuthRole> {
  const fromApp = normalizeRole(user.app_metadata?.["role"]);
  if (fromApp) return fromApp;

  const fromUser = normalizeRole(user.user_metadata?.["role"]);
  if (fromUser) return fromUser;

  try {
    const supabase = getSupabase();
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const fromProfile = normalizeRole(data?.role);
    if (fromProfile) return fromProfile;
  } catch {
    /* profiles table may not exist yet */
  }

  // Safe default for new accounts without an assigned role
  return "student";
}

function signInDemo(email: string, password: string, remember: boolean): SignInResult {
  const match = DEMO_ACCOUNTS.find(
    (account) => account.email === email && account.password === password,
  );
  if (!match) {
    return { ok: false, error: "Invalid email or password. Please try again." };
  }
  setDemoSession(match.role, match.email, remember);
  return { ok: true, role: match.role, redirectTo: portalHomeByRole[match.role] };
}

/**
 * Unified sign-in: Supabase Auth first, demo accounts as fallback.
 * Role is resolved from metadata / profiles — never selected in the UI.
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

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data.user) {
        clearDemoSession();
        const role = await resolveSupabaseRole(data.user);
        return { ok: true, role, redirectTo: portalHomeByRole[role] };
      }

      // Unknown Supabase user — allow demo accounts for local/portal preview
      const demo = signInDemo(email, password, remember);
      if (demo.ok) return demo;

      return {
        ok: false,
        error: error?.message ?? "Invalid email or password. Please try again.",
      };
    } catch {
      const demo = signInDemo(email, password, remember);
      if (demo.ok) return demo;
      return { ok: false, error: "Unable to sign in right now. Please try again." };
    }
  }

  return signInDemo(email, password, remember);
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
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/sign-in` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to send reset email right now. Please try again." };
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "student",
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

    // If email confirmation is disabled, session may already exist
    if (data.session) {
      const role = await resolveSupabaseRole(data.user);
      return { ok: true, role, redirectTo: portalHomeByRole[role] };
    }

    return {
      ok: false,
      error: "Account created. Check your email to confirm, then sign in.",
    };
  } catch {
    return { ok: false, error: "Unable to create your account right now. Please try again." };
  }
}
