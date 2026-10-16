/**
 * Admissions catalog — universities / programs.
 * Public lists use anon + RLS. Staff lists/mutations use JWT + admissions matrix.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import { createServerSupabase } from "@/server/supabase";
import type { University } from "@/types";
import type { CatalogProgramView } from "@/lib/catalog-mappers";
import { crmListOrEmpty, isMockCrmAllowed } from "@/lib/portal-data-plane";
import { mayServePublicCatalogDemo, resolvePublicCatalogSource } from "@/lib/public-catalog-rules";
import {
  resolveCatalogPage,
  validateProgramWrite,
  validateUniversityWrite,
  type CatalogListFilters,
  type ProgramWriteInput,
  type UniversityWriteInput,
} from "@/lib/catalog-rules";
import * as db from "@/data/mock";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type PublicUniversityListPayload = {
  rows: University[];
  total: number;
  page: number;
  pageSize: number;
  source: "live" | "unavailable" | "demo";
  /** Facets from the full filtered set (not only the current page). */
  countries: string[];
  levels: string[];
};

export type PublicProgramListPayload = {
  rows: CatalogProgramView[];
  total: number;
  page: number;
  pageSize: number;
  source: "live" | "unavailable" | "demo";
  levels: string[];
};

export type AdminCatalogListPayload<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  source: "live" | "unavailable" | "demo";
  canMutate: boolean;
};

function publicCatalogDemoEnv() {
  const nodeEnv = process.env["NODE_ENV"];
  return {
    PROD: nodeEnv === "production",
    DEV: nodeEnv !== "production",
  };
}

async function loadUniversitiesWithPrograms(
  client: NonNullable<ReturnType<typeof createServerSupabase>>,
): Promise<University[]> {
  const { mapUniversityWithPrograms } = await import("@/lib/catalog-mappers");
  const [{ data: unis, error: uniErr }, { data: programs, error: progErr }] =
    await Promise.all([
      client.from("universities").select("*").order("name", { ascending: true }).limit(500),
      client.from("programs").select("*").order("name", { ascending: true }).limit(2000),
    ]);
  if (uniErr) throw new Error(uniErr.message);
  if (progErr) throw new Error(progErr.message);
  const byUni = new Map<string, NonNullable<typeof programs>>();
  for (const p of programs ?? []) {
    const list = byUni.get(p.university_id) ?? [];
    list.push(p);
    byUni.set(p.university_id, list);
  }
  return (unis ?? []).map((u) => mapUniversityWithPrograms(u, byUni.get(u.id) ?? []));
}

function filterUniversitiesClient(
  rows: University[],
  filters: CatalogListFilters,
): University[] {
  const q = filters.q?.trim().toLowerCase();
  const country = filters.country?.trim();
  const level = filters.level?.trim();
  return rows.filter((u) => {
    if (q && !u.name.toLowerCase().includes(q) && !u.country.toLowerCase().includes(q)) {
      return false;
    }
    if (country && u.country !== country) return false;
    if (level && !u.levels.includes(level)) return false;
    return true;
  });
}

function paginateRows<T>(rows: T[], filters: CatalogListFilters): {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
} {
  const { page, pageSize, offset } = resolveCatalogPage(filters);
  return {
    rows: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

function universityFacets(rows: University[]): { countries: string[]; levels: string[] } {
  return {
    countries: [...new Set(rows.map((u) => u.country).filter(Boolean))].sort(),
    levels: [...new Set(rows.flatMap((u) => u.levels).filter(Boolean))].sort(),
  };
}

function programFacets(rows: CatalogProgramView[]): { levels: string[] } {
  return {
    levels: [...new Set(rows.map((p) => p.level).filter((x) => x && x !== "—"))].sort(),
  };
}

/** Public website — live universities via anon RLS. Demo only in DEV when live unavailable. */
export const portalListPublishedUniversities = createServerFn({ method: "GET" })
  .validator((data: CatalogListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<PublicUniversityListPayload> => {
    try {
      const allowDemo = mayServePublicCatalogDemo(publicCatalogDemoEnv());
      const client = createServerSupabase();
      if (!client) {
        const source = resolvePublicCatalogSource({ liveOk: false, allowDemo });
        const all = source === "demo" ? db.universities : [];
        const filtered = filterUniversitiesClient(all, data);
        return { ...paginateRows(filtered, data), source, ...universityFacets(all) };
      }

      const all = await loadUniversitiesWithPrograms(client);
      const filtered = filterUniversitiesClient(all, data);
      return { ...paginateRows(filtered, data), source: "live", ...universityFacets(all) };
    } catch {
      const allowDemo = mayServePublicCatalogDemo(publicCatalogDemoEnv());
      const source = resolvePublicCatalogSource({ liveOk: false, allowDemo });
      const all = source === "demo" ? db.universities : [];
      const filtered = filterUniversitiesClient(all, data);
      return { ...paginateRows(filtered, data), source, ...universityFacets(all) };
    }
  });

/** Public website — live programs via anon RLS. */
export const portalListPublishedPrograms = createServerFn({ method: "GET" })
  .validator((data: CatalogListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<PublicProgramListPayload> => {
    try {
      const allowDemo = mayServePublicCatalogDemo(publicCatalogDemoEnv());
      const client = createServerSupabase();
      const { mapProgramRow } = await import("@/lib/catalog-mappers");

      if (!client) {
        const source = resolvePublicCatalogSource({ liveOk: false, allowDemo });
        if (source !== "demo") {
          const { page, pageSize } = resolveCatalogPage(data);
          return { rows: [], total: 0, page, pageSize, source, levels: [] };
        }
        const demoRows: CatalogProgramView[] = [];
        for (const u of db.universities) {
          for (const name of u.programs) {
            demoRows.push({
              id: `${u.id}-${name}`,
              universityId: u.id,
              universityName: u.name,
              name,
              level: u.levels[0] ?? "—",
              duration: "—",
              tuitionFee: "—",
            });
          }
        }
        const filtered = filterProgramsClient(demoRows, data);
        return { ...paginateRows(filtered, data), source: "demo", ...programFacets(demoRows) };
      }

      const [{ data: unis, error: uniErr }, { data: programs, error: progErr }] =
        await Promise.all([
          client.from("universities").select("id,name").limit(500),
          client.from("programs").select("*").order("name", { ascending: true }).limit(2000),
        ]);
      if (uniErr || progErr) {
        const source = resolvePublicCatalogSource({ liveOk: false, allowDemo });
        const { page, pageSize } = resolveCatalogPage(data);
        return {
          rows: [],
          total: 0,
          page,
          pageSize,
          source: source === "demo" ? "demo" : "unavailable",
          levels: [],
        };
      }
      const nameById = new Map((unis ?? []).map((u) => [u.id, u.name]));
      const mapped = (programs ?? []).map((p) => mapProgramRow(p, nameById));
      const filtered = filterProgramsClient(mapped, data);
      return { ...paginateRows(filtered, data), source: "live", ...programFacets(mapped) };
    } catch {
      const { page, pageSize } = resolveCatalogPage(data);
      return { rows: [], total: 0, page, pageSize, source: "unavailable", levels: [] };
    }
  });

function filterProgramsClient(
  rows: CatalogProgramView[],
  filters: CatalogListFilters,
): CatalogProgramView[] {
  const q = filters.q?.trim().toLowerCase();
  const level = filters.level?.trim();
  const universityId = filters.universityId?.trim();
  return rows.filter((p) => {
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.universityName.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (level && p.level !== level) return false;
    if (universityId && p.universityId !== universityId) return false;
    return true;
  });
}

export const portalGetCatalogUniversities = createServerFn({ method: "GET" }).handler(
  async (): Promise<University[]> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "university catalog");
      await requireModulePermission(session, "admissions", 1, "university catalog");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        return loadUniversitiesWithPrograms(requireAoSupabaseClient());
      }

      if (!isMockCrmAllowed(session.source)) return [];
      return crmListOrEmpty(session.source, db.universities);
    } catch (error) {
      toError(error);
    }
  },
);

export const portalListCatalogUniversitiesAdmin = createServerFn({ method: "GET" })
  .validator((data: CatalogListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<AdminCatalogListPayload<University>> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "university catalog");
      await requireModulePermission(session, "admissions", 1, "university catalog");

      let canMutate = false;
      try {
        await requireModulePermission(session, "admissions", 2, "university mutations");
        canMutate = true;
      } catch {
        canMutate = false;
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        if (!isMockCrmAllowed(session.source)) {
          const { page, pageSize } = resolveCatalogPage(data);
          return { rows: [], total: 0, page, pageSize, source: "unavailable", canMutate: false };
        }
        const filtered = filterUniversitiesClient(db.universities, data);
        return {
          ...paginateRows(filtered, data),
          source: "demo",
          canMutate: false,
        };
      }

      const all = await loadUniversitiesWithPrograms(requireAoSupabaseClient());
      const filtered = filterUniversitiesClient(all, data);
      return { ...paginateRows(filtered, data), source: "live", canMutate };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetCatalogPrograms = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogProgramView[]> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "program catalog");
      await requireModulePermission(session, "admissions", 1, "program catalog");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { mapProgramRow } = await import("@/lib/catalog-mappers");
        const client = requireAoSupabaseClient();
        const [{ data: unis, error: uniErr }, { data: programs, error: progErr }] =
          await Promise.all([
            client.from("universities").select("id,name").limit(500),
            client.from("programs").select("*").order("name", { ascending: true }).limit(2000),
          ]);
        if (uniErr) throw new Error(uniErr.message);
        if (progErr) throw new Error(progErr.message);
        const nameById = new Map((unis ?? []).map((u) => [u.id, u.name]));
        return (programs ?? []).map((p) => mapProgramRow(p, nameById));
      }

      if (!isMockCrmAllowed(session.source)) return [];
      const rows: CatalogProgramView[] = [];
      for (const u of db.universities) {
        for (const name of u.programs) {
          rows.push({
            id: `${u.id}-${name}`,
            universityId: u.id,
            universityName: u.name,
            name,
            level: u.levels[0] ?? "—",
            duration: "—",
            tuitionFee: "—",
          });
        }
      }
      return crmListOrEmpty(session.source, rows);
    } catch (error) {
      toError(error);
    }
  },
);

export const portalListCatalogProgramsAdmin = createServerFn({ method: "GET" })
  .validator((data: CatalogListFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<AdminCatalogListPayload<CatalogProgramView>> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "program catalog");
      await requireModulePermission(session, "admissions", 1, "program catalog");

      let canMutate = false;
      try {
        await requireModulePermission(session, "admissions", 2, "program mutations");
        canMutate = true;
      } catch {
        canMutate = false;
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        if (!isMockCrmAllowed(session.source)) {
          const { page, pageSize } = resolveCatalogPage(data);
          return { rows: [], total: 0, page, pageSize, source: "unavailable", canMutate: false };
        }
        const demoRows: CatalogProgramView[] = [];
        for (const u of db.universities) {
          for (const name of u.programs) {
            demoRows.push({
              id: `${u.id}-${name}`,
              universityId: u.id,
              universityName: u.name,
              name,
              level: u.levels[0] ?? "—",
              duration: "—",
              tuitionFee: "—",
            });
          }
        }
        return {
          ...paginateRows(filterProgramsClient(demoRows, data), data),
          source: "demo",
          canMutate: false,
        };
      }

      const { mapProgramRow } = await import("@/lib/catalog-mappers");
      const client = requireAoSupabaseClient();
      const [{ data: unis, error: uniErr }, { data: programs, error: progErr }] =
        await Promise.all([
          client.from("universities").select("id,name").limit(500),
          client.from("programs").select("*").order("name", { ascending: true }).limit(2000),
        ]);
      if (uniErr) throw new Error(uniErr.message);
      if (progErr) throw new Error(progErr.message);
      const nameById = new Map((unis ?? []).map((u) => [u.id, u.name]));
      const mapped = (programs ?? []).map((p) => mapProgramRow(p, nameById));
      return {
        ...paginateRows(filterProgramsClient(mapped, data), data),
        source: "live",
        canMutate,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertUniversity = createServerFn({ method: "POST" })
  .validator((data: UniversityWriteInput & { id?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "university mutations");
      await requireModulePermission(session, "admissions", 2, "university mutations");

      const parsed = validateUniversityWrite(data);
      if (!parsed.ok) throw new AuthError(parsed.error, 400);
      const n = parsed.normalized;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("University mutations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const payload = {
        name: n.name,
        country: n.country,
        city: n.city,
        website: n.website,
        logo_url: n.logoUrl,
      };

      if (data.id?.trim()) {
        const { data: row, error } = await client
          .from("universities")
          .update(payload)
          .eq("id", data.id.trim())
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "university.update",
          entity_type: "universities",
          entity_id: row.id,
          metadata: { name: row.name, country: row.country },
        });
        const { mapUniversityWithPrograms } = await import("@/lib/catalog-mappers");
        return { ok: true as const, university: mapUniversityWithPrograms(row, []) };
      }

      const { data: row, error } = await client
        .from("universities")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "university.create",
        entity_type: "universities",
        entity_id: row.id,
        metadata: { name: row.name, country: row.country },
      });
      const { mapUniversityWithPrograms } = await import("@/lib/catalog-mappers");
      return { ok: true as const, university: mapUniversityWithPrograms(row, []) };
    } catch (error) {
      toError(error);
    }
  });

export const portalDeleteUniversity = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "university delete");
      await requireModulePermission(session, "admissions", 2, "university delete");

      const id = data.id?.trim();
      if (!id) throw new AuthError("University id is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("University delete requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error: findErr } = await client
        .from("universities")
        .select("id,name")
        .eq("id", id)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (!row) throw new AuthError("University not found.", 404);

      const { error } = await client.from("universities").delete().eq("id", id);
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "university.delete",
        entity_type: "universities",
        entity_id: id,
        metadata: { name: row.name },
      });
      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertProgram = createServerFn({ method: "POST" })
  .validator((data: ProgramWriteInput & { id?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "program mutations");
      await requireModulePermission(session, "admissions", 2, "program mutations");

      const parsed = validateProgramWrite(data);
      if (!parsed.ok) throw new AuthError(parsed.error, 400);
      const n = parsed.normalized;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Program mutations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: uni, error: uniErr } = await client
        .from("universities")
        .select("id,name")
        .eq("id", n.universityId)
        .maybeSingle();
      if (uniErr) throw new Error(uniErr.message);
      if (!uni) throw new AuthError("Linked university was not found.", 400);

      const payload = {
        university_id: n.universityId,
        name: n.name,
        level: n.level,
        duration: n.duration,
        tuition_fee: n.tuitionFee,
      };

      if (data.id?.trim()) {
        const { data: row, error } = await client
          .from("programs")
          .update(payload)
          .eq("id", data.id.trim())
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "program.update",
          entity_type: "programs",
          entity_id: row.id,
          metadata: { name: row.name, university_id: row.university_id },
        });
        const { mapProgramRow } = await import("@/lib/catalog-mappers");
        return {
          ok: true as const,
          program: mapProgramRow(row, new Map([[uni.id, uni.name]])),
        };
      }

      const { data: row, error } = await client
        .from("programs")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "program.create",
        entity_type: "programs",
        entity_id: row.id,
        metadata: { name: row.name, university_id: row.university_id },
      });
      const { mapProgramRow } = await import("@/lib/catalog-mappers");
      return {
        ok: true as const,
        program: mapProgramRow(row, new Map([[uni.id, uni.name]])),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalDeleteProgram = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "program delete");
      await requireModulePermission(session, "admissions", 2, "program delete");

      const id = data.id?.trim();
      if (!id) throw new AuthError("Program id is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Program delete requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error: findErr } = await client
        .from("programs")
        .select("id,name")
        .eq("id", id)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (!row) throw new AuthError("Program not found.", 404);

      const { error } = await client.from("programs").delete().eq("id", id);
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "program.delete",
        entity_type: "programs",
        entity_id: id,
        metadata: { name: row.name },
      });
      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });
