/**
 * Website CMS — admin draft/publish + public published readers.
 * Drafts never leave authenticated admin paths.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import { defaultPayloadForKey } from "@/lib/cms-defaults";
import {
  isMissingCmsRelation,
  parseCmsDocumentRow,
  sanitizePlainText,
  validateAnnouncementWrite,
  validateDocumentDraft,
} from "@/lib/cms-rules";
import type {
  CmsAnnouncementInput,
  CmsDocumentAdminView,
  CmsPublicAnnouncement,
} from "@/lib/cms-types";
import { createServerSupabase } from "@/server/supabase";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("CMS authorization failed.");
}

const SCHEMA_NOTE =
  "Website CMS tables are not available yet. Apply migration 20261108120000_website_cms_foundation.sql (owner confirmation required).";

async function requireCmsAdmin() {
  const session = await requireTrustedSession();
  requireRoles(session, ["admin", "super_admin"]);
  denyFrontDeskConsultantWorkflows(session, "website CMS");
  await requireModulePermission(session, "settings", 2, "website CMS");
  return session;
}

export type CmsPublicBundle = {
  source: "live" | "fallback";
  schemaReady: boolean;
  documents: Record<string, unknown>;
  announcements: CmsPublicAnnouncement[];
  note: string | null;
};

export type CmsAdminOverview = {
  schemaReady: boolean;
  canMutate: boolean;
  documents: CmsDocumentAdminView[];
  announcementCount: { draft: number; published: number; archived: number };
  mediaCount: number;
  note: string | null;
};

function mapAnnouncement(row: Record<string, unknown>): CmsPublicAnnouncement {
  return {
    id: String(row.id),
    body: String(row.body ?? ""),
    announcementType: String(row.announcement_type ?? "general"),
    ctaLabel: (row.cta_label as string | null) ?? null,
    ctaHref: (row.cta_href as string | null) ?? null,
    styleToken: String(row.style_token ?? "navy"),
    position: String(row.display_position ?? row.position ?? "top"),
    dismissible: Boolean(row.dismissible ?? true),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function fallbackBundle(note: string | null): CmsPublicBundle {
  const keys = [
    "site.header",
    "site.nav",
    "site.footer",
    "site.theme",
    "page.home",
    "seo.global",
  ];
  const documents: Record<string, unknown> = {};
  for (const key of keys) documents[key] = defaultPayloadForKey(key);
  return {
    source: "fallback",
    schemaReady: false,
    documents,
    announcements: [],
    note,
  };
}

/** Public — published CMS only, with hardcoded fallbacks. */
export const portalGetPublishedCmsBundle = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPublicBundle> => {
    try {
      const client = createServerSupabase();
      if (!client) return fallbackBundle("Supabase public client unavailable.");

      const [{ data: docs, error: docsErr }, { data: anns, error: annErr }] = await Promise.all([
        client.rpc("get_cms_public_documents", {
          p_keys: [
            "site.header",
            "site.nav",
            "site.footer",
            "site.theme",
            "page.home",
            "seo.global",
          ],
        }),
        client.rpc("get_cms_public_announcements"),
      ]);

      if (docsErr || annErr) {
        const msg = docsErr?.message || annErr?.message || "CMS read failed";
        if (isMissingCmsRelation(msg)) return fallbackBundle(SCHEMA_NOTE);
        return fallbackBundle(msg);
      }

      const documents: Record<string, unknown> = {};
      for (const key of [
        "site.header",
        "site.nav",
        "site.footer",
        "site.theme",
        "page.home",
        "seo.global",
      ]) {
        documents[key] = defaultPayloadForKey(key);
      }
      for (const row of docs ?? []) {
        const key = String((row as { document_key: string }).document_key);
        const payload = (row as { payload: unknown }).payload;
        if (payload && typeof payload === "object") {
          documents[key] = { ...(defaultPayloadForKey(key) as object), ...(payload as object) };
        }
      }

      return {
        source: "live",
        schemaReady: true,
        documents,
        announcements: (anns ?? []).map((r) => mapAnnouncement(r as Record<string, unknown>)),
        note: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "CMS unavailable";
      if (isMissingCmsRelation(message)) return fallbackBundle(SCHEMA_NOTE);
      return fallbackBundle(message);
    }
  },
);

export const portalGetCmsAdminOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsAdminOverview> => {
    try {
      await requireCmsAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) {
        return {
          schemaReady: false,
          canMutate: false,
          documents: [],
          announcementCount: { draft: 0, published: 0, archived: 0 },
          mediaCount: 0,
          note: "Website CMS requires the live data plane.",
        };
      }
      const client = requireAoSupabaseClient();
      const [
        { data: docs, error: docsErr },
        { data: anns, error: annErr },
        { count: mediaCount, error: mediaErr },
      ] = await Promise.all([
        client.from("cms_documents").select("*").order("document_key"),
        client.from("cms_announcements").select("status"),
        client.from("cms_media").select("id", { count: "exact", head: true }),
      ]);

      if (docsErr || annErr || mediaErr) {
        const msg = docsErr?.message || annErr?.message || mediaErr?.message || "";
        if (isMissingCmsRelation(msg)) {
          return {
            schemaReady: false,
            canMutate: false,
            documents: [],
            announcementCount: { draft: 0, published: 0, archived: 0 },
            mediaCount: 0,
            note: SCHEMA_NOTE,
          };
        }
        throw new AuthError(msg, 500);
      }

      const announcementCount = { draft: 0, published: 0, archived: 0 };
      for (const row of anns ?? []) {
        const s = String((row as { status: string }).status);
        if (s === "draft" || s === "published" || s === "archived") announcementCount[s] += 1;
      }

      const documents = (docs ?? []).map((row) => {
        const parsed = parseCmsDocumentRow(row as Record<string, unknown>);
        const draftEmpty =
          !parsed.draft ||
          (typeof parsed.draft === "object" &&
            Object.keys(parsed.draft as object).length === 0);
        return {
          ...parsed,
          draft: draftEmpty ? defaultPayloadForKey(parsed.documentKey) : parsed.draft,
        };
      });

      return {
        schemaReady: true,
        canMutate: true,
        documents,
        announcementCount,
        mediaCount: mediaCount ?? 0,
        note: null,
      };
    } catch (error) {
      toError(error);
    }
  },
);

export const portalGetCmsDocument = createServerFn({ method: "GET" })
  .validator((data: { documentKey: string }) => data)
  .handler(async ({ data }): Promise<CmsDocumentAdminView> => {
    try {
      await requireCmsAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client
        .from("cms_documents")
        .select("*")
        .eq("document_key", data.documentKey)
        .maybeSingle();
      if (error) {
        if (isMissingCmsRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }
      if (!row) throw new AuthError("CMS document not found.", 404);
      const parsed = parseCmsDocumentRow(row as Record<string, unknown>);
      const draftEmpty =
        !parsed.draft ||
        (typeof parsed.draft === "object" && Object.keys(parsed.draft as object).length === 0);
      return {
        ...parsed,
        draft: draftEmpty ? defaultPayloadForKey(parsed.documentKey) : parsed.draft,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveCmsDraft = createServerFn({ method: "POST" })
  .validator((data: { documentKey: string; draft: unknown; expectedDraftVersion?: number }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireCmsAdmin();
      const validated = validateDocumentDraft(data.documentKey, data.draft);
      if (!validated.ok) throw new AuthError(validated.message, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: current, error: readErr } = await client
        .from("cms_documents")
        .select("draft_version")
        .eq("document_key", data.documentKey)
        .maybeSingle();
      if (readErr) {
        if (isMissingCmsRelation(readErr.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(readErr.message, 500);
      }
      if (!current) throw new AuthError("CMS document not found.", 404);

      const currentVersion = Number(current.draft_version ?? 1);
      if (
        typeof data.expectedDraftVersion === "number" &&
        data.expectedDraftVersion !== currentVersion
      ) {
        throw new AuthError(
          "This document was updated by someone else. Reload before saving.",
          409,
        );
      }

      const nextVersion = currentVersion + 1;
      const { data: updated, error } = await client
        .from("cms_documents")
        .update({
          draft: validated.value,
          draft_version: nextVersion,
          updated_by: session.userId ?? null,
        })
        .eq("document_key", data.documentKey)
        .select("*")
        .single();
      if (error) throw new AuthError(error.message, 500);

      await client.from("cms_revisions").insert({
        document_key: data.documentKey,
        version: nextVersion,
        payload: validated.value,
        kind: "draft_snapshot",
        note: "Draft saved",
        created_by: session.userId ?? null,
      });

      try {
        await client.rpc("write_audit_event", {
          p_action: "cms.document.save_draft",
          p_entity_type: "cms_documents",
          p_entity_id: data.documentKey,
          p_meta: { draft_version: nextVersion },
        });
      } catch {
        /* audit best-effort */
      }

      return { ok: true as const, document: parseCmsDocumentRow(updated as Record<string, unknown>) };
    } catch (error) {
      toError(error);
    }
  });

export const portalPublishCmsDocument = createServerFn({ method: "POST" })
  .validator((data: { documentKey: string; expectedDraftVersion?: number }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireCmsAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error: readErr } = await client
        .from("cms_documents")
        .select("*")
        .eq("document_key", data.documentKey)
        .maybeSingle();
      if (readErr) {
        if (isMissingCmsRelation(readErr.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(readErr.message, 500);
      }
      if (!row) throw new AuthError("CMS document not found.", 404);

      const draftVersion = Number(row.draft_version ?? 1);
      if (
        typeof data.expectedDraftVersion === "number" &&
        data.expectedDraftVersion !== draftVersion
      ) {
        throw new AuthError(
          "This document was updated by someone else. Reload before publishing.",
          409,
        );
      }

      const draftPayload =
        row.draft && typeof row.draft === "object" && Object.keys(row.draft as object).length
          ? row.draft
          : defaultPayloadForKey(data.documentKey);
      const validated = validateDocumentDraft(data.documentKey, draftPayload);
      if (!validated.ok) throw new AuthError(validated.message, 400);

      const publishedVersion = draftVersion;
      const { data: updated, error } = await client
        .from("cms_documents")
        .update({
          draft: validated.value,
          published: validated.value,
          published_version: publishedVersion,
          published_at: new Date().toISOString(),
          published_by: session.userId ?? null,
          updated_by: session.userId ?? null,
        })
        .eq("document_key", data.documentKey)
        .select("*")
        .single();
      if (error) throw new AuthError(error.message, 500);

      await client.from("cms_revisions").insert({
        document_key: data.documentKey,
        version: publishedVersion,
        payload: validated.value,
        kind: "published",
        note: "Published",
        created_by: session.userId ?? null,
      });

      try {
        await client.rpc("write_audit_event", {
          p_action: "cms.document.publish",
          p_entity_type: "cms_documents",
          p_entity_id: data.documentKey,
          p_meta: { published_version: publishedVersion },
        });
      } catch {
        /* audit best-effort */
      }

      return { ok: true as const, document: parseCmsDocumentRow(updated as Record<string, unknown>) };
    } catch (error) {
      toError(error);
    }
  });

export const portalListCmsAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireCmsAdmin();
    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    const session = await requireTrustedSession();
    if (!usesSupabaseDataPlane(session)) {
      throw new AuthError("Website CMS requires the live data plane.", 400);
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client
      .from("cms_announcements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingCmsRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
      throw new AuthError(error.message, 500);
    }
    return {
      rows: (data ?? []).map((row) => ({
        id: String(row.id),
        internalTitle: String(row.internal_title ?? ""),
        body: String(row.body ?? ""),
        announcementType: String(row.announcement_type ?? "general"),
        ctaLabel: (row.cta_label as string | null) ?? null,
        ctaHref: (row.cta_href as string | null) ?? null,
        styleToken: String(row.style_token ?? "navy"),
        dismissible: Boolean(row.dismissible),
        status: String(row.status),
        startsAt: (row.starts_at as string | null) ?? null,
        endsAt: (row.ends_at as string | null) ?? null,
        sortOrder: Number(row.sort_order ?? 0),
        updatedAt: (row.updated_at as string | null) ?? null,
      })),
    };
  } catch (error) {
    toError(error);
  }
});

export const portalSaveCmsAnnouncement = createServerFn({ method: "POST" })
  .validator((data: CmsAnnouncementInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireCmsAdmin();
      const validated = validateAnnouncementWrite(data);
      if (!validated.ok) throw new AuthError(validated.message, 400);
      const v = validated.value;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const payload = {
        internal_title: sanitizePlainText(v.internalTitle, 160),
        body: sanitizePlainText(v.body, 500),
        announcement_type: v.announcementType,
        cta_label: v.ctaLabel,
        cta_href: v.ctaHref,
        style_token: v.styleToken,
        dismissible: v.dismissible,
        status: v.status,
        starts_at: v.startsAt || null,
        ends_at: v.endsAt || null,
        sort_order: v.sortOrder,
        updated_by: session.userId ?? null,
      };

      if (v.id) {
        const { data: updated, error } = await client
          .from("cms_announcements")
          .update(payload)
          .eq("id", v.id)
          .select("*")
          .single();
        if (error) throw new AuthError(error.message, 500);
        return { ok: true as const, id: updated.id as string };
      }

      const { data: inserted, error } = await client
        .from("cms_announcements")
        .insert({ ...payload, created_by: session.userId ?? null })
        .select("*")
        .single();
      if (error) {
        if (isMissingCmsRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }
      return { ok: true as const, id: inserted.id as string };
    } catch (error) {
      toError(error);
    }
  });

export const portalListCmsRevisions = createServerFn({ method: "GET" })
  .validator((data: { documentKey: string }) => data)
  .handler(async ({ data }) => {
    try {
      await requireCmsAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: rows, error } = await client
        .from("cms_revisions")
        .select("id, document_key, version, kind, note, created_at, created_by")
        .eq("document_key", data.documentKey)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (isMissingCmsRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }
      return { rows: rows ?? [] };
    } catch (error) {
      toError(error);
    }
  });

export const portalRestoreCmsRevision = createServerFn({ method: "POST" })
  .validator((data: { revisionId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireCmsAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Website CMS requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: rev, error: revErr } = await client
        .from("cms_revisions")
        .select("*")
        .eq("id", data.revisionId)
        .maybeSingle();
      if (revErr) throw new AuthError(revErr.message, 500);
      if (!rev) throw new AuthError("Revision not found.", 404);

      const validated = validateDocumentDraft(String(rev.document_key), rev.payload);
      if (!validated.ok) throw new AuthError(validated.message, 400);

      const { data: current, error: curErr } = await client
        .from("cms_documents")
        .select("draft_version")
        .eq("document_key", rev.document_key)
        .single();
      if (curErr) throw new AuthError(curErr.message, 500);
      const nextVersion = Number(current.draft_version ?? 1) + 1;

      const { data: updated, error } = await client
        .from("cms_documents")
        .update({
          draft: validated.value,
          draft_version: nextVersion,
          updated_by: session.userId ?? null,
        })
        .eq("document_key", rev.document_key)
        .select("*")
        .single();
      if (error) throw new AuthError(error.message, 500);

      await client.from("cms_revisions").insert({
        document_key: rev.document_key,
        version: nextVersion,
        payload: validated.value,
        kind: "draft_snapshot",
        note: `Restored from revision ${rev.id}`,
        created_by: session.userId ?? null,
      });

      return { ok: true as const, document: parseCmsDocumentRow(updated as Record<string, unknown>) };
    } catch (error) {
      toError(error);
    }
  });
