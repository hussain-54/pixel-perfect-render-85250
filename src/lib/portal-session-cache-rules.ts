/**
 * Short-lived client cache for portal establishSession (same JWT only).
 * Not for user-specific student/finance records.
 */

export const PORTAL_SESSION_CACHE_TTL_MS = 30_000;

export type PortalSessionCacheEntry<T> = {
  tokenFingerprint: string;
  session: T;
  at: number;
};

/** Fingerprint without retaining the full JWT in memory longer than needed. */
export function tokenFingerprint(accessToken: string): string {
  const t = accessToken.trim();
  if (t.length <= 24) return t;
  return `${t.slice(0, 12)}…${t.slice(-12)}:${t.length}`;
}

export function readPortalSessionCache<T>(
  cache: PortalSessionCacheEntry<T> | null,
  accessToken: string,
  nowMs: number,
  ttlMs: number = PORTAL_SESSION_CACHE_TTL_MS,
): T | null {
  if (!cache) return null;
  if (cache.tokenFingerprint !== tokenFingerprint(accessToken)) return null;
  if (nowMs - cache.at > ttlMs) return null;
  return cache.session;
}

export function writePortalSessionCache<T>(
  accessToken: string,
  session: T,
  nowMs: number,
): PortalSessionCacheEntry<T> {
  return {
    tokenFingerprint: tokenFingerprint(accessToken),
    session,
    at: nowMs,
  };
}
