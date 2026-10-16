/**
 * Pure validation / mapping for Admin Organization Settings.
 * Persists to public.organization_settings (singleton id=1) when migration is applied.
 */

export type OrganizationSettingsInput = {
  consultancyName: string;
  supportEmail: string;
  portalFooterNote: string;
  emailAdminsOnNewLeads: boolean;
  studentDocumentAlerts: boolean;
};

export type NormalizedOrganizationSettings = {
  consultancyName: string;
  supportEmail: string;
  portalFooterNote: string;
  emailAdminsOnNewLeads: boolean;
  studentDocumentAlerts: boolean;
};

export type OrganizationSettingsRow = {
  id: number;
  consultancy_name: string;
  support_email: string;
  portal_footer_note: string;
  email_admins_on_new_leads: boolean;
  student_document_alerts: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Defaults match migration seed + historical preview UI. */
export const DEFAULT_ORGANIZATION_SETTINGS: NormalizedOrganizationSettings = {
  consultancyName: "Global Roots Consultants",
  supportEmail: "support@globalroots.pk",
  portalFooterNote: "Global Roots Consultants — secure client portal.",
  emailAdminsOnNewLeads: true,
  studentDocumentAlerts: true,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mapOrganizationSettingsRow(
  row: OrganizationSettingsRow | null | undefined,
): NormalizedOrganizationSettings {
  if (!row) return { ...DEFAULT_ORGANIZATION_SETTINGS };
  return {
    consultancyName: row.consultancy_name?.trim() || DEFAULT_ORGANIZATION_SETTINGS.consultancyName,
    supportEmail: row.support_email?.trim() || DEFAULT_ORGANIZATION_SETTINGS.supportEmail,
    portalFooterNote:
      row.portal_footer_note?.trim() ?? DEFAULT_ORGANIZATION_SETTINGS.portalFooterNote,
    emailAdminsOnNewLeads: Boolean(row.email_admins_on_new_leads),
    studentDocumentAlerts: Boolean(row.student_document_alerts),
  };
}

export function validateOrganizationSettingsWrite(
  input: OrganizationSettingsInput,
):
  | { ok: true; normalized: NormalizedOrganizationSettings }
  | { ok: false; error: string } {
  const consultancyName = input.consultancyName?.trim() ?? "";
  const supportEmail = input.supportEmail?.trim() ?? "";
  const portalFooterNote = input.portalFooterNote?.trim() ?? "";

  if (consultancyName.length < 2) {
    return { ok: false, error: "Consultancy name is required (min 2 characters)." };
  }
  if (consultancyName.length > 200) {
    return { ok: false, error: "Consultancy name is too long (max 200 characters)." };
  }
  if (supportEmail.length < 3) {
    return { ok: false, error: "Support email is required." };
  }
  if (supportEmail.length > 254) {
    return { ok: false, error: "Support email is too long." };
  }
  if (!EMAIL_RE.test(supportEmail)) {
    return { ok: false, error: "Support email must be a valid email address." };
  }
  if (portalFooterNote.length > 1000) {
    return { ok: false, error: "Portal footer note is too long (max 1000 characters)." };
  }

  return {
    ok: true,
    normalized: {
      consultancyName,
      supportEmail: supportEmail.toLowerCase(),
      portalFooterNote,
      emailAdminsOnNewLeads: Boolean(input.emailAdminsOnNewLeads),
      studentDocumentAlerts: Boolean(input.studentDocumentAlerts),
    },
  };
}

export function organizationSettingsAreDirty(
  draft: NormalizedOrganizationSettings,
  saved: NormalizedOrganizationSettings,
): boolean {
  return (
    draft.consultancyName !== saved.consultancyName ||
    draft.supportEmail !== saved.supportEmail ||
    draft.portalFooterNote !== saved.portalFooterNote ||
    draft.emailAdminsOnNewLeads !== saved.emailAdminsOnNewLeads ||
    draft.studentDocumentAlerts !== saved.studentDocumentAlerts
  );
}

/** DB write shape for the singleton row. */
export function toOrganizationSettingsDbPatch(normalized: NormalizedOrganizationSettings): {
  consultancy_name: string;
  support_email: string;
  portal_footer_note: string;
  email_admins_on_new_leads: boolean;
  student_document_alerts: boolean;
} {
  return {
    consultancy_name: normalized.consultancyName,
    support_email: normalized.supportEmail,
    portal_footer_note: normalized.portalFooterNote,
    email_admins_on_new_leads: normalized.emailAdminsOnNewLeads,
    student_document_alerts: normalized.studentDocumentAlerts,
  };
}

/**
 * Documents which Settings UI fields are persisted vs navigation-only.
 * Kept pure for regression tests.
 */
export function adminSettingsPersistenceCoverage(): {
  persisted: readonly string[];
  navigationOnly: readonly string[];
  deliveryNotWired: readonly string[];
} {
  return {
    persisted: [
      "consultancyName",
      "supportEmail",
      "portalFooterNote",
      "emailAdminsOnNewLeads",
      "studentDocumentAlerts",
    ],
    navigationOnly: ["importExportLink", "auditLogsLink", "changePasswordLink"],
    deliveryNotWired: ["emailAdminsOnNewLeads", "studentDocumentAlerts"],
  };
}
