/**
 * Centralized role → workspace branding for portal chrome (header, identity, SEO).
 * Uses existing business_role enum values only — does not invent roles or change storage.
 * Never uses the bare word "Portal" as the main workspace title.
 */
import { BUSINESS_ROLES, type BusinessRole } from "@/lib/business-permissions";
import type { PortalKind } from "@/lib/roles";

export type WorkspaceBrand = {
  /** Main workspace title shown in the staff/admin/student top bar. */
  title: string;
  /** Compact identity line (“Logged in as …”). */
  identityLabel: string;
};

/**
 * Professional workspace titles keyed by profiles.business_role.
 * Staff specialty desks and counsellor/admission share the /staff shell.
 */
export const WORKSPACE_BRANDING_BY_BUSINESS_ROLE: Record<BusinessRole, WorkspaceBrand> = {
  front_desk_student_affairs: {
    title: "Front Desk & Student Affairs",
    identityLabel: "Front Desk",
  },
  counsellor_consultant: {
    title: "Counselling & Student Guidance",
    identityLabel: "Counsellor",
  },
  admission_team: {
    title: "Admissions & Application Management",
    identityLabel: "Admission Team",
  },
  accounts_banking_finance: {
    title: "Accounts & Financial Operations",
    identityLabel: "Accounts & Finance",
  },
  hr_system: {
    title: "Human Resources & Attendance",
    identityLabel: "HR",
  },
  digital_manager: {
    title: "Digital Marketing & Growth",
    identityLabel: "Digital Manager",
  },
  office_ops: {
    title: "Office Operations & Administration",
    identityLabel: "Office Operations",
  },
  manager: {
    title: "Management & Oversight",
    identityLabel: "Manager",
  },
  admin: {
    title: "Administration & System Management",
    identityLabel: "Admin",
  },
  student_portal: {
    title: "Student Workspace",
    identityLabel: "Student",
  },
};

/** Fail-safe shell titles when business_role is missing — never grant access. */
const FALLBACK_BY_PORTAL: Record<PortalKind, WorkspaceBrand> = {
  student: { title: "Student Workspace", identityLabel: "Student" },
  staff: { title: "Staff Workspace", identityLabel: "Staff" },
  admin: { title: "Administration & System Management", identityLabel: "Admin" },
};

export function isKnownBusinessRole(value: unknown): value is BusinessRole {
  return typeof value === "string" && (BUSINESS_ROLES as readonly string[]).includes(value);
}

/**
 * Resolve workspace brand from authenticated business_role + portal kind.
 * Unknown / missing roles fall back safely without implying elevated access.
 */
export type WorkspaceSessionInput = {
  portal: PortalKind;
  businessRole?: BusinessRole | string | null | undefined;
  appRole?: string | null | undefined;
};

export function workspaceBrandForSession(input: WorkspaceSessionInput): WorkspaceBrand {
  const role = input.businessRole;
  if (isKnownBusinessRole(role)) {
    return WORKSPACE_BRANDING_BY_BUSINESS_ROLE[role];
  }
  // Technical admin/super_admin without business_role still get admin branding in /admin.
  if (input.portal === "admin" || input.appRole === "admin" || input.appRole === "super_admin") {
    return FALLBACK_BY_PORTAL.admin;
  }
  return FALLBACK_BY_PORTAL[input.portal];
}

export function workspaceTitleForSession(input: WorkspaceSessionInput): string {
  return workspaceBrandForSession(input).title;
}

export function workspaceIdentityLabelForSession(input: WorkspaceSessionInput): string {
  return workspaceBrandForSession(input).identityLabel;
}

/** Document / SEO title segment (no bare “Portal”). */
export function workspaceDocumentTitle(input: WorkspaceSessionInput): string {
  return `${workspaceTitleForSession(input)} — Global Roots Consultants`;
}

/** True if title is the generic forbidden “Portal” shell label. */
export function isGenericPortalTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === "portal" || t === "consultant portal" || t === "staff portal";
}
