/**
 * Digital Marketing — campaigns, attribution history, conversion counts from persisted links.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  campaignConversionMetrics,
  campaignInquiryMetrics,
  canAttributeInquiryCampaign,
  isValidCampaignStatusTransition,
  validateCampaignCreate,
  validateCampaignId,
  type MarketingCampaignStatus,
} from "@/lib/marketing-rules";
import {
  getPermissionLevelFromMatrix,
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { businessRoleFromSession, requireModulePermission } from "@/server/staff-access";
import { loadAuthorizationMatrix } from "@/server/permission-matrix-store";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

async function resolveSessionBusinessRole(session: TrustedSession): Promise<BusinessRole | null> {
  const mapped = resolveBusinessRoleFromTrustedAppRole(session.role);
  if (!session.userId || session.source !== "supabase") return mapped;
  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("business_role")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

async function requireMarketingView(session: TrustedSession) {
  // Matrix-driven: Admin may grant Front Desk View. Server loads DB matrix.
  await requireModulePermission(session, "digital_marketing", 1, "Digital Marketing");
}

async function requireMarketingMutate(session: TrustedSession) {
  // View never unlocks mutate — Edit (2+) required via persisted matrix.
  await requireModulePermission(session, "digital_marketing", 2, "Digital Marketing changes");
}

async function marketingCanMutate(
  session: TrustedSession,
  businessRole: BusinessRole | null,
): Promise<boolean> {
  if (rolesAtLeastAdmin(session.role)) return true;
  const loaded = await loadAuthorizationMatrix(session);
  if (loaded.source === "unavailable") {
    throw new AuthError(
      "Permission matrix is temporarily unavailable. Try again or contact an administrator.",
      503,
    );
  }
  const role = businessRoleFromSession(session) ?? businessRole;
  return getPermissionLevelFromMatrix(loaded.matrix, role, "digital_marketing") >= 2;
}

export type MarketingCampaignView = {
  id: string;
  name: string;
  channel: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  budgetNote: string | null;
  archivedAt: string | null;
  inquiries: number;
  newInquiries: number;
  assignedInquiries: number;
  /** null = unavailable (not zero) */
  registeredStudents: number | null;
  registeredStudentsUnavailable: string | null;
};

export const portalGetMarketingOverview = createServerFn({ method: "GET" })
  .validator((data: { includeArchived?: boolean } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      await requireMarketingView(session);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const canMutate = await marketingCanMutate(session, businessRole);

      if (!usesSupabaseDataPlane(session)) {
        return {
          ok: true as const,
          campaigns: [] as MarketingCampaignView[],
          recentInquiries: [] as Array<{
            id: string;
            referenceCode: string;
            fullName: string;
            email: string;
            status: string;
            campaignId: string | null;
            attributionSource: string | null;
            originalAttributionSource: string | null;
            createdAt: string;
          }>,
          canMutate,
          isSuperAdmin: session.role === "super_admin",
        };
      }

      const client = requireAoSupabaseClient();
      let campQ = client
        .from("marketing_campaigns")
        .select("id, name, channel, status, starts_on, ends_on, budget_note, archived_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data.includeArchived) campQ = campQ.is("archived_at", null);

      const [campRes, inqRes, studentsRes] = await Promise.all([
        campQ,
        client
          .from("consultation_requests")
          .select(
            "id, reference_code, full_name, email, status, campaign_id, attribution_source, original_attribution_source, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        client.from("students").select("email").limit(2000),
      ]);
      if (campRes.error) throw new Error(campRes.error.message);
      if (inqRes.error) throw new Error(inqRes.error.message);
      // Student email match may fail under RLS for some roles — treat as unavailable, not zero.
      const studentEmails = studentsRes.error ? null : (studentsRes.data ?? []).map((s) => s.email);

      const inquiries = inqRes.data ?? [];
      const inquirySnaps = inquiries.map((r) => ({
        campaignId: r.campaign_id,
        status: r.status,
      }));

      const campaigns: MarketingCampaignView[] = (campRes.data ?? []).map((c) => {
        const m = campaignInquiryMetrics(inquirySnaps, c.id);
        const emails = inquiries.filter((i) => i.campaign_id === c.id).map((i) => i.email);
        const conv = campaignConversionMetrics({
          inquiryEmails: emails,
          studentEmails,
        });
        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          status: c.status,
          startsOn: c.starts_on,
          endsOn: c.ends_on,
          budgetNote: c.budget_note,
          archivedAt: c.archived_at,
          inquiries: m.inquiries,
          newInquiries: m.newCount,
          assignedInquiries: m.assignedCount,
          registeredStudents: conv.registeredStudents,
          registeredStudentsUnavailable: conv.unavailableReason,
        };
      });

      return {
        ok: true as const,
        campaigns,
        recentInquiries: inquiries.map((r) => ({
          id: r.id,
          referenceCode: r.reference_code,
          fullName: r.full_name,
          email: r.email,
          status: r.status,
          campaignId: r.campaign_id,
          attributionSource: r.attribution_source,
          originalAttributionSource: r.original_attribution_source,
          createdAt: r.created_at,
        })),
        canMutate,
        isSuperAdmin: session.role === "super_admin",
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertMarketingCampaign = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      name: string;
      channel?: string;
      status?: MarketingCampaignStatus;
      startsOn?: string;
      endsOn?: string;
      budgetNote?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireMarketingMutate(session);

      const validated = validateCampaignCreate(data);
      if (!validated.ok) throw new AuthError(validated.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Marketing mutations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (data.id?.trim()) {
        const { data: existing, error: loadErr } = await client
          .from("marketing_campaigns")
          .select("*")
          .eq("id", data.id.trim())
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);
        if (!existing) throw new AuthError("Campaign not found.", 404);

        const nextStatus = (data.status ?? existing.status) as MarketingCampaignStatus;
        if (
          !isValidCampaignStatusTransition({
            from: existing.status as MarketingCampaignStatus,
            to: nextStatus,
            appRole: session.role,
          })
        ) {
          throw new AuthError("Invalid campaign status transition.", 400);
        }

        const { data: row, error } = await client
          .from("marketing_campaigns")
          .update({
            name: data.name.trim(),
            channel: data.channel?.trim() ?? existing.channel,
            status: nextStatus,
            starts_on: data.startsOn?.trim() || null,
            ends_on: data.endsOn?.trim() || null,
            budget_note: data.budgetNote?.trim() || null,
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw new Error(error.message);

        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "marketing.campaign.update",
          entity_type: "marketing_campaigns",
          entity_id: row.id,
          metadata: { status: row.status, name: row.name },
        });
        return { ok: true as const, campaignId: row.id };
      }

      const { data: row, error } = await client
        .from("marketing_campaigns")
        .insert({
          name: data.name.trim(),
          channel: data.channel?.trim() || "",
          status: data.status ?? "draft",
          starts_on: data.startsOn?.trim() || null,
          ends_on: data.endsOn?.trim() || null,
          budget_note: data.budgetNote?.trim() || null,
          created_by: session.userId ?? null,
          owner_profile_id: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "marketing.campaign.create",
        entity_type: "marketing_campaigns",
        entity_id: row.id,
        metadata: { status: row.status, name: row.name },
      });
      return { ok: true as const, campaignId: row.id };
    } catch (error) {
      toError(error);
    }
  });

export const portalArchiveMarketingCampaign = createServerFn({ method: "POST" })
  .validator((data: { campaignId: string; archive: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireMarketingMutate(session);

      const idCheck = validateCampaignId(data.campaignId);
      if (!idCheck.ok || !idCheck.id)
        throw new AuthError(idCheck.ok ? "Campaign ID required." : idCheck.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Archive requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: row, error } = await client
        .from("marketing_campaigns")
        .update({ archived_at: data.archive ? new Date().toISOString() : null })
        .eq("id", idCheck.id)
        .select("id, archived_at, name")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: data.archive ? "marketing.campaign.archive" : "marketing.campaign.unarchive",
        entity_type: "marketing_campaigns",
        entity_id: row.id,
        metadata: { name: row.name },
      });

      return { ok: true as const, campaignId: row.id, archivedAt: row.archived_at };
    } catch (error) {
      toError(error);
    }
  });

export const portalAttributeInquiryToCampaign = createServerFn({ method: "POST" })
  .validator(
    (data: {
      consultationRequestId: string;
      campaignId: string | null;
      attributionSource?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      // Marketing Edit only — View never unlocks attribution (matrix-backed).
      await requireModulePermission(
        session,
        "digital_marketing",
        2,
        "inquiry campaign attribution",
      );
      const allowed =
        (await marketingCanMutate(session, businessRole)) &&
        canAttributeInquiryCampaign({ appRole: session.role, businessRole });
      if (!allowed) {
        throw new AuthError("Not authorized to attribute inquiries.", 403);
      }

      const idCheck = validateCampaignId(data.campaignId);
      if (!idCheck.ok) throw new AuthError(idCheck.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Attribution requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (idCheck.id) {
        const { data: camp } = await client
          .from("marketing_campaigns")
          .select("id, archived_at")
          .eq("id", idCheck.id)
          .maybeSingle();
        if (!camp) throw new AuthError("Campaign not found.", 404);
        if (camp.archived_at) {
          throw new AuthError("Cannot attribute inquiries to an archived campaign.", 400);
        }
      }

      const { data: existing, error: loadErr } = await client
        .from("consultation_requests")
        .select("id, campaign_id, attribution_source, original_attribution_source")
        .eq("id", data.consultationRequestId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Consultation request not found.", 404);

      const nextSource = data.attributionSource?.trim() || null;
      // Preserve first-seen original source; never silently overwrite.
      const originalSource =
        existing.original_attribution_source ?? existing.attribution_source ?? nextSource;

      const { error: histErr } = await client.from("marketing_attribution_history").insert({
        consultation_request_id: existing.id,
        previous_campaign_id: existing.campaign_id,
        new_campaign_id: idCheck.id,
        previous_attribution_source: existing.attribution_source,
        new_attribution_source: nextSource,
        changed_by: session.userId ?? null,
      });
      if (histErr) throw new Error(histErr.message);

      const { data: row, error } = await client
        .from("consultation_requests")
        .update({
          campaign_id: idCheck.id,
          attribution_source: nextSource,
          original_attribution_source: originalSource,
        })
        .eq("id", existing.id)
        .select("id, campaign_id, attribution_source, original_attribution_source, reference_code")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "marketing.inquiry.attribute",
        entity_type: "consultation_requests",
        entity_id: row.id,
        metadata: {
          previous_campaign_id: existing.campaign_id,
          campaign_id: row.campaign_id,
          attribution_source: row.attribution_source,
          original_attribution_source: row.original_attribution_source,
          reference_code: row.reference_code,
        },
      });

      return {
        ok: true as const,
        inquiryId: row.id,
        campaignId: row.campaign_id,
        originalAttributionSource: row.original_attribution_source,
        nextStep: "Use Front Desk intake registration with the same email/phone when converting.",
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalListAttributionHistory = createServerFn({ method: "GET" })
  .validator((data: { consultationRequestId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireMarketingView(session);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return {
          ok: true as const,
          history: [] as Array<{
            id: string;
            previousCampaignId: string | null;
            newCampaignId: string | null;
            previousAttributionSource: string | null;
            newAttributionSource: string | null;
            createdAt: string;
          }>,
        };
      }

      const client = requireAoSupabaseClient();
      const { data: rows, error } = await client
        .from("marketing_attribution_history")
        .select(
          "id, previous_campaign_id, new_campaign_id, previous_attribution_source, new_attribution_source, created_at",
        )
        .eq("consultation_request_id", data.consultationRequestId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);

      return {
        ok: true as const,
        history: (rows ?? []).map((r) => ({
          id: r.id,
          previousCampaignId: r.previous_campaign_id,
          newCampaignId: r.new_campaign_id,
          previousAttributionSource: r.previous_attribution_source,
          newAttributionSource: r.new_attribution_source,
          createdAt: r.created_at,
        })),
      };
    } catch (error) {
      toError(error);
    }
  });
