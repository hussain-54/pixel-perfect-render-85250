/**
 * Scholarships catalog — live Supabase (admissions module).
 * Public list uses anon client + RLS published-only; staff uses JWT + matrix gates.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import { createServerSupabase, type ServerSupabase } from "@/server/supabase";
import {
  isPubliclyVisibleScholarship,
  mapScholarshipRow,
} from "@/lib/scholarship-mappers";
import {
  resolveScholarshipPage,
  validateScholarshipWrite,
  type ScholarshipListFilters,
  type ScholarshipWriteInput,
} from "@/lib/scholarship-rules";
import type { Scholarship } from "@/types";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type ScholarshipListPayload = {
  rows: Scholarship[];
  total: number;
  page: number;
  pageSize: number;
  source: "live" | "unavailable";
  canMutate: boolean;
};

async function universityNames(
  client: ServerSupabase,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await client.from("universities").select("id,name").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

function emptyUnavailable(filters: ScholarshipListFilters): ScholarshipListPayload {
  const { page, pageSize } = resolveScholarshipPage(filters);
  return {
    rows: [],
    total: 0,
    page,
    pageSize,
    source: "unavailable",
    canMutate: false,
  };
}

/** Public website — published scholarships only. Never falls back to demo fixtures. */
export const portalListPublishedScholarships = createServerFn({ method: "GET" })
  .validator((data: ScholarshipListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ScholarshipListPayload> => {
    try {
      const client = createServerSupabase();
      if (!client) return emptyUnavailable(data);

      const { page, pageSize, offset } = resolveScholarshipPage(data);
      let q = client
        .from("scholarships")
        .select("*", { count: "exact" })
        .eq("status", "published")
        .order("closes_on", { ascending: true })
        .range(offset, offset + pageSize - 1);

      const country = data.country?.trim();
      const level = data.level?.trim();
      const funding = data.funding?.trim();
      const needle = data.q?.trim();
      if (country) q = q.ilike("country", country);
      if (level) q = q.ilike("study_level", `%${level}%`);
      if (funding === "Fully Funded") q = q.eq("funding_type", "fully_funded");
      if (funding === "Partial Funding") q = q.eq("funding_type", "partial_funding");
      if (funding === "Tuition Waiver") q = q.eq("funding_type", "tuition_waiver");
      if (needle) {
        q = q.or(
          `title.ilike.%${needle}%,provider.ilike.%${needle}%,field_of_study.ilike.%${needle}%,country.ilike.%${needle}%`,
        );
      }

      const { data: rows, error, count } = await q;
      if (error) {
        // Table missing until owner applies migration — honest empty, no fixture fallback.
        return emptyUnavailable(data);
      }

      const names = await universityNames(
        client,
        (rows ?? []).map((r) => r.university_id).filter((id): id is string => Boolean(id)),
      );
      const mapped = (rows ?? [])
        .map((r) => mapScholarshipRow(r, r.university_id ? names.get(r.university_id) : null))
        .filter(isPubliclyVisibleScholarship);

      return {
        rows: mapped,
        total: count ?? mapped.length,
        page,
        pageSize,
        source: "live",
        canMutate: false,
      };
    } catch {
      return emptyUnavailable(data);
    }
  });

export const portalListScholarshipsAdmin = createServerFn({ method: "GET" })
  .validator((data: ScholarshipListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ScholarshipListPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "scholarships");
      await requireModulePermission(session, "admissions", 1, "scholarship catalog");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return emptyUnavailable(data);
      }

      const client = requireAoSupabaseClient();
      const { page, pageSize, offset } = resolveScholarshipPage(data);
      let q = client
        .from("scholarships")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (!data.includeArchived) {
        q = q.neq("status", "archived");
      }
      const status = data.status?.trim();
      if (status === "draft" || status === "published" || status === "archived") {
        q = q.eq("status", status);
      }
      const country = data.country?.trim();
      const level = data.level?.trim();
      const needle = data.q?.trim();
      if (country) q = q.ilike("country", country);
      if (level) q = q.ilike("study_level", `%${level}%`);
      if (needle) {
        q = q.or(`title.ilike.%${needle}%,provider.ilike.%${needle}%,country.ilike.%${needle}%`);
      }

      const { data: rows, error, count } = await q;
      if (error) throw new Error(error.message);
      const names = await universityNames(
        client,
        (rows ?? []).map((r) => r.university_id).filter((id): id is string => Boolean(id)),
      );

      let canMutate = false;
      try {
        await requireModulePermission(session, "admissions", 2, "scholarship mutations");
        canMutate = true;
      } catch {
        canMutate = false;
      }

      return {
        rows: (rows ?? []).map((r) =>
          mapScholarshipRow(r, r.university_id ? names.get(r.university_id) : null),
        ),
        total: count ?? 0,
        page,
        pageSize,
        source: "live",
        canMutate,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetScholarship = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Scholarship | null> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "scholarships");
      await requireModulePermission(session, "admissions", 1, "scholarship detail");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) return null;
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client
        .from("scholarships")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      const names = await universityNames(
        client,
        row.university_id ? [row.university_id] : [],
      );
      return mapScholarshipRow(
        row,
        row.university_id ? names.get(row.university_id) : null,
      );
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertScholarship = createServerFn({ method: "POST" })
  .validator((data: ScholarshipWriteInput & { id?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "scholarship mutations");
      await requireModulePermission(session, "admissions", 2, "scholarship mutations");

      const parsed = validateScholarshipWrite(data);
      if (!parsed.ok) throw new AuthError(parsed.error, 400);
      const n = parsed.normalized;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Scholarship mutations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (n.universityId) {
        const { data: uni, error: uniErr } = await client
          .from("universities")
          .select("id")
          .eq("id", n.universityId)
          .maybeSingle();
        if (uniErr) throw new Error(uniErr.message);
        if (!uni) throw new AuthError("Linked university was not found.", 400);
      }

      const payload = {
        title: n.title,
        description: n.description,
        provider: n.provider,
        university_id: n.universityId,
        country: n.country,
        study_level: n.studyLevel,
        field_of_study: n.fieldOfStudy,
        funding_type: n.fundingType,
        funding_description: n.fundingDescription,
        eligibility: n.eligibility,
        opens_on: n.opensOn,
        closes_on: n.closesOn,
        application_url: n.applicationUrl,
        status: n.status,
        updated_by: session.userId ?? null,
      };

      if (data.id?.trim()) {
        const { data: row, error } = await client
          .from("scholarships")
          .update(payload)
          .eq("id", data.id.trim())
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "scholarship.update",
          entity_type: "scholarships",
          entity_id: row.id,
          metadata: { status: row.status, title: row.title },
        });
        return { ok: true as const, scholarship: mapScholarshipRow(row) };
      }

      const { data: row, error } = await client
        .from("scholarships")
        .insert({
          ...payload,
          created_by: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "scholarship.create",
        entity_type: "scholarships",
        entity_id: row.id,
        metadata: { status: row.status, title: row.title },
      });
      return { ok: true as const, scholarship: mapScholarshipRow(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalSetScholarshipStatus = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: "draft" | "published" | "archived" }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "scholarship status");
      await requireModulePermission(session, "admissions", 2, "scholarship status changes");

      if (!["draft", "published", "archived"].includes(data.status)) {
        throw new AuthError("Invalid status.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Scholarship status changes require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client
        .from("scholarships")
        .update({
          status: data.status,
          updated_by: session.userId ?? null,
        })
        .eq("id", data.id.trim())
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `scholarship.${data.status}`,
        entity_type: "scholarships",
        entity_id: row.id,
        metadata: { status: row.status, title: row.title },
      });

      return { ok: true as const, scholarship: mapScholarshipRow(row) };
    } catch (error) {
      toError(error);
    }
  });
