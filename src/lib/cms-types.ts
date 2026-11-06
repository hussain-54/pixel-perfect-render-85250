/**
 * Website CMS document shapes.
 * Published payloads drive the public site; drafts stay admin-only.
 */

export const CMS_DOCUMENT_KEYS = [
  "site.header",
  "site.nav",
  "site.footer",
  "site.theme",
  "page.home",
  "page.about",
  "page.services",
  "page.contact",
  "page.destinations",
  "seo.global",
] as const;

export type CmsDocumentKey = (typeof CMS_DOCUMENT_KEYS)[number];

export type CmsLink = {
  label: string;
  href: string;
  openInNewTab?: boolean;
};

export type CmsHeaderSettings = {
  sticky: boolean;
  showUtilityBar: boolean;
  logoUrl: string | null;
  logoHeightPx: number;
  backgroundToken: "white" | "navy" | "surface";
  cta: CmsLink;
  secondaryCta: CmsLink | null;
  hoverTextToken: "navy" | "royal";
  hoverBgToken: "accent" | "muted" | "none";
  transitionMs: 150 | 200 | 300;
};

export type CmsNavItem = {
  id: string;
  label: string;
  type: "link" | "mega";
  href?: string;
  megaId?: string;
  visible: boolean;
  openInNewTab?: boolean;
  children?: CmsLink[];
};

export type CmsNavSettings = {
  items: CmsNavItem[];
};

export type CmsFooterColumn = {
  id: string;
  heading: string;
  links: CmsLink[];
  visible: boolean;
};

export type CmsFooterSettings = {
  brandName: string;
  description: string;
  registration: string;
  copyright: string;
  phoneDisplay: string;
  emailDisplay: string;
  addressDisplay: string;
  whatsappHref: string;
  socialLinks: Array<{ id: string; label: string; href: string }>;
  columns: CmsFooterColumn[];
  backgroundToken: "navy" | "surface";
  textToken: "navy-foreground" | "foreground";
};

export type CmsThemeSettings = {
  accentToken: "royal" | "bright";
  buttonVariant: "default" | "bright" | "navy";
  radiusToken: "sm" | "md" | "lg";
  sectionSpacingToken: "compact" | "default" | "roomy";
};

export type CmsSeoSettings = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImagePath?: string;
  canonicalPath?: string;
};

export type CmsHomeSectionType =
  | "hero"
  | "trust"
  | "destinations"
  | "european_destinations"
  | "why_us"
  | "partners"
  | "programs"
  | "scholarships"
  | "services"
  | "visa"
  | "how_it_works"
  | "stories"
  | "faq"
  | "cta"
  | "reviews"
  | "map"
  | "custom_content";

export type CmsHomeSection = {
  id: string;
  type: CmsHomeSectionType;
  visible: boolean;
  sort: number;
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string | null;
  backgroundToken?: "default" | "surface" | "navy";
  primaryCta?: CmsLink | null;
  secondaryCta?: CmsLink | null;
  /** Section-specific structured items (stats, cards) — never raw HTML. */
  items?: Array<Record<string, string | number | boolean>>;
};

export type CmsPageContent = {
  seo: CmsSeoSettings;
  sections: CmsHomeSection[];
};

export type CmsAnnouncementType =
  | "general"
  | "important"
  | "admission_deadline"
  | "new_service"
  | "event"
  | "promotional";

export type CmsAnnouncementStyle = "navy" | "royal" | "bright" | "muted" | "danger";

export type CmsAnnouncementInput = {
  id?: string;
  internalTitle: string;
  body: string;
  announcementType: CmsAnnouncementType;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  styleToken: CmsAnnouncementStyle;
  dismissible: boolean;
  status: "draft" | "published" | "archived";
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder: number;
};

export type CmsPublicAnnouncement = {
  id: string;
  body: string;
  announcementType: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  styleToken: string;
  position: string;
  dismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
};

export type CmsDocumentAdminView = {
  documentKey: CmsDocumentKey | string;
  title: string;
  draft: unknown;
  published: unknown | null;
  draftVersion: number;
  publishedVersion: number;
  publishedAt: string | null;
  updatedAt: string | null;
  hasUnpublishedChanges: boolean;
};
