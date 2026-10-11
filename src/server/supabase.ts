/**
 * Server-side typed Supabase client (publishable key + optional user JWT).
 * Never imports or exposes a service-role key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ServerSupabase = SupabaseClient<Database>;

function env() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL?.trim()) ||
    process.env["VITE_SUPABASE_URL"]?.trim() ||
    process.env["SUPABASE_URL"]?.trim() ||
    "";
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    process.env["SUPABASE_ANON_KEY"]?.trim() ||
    "";
  return { url, key };
}

export function createServerSupabase(accessToken?: string): ServerSupabase | null {
  const { url, key } = env();
  if (!url || !key) return null;

  if (accessToken) {
    return createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

