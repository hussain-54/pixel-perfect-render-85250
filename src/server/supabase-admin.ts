/**
 * Server-only Supabase client with the service-role key.
 * Never import this module from client/route components.
 * Never expose SUPABASE_SERVICE_ROLE_KEY via VITE_* variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AuthError } from "@/server/portal-auth";

export type AdminSupabase = SupabaseClient<Database>;

function adminEnv() {
  const url =
    process.env["SUPABASE_URL"]?.trim() ||
    process.env["VITE_SUPABASE_URL"]?.trim() ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL?.trim()) ||
    "";
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() || "";
  return { url, serviceKey };
}

export function isAdminSupabaseConfigured(): boolean {
  const { url, serviceKey } = adminEnv();
  return Boolean(url && serviceKey);
}

/** Privileged Auth Admin + DB client. Server-only. */
export function createAdminSupabase(): AdminSupabase {
  const { url, serviceKey } = adminEnv();
  if (!url || !serviceKey) {
    throw new AuthError(
      "Account management is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server only.",
      503,
    );
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
