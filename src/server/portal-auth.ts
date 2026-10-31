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
import { sessionValidationFailureMessage } from "@/lib/session-auth";
import type { BusinessRole } from "@/lib/business-permissions";
import { normalizeTrustedBusinessRole } from "@/lib/staff-business-access";

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
  /** From profiles.business_role only — never client-supplied. */
  businessRole?: BusinessRole | null;
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

export type TrustedProfileRoles = {
  appRole: AppRole;
  businessRole: BusinessRole | null;
};

/**
 * App role + business role from trusted profiles row only for business_role.
 * Prefer profiles.role over app_metadata. Never trust user_metadata or client body.
 */
export async function resolveTrustedProfileRoles(
  user: User,
  accessToken?: string | null,
): Promise<TrustedProfileRoles> {
  let profileRole: unknown;
  let profileBusinessRole: unknown;

  const { url, key } = supabaseEnv();
  if (url && key && accessToken) {
    try {
      const supabase = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await supabase
        .from("profiles")
        .select("role, business_role")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) {
        profileRole = data.role;
        profileBusinessRole = data.business_role;
      }
    } catch {
      /* profiles may be unavailable; fail closed via resolveAppRoleFromTrustedSources */
    }
  }

  return {
    appRole: resolveAppRoleFromTrustedSources({
      profileRole,
      appMetadataRole: user.app_metadata?.["role"],
    }),
    businessRole: normalizeTrustedBusinessRole(profileBusinessRole),
  };
}

/** @deprecated Prefer resolveTrustedProfileRoles — kept for call-site compatibility. */
export async function resolveTrustedRole(
  user: User,
  accessToken?: string | null,
): Promise<AppRole> {
  const resolved = await resolveTrustedProfileRoles(user, accessToken);
  return resolved.appRole;
}

export function readPortalSessionCookie(): PortalSessionPayload | null {
  return decodePortalSession(getCookie(PORTAL_SESSION_COOKIE));
}

export function writePortalSessionCookie(payload: Omit<PortalSessionPayload, "exp">) {
  const full: PortalSessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const secure =
    process.env["NODE_ENV"] === "production" ||
    process.env["VERCEL_ENV"] === "production" ||
    process.env["VERCEL"] === "1";
  setCookie(PORTAL_SESSION_COOKIE, encodePortalSession(full), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    secure,
  });
  return full;
}

export function clearPortalSessionCookie() {
  deleteCookie(PORTAL_SESSION_COOKIE, { path: "/" });
}

async function sessionFromAccessToken(accessToken: string): Promise<TrustedSession> {
  const { url, key } = supabaseEnv();
  if (!url || !key) throw new AuthError("Authentication is not configured.", 503);

  const token = accessToken.trim();
  if (!token) throw new AuthError("Sign in required. Missing access token.", 401);

  // Stateless server client — never touch browser storage or auto-refresh here.
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    // AuthSessionMissingError happens when admin password rotation revoked the
    // session_id inside an otherwise unexpired JWT — do not treat as authenticated.
    throw new AuthError(sessionValidationFailureMessage(error?.message), 401);
  }

  const { appRole: role, businessRole } = await resolveTrustedProfileRoles(data.user, token);
  const email = (data.user.email ?? "").toLowerCase();
  const session: TrustedSession = {
    role,
    email,
    source: "supabase",
    userId: data.user.id,
    businessRole,
  };

  // Consultant / Admission Officer desk id is the consultants row (= auth.uid()).
  // Never invent mock ids (c1) for Supabase sessions.
  if (role === "consultant") {
    try {
      const userClient = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
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
  const businessRole = normalizeTrustedBusinessRole(account.businessRole);
  return {
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
    ...(businessRole ? { businessRole } : {}),
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
      businessRole: session.businessRole ?? null,
    });
    return session;
  }

  const cookie = readPortalSessionCookie();
  if (cookie?.source === "supabase") {
    // Cookie alone is not enough for data access without a JWT — require Bearer.
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

  const businessRole = normalizeTrustedBusinessRole(account.businessRole);
  writePortalSessionCookie({
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
    ...(businessRole ? { businessRole } : {}),
  });

  return {
    role,
    email: account.email,
    source: "demo",
    ...(account.consultantId ? { consultantId: account.consultantId } : {}),
    ...(businessRole ? { businessRole } : {}),
  };
}

export async function establishSupabaseSession(accessToken: string): Promise<TrustedSession> {
  const session = await sessionFromAccessToken(accessToken);
  writePortalSessionCookie({
    role: session.role,
    email: session.email,
    source: "supabase",
    businessRole: session.businessRole ?? null,
  });
  return session;
}

export function requireRoles(session: TrustedSession, allowed: AppRole[]): void {
  if (!allowed.includes(session.role)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
}
