import { redirect } from "@tanstack/react-router";
import { getPortalSession, type PublicSession } from "@/server/portal-data";
import {
  portalHomeByRole,
  roleCanAccessPortal,
  type PortalHome,
  type PortalKind,
} from "@/lib/roles";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  readPortalSessionCache,
  writePortalSessionCache,
  type PortalSessionCacheEntry,
} from "@/lib/portal-session-cache-rules";

/** Same-JWT short TTL — avoids establishSession on every in-portal navigation. */
let portalSessionCache: PortalSessionCacheEntry<PublicSession> | null = null;

export function clearPortalSessionClientCache(): void {
  portalSessionCache = null;
}

async function bearerHeaders(): Promise<HeadersInit | undefined> {
  if (typeof window === "undefined") return undefined;
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  } catch {
    return undefined;
  }
}

function portalHomePath(portal: PortalKind): PortalHome {
  if (portal === "student") return "/student/dashboard";
  if (portal === "staff") return "/staff/dashboard";
  return "/admin/dashboard";
}

/**
 * TanStack Router beforeLoad guard for portal layouts.
 * When a live Supabase JWT is present, re-resolve role via establishSession
 * (short same-token cache) so profiles.role changes are not masked by a stale cookie.
 * Client localStorage/sessionStorage roles are never trusted for portal access.
 */
export function requirePortalAccess(portal: PortalKind) {
  return async () => {
    let session: PublicSession | null = null;

    // Live JWT path first — refreshes httpOnly cookie from profiles/app_metadata.
    // Proactively refresh near-expiry tokens so the next server fn still validates.
    if (typeof window !== "undefined" && isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        let { data } = await supabase.auth.getSession();
        const expiresAt = data.session?.expires_at;
        if (
          data.session &&
          typeof expiresAt === "number" &&
          expiresAt * 1000 <= Date.now() + 60_000
        ) {
          const refreshed = await supabase.auth.refreshSession();
          if (!refreshed.error && refreshed.data.session) {
            data = { session: refreshed.data.session };
          }
        }
        const token = data.session?.access_token;
        if (token) {
          const cached = readPortalSessionCache(portalSessionCache, token, Date.now());
          if (cached) {
            session = cached;
          } else {
            const { establishSession } = await import("@/server/portal-data");
            try {
              session = await establishSession({ data: { accessToken: token } });
              portalSessionCache = writePortalSessionCache(token, session, Date.now());
            } catch {
              portalSessionCache = null;
              // Stale/revoked JWT (e.g. admin password rotation) — clear and force sign-in.
              try {
                await supabase.auth.signOut();
              } catch {
                /* ignore */
              }
              const { clearSession } = await import("@/server/portal-data");
              try {
                await clearSession();
              } catch {
                /* ignore */
              }
              session = null;
            }
          }
        }
      } catch {
        session = null;
      }
    }

    // Demo / cookie fallback only when no JWT session was established.
    if (!session) {
      try {
        const headers = await bearerHeaders();
        session = await getPortalSession(headers ? { headers } : undefined);
      } catch {
        session = null;
      }
    }

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: portalHomePath(portal) },
      });
    }

    if (!roleCanAccessPortal(session.role, portal)) {
      throw redirect({ to: portalHomeByRole[session.role] });
    }

    return { auth: session };
  };
}
