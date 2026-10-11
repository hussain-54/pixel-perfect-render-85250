/**
 * Public-site SEO helpers. Canonical origin is the confirmed production domain
 * already used in this project (contact page / root meta) — do not invent another.
 */

export const SITE_ORIGIN = "https://globalroots.pk";
export const SITE_NAME = "Global Roots Consultants";
export const SITE_DEFAULT_TITLE = `${SITE_NAME} | Global Education & Visa Consultants`;
export const SITE_DEFAULT_DESCRIPTION =
  "Global Roots Consultants — premium education and visa consultancy guiding students from first conversation to first day on campus.";

/** Verified brand asset already served from /public. */
export const SITE_OG_IMAGE_PATH = "/brand/global-roots-logo.png";
export const SITE_OG_IMAGE = `${SITE_ORIGIN}${SITE_OG_IMAGE_PATH}`;

/** Indexable marketing routes (excludes auth + authenticated portals). */
export const PUBLIC_INDEXABLE_PATHS = [
  "/",
  "/about",
  "/contact",
  "/destinations",
  "/programs",
  "/resources",
  "/scholarships",
  "/services",
  "/student-visa",
  "/success-stories",
  "/universities",
  "/privacy",
  "/terms",
] as const;

export type PublicIndexablePath = (typeof PUBLIC_INDEXABLE_PATHS)[number];

export function absoluteUrl(path: string): string {
  if (!path || path === "/") return `${SITE_ORIGIN}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export type PageSeoInput = {
  path: string;
  title: string;
  description: string;
  /** When false, emit noindex and omit canonical (auth / portal). Default true. */
  indexable?: boolean;
};

/** Shared head fragment for public (and non-indexable) routes. */
export function pageHead({ path, title, description, indexable = true }: PageSeoInput) {
  const url = absoluteUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: indexable ? "index,follow" : "noindex,nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: SITE_OG_IMAGE },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SITE_OG_IMAGE },
    ],
    links: indexable ? [{ rel: "canonical", href: url }] : [],
  };
}

/** XML sitemap body from the confirmed public route list. */
export function buildSitemapXml(paths: readonly string[] = PUBLIC_INDEXABLE_PATHS): string {
  const urls = paths
    .map((path) => {
      const loc = absoluteUrl(path);
      const priority = path === "/" ? "1.0" : path === "/contact" ? "0.9" : "0.7";
      return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}