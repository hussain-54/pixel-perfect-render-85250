/**
 * Single source of truth for public contact details, WhatsApp, maps, and social channels.
 * Values are reused across utility bar, footer, contact page, and homepage sections.
 *
 * OWNER ACTION REQUIRED:
 * - Paste real Global Roots Consultants profile URLs into `socialLinks` when verified.
 * - Provide Google Place ID to enable direct “Write a Review” + live review feed.
 * Empty social hrefs are hidden in the UI (not shown as dead icons).
 */
import type { AppPath } from "@/data/navigation";

export type SocialChannelId =
  | "facebook"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "x"
  | "snapchat"
  | "tiktok"
  | "whatsapp";

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

/** Official WhatsApp Business number (Pakistan mobile, national form 03260505557). */
export const WHATSAPP_E164_DIGITS = "923260505557" as const;

export const WHATSAPP_PREFILL_MESSAGE =
  "Hello GlobalRoots Consultants, I would like to inquire about your study abroad services." as const;

/** Build a wa.me link with optional pre-filled message. Digits must be country code + number (no +/spaces). */
export function buildWhatsAppUrl(
  e164Digits: string = WHATSAPP_E164_DIGITS,
  message: string = WHATSAPP_PREFILL_MESSAGE,
): string {
  const digits = e164Digits.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  const text = message.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function formatPakistanMobileDisplay(e164Digits: string): string {
  const d = e164Digits.replace(/\D/g, "");
  if (d.startsWith("92") && d.length >= 12) {
    return `+92 ${d.slice(2, 5)} ${d.slice(5, 12)}`;
  }
  return `+${d}`;
}

const OFFICE_FULL =
  "584-B 2nd floor, Peoples Colony No.1, Chen One Road, Saleemi Chowk, Faisalabad";

/** Maps / review search query from the registered office address in this project. */
export function buildOfficeMapsQuery(address: string = OFFICE_FULL): string {
  return `Global Roots Consultants, ${address}`;
}

export function buildGoogleMapsEmbedSrc(address: string = OFFICE_FULL): string {
  const q = encodeURIComponent(buildOfficeMapsQuery(address));
  return `https://maps.google.com/maps?q=${q}&z=16&hl=en&output=embed`;
}

export function buildGoogleMapsDirectionsUrl(address: string = OFFICE_FULL): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(buildOfficeMapsQuery(address))}`;
}

export function buildGoogleMapsSearchUrl(address: string = OFFICE_FULL): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildOfficeMapsQuery(address))}`;
}

/** Existing contact details from contact page + site footer. */
export const siteContact = {
  brandName: "Global Roots Consultants",
  phone: {
    display: formatPakistanMobileDisplay(WHATSAPP_E164_DIGITS),
    href: `tel:+${WHATSAPP_E164_DIGITS}`,
    placeholder: false,
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
    fullDisplay: OFFICE_FULL,
    /** Opens Google Maps search for this office. */
    href: buildGoogleMapsSearchUrl(OFFICE_FULL),
    embedSrc: buildGoogleMapsEmbedSrc(OFFICE_FULL),
    directionsUrl: buildGoogleMapsDirectionsUrl(OFFICE_FULL),
  },
  whatsapp: {
    display: formatPakistanMobileDisplay(WHATSAPP_E164_DIGITS),
    /** Digits only — never include spaces or a leading 0 in the URL. */
    e164Digits: WHATSAPP_E164_DIGITS,
    href: buildWhatsAppUrl(WHATSAPP_E164_DIGITS, WHATSAPP_PREFILL_MESSAGE),
    prefillMessage: WHATSAPP_PREFILL_MESSAGE,
    placeholder: false,
  },
  /**
   * Google Business Profile integration.
   * No Place ID is stored in this repo — do not invent ratings or review cards.
   * Search URL is address-based until a verified Place ID is supplied.
   */
  googleBusiness: {
    placeId: null as string | null,
    searchUrl: buildGoogleMapsSearchUrl(OFFICE_FULL),
    /** Direct write-a-review requires a Place ID (`placeid` query). */
    writeReviewUrl: null as string | null,
    rating: null as number | null,
    reviewCount: null as number | null,
  },
  hours: "Mon–Sat, 10:00–19:00",
  registration: "SECP Registered",
} as const;

/**
 * Shared social-channel configuration used by the utility bar,
 * mobile navigation drawer, and footer.
 *
 * Icons only render when href is non-empty.
 *
 * Official Global Roots Consultants Facebook / Instagram / LinkedIn / YouTube / TikTok
 * profile URLs were not found in the repo or verified public listings — leave empty
 * until the business provides them. Do not invent usernames.
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

/** Follow-us platforms excluding WhatsApp (shown as its own contact action). */
export function getFollowUsSocialLinks(): SocialLink[] {
  return getConfiguredSocialLinks().filter((link) => link.id !== "whatsapp");
}
