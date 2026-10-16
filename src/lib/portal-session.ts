export const PORTAL_SESSION_COOKIE = "gr_portal_session";

export type PortalSessionPayload = {
  role: "student" | "consultant" | "admin" | "super_admin";
  email: string;
  source: "supabase" | "demo";
  /** Demo consultant mock id when source is demo + consultant. */
  consultantId?: string;
  /** Trusted profiles.business_role snapshot for shell branding (not an authz grant). */
  businessRole?: string | null;
  exp: number;
};

export function encodePortalSession(payload: PortalSessionPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodePortalSession(raw: string | undefined | null): PortalSessionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as PortalSessionPayload;
    if (!parsed?.role || !parsed?.email || !parsed?.source || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}