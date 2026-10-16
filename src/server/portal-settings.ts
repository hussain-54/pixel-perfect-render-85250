/**
 * Admin Organization Settings — singleton public.organization_settings.
 * Server enforces roles + settings matrix; RLS restricts mutate to is_admin().
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  mapOrganizationSettingsRow,
  toOrganizationSettingsDbPatch,
  validateOrganizationSettingsWrite,
  type NormalizedOrganizationSettings,
  type OrganizationSettingsInput,
  type OrganizationSettingsRow,
} from "@/lib/admin-settings-rules";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type OrganizationSettingsPayload = {
  settings: NormalizedOrganizationSettings;
  source: "live" | "unavailable";
  canMutate: boolean;
  schemaReady: boolean;
  updatedAt: string | null;
  note: string | null;
};

const SCHEMA_MISSING_NOTE =
  "organization_settings table is not available yet. Apply migration 20261016100000_organization_settings.sql (owner confirmation required).";

const PREFERENCE_NOTE =
  "Notification flags store organization preferences only; they do not by themselves send email.";

function unavailablePayload(canMutate: boolean, note: string | null): OrganizationSettingsPayload {
  return {
    settings: { ...DEFAULT_ORGANIZATION_SETTINGS },
    source: "unavailable",
    canMutate,
    schemaReady: false,
    updatedAt: null,
    note,
  };
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("organization_settings") &&
    (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"))
  );
}

export const portalGetOrganizationSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<OrganizationSettingsPayload> => {
    try {
      const session = await requireTrustedSession();
      // Settings UI lives under /admin — technical admin only (matches portal shell).
      requireRoles(session, ["admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "organization settings");
      await requireModulePermission(session, "settings", 1, "organization settings");

      let canMutate = false;
      try {
        await requireModulePermission(session, "settings", 2, "organization settings edit");
        canMutate = true;
      } catch {
        canMutate = false;
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return unavailablePayload(
          false,
          "Organization settings require the live data plane.",
        );
      }

      const client = requireAoSupabaseClient();
      const { data, error } = await client
        .from("organization_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        if (isMissingRelation(error.message)) {
          return unavailablePayload(false, SCHEMA_MISSING_NOTE);
        }
        throw new AuthError(error.message, 500);
      }

      const row = data as OrganizationSettingsRow | null;
      return {
        settings: mapOrganizationSettingsRow(row),
        source: "live",
        canMutate,
        schemaReady: true,
        updatedAt: row?.updated_at ?? null,
        note: PREFERENCE_NOTE,
      };
    } catch (error) {
      toError(error);
    }
  },
);

export const portalUpdateOrganizationSettings = createServerFn({ method: "POST" })
  .validator((data: OrganizationSettingsInput) => data)
  .handler(async ({ data }): Promise<OrganizationSettingsPayload> => {
    try {
      const session = await requireTrustedSession();
      // Administrator-only mutations — ordinary staff cannot change org settings.
      requireRoles(session, ["admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "organization settings");
      await requireModulePermission(session, "settings", 2, "organization settings edit");

      const parsed = validateOrganizationSettingsWrite(data);
      if (!parsed.ok) {
        throw new AuthError(parsed.error, 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Organization settings require the live data plane.", 400);
      }

      const client = requireAoSupabaseClient();
      const patch = {
        ...toOrganizationSettingsDbPatch(parsed.normalized),
        updated_by: session.userId ?? null,
      };

      const { data: row, error } = await client
        .from("organization_settings")
        .update(patch)
        .eq("id", 1)
        .select("*")
        .maybeSingle();

      if (error) {
        if (isMissingRelation(error.message)) {
          throw new AuthError(SCHEMA_MISSING_NOTE, 503);
        }
        throw new AuthError(error.message, 500);
      }
      if (!row) {
        throw new AuthError(
          "Organization settings row was not found. Re-apply the organization_settings migration.",
          404,
        );
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "organization_settings.update",
          entity_type: "organization_settings",
          entity_id: "1",
          metadata: {
            consultancy_name: parsed.normalized.consultancyName,
            support_email: parsed.normalized.supportEmail,
            email_admins_on_new_leads: parsed.normalized.emailAdminsOnNewLeads,
            student_document_alerts: parsed.normalized.studentDocumentAlerts,
          },
        });
      } catch {
        // Audit failure must not roll back a successful settings write.
      }

      const typed = row as OrganizationSettingsRow;
      return {
        settings: mapOrganizationSettingsRow(typed),
        source: "live",
        canMutate: true,
        schemaReady: true,
        updatedAt: typed.updated_at ?? null,
        note: PREFERENCE_NOTE,
      };
    } catch (error) {
      toError(error);
    }
  },
);
