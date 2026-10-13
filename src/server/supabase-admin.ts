/**
 * Server-only Supabase client with the service-role key.
 * Never import this module from client/route components.
 * Never expose SUPABASE_SERVICE_ROLE_KEY via VITE_* variables or import.meta.env.
 *
 * TanStack Start / Nitro / Vercel: read unprefixed secrets from process.env
 * inside request handlers (not at module top-level for edge runtimes).
 * After adding the var in Vercel, a new deployment is required.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AuthError } from "@/server/portal-auth";

export type AdminSupabase = SupabaseClient<Database>;

export type AdminEnvStatus = {
  hasUrl: boolean;
  hasServiceRoleKey: boolean;
  configured: boolean;
};

/**
 * Probe configuration without returning secret values.
 * Exported for unit tests — never log the key itself.
 */
/**
 * Resolve the service-role / secret key from server env only.
 * Prefer SUPABASE_SERVICE_ROLE_KEY; accept SUPABASE_SECRET_KEY as an alias
 * (some hosts/docs use that name). Never read VITE_* for this secret.
 */
export function readServiceRoleKey(env: NodeJS.ProcessEnv = process.env): string {
  return env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() || env["SUPABASE_SECRET_KEY"]?.trim() || "";
}

export function getAdminEnvStatus(
  env: NodeJS.ProcessEnv = process.env,
  viteUrl?: string | undefined,
): AdminEnvStatus {
  const url =
    env["SUPABASE_URL"]?.trim() || env["VITE_SUPABASE_URL"]?.trim() || viteUrl?.trim() || "";
  const serviceKey = readServiceRoleKey(env);
  const hasUrl = Boolean(url);
  const hasServiceRoleKey = Boolean(serviceKey);
  return {
    hasUrl,
    hasServiceRoleKey,
    configured: hasUrl && hasServiceRoleKey,
  };
}

function adminEnv() {
  const viteUrl =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : undefined;
  const status = getAdminEnvStatus(process.env, viteUrl);
  const url =
    process.env["SUPABASE_URL"]?.trim() ||
    process.env["VITE_SUPABASE_URL"]?.trim() ||
    viteUrl?.trim() ||
    "";
  const serviceKey = readServiceRoleKey(process.env);
  return { url, serviceKey, status };
}

export function isAdminSupabaseConfigured(): boolean {
  return adminEnv().status.configured;
}

/** Safe, actionable message — never includes secret material. */
export function adminConfigErrorMessage(status: AdminEnvStatus = getAdminEnvStatus()): string {
  if (!status.hasServiceRoleKey && !status.hasUrl) {
    return (
      "Account management is not configured. On Vercel → Project → Settings → Environment Variables, " +
      "set SUPABASE_SERVICE_ROLE_KEY (Production, never VITE_*) and ensure VITE_SUPABASE_URL (or SUPABASE_URL) is set, " +
      "then Redeploy. Locally, put the key only in a private .env (not committed)."
    );
  }
  if (!status.hasServiceRoleKey) {
    return (
      "Account management is not configured. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SECRET_KEY " +
      "as a server-only Vercel Production variable (never VITE_*), then Redeploy so server functions receive it."
    );
  }
  if (!status.hasUrl) {
    return (
      "Account management is not configured. Supabase URL is missing on the server. " +
      "Set VITE_SUPABASE_URL or SUPABASE_URL for the server runtime, then Redeploy."
    );
  }
  return "Account management is not configured.";
}

/** Privileged Auth Admin + DB client. Server-only. */
export function createAdminSupabase(): AdminSupabase {
  const { url, serviceKey, status } = adminEnv();
  if (!status.configured || !url || !serviceKey) {
    throw new AuthError(adminConfigErrorMessage(status), 503);
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function requireAdminSupabase(): AdminSupabase {
  return createAdminSupabase();
}
