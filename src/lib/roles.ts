/**
 * Canonical application roles.
 * UI portal path `/staff` remains the consultant (Admission Officer) workspace.
 */
export type AppRole = "student" | "consultant" | "admin" | "super_admin";

/** Portal shell / route tree kinds — `staff` is the consultant portal path alias. */
export type PortalKind = "student" | "staff" | "admin";

export type PortalHome = "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";

export const portalHomeByRole: Record<AppRole, PortalHome> = {
  student: "/student/dashboard",
  consultant: "/staff/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
};

/**
 * Admission Officer compatibility decision (Phase A2):
 * Keep reusing `consultant` rather than introducing `admission_officer` in the DB enum.
 * Reasons: foundation migrations, RLS helpers (`is_consultant`, assignment FKs), and
 * `/staff` routes already treat officer workflows as the consultant desk. Adding a new
 * enum value would require a breaking migration and dual-path auth for little gain until
 * product requires distinct AO vs consultant permissions.
 * Alias `admission_officer` normalizes to `consultant` for inbound strings only.
 * Staff access is never granted from browser-editable user_metadata.
 */
export const ADMISSION_OFFICER_ROLE: AppRole = "consultant";

/** Roles allowed on Admission Officer / consultant desk server functions. */
export const STAFF_DESK_ROLES: AppRole[] = ["consultant", "admin", "super_admin"];

/** Normalize any stored/legacy role string. Returns null if unrecognized. */
export function normalizeAppRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  if (role === "student") return "student";
  if (role === "consultant" || role === "staff" || role === "admission_officer") {
    return "consultant";
  }
  if (role === "admin") return "admin";
  if (role === "super_admin" || role === "superadmin") return "super_admin";
  return null;
}

export function portalKindForRole(role: AppRole): PortalKind {
  if (role === "student") return "student";
  if (role === "consultant") return "staff";
  return "admin";
}

export function roleCanAccessPortal(role: AppRole, portal: PortalKind): boolean {
  if (portal === "student") return role === "student";
  if (portal === "staff") return role === "consultant";
  return role === "admin" || role === "super_admin";
}

export function rolesAtLeastAdmin(role: AppRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function rolesConsultantDesk(role: AppRole): boolean {
  return role === "consultant" || rolesAtLeastAdmin(role);
}