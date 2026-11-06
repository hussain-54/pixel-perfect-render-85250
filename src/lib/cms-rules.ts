/**
 * Validation and merge helpers for Website CMS payloads.
 * No arbitrary HTML/JS — structured fields only.
 */
import { defaultPayloadForKey } from "@/lib/cms-defaults";
import {
  CMS_DOCUMENT_KEYS,
  type CmsAnnouncementInput,
  type CmsDocumentKey,
  type CmsFooterSettings,
  type CmsHeaderSettings,
  type CmsHomeSection,
  type CmsNavSettings,
  type CmsPageContent,
  type CmsSeoSettings,
} from "@/lib/cms-types";

const SAFE_HREF =
  /^(https?:\/\/[^\s]+|\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*|mailto:[^\s]+|tel:[^\s]+)$/;

export function isCmsDocumentKey(value: string): value is CmsDocumentKey {
  return (CMS_DOCUMENT_KEYS as readonly string[]).includes(value);
}

export function assertSafeHref(href: string, field: string): string | null {
  const t = href.trim();
  if (!t) return `${field} is required.`;
  if (t.length > 500) return `${field} is too long.`;
  if (/javascript:/i.test(t) || /data:/i.test(t) || /<script/i.test(t)) {
    return `${field} contains a disallowed URL scheme.`;
  }
  if (!SAFE_HREF.test(t)) return `${field} must be a relative path or http(s)/mailto/tel URL.`;
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mergeWithDefaults<T>(key: string, payload: unknown): T {
  const defaults = defaultPayloadForKey(key) as T;
  if (!payload || typeof payload !== "object") return structuredClone(defaults);
  return deepMerge(defaults as object, payload as object) as T;
}

function deepMerge(base: object, over: object): object {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k] as object, v as object);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function validateHeaderDraft(
  input: unknown,
): { ok: true; value: CmsHeaderSettings } | { ok: false; message: string } {
  const merged = mergeWithDefaults<CmsHeaderSettings>("site.header", input);
  if (merged.logoHeightPx < 24 || merged.logoHeightPx > 72) {
    return { ok: false, message: "Logo height must be between 24 and 72px." };
  }
  const ctaErr = assertSafeHref(merged.cta.href, "Header CTA link");
  if (ctaErr) return { ok: false, message: ctaErr };
  if (!merged.cta.label.trim()) return { ok: false, message: "Header CTA label is required." };
  if (merged.secondaryCta) {
    const sErr = assertSafeHref(merged.secondaryCta.href, "Secondary CTA link");
    if (sErr) return { ok: false, message: sErr };
  }
  return { ok: true, value: merged };
}

export function validateNavDraft(
  input: unknown,
): { ok: true; value: CmsNavSettings } | { ok: false; message: string } {
  const merged = mergeWithDefaults<CmsNavSettings>("site.nav", input);
  if (!Array.isArray(merged.items) || !merged.items.length) {
    return { ok: false, message: "Navigation must include at least one item." };
  }
  for (const item of merged.items) {
    if (!item.id?.trim() || !item.label?.trim()) {
      return { ok: false, message: "Each navigation item needs an id and label." };
    }
    if (item.type === "link") {
      const err = assertSafeHref(item.href ?? "", `Nav link “${item.label}”`);
      if (err) return { ok: false, message: err };
    }
  }
  return { ok: true, value: merged };
}

export function validateFooterDraft(
  input: unknown,
): { ok: true; value: CmsFooterSettings } | { ok: false; message: string } {
  const merged = mergeWithDefaults<CmsFooterSettings>("site.footer", input);
  if (!merged.brandName.trim() || !merged.description.trim()) {
    return { ok: false, message: "Footer brand name and description are required." };
  }
  for (const col of merged.columns) {
    for (const link of col.links) {
      const err = assertSafeHref(link.href, `Footer link “${link.label}”`);
      if (err) return { ok: false, message: err };
    }
  }
  return { ok: true, value: merged };
}

export function validatePageDraft(
  key: string,
  input: unknown,
): { ok: true; value: CmsPageContent } | { ok: false; message: string } {
  const merged = mergeWithDefaults<CmsPageContent>(key, input);
  if (!merged.seo?.title?.trim() || !merged.seo?.description?.trim()) {
    return { ok: false, message: "Page SEO title and description are required." };
  }
  if (!Array.isArray(merged.sections)) {
    return { ok: false, message: "Page sections must be an array." };
  }
  const ids = new Set<string>();
  for (const section of merged.sections as CmsHomeSection[]) {
    if (!section.id?.trim()) return { ok: false, message: "Each section needs an id." };
    if (ids.has(section.id)) return { ok: false, message: `Duplicate section id: ${section.id}` };
    ids.add(section.id);
    if (section.primaryCta?.href) {
      const err = assertSafeHref(section.primaryCta.href, `${section.id} CTA`);
      if (err) return { ok: false, message: err };
    }
  }
  return { ok: true, value: merged };
}

export function validateSeoDraft(
  input: unknown,
): { ok: true; value: CmsSeoSettings } | { ok: false; message: string } {
  const merged = mergeWithDefaults<CmsSeoSettings>("seo.global", input);
  if (!merged.title.trim() || merged.title.length > 120) {
    return { ok: false, message: "SEO title is required (max 120 characters)." };
  }
  if (!merged.description.trim() || merged.description.length > 320) {
    return { ok: false, message: "SEO description is required (max 320 characters)." };
  }
  return { ok: true, value: merged };
}

export function validateDocumentDraft(
  key: string,
  input: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  switch (key) {
    case "site.header":
      return validateHeaderDraft(input);
    case "site.nav":
      return validateNavDraft(input);
    case "site.footer":
      return validateFooterDraft(input);
    case "site.theme":
      return { ok: true, value: mergeWithDefaults(key, input) };
    case "page.home":
    case "page.about":
    case "page.services":
    case "page.contact":
    case "page.destinations":
      return validatePageDraft(key, input);
    case "seo.global":
      return validateSeoDraft(input);
    default:
      return { ok: false, message: `Unknown CMS document key: ${key}` };
  }
}

export function validateAnnouncementWrite(
  input: CmsAnnouncementInput,
): { ok: true; value: CmsAnnouncementInput } | { ok: false; message: string } {
  const body = input.body?.trim() ?? "";
  if (!body || body.length > 500) {
    return { ok: false, message: "Announcement body is required (max 500 characters)." };
  }
  if (input.ctaHref) {
    const err = assertSafeHref(input.ctaHref, "Announcement CTA");
    if (err) return { ok: false, message: err };
  }
  if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
    return { ok: false, message: "Announcement end date must be after the start date." };
  }
  return {
    ok: true,
    value: {
      ...input,
      body,
      internalTitle: (input.internalTitle ?? "").trim().slice(0, 160),
      ctaLabel: input.ctaLabel?.trim() || null,
      ctaHref: input.ctaHref?.trim() || null,
    },
  };
}

export function documentsHaveUnpublishedChanges(draft: unknown, published: unknown): boolean {
  return JSON.stringify(draft ?? null) !== JSON.stringify(published ?? null);
}

export function parseCmsDocumentRow(row: Record<string, unknown>) {
  const draft = row.draft ?? {};
  const published = row.published ?? null;
  return {
    documentKey: String(row.document_key),
    title: String(row.title ?? row.document_key),
    draft,
    published,
    draftVersion: Number(row.draft_version ?? 1),
    publishedVersion: Number(row.published_version ?? 0),
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    hasUnpublishedChanges: documentsHaveUnpublishedChanges(draft, published),
  };
}

export function isMissingCmsRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("cms_documents") ||
      m.includes("cms_announcements") ||
      m.includes("cms_media") ||
      m.includes("get_cms_public")) &&
    (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"))
  );
}

/** Strip script-like content from plain text fields (defence in depth). */
export function sanitizePlainText(value: string, max = 2000): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export { asObject };
