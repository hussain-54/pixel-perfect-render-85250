/**
 * Single source of truth for public contact details and social channels.
 * Values below are reused from existing site content (contact page / footer).
 *
 * OWNER ACTION REQUIRED:
 * - Replace placeholder phone / WhatsApp with the live business numbers.
 * - Paste real Global Roots profile URLs into `socialLinks` when ready.
 * Empty social hrefs are hidden in the UI (not shown as dead icons).
 */
import type { AppPath } from "@/data/navigation";

export type SocialChannelId =
  "facebook" | "instagram" | "youtube" | "linkedin" | "x" | "snapchat" | "tiktok" | "whatsapp";

export type SocialLink = {
  id: SocialChannelId;
  label: string;
  /** Real profile URL, or empty until provided. */
  href: string;
};

export type UtilityQuickLink = {
  label: string;
  to: AppPath;
};

/** Existing contact details from contact page + site footer. */
export const siteContact = {
  phone: {
    /** Placeholder — GR-015. Do not invent a real number. */
    display: "+92 300 0000000",
    href: "tel:+923000000000",
    placeholder: true,
  },
  email: {
    display: "info@globalroots.pk",
    href: "mailto:info@globalroots.pk",
    placeholder: false,
  },
  location: {
    /** Single office label — do not present multiple city offices. */
    label: "Our Office",
    display: "Saleemi Chowk, Faisalabad",
    shortDisplay: "Faisalabad, Pakistan",
    fullDisplay: "584-B 2nd floor, Peoples Colony No.1, Chen One Road, Saleemi Chowk, Faisalabad",
    /** No map URL exists in the project yet. */
    href: null as string | null,
  },
  whatsapp: {
    /** Placeholder — tied to phone until a verified WhatsApp number is supplied. */
    display: "+92 300 0000000",
    href: "https://wa.me/923000000000",
    placeholder: true,
  },
  hours: "Mon–Sat, 10:00–19:00",
  registration: "SECP Registered",
} as const;

/**
 * Shared social-channel configuration used by the utility bar,
 * mobile navigation drawer, and footer.
 *
 * Icons only render when href is non-empty (except WhatsApp, which also
 * requires a non-placeholder phone).
 */
export const socialLinks: SocialLink[] = [
  { id: "facebook", label: "Facebook", href: "" },
  { id: "instagram", label: "Instagram", href: "" },
  { id: "youtube", label: "YouTube", href: "" },
  { id: "linkedin", label: "LinkedIn", href: "" },
  { id: "x", label: "X", href: "" },
  { id: "snapchat", label: "Snapchat", href: "" },
  { id: "tiktok", label: "TikTok", href: "" },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: siteContact.whatsapp.placeholder ? "" : siteContact.whatsapp.href,
  },
];

/** Compact utility links that already exist as routes (not main-nav duplicates). */
export const utilityQuickLinks: UtilityQuickLink[] = [
  { label: "Sign In", to: "/sign-in" },
  { label: "Free Consultation", to: "/contact" },
];

/** Social channels that currently have a live URL. */
export function getConfiguredSocialLinks(): SocialLink[] {
  return socialLinks.filter((link) => Boolean(link.href.trim()));
}