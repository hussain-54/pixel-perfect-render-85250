/**
 * Public website-media / blog CMS upload MIME allowlist.
 * SVG is intentionally excluded (stored XSS when served from a public bucket).
 */

export const WEBSITE_MEDIA_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type WebsiteMediaAllowedMime = (typeof WEBSITE_MEDIA_ALLOWED_MIME)[number];

export function isAllowedWebsiteMediaMime(mime: string): mime is WebsiteMediaAllowedMime {
  return (WEBSITE_MEDIA_ALLOWED_MIME as readonly string[]).includes(mime);
}

export function websiteMediaMimeRejectMessage(mime: string): string {
  if (mime === "image/svg+xml" || mime.toLowerCase().includes("svg")) {
    return "SVG uploads are not allowed (XSS risk on public media). Use JPEG, PNG, WebP, or GIF.";
  }
  return "Only JPEG, PNG, WebP or GIF images are allowed.";
}
