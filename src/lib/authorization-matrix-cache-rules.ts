/**
 * Org-wide authorization matrix cache (not user-specific records).
 * Safe to share across authenticated callers for a short TTL.
 */

export const AUTHORIZATION_MATRIX_CACHE_TTL_MS = 30_000;

export type AuthorizationMatrixCacheEntry<T> = {
  value: T;
  at: number;
};

export function readAuthorizationMatrixCache<T>(
  entry: AuthorizationMatrixCacheEntry<T> | null,
  nowMs: number,
  ttlMs: number = AUTHORIZATION_MATRIX_CACHE_TTL_MS,
): T | null {
  if (!entry) return null;
  if (nowMs - entry.at > ttlMs) return null;
  return entry.value;
}

export function writeAuthorizationMatrixCache<T>(
  value: T,
  nowMs: number,
): AuthorizationMatrixCacheEntry<T> {
  return { value, at: nowMs };
}
