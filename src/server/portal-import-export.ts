/**
 * Admin Import / Export — authorized CSV for CRM / catalog entities.
 * Catalog import: preview → confirm → commit. Duplicates skipped unless update policy.
 * Student CSV import is not offered (no approved bulk register API).
 *
 * Transaction note: row writes are best-effort per row (PostgREST), not a single DB transaction.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
} from "@/server/portal-auth";
import {
  businessRoleFromSession,
  denyFrontDeskConsultantWorkflows,
  requireModulePermission,
} from "@/server/staff-access";
import {
  buildCrmCsv,
  crmExportFilename,
  isCatalogImportEntity,
  isCrmExportEntity,
  isDuplicatePolicy,
  previewProgramImportCsv,
  previewUniversityImportCsv,
  type CatalogImportEntity,
  type CatalogImportPreviewPayload,
  type CatalogImportPreviewRow,
  type CrmExportEntity,
  type DuplicatePolicy,
} from "@/lib/crm-export";
import { rolesAtLeastAdmin } from "@/lib/roles";
import type { ServerSupabase } from "@/server/supabase";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type CrmExportPayload = {
  entity: CrmExportEntity;
  filename: string;
  mimeType: string;
  contentBase64: string;
  rowCount: number;
  generatedAt: string;
};

export type CatalogImportCommitResult = {
  ok: true;
  entity: CatalogImportEntity;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: { line: number; error: string }[];
  transactionNote: string;
};

const TRANSACTION_NOTE =
  "Imports apply row-by-row (not one atomic transaction). Failed rows after earlier successes are not rolled back.";

function b64(csv: string): string {
  return Buffer.from(csv, "utf8").toString("base64");
}

export const portalExportCrmCsv = createServerFn({ method: "POST" })
  .validator((data: { entity: string }) => data)
  .handler(async ({ data }): Promise<CrmExportPayload> => {
    try {
      const session = await requireTrustedSession();
      if (!isCrmExportEntity(data.entity)) {
        throw new AuthError("Unsupported export entity.", 400);
      }
      const entity = data.entity;
      denyFrontDeskConsultantWorkflows(session, "CRM export");

      if (entity === "universities" || entity === "programs") {
        requireRoles(session, ["consultant", "admin", "super_admin"]);
        await requireModulePermission(session, "admissions", 1, "catalog export");
      } else {
        requireRoles(session, ["admin", "super_admin"]);
        if (entity === "applications") {
          await requireModulePermission(session, "admissions", 1, "application export");
        } else {
          await requireModulePermission(session, "students", 1, "CRM export");
        }
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("CSV export requires the live data plane (demo has no export).", 400);
      }
      const client = requireAoSupabaseClient();
      const generatedAt = new Date().toISOString();
      let headers: string[] = [];
      let rows: (string | number | null)[][] = [];

      if (entity === "students") {
        const { listVisibleStudentsDb } = await import("@/server/ao-data");
        const students = await listVisibleStudentsDb(client, session);
        headers = [
          "id",
          "case_id",
          "name",
          "email",
          "destination",
          "program",
          "study_level",
          "stage",
          "consultant_id",
        ];
        rows = students.map((s) => [
          s.id,
          s.caseId,
          s.name,
          s.email,
          s.destination,
          s.program,
          s.studyLevel,
          s.stage,
          s.consultantId,
        ]);
      } else if (entity === "leads") {
        const { listConsultationRequests } = await import("@/services/db");
        const { filterLeadsForDeskScope, mapConsultationRequestToLead } =
          await import("@/lib/lead-mappers");
        const raw = await listConsultationRequests(client, 500);
        const isAdmin = rolesAtLeastAdmin(session.role);
        const businessRole = businessRoleFromSession(session);
        const isManager = businessRole === "manager";
        const { resolveConsultantDeskId } = await import("@/server/ao-data");
        const desk = isAdmin || isManager ? null : await resolveConsultantDeskId(client, session);
        const scoped = filterLeadsForDeskScope(raw, {
          isAdmin,
          isManager,
          deskId: desk,
        });
        const leads = scoped.map(mapConsultationRequestToLead);
        headers = [
          "id",
          "name",
          "email",
          "phone",
          "country",
          "program",
          "source",
          "consultant_id",
          "status",
          "created",
        ];
        rows = leads.map((l) => [
          l.id,
          l.name,
          l.email,
          l.phone,
          l.country,
          l.program,
          l.source,
          l.consultantId,
          l.status,
          l.created,
        ]);
      } else if (entity === "applications") {
        const { listVisibleStudentsDb, listAppsForStudents } = await import("@/server/ao-data");
        const students = await listVisibleStudentsDb(client, session);
        const apps = await listAppsForStudents(
          client,
          students.map((s) => s.id),
        );
        headers = [
          "id",
          "student_id",
          "student_name",
          "university",
          "program",
          "country",
          "intake",
          "status",
          "deadline",
        ];
        const nameById = new Map(students.map((s) => [s.id, s.name]));
        rows = apps.map((a) => [
          a.id,
          a.studentId,
          a.studentName ?? nameById.get(a.studentId) ?? "",
          a.university,
          a.program,
          a.country,
          a.intake,
          a.status,
          a.deadline,
        ]);
      } else if (entity === "universities") {
        const { data: unis, error } = await client
          .from("universities")
          .select("id,name,country,city,website")
          .order("name")
          .limit(500);
        if (error) throw new Error(error.message);
        headers = ["id", "name", "country", "city", "website"];
        rows = (unis ?? []).map((u) => [u.id, u.name, u.country, u.city, u.website]);
      } else {
        const [{ data: unis }, { data: programs, error }] = await Promise.all([
          client.from("universities").select("id,name").limit(500),
          client.from("programs").select("*").order("name").limit(2000),
        ]);
        if (error) throw new Error(error.message);
        const nameById = new Map((unis ?? []).map((u) => [u.id, u.name]));
        headers = [
          "id",
          "university_id",
          "university_name",
          "name",
          "level",
          "duration",
          "tuition_fee",
        ];
        rows = (programs ?? []).map((p) => [
          p.id,
          p.university_id,
          nameById.get(p.university_id) ?? "",
          p.name,
          p.level,
          p.duration,
          p.tuition_fee,
        ]);
      }

      const csv = buildCrmCsv(headers, rows);
      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "catalog.export",
        entity_type: entity,
        metadata: { rowCount: rows.length, filename: crmExportFilename(entity, generatedAt) },
      });

      return {
        entity,
        filename: crmExportFilename(entity, generatedAt),
        mimeType: "text/csv;charset=utf-8",
        contentBase64: b64(csv),
        rowCount: rows.length,
        generatedAt,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalPreviewCatalogImport = createServerFn({ method: "POST" })
  .validator((data: { entity: string; csvText: string }) => data)
  .handler(async ({ data }): Promise<CatalogImportPreviewPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "catalog import preview");
      await requireModulePermission(session, "admissions", 2, "catalog import");

      if (!isCatalogImportEntity(data.entity)) {
        throw new AuthError("Unsupported import entity.", 400);
      }
      const entity = data.entity;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Catalog import requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (entity === "universities") {
        const parsed = previewUniversityImportCsv(data.csvText ?? "");
        if (!parsed.ok) throw new AuthError(parsed.error, 400);

        let duplicate = 0;
        const rows: CatalogImportPreviewRow[] = [];
        for (const row of parsed.rows) {
          if (row.status !== "ok" || !row.university) {
            rows.push(row);
            continue;
          }
          const { data: existing, error } = await client
            .from("universities")
            .select("id")
            .eq("name", row.university.name)
            .eq("country", row.university.country)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (existing?.id) {
            duplicate += 1;
            rows.push({
              ...row,
              status: "duplicate",
              error: "Already exists (name + country)",
            });
          } else {
            rows.push(row);
          }
        }

        return {
          entity,
          headers: parsed.headers,
          rows,
          summary: {
            ok: rows.filter((r) => r.status === "ok").length,
            error: rows.filter((r) => r.status === "error").length,
            duplicate,
          },
          transactionNote: TRANSACTION_NOTE,
        };
      }

      const parsed = previewProgramImportCsv(data.csvText ?? "");
      if (!parsed.ok) throw new AuthError(parsed.error, 400);

      let duplicate = 0;
      const rows: CatalogImportPreviewRow[] = [];
      for (const row of parsed.rows) {
        if (row.status !== "ok" || !row.program) {
          rows.push(row);
          continue;
        }
        const { data: uni, error: uniErr } = await client
          .from("universities")
          .select("id")
          .eq("name", row.program.universityName)
          .eq("country", row.program.universityCountry)
          .maybeSingle();
        if (uniErr) throw new Error(uniErr.message);
        if (!uni?.id) {
          rows.push({
            ...row,
            status: "error",
            error: "University not found (match name + country)",
          });
          continue;
        }
        const { data: existing, error } = await client
          .from("programs")
          .select("id")
          .eq("university_id", uni.id)
          .eq("name", row.program.name)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (existing?.id) {
          duplicate += 1;
          rows.push({
            ...row,
            status: "duplicate",
            error: "Already exists (university + program name)",
          });
        } else {
          rows.push(row);
        }
      }

      return {
        entity,
        headers: parsed.headers,
        rows,
        summary: {
          ok: rows.filter((r) => r.status === "ok").length,
          error: rows.filter((r) => r.status === "error").length,
          duplicate,
        },
        transactionNote: TRANSACTION_NOTE,
      };
    } catch (error) {
      toError(error);
    }
  });

async function commitCatalogImportCore(input: {
  entity: CatalogImportEntity;
  csvText: string;
  policy: DuplicatePolicy;
  client: ServerSupabase;
}): Promise<CatalogImportCommitResult> {
  const { entity, csvText, policy, client } = input;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { line: number; error: string }[] = [];

  if (entity === "universities") {
    const parsed = previewUniversityImportCsv(csvText);
    if (!parsed.ok) throw new AuthError(parsed.error, 400);

    for (const row of parsed.rows) {
      if (row.status === "error" || !row.university) {
        failed += 1;
        failures.push({ line: row.line, error: row.error ?? "Invalid row" });
        continue;
      }
      const u = row.university;
      try {
        const { data: existing, error: findErr } = await client
          .from("universities")
          .select("id")
          .eq("name", u.name)
          .eq("country", u.country)
          .maybeSingle();
        if (findErr) throw new Error(findErr.message);

        if (existing?.id) {
          if (policy === "skip") {
            skipped += 1;
            continue;
          }
          const { error } = await client
            .from("universities")
            .update({ city: u.city, website: u.website })
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          updated += 1;
        } else {
          const { error } = await client.from("universities").insert({
            name: u.name,
            country: u.country,
            city: u.city,
            website: u.website,
          });
          if (error) throw new Error(error.message);
          created += 1;
        }
      } catch (e) {
        failed += 1;
        failures.push({
          line: row.line,
          error: e instanceof Error ? e.message : "Write failed",
        });
      }
    }
  } else {
    const parsed = previewProgramImportCsv(csvText);
    if (!parsed.ok) throw new AuthError(parsed.error, 400);

    for (const row of parsed.rows) {
      if (row.status === "error" || !row.program) {
        failed += 1;
        failures.push({ line: row.line, error: row.error ?? "Invalid row" });
        continue;
      }
      const p = row.program;
      try {
        const { data: uni, error: uniErr } = await client
          .from("universities")
          .select("id")
          .eq("name", p.universityName)
          .eq("country", p.universityCountry)
          .maybeSingle();
        if (uniErr) throw new Error(uniErr.message);
        if (!uni?.id) {
          failed += 1;
          failures.push({
            line: row.line,
            error: "University not found (match name + country)",
          });
          continue;
        }

        const { data: existing, error: findErr } = await client
          .from("programs")
          .select("id")
          .eq("university_id", uni.id)
          .eq("name", p.name)
          .maybeSingle();
        if (findErr) throw new Error(findErr.message);

        if (existing?.id) {
          if (policy === "skip") {
            skipped += 1;
            continue;
          }
          const { error } = await client
            .from("programs")
            .update({
              level: p.level,
              duration: p.duration,
              tuition_fee: p.tuitionFee,
            })
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          updated += 1;
        } else {
          const { error } = await client.from("programs").insert({
            university_id: uni.id,
            name: p.name,
            level: p.level,
            duration: p.duration,
            tuition_fee: p.tuitionFee,
          });
          if (error) throw new Error(error.message);
          created += 1;
        }
      } catch (e) {
        failed += 1;
        failures.push({
          line: row.line,
          error: e instanceof Error ? e.message : "Write failed",
        });
      }
    }
  }

  const { writeAudit } = await import("@/services/db");
  await writeAudit(client, {
    action: "catalog.import",
    entity_type: entity,
    metadata: {
      created,
      updated,
      skipped,
      failed,
      duplicatePolicy: policy,
    },
  });

  return {
    ok: true as const,
    entity,
    created,
    updated,
    skipped,
    failed,
    failures: failures.slice(0, 50),
    transactionNote: TRANSACTION_NOTE,
  };
}

export const portalCommitCatalogImport = createServerFn({ method: "POST" })
  .validator(
    (data: {
      entity: string;
      csvText: string;
      duplicatePolicy: string;
      confirmed: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<CatalogImportCommitResult> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "catalog import commit");
      await requireModulePermission(session, "admissions", 2, "catalog import");

      if (!data.confirmed) {
        throw new AuthError("Import requires explicit confirmation.", 400);
      }
      if (!isCatalogImportEntity(data.entity)) {
        throw new AuthError("Unsupported import entity.", 400);
      }
      if (!isDuplicatePolicy(data.duplicatePolicy)) {
        throw new AuthError("Invalid duplicate policy.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Catalog import requires the live data plane.", 400);
      }
      return commitCatalogImportCore({
        entity: data.entity,
        csvText: data.csvText ?? "",
        policy: data.duplicatePolicy,
        client: requireAoSupabaseClient(),
      });
    } catch (error) {
      toError(error);
    }
  });

/**
 * @deprecated Use portalPreviewCatalogImport + portalCommitCatalogImport.
 * Skips duplicates (no silent overwrite).
 */
export const portalImportUniversitiesCsv = createServerFn({ method: "POST" })
  .validator((data: { csvText: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "university import");
      await requireModulePermission(session, "admissions", 2, "university import");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("University import requires the live data plane.", 400);
      }
      return commitCatalogImportCore({
        entity: "universities",
        csvText: data.csvText ?? "",
        policy: "skip",
        client: requireAoSupabaseClient(),
      });
    } catch (error) {
      toError(error);
    }
  });
