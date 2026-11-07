import DOMPurify from "isomorphic-dompurify";
import type { BlogContentJson, BlogPostStatus, BlogPostWriteInput } from "@/lib/blog-types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyBlogTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "article"
  );
}

export function estimateReadingTimeMinutes(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.min(120, Math.ceil(words / 200)));
}

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html ?? "", {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "target", "rel", "class", "style"],
    FORBID_TAGS: ["script", "style", "form", "input", "button"],
  });
}

export function isMissingBlogRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("blog_posts") ||
      m.includes("blog_categories") ||
      m.includes("blog_authors") ||
      m.includes("get_published_blog")) &&
    (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"))
  );
}

export function validateBlogPostWrite(
  input: BlogPostWriteInput,
): { ok: true; value: BlogPostWriteInput } | { ok: false; message: string } {
  const title = (input.title ?? "").trim();
  const slug = (input.slug ?? "").trim().toLowerCase();
  const excerpt = (input.excerpt ?? "").trim();
  const status = input.status as BlogPostStatus;

  if (!["draft", "scheduled", "published", "archived"].includes(status)) {
    return { ok: false, message: "Invalid article status." };
  }
  if (status !== "draft" && !title) {
    return { ok: false, message: "Title is required before publishing or scheduling." };
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, message: "Slug must use lowercase letters, numbers and hyphens." };
  }
  if (excerpt.length > 500) {
    return { ok: false, message: "Excerpt must be 500 characters or fewer." };
  }
  if (status === "scheduled" && !input.scheduledFor) {
    return { ok: false, message: "Choose a schedule date before scheduling." };
  }
  if (status === "published" && !(input.contentHtml ?? "").replace(/<[^>]+>/g, "").trim()) {
    return { ok: false, message: "Add article content before publishing." };
  }

  const html = sanitizeBlogHtml(input.contentHtml ?? "");
  return {
    ok: true,
    value: {
      ...input,
      title,
      slug,
      excerpt,
      contentHtml: html,
      featuredImageAlt: (input.featuredImageAlt ?? "").trim().slice(0, 300),
      seoTitle: (input.seoTitle ?? "").trim().slice(0, 120),
      seoDescription: (input.seoDescription ?? "").trim().slice(0, 320),
      focusKeyword: (input.focusKeyword ?? "").trim().slice(0, 80),
      ogTitle: (input.ogTitle ?? "").trim().slice(0, 120),
      ogDescription: (input.ogDescription ?? "").trim().slice(0, 320),
      readingTimeMinutes: input.readingTimeMinutes ?? estimateReadingTimeMinutes(html),
      tagIds: input.tagIds ?? [],
    },
  };
}

export type EditorialChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export function buildEditorialChecklist(input: {
  title: string;
  excerpt: string;
  contentHtml: string;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string;
  categoryId?: string | null;
  authorId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
}): { items: EditorialChecklistItem[]; completed: number; total: number } {
  const text = (input.contentHtml ?? "").replace(/<[^>]+>/g, " ").trim();
  const hasH2 = /<h[23][\s>]/i.test(input.contentHtml ?? "");
  const hasImg = /<img[\s>]/i.test(input.contentHtml ?? "") || Boolean(input.featuredImageUrl);
  const items: EditorialChecklistItem[] = [
    { id: "title", label: "Article title", done: Boolean(input.title?.trim()) },
    {
      id: "intro",
      label: "Introduction / excerpt",
      done: Boolean(input.excerpt?.trim()) || text.length > 80,
    },
    { id: "headings", label: "Heading structure", done: hasH2 },
    { id: "content", label: "Body content", done: text.length > 120 },
    { id: "featured", label: "Featured image", done: Boolean(input.featuredImageUrl) },
    {
      id: "alt",
      label: "Image alt text",
      done: !hasImg || Boolean(input.featuredImageAlt?.trim()),
    },
    { id: "category", label: "Category selected", done: Boolean(input.categoryId) },
    { id: "author", label: "Author selected", done: Boolean(input.authorId) },
    { id: "seo_title", label: "SEO title", done: Boolean(input.seoTitle?.trim()) },
    { id: "seo_desc", label: "Meta description", done: Boolean(input.seoDescription?.trim()) },
    { id: "slug", label: "URL slug", done: Boolean(input.slug?.trim()) },
  ];
  const completed = items.filter((i) => i.done).length;
  return { items, completed, total: items.length };
}

export function mapBlogPostRow(row: Record<string, unknown>): {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  readingTimeMinutes: number;
  isFeatured: boolean;
  categoryId: string | null;
  authorId: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  contentJson: BlogContentJson;
  contentHtml: string;
  draftVersion: number;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  canonicalPath: string | null;
  robotsIndex: boolean;
  createdAt: string;
} {
  return {
    id: String(row["id"]),
    title: String(row["title"] ?? ""),
    slug: String(row["slug"] ?? ""),
    excerpt: String(row["excerpt"] ?? ""),
    status: String(row["status"] ?? "draft") as BlogPostStatus,
    publishedAt: (row["published_at"] as string | null) ?? null,
    scheduledFor: (row["scheduled_for"] as string | null) ?? null,
    updatedAt: String(row["updated_at"] ?? ""),
    readingTimeMinutes: Number(row["reading_time_minutes"] ?? 1),
    isFeatured: Boolean(row["is_featured"]),
    categoryId: (row["category_id"] as string | null) ?? null,
    authorId: (row["author_id"] as string | null) ?? null,
    featuredImageUrl: (row["featured_image_url"] as string | null) ?? null,
    featuredImageAlt: String(row["featured_image_alt"] ?? ""),
    contentJson: (row["content_json"] as BlogContentJson) ?? {},
    contentHtml: String(row["content_html"] ?? ""),
    draftVersion: Number(row["draft_version"] ?? 1),
    seoTitle: String(row["seo_title"] ?? ""),
    seoDescription: String(row["seo_description"] ?? ""),
    focusKeyword: String(row["focus_keyword"] ?? ""),
    ogTitle: String(row["og_title"] ?? ""),
    ogDescription: String(row["og_description"] ?? ""),
    ogImageUrl: (row["og_image_url"] as string | null) ?? null,
    canonicalPath: (row["canonical_path"] as string | null) ?? null,
    robotsIndex: row["robots_index"] !== false,
    createdAt: String(row["created_at"] ?? ""),
  };
}
