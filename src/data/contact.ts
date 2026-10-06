/**
 * Single source of truth for public contact details and social channels.
 * Values below are reused from existing site content (contact page / footer).
 *
 * Paste real Global Roots profile URLs into `socialLinks` when ready.
 * Icons always render; empty hrefs show the icon without a live link.
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
    display: "+92 300 0000000",
    href: "tel:+923000000000",
  },
  email: {
    display: "info@globalroots.pk",
    href: "mailto:info@globalroots.pk",
  },
  location: {
    display: "Gulberg III, Lahore",
    shortDisplay: "Lahore, Pakistan",
    fullDisplay: "Gulberg III, Lahore, Pakistan",
    /** No map URL exists in the project yet. */
    href: null as string | null,
  },
  whatsapp: {
    display: "+92 300 0000000",
    /** Derived from the existing WhatsApp/phone number on the contact page. */
    href: "https://wa.me/923000000000",
  },
  hours: "Mon–Sat, 10:00–19:00",
} as const;

/**
 * Shared social-channel configuration used by the utility bar,
 * mobile navigation drawer, and footer.
 *
 * Icons always display. Add real URLs when available.
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
    href: siteContact.whatsapp.href,
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
