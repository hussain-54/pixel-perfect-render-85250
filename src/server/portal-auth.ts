import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { getCookie, getRequestHeader, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { findDemoAccount, findDemoAccountByEmail, isDemoAuthEnabled } from "@/lib/demo-auth";
import {
  PORTAL_SESSION_COOKIE,
  decodePortalSession,
  encodePortalSession,
  type PortalSessionPayload,
} from "@/lib/portal-session";
import { normalizeAppRole, resolveAppRoleFromTrustedSources, type AppRole } from "@/lib/roles";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type TrustedSession = {
  role: AppRole;
  email: string;
  source: "supabase" | "demo";
  userId?: string;
  consultantId?: string;
};

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function supabaseEnv() {
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

/**
 * Role from trusted sources only — never user_metadata.
 * Prefer profiles.role (JWT-authorized read) over app_metadata so owner SQL /
 * admin_set_user_role take effect without a stale app_metadata.student claim.
 * Fail closed: missing/failed sources never invent staff/admin.
 */
export async function resolveTrustedRole(
  user: User,
  accessToken?: string | null,
): Promise<AppRole> {
  let profileRole: unknown;

  const { url, key } = supabaseEnv();
  if (url && key && accessToken) {
    try {
      const supabase = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!error) profileRole = data?.role;
      // RLS denial / missing row: fall through to app_metadata, then student.
    } catch {
      /* profiles may be unavailable; fail closed via resolveAppRoleFromTrustedSources */
    }
  }

  return resolveAppRoleFromTrustedSources({
    profileRole,
    appMetadataRole: user.app_metadata?.["role"],
  });
}

export function readPortalSessionCookie(): PortalSessionPayload | null {
  return decodePortalSession(getCookie(PORTAL_SESSION_COOKIE));
}

export function writePortalSessionCookie(payload: Omit<PortalSessionPayload, "exp">) {
  const full: PortalSessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  setCookie(PORTAL_SESSION_COOKIE, encodePortalSession(full), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env["NODE_ENV"] === "production",
  });
  return full;
}

export function clearPortalSessionCookie() {
  deleteCookie(PORTAL_SESSION_COOKIE, { path: "/" });
}

async function sessionFromAccessToken(accessToken: string): Promise<TrustedSession> {
  const { url, key } = supabaseEnv();
  if (!url || !key) throw new AuthError("Authentication is not configured.", 503);

  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new AuthError("Invalid or expired session.");

  const role = await resolveTrustedRole(data.user, accessToken);
  const email = (data.user.email ?? "").toLowerCase();
  const session: TrustedSession = {
    role,
    email,
    source: "supabase",
    userId: data.user.id,
  };

  // Consultant / Admission Officer desk id is the consultants row (= auth.uid()).
  // Never invent mock ids (c1) for Supabase sessions.
  if (role === "consultant") {
    try {
      const userClient = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: desk } = await userClient
        .from("consultants")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (desk?.id) session.consultantId = desk.id;
    } catch {
      /* consultants table may be unavailable; AO handlers will fail closed */
    }
  }

  return session;
}

function sessionFromDemoCookie(cookie: PortalSessionPayload): TrustedSession {
  if (!isDemoAuthEnabled()) throw new AuthError("Demo authentication is disabled.");
  if (cookie.source !== "demo") throw new AuthError("Invalid demo session.");
  const account = findDemoAccountByEmail(cookie.email);
  if (!account) throw new AuthError("Demo session is not recognized.");
  const role = normalizeAppRole(account.role);
  if (!role) throw new AuthError("Demo session role is invalid.");
  return {
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
  };
}

/**
 * Resolve the caller for server functions.
 * Prefers Bearer JWT (validated via Supabase Auth), then httpOnly portal cookie.
 */
export async function requireTrustedSession(): Promise<TrustedSession> {
  const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (bearer) {
    const session = await sessionFromAccessToken(bearer);
    // Keep cookie in sync for route guards
    writePortalSessionCookie({
      role: session.role,
      email: session.email,
      source: "supabase",
    });
    return session;
  }

  const cookie = readPortalSessionCookie();
  if (cookie?.source === "supabase") {
    // Cookie alone is not enough for data access without a JWT â€” require Bearer.
    throw new AuthError("Sign in required. Missing access token.");
  }
  if (cookie?.source === "demo") {
    return sessionFromDemoCookie(cookie);
  }

  throw new AuthError("Sign in required.");
}

export function establishDemoSession(email: string, password: string): TrustedSession {
  if (!isDemoAuthEnabled()) {
    throw new AuthError("Demo authentication is disabled in this environment.", 403);
  }
  const account = findDemoAccount(email, password);
  if (!account) throw new AuthError("Invalid email or password.");
  const role = normalizeAppRole(account.role);
  if (!role) throw new AuthError("Invalid demo role.");

  writePortalSessionCookie({
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
  });

  return {
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
  };
}

export async function establishSupabaseSession(accessToken: string): Promise<TrustedSession> {
  const session = await sessionFromAccessToken(accessToken);
  writePortalSessionCookie({
    role: session.role,
    email: session.email,
    source: "supabase",
  });
  return session;
}

export function requireRoles(session: TrustedSession, allowed: AppRole[]): void {
  if (!allowed.includes(session.role)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
}
