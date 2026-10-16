import { describe, expect, it } from "vitest";
import { assertModulePermission } from "@/server/staff-access";
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  adminSettingsPersistenceCoverage,
  mapOrganizationSettingsRow,
  organizationSettingsAreDirty,
  toOrganizationSettingsDbPatch,
  validateOrganizationSettingsWrite,
} from "./admin-settings-rules";

function session(partial: Partial<TrustedSession> & Pick<TrustedSession, "role">): TrustedSession {
  return {
    email: "t@example.com",
    source: "demo",
    userId: "u1",
    businessRole: null,
    ...partial,
  };
}

describe("admin settings rules", () => {
  it("maps null row to documented defaults", () => {
    expect(mapOrganizationSettingsRow(null)).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
  });

  it("maps a live row", () => {
    expect(
      mapOrganizationSettingsRow({
        id: 1,
        consultancy_name: "  Acme Advisors  ",
        support_email: "help@acme.test",
        portal_footer_note: "Secure portal.",
        email_admins_on_new_leads: false,
        student_document_alerts: true,
        updated_by: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      }),
    ).toEqual({
      consultancyName: "Acme Advisors",
      supportEmail: "help@acme.test",
      portalFooterNote: "Secure portal.",
      emailAdminsOnNewLeads: false,
      studentDocumentAlerts: true,
    });
  });

  it("validates organization writes", () => {
    expect(
      validateOrganizationSettingsWrite({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        consultancyName: "A",
      }).ok,
    ).toBe(false);

    expect(
      validateOrganizationSettingsWrite({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        supportEmail: "not-an-email",
      }).ok,
    ).toBe(false);

    expect(
      validateOrganizationSettingsWrite({
        ...DEFAULT_ORGANIZATION_SETTINGS,
        portalFooterNote: "x".repeat(1001),
      }).ok,
    ).toBe(false);

    const ok = validateOrganizationSettingsWrite({
      consultancyName: "  Global Roots Consultants ",
      supportEmail: "Support@GlobalRoots.pk",
      portalFooterNote: "  Note  ",
      emailAdminsOnNewLeads: false,
      studentDocumentAlerts: false,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.normalized.consultancyName).toBe("Global Roots Consultants");
      expect(ok.normalized.supportEmail).toBe("support@globalroots.pk");
      expect(ok.normalized.portalFooterNote).toBe("Note");
      expect(ok.normalized.emailAdminsOnNewLeads).toBe(false);
    }
  });

  it("detects dirty drafts and builds DB patches", () => {
    const saved = { ...DEFAULT_ORGANIZATION_SETTINGS };
    const draft = { ...saved, consultancyName: "Changed" };
    expect(organizationSettingsAreDirty(draft, saved)).toBe(true);
    expect(organizationSettingsAreDirty(saved, saved)).toBe(false);
    expect(toOrganizationSettingsDbPatch(draft)).toEqual({
      consultancy_name: "Changed",
      support_email: saved.supportEmail,
      portal_footer_note: saved.portalFooterNote,
      email_admins_on_new_leads: true,
      student_document_alerts: true,
    });
  });

  it("documents persistence coverage (flags are preference-only)", () => {
    const coverage = adminSettingsPersistenceCoverage();
    expect(coverage.persisted).toContain("consultancyName");
    expect(coverage.persisted).toContain("emailAdminsOnNewLeads");
    expect(coverage.navigationOnly).toContain("changePasswordLink");
    expect(coverage.deliveryNotWired).toEqual(
      expect.arrayContaining(["emailAdminsOnNewLeads", "studentDocumentAlerts"]),
    );
  });

  it("settings module: manager may view; counsellor denied; admin may edit", () => {
    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "manager" }),
        "settings",
        1,
        "settings view",
      ),
    ).not.toThrow();

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "manager" }),
        "settings",
        2,
        "settings edit",
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(
        session({ role: "consultant", businessRole: "counsellor_consultant" }),
        "settings",
        1,
      ),
    ).toThrow(AuthError);

    expect(() =>
      assertModulePermission(session({ role: "admin", businessRole: "admin" }), "settings", 2),
    ).not.toThrow();
  });
});
