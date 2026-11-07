/**
 * Blog CMS — admin CRUD + public published readers.
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import {
  estimateReadingTimeMinutes,
  isMissingBlogRelation,
  mapBlogPostRow,
  sanitizeBlogHtml,
  slugifyBlogTitle,
  validateBlogPostWrite,
} from "@/lib/blog-rules";
import type {
  BlogAuthor,
  BlogCategory,
  BlogDashboardStats,
  BlogPostDetail,
  BlogPostListItem,
  BlogPostWriteInput,
  BlogTag,
  PublicBlogArticle,
  PublicBlogCard,
} from "@/lib/blog-types";
import { createServerSupabase } from "@/server/supabase";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Blog authorization failed.");
}

/** Blog tables are forward-only migrations — not yet in generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlogDb = any;

function blogDb(client: unknown): BlogDb {
  return client as BlogDb;
}

const SCHEMA_NOTE =
  "Blog tables are not available yet. Apply migration 20261108140000_blog_platform_foundation.sql.";

async function requireBlogAdmin() {
  const session = await requireTrustedSession();
  requireRoles(session, ["admin", "super_admin"]);
  denyFrontDeskConsultantWorkflows(session, "blog CMS");
  await requireModulePermission(session, "settings", 2, "blog CMS");
  return session;
}

function mapAuthor(row: Record<string, unknown>): BlogAuthor {
  return {
    id: String(row["id"]),
    displayName: String(row["display_name"] ?? ""),
    bio: String(row["bio"] ?? ""),
    avatarUrl: (row["avatar_url"] as string | null) ?? null,
    active: row["active"] !== false,
    profileId: (row["profile_id"] as string | null) ?? null,
  };
}

function mapCategory(row: Record<string, unknown>): BlogCategory {
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    slug: String(row["slug"] ?? ""),
    description: String(row["description"] ?? ""),
    sortOrder: Number(row["sort_order"] ?? 0),
  };
}

function mapTag(row: Record<string, unknown>): BlogTag {
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    slug: String(row["slug"] ?? ""),
  };
}

export const portalGetBlogDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlogDashboardStats> => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) {
        return {
          total: 0,
          published: 0,
          drafts: 0,
          scheduled: 0,
          archived: 0,
          schemaReady: false,
          note: "Blog CMS requires the live data plane.",
        };
      }
      const client = blogDb(requireAoSupabaseClient());
      await client.rpc("promote_scheduled_blog_posts");
      const { data, error } = await client.from("blog_posts").select("status");
      if (error) {
        if (isMissingBlogRelation(error.message)) {
          return {
            total: 0,
            published: 0,
            drafts: 0,
            scheduled: 0,
            archived: 0,
            schemaReady: false,
            note: SCHEMA_NOTE,
          };
        }
        throw new AuthError(error.message, 500);
      }
      const rows = (data ?? []) as { status?: string }[];
      const count = (s: string) => rows.filter((r) => String(r.status) === s).length;
      return {
        total: rows.length,
        published: count("published"),
        drafts: count("draft"),
        scheduled: count("scheduled"),
        archived: count("archived"),
        schemaReady: true,
        note: null,
      };
    } catch (error) {
      toError(error);
    }
  },
);

export const portalListBlogPosts = createServerFn({ method: "GET" })
  .validator(
    (data: { status?: string; search?: string; page?: number; pageSize?: number }) => data ?? {},
  )
  .handler(async ({ data }): Promise<{ rows: BlogPostListItem[]; total: number }> => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      await client.rpc("promote_scheduled_blog_posts");

      const page = Math.max(1, data.page ?? 1);
      const pageSize = Math.min(50, Math.max(1, data.pageSize ?? 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = client
        .from("blog_posts")
        .select("*, blog_categories(name, slug), blog_authors(display_name)", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (data.status && data.status !== "all") q = q.eq("status", data.status);
      if (data.search?.trim()) {
        const s = data.search.trim();
        q = q.or(`title.ilike.%${s}%,slug.ilike.%${s}%,excerpt.ilike.%${s}%`);
      }

      const { data: rows, error, count } = await q;
      if (error) {
        if (isMissingBlogRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }

      return {
        total: count ?? 0,
        rows: ((rows ?? []) as Record<string, unknown>[]).map((row) => {
          const mapped = mapBlogPostRow(row);
          const cat = (row as { blog_categories?: { name?: string; slug?: string } | null })
            .blog_categories;
          const author = (row as { blog_authors?: { display_name?: string } | null }).blog_authors;
          return {
            id: mapped.id,
            title: mapped.title,
            slug: mapped.slug,
            excerpt: mapped.excerpt,
            status: mapped.status,
            publishedAt: mapped.publishedAt,
            scheduledFor: mapped.scheduledFor,
            updatedAt: mapped.updatedAt,
            readingTimeMinutes: mapped.readingTimeMinutes,
            isFeatured: mapped.isFeatured,
            categoryName: cat?.name ?? null,
            categorySlug: cat?.slug ?? null,
            authorName: author?.display_name ?? null,
            featuredImageUrl: mapped.featuredImageUrl,
            draftVersion: mapped.draftVersion,
          };
        }),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetBlogPost = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<BlogPostDetail> => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const { data: row, error } = await client
        .from("blog_posts")
        .select("*, blog_categories(name, slug), blog_authors(display_name)")
        .eq("id", data.id)
        .maybeSingle();
      if (error) {
        if (isMissingBlogRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }
      if (!row) throw new AuthError("Article not found.", 404);

      const { data: tagRows } = await client
        .from("blog_post_tags")
        .select("tag_id, blog_tags(name)")
        .eq("post_id", data.id);

      const mapped = mapBlogPostRow(row as Record<string, unknown>);
      const cat = (row as { blog_categories?: { name?: string; slug?: string } | null })
        .blog_categories;
      const author = (row as { blog_authors?: { display_name?: string } | null }).blog_authors;
      const tagIds = ((tagRows ?? []) as { tag_id?: string }[]).map((t) => String(t.tag_id));
      const tagNames = ((tagRows ?? []) as { blog_tags?: { name?: string } | null }[])
        .map((t) => t.blog_tags?.name)
        .filter(Boolean) as string[];

      return {
        ...mapped,
        categoryName: cat?.name ?? null,
        categorySlug: cat?.slug ?? null,
        authorName: author?.display_name ?? null,
        tagIds,
        tagNames,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveBlogPost = createServerFn({ method: "POST" })
  .validator((data: BlogPostWriteInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireBlogAdmin();
      const validated = validateBlogPostWrite(data);
      if (!validated.ok) throw new AuthError(validated.message, 400);
      const v = validated.value;

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());

      const payload = {
        title: v.title,
        slug: v.slug,
        excerpt: v.excerpt,
        content_json: v.contentJson ?? {},
        content_html: v.contentHtml,
        featured_image_url: v.featuredImageUrl || null,
        featured_image_alt: v.featuredImageAlt || "",
        category_id: v.categoryId || null,
        author_id: v.authorId || null,
        status: v.status,
        scheduled_for: v.status === "scheduled" ? v.scheduledFor || null : null,
        published_at:
          v.status === "published"
            ? v.publishedAt || new Date().toISOString()
            : v.status === "draft" || v.status === "archived"
              ? v.publishedAt || null
              : v.publishedAt || null,
        is_featured: Boolean(v.isFeatured),
        reading_time_minutes: v.readingTimeMinutes || estimateReadingTimeMinutes(v.contentHtml),
        seo_title: v.seoTitle || "",
        seo_description: v.seoDescription || "",
        focus_keyword: v.focusKeyword || "",
        og_title: v.ogTitle || "",
        og_description: v.ogDescription || "",
        og_image_url: v.ogImageUrl || null,
        canonical_path: v.canonicalPath || `/blog/${v.slug}`,
        robots_index: v.robotsIndex !== false,
        updated_by: session.userId ?? null,
      };

      let postId = v.id;
      let draftVersion = 1;

      if (postId) {
        const { data: current, error: curErr } = await client
          .from("blog_posts")
          .select("draft_version")
          .eq("id", postId)
          .maybeSingle();
        if (curErr) throw new AuthError(curErr.message, 500);
        if (!current) throw new AuthError("Article not found.", 404);
        const currentVersion = Number(current.draft_version ?? 1);
        if (
          typeof v.expectedDraftVersion === "number" &&
          v.expectedDraftVersion !== currentVersion
        ) {
          throw new AuthError("This article was updated elsewhere. Reload before saving.", 409);
        }
        draftVersion = currentVersion + 1;
        const { data: updated, error } = await client
          .from("blog_posts")
          .update({ ...payload, draft_version: draftVersion })
          .eq("id", postId)
          .select("id, draft_version, slug, status")
          .single();
        if (error) throw new AuthError(error.message, 500);
        postId = updated.id as string;
        draftVersion = Number(updated.draft_version);
      } else {
        const { data: inserted, error } = await client
          .from("blog_posts")
          .insert({
            ...payload,
            draft_version: 1,
            created_by: session.userId ?? null,
          })
          .select("id, draft_version, slug, status")
          .single();
        if (error) {
          if (isMissingBlogRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
          if (error.message.toLowerCase().includes("duplicate")) {
            throw new AuthError("That slug is already in use. Choose another.", 400);
          }
          throw new AuthError(error.message, 500);
        }
        postId = inserted.id as string;
        draftVersion = Number(inserted.draft_version);
      }

      await client.from("blog_post_tags").delete().eq("post_id", postId);
      const tagIds = [...new Set(v.tagIds ?? [])];
      if (tagIds.length) {
        const { error: tagErr } = await client
          .from("blog_post_tags")
          .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
        if (tagErr) throw new AuthError(tagErr.message, 500);
      }

      await client.from("blog_post_revisions").insert({
        post_id: postId,
        version: draftVersion,
        title: v.title,
        content_json: v.contentJson ?? {},
        content_html: v.contentHtml,
        kind: v.status === "published" ? "published" : "draft_snapshot",
        note: v.status === "published" ? "Published" : "Saved",
        created_by: session.userId ?? null,
      });

      return { ok: true as const, id: postId!, draftVersion, slug: v.slug, status: v.status };
    } catch (error) {
      toError(error);
    }
  });

export const portalDeleteBlogPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const { error } = await client.from("blog_posts").delete().eq("id", data.id);
      if (error) throw new AuthError(error.message, 500);
      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });

export const portalListBlogTaxonomy = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    authors: BlogAuthor[];
    categories: BlogCategory[];
    tags: BlogTag[];
  }> => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const [authors, categories, tags] = await Promise.all([
        client.from("blog_authors").select("*").order("display_name"),
        client.from("blog_categories").select("*").order("sort_order"),
        client.from("blog_tags").select("*").order("name"),
      ]);
      if (authors.error || categories.error || tags.error) {
        const msg =
          authors.error?.message || categories.error?.message || tags.error?.message || "";
        if (isMissingBlogRelation(msg)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(msg, 500);
      }
      return {
        authors: ((authors.data ?? []) as Record<string, unknown>[]).map((r) => mapAuthor(r)),
        categories: ((categories.data ?? []) as Record<string, unknown>[]).map((r) =>
          mapCategory(r),
        ),
        tags: ((tags.data ?? []) as Record<string, unknown>[]).map((r) => mapTag(r)),
      };
    } catch (error) {
      toError(error);
    }
  },
);

export const portalSaveBlogAuthor = createServerFn({ method: "POST" })
  .validator((data: { id?: string; displayName: string; bio?: string; active?: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const name = data.displayName.trim();
      if (name.length < 2) throw new AuthError("Author name is required.", 400);
      if (data.id) {
        const { error } = await client
          .from("blog_authors")
          .update({
            display_name: name,
            bio: (data.bio ?? "").trim(),
            active: data.active !== false,
          })
          .eq("id", data.id);
        if (error) throw new AuthError(error.message, 500);
        return { ok: true as const, id: data.id };
      }
      const { data: row, error } = await client
        .from("blog_authors")
        .insert({
          display_name: name,
          bio: (data.bio ?? "").trim(),
          active: data.active !== false,
          profile_id: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new AuthError(error.message, 500);
      return { ok: true as const, id: row.id as string };
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveBlogCategory = createServerFn({ method: "POST" })
  .validator((data: { id?: string; name: string; slug?: string; description?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const name = data.name.trim();
      const slug = (data.slug?.trim() || slugifyBlogTitle(name)).toLowerCase();
      if (name.length < 2) throw new AuthError("Category name is required.", 400);
      if (data.id) {
        const { error } = await client
          .from("blog_categories")
          .update({ name, slug, description: (data.description ?? "").trim() })
          .eq("id", data.id);
        if (error) throw new AuthError(error.message, 500);
        return { ok: true as const, id: data.id };
      }
      const { data: row, error } = await client
        .from("blog_categories")
        .insert({ name, slug, description: (data.description ?? "").trim() })
        .select("id")
        .single();
      if (error) throw new AuthError(error.message, 500);
      return { ok: true as const, id: row.id as string };
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveBlogTag = createServerFn({ method: "POST" })
  .validator((data: { id?: string; name: string; slug?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await requireBlogAdmin();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      const session = await requireTrustedSession();
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const name = data.name.trim();
      const slug = (data.slug?.trim() || slugifyBlogTitle(name)).toLowerCase();
      if (name.length < 2) throw new AuthError("Tag name is required.", 400);
      if (data.id) {
        const { error } = await client.from("blog_tags").update({ name, slug }).eq("id", data.id);
        if (error) throw new AuthError(error.message, 500);
        return { ok: true as const, id: data.id };
      }
      const { data: row, error } = await client
        .from("blog_tags")
        .insert({ name, slug })
        .select("id")
        .single();
      if (error) throw new AuthError(error.message, 500);
      return { ok: true as const, id: row.id as string };
    } catch (error) {
      toError(error);
    }
  });

export const portalUploadBlogMedia = createServerFn({ method: "POST" })
  .validator(
    (data: { fileName: string; mimeType: string; base64: string; altText?: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireBlogAdmin();
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(data.mimeType)) {
        throw new AuthError("Only JPEG, PNG, WebP or GIF images are allowed.", 400);
      }
      const buf = Buffer.from(data.base64, "base64");
      if (buf.byteLength > 5_242_880) {
        throw new AuthError("Image must be 5 MB or smaller.", 400);
      }
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = blogDb(requireAoSupabaseClient());
      const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "image";
      const path = `blog/${session.userId ?? "admin"}/${Date.now()}_${safeName}`;
      const { error: upErr } = await client.storage
        .from("website-media")
        .upload(path, buf, { contentType: data.mimeType, upsert: false });
      if (upErr) throw new AuthError(upErr.message, 500);
      const { data: pub } = client.storage.from("website-media").getPublicUrl(path);
      const { data: media, error: metaErr } = await client
        .from("cms_media")
        .insert({
          storage_bucket: "website-media",
          storage_path: path,
          file_name: safeName,
          mime_type: data.mimeType,
          byte_size: buf.byteLength,
          alt_text: (data.altText ?? "").trim().slice(0, 300),
          folder: "blog",
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (metaErr) throw new AuthError(metaErr.message, 500);
      return {
        ok: true as const,
        mediaId: media.id as string,
        url: pub.publicUrl,
        path,
      };
    } catch (error) {
      toError(error);
    }
  });

/** Public — published posts only. */
export const portalListPublishedBlogPosts = createServerFn({ method: "GET" })
  .validator(
    (data: { page?: number; pageSize?: number; category?: string; search?: string } | undefined) =>
      data ?? {},
  )
  .handler(
    async ({
      data,
    }): Promise<{ rows: PublicBlogCard[]; total: number; source: "live" | "fallback" }> => {
      try {
        const raw = createServerSupabase();
        if (!raw) return { rows: [], total: 0, source: "fallback" };
        const client = blogDb(raw);
        const page = Math.max(1, data.page ?? 1);
        const pageSize = Math.min(24, Math.max(1, data.pageSize ?? 12));
        const offset = (page - 1) * pageSize;
        const { data: rows, error } = await client.rpc("get_published_blog_posts", {
          p_limit: pageSize,
          p_offset: offset,
          p_category_slug: data.category || null,
          p_search: data.search || null,
        });
        if (error) {
          if (isMissingBlogRelation(error.message))
            return { rows: [], total: 0, source: "fallback" };
          return { rows: [], total: 0, source: "fallback" };
        }
        const list = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r["id"]),
          title: String(r["title"] ?? ""),
          slug: String(r["slug"] ?? ""),
          excerpt: String(r["excerpt"] ?? ""),
          featuredImageUrl: (r["featured_image_url"] as string | null) ?? null,
          featuredImageAlt: String(r["featured_image_alt"] ?? ""),
          publishedAt: String(r["published_at"] ?? ""),
          readingTimeMinutes: Number(r["reading_time_minutes"] ?? 1),
          isFeatured: Boolean(r["is_featured"]),
          categoryName: (r["category_name"] as string | null) ?? null,
          categorySlug: (r["category_slug"] as string | null) ?? null,
          authorName: (r["author_name"] as string | null) ?? null,
        }));
        const total = Number(
          ((rows as Record<string, unknown>[] | null)?.[0]?.["total_count"] as
            number | undefined) ?? 0,
        );
        return { rows: list, total, source: "live" };
      } catch {
        return { rows: [], total: 0, source: "fallback" };
      }
    },
  );

export const portalGetPublishedBlogPost = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<PublicBlogArticle | null> => {
    try {
      const raw = createServerSupabase();
      if (!raw) return null;
      const client = blogDb(raw);
      const { data: rows, error } = await client.rpc("get_published_blog_post", {
        p_slug: data.slug,
      });
      if (error || !rows?.length) return null;
      const r = rows[0] as Record<string, unknown>;
      return {
        id: String(r["id"]),
        title: String(r["title"] ?? ""),
        slug: String(r["slug"] ?? ""),
        excerpt: String(r["excerpt"] ?? ""),
        contentHtml: sanitizeBlogHtml(String(r["content_html"] ?? "")),
        featuredImageUrl: (r["featured_image_url"] as string | null) ?? null,
        featuredImageAlt: String(r["featured_image_alt"] ?? ""),
        publishedAt: String(r["published_at"] ?? ""),
        readingTimeMinutes: Number(r["reading_time_minutes"] ?? 1),
        isFeatured: Boolean(r["is_featured"]),
        categoryName: (r["category_name"] as string | null) ?? null,
        categorySlug: (r["category_slug"] as string | null) ?? null,
        authorName: (r["author_name"] as string | null) ?? null,
        authorBio: (r["author_bio"] as string | null) ?? null,
        authorAvatarUrl: (r["author_avatar_url"] as string | null) ?? null,
        seoTitle: String(r["seo_title"] ?? ""),
        seoDescription: String(r["seo_description"] ?? ""),
        focusKeyword: String(r["focus_keyword"] ?? ""),
        ogTitle: String(r["og_title"] ?? ""),
        ogDescription: String(r["og_description"] ?? ""),
        ogImageUrl: (r["og_image_url"] as string | null) ?? null,
        canonicalPath: (r["canonical_path"] as string | null) ?? null,
        robotsIndex: r["robots_index"] !== false,
        tagNames: Array.isArray(r["tag_names"]) ? (r["tag_names"] as string[]) : [],
      };
    } catch {
      return null;
    }
  });

export const portalListPublishedBlogCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlogCategory[]> => {
    try {
      const raw = createServerSupabase();
      if (!raw) return [];
      const client = blogDb(raw);
      const { data: rows } = await client.rpc("get_published_blog_posts", {
        p_limit: 100,
        p_offset: 0,
        p_category_slug: null,
        p_search: null,
      });
      const map = new Map<string, BlogCategory>();
      for (const r of (rows ?? []) as Record<string, unknown>[]) {
        const slug = r["category_slug"] as string | undefined;
        const name = r["category_name"] as string | undefined;
        if (slug && name && !map.has(slug)) {
          map.set(slug, {
            id: slug,
            name,
            slug,
            description: "",
            sortOrder: map.size,
          });
        }
      }
      return [...map.values()];
    } catch {
      return [];
    }
  },
);

/** Public — indexable published article paths for sitemap (robots_index + published only). */
export const portalListPublishedBlogSitemapPaths = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    try {
      const raw = createServerSupabase();
      if (!raw) return [];
      const client = blogDb(raw);
      const { data: rows, error } = await client.rpc("get_published_blog_slugs");
      if (error || !rows?.length) return [];
      return ((rows ?? []) as { slug?: string }[])
        .map((r) => String(r.slug ?? "").trim())
        .filter(Boolean)
        .map((slug) => `/blog/${slug}`);
    } catch {
      return [];
    }
  },
);
