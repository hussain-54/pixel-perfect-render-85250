/**
 * Front Desk intake form catalogs — UI options only (text columns / enums).
 * Does not invent university/program UUID links.
 */

export const INTAKE_PAKISTAN_CITIES = [
  "Islamabad",
  "Rawalpindi",
  "Lahore",
  "Karachi",
  "Peshawar",
  "Haripur",
  "Abbottabad",
  "Faisalabad",
  "Multan",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Gujrat",
  "Sargodha",
  "Bahawalpur",
  "Mardan",
  "Mingora",
  "Sukkur",
  "Larkana",
  "Other",
] as const;

export const INTAKE_DESTINATIONS = [
  "Germany",
  "Italy",
  "France",
  "Hungary",
  "Lithuania",
  "Finland",
  "Sweden",
  "Ireland",
  "United Kingdom",
  "Austria",
  "Netherlands",
  "Belgium",
  "Canada",
  "Australia",
  "New Zealand",
  "United States",
  "Malaysia",
  "Poland",
  "Czech Republic",
  "Denmark",
  "Portugal",
  "Spain",
  "Other",
] as const;

export const INTAKE_PROGRAMMES = [
  "Computer Science",
  "Software Engineering",
  "Artificial Intelligence",
  "Data Science",
  "Cybersecurity",
  "Information Technology",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Business Administration",
  "Accounting & Finance",
  "Economics",
  "Medicine / MBBS",
  "Nursing",
  "Public Health",
  "Law",
  "Psychology",
  "Architecture",
  "Other",
] as const;

export const INTAKE_STUDY_LEVELS = [
  "Foundation / Pathway",
  "Diploma",
  "Bachelor's",
  "Master's",
  "MPhil / Research",
  "PhD / Doctorate",
  "Other",
] as const;

export const INTAKE_SEASONS = [
  "Winter",
  "Summer",
  "Spring",
  "Autumn",
  "Other",
] as const;

export type IntakeSeason = (typeof INTAKE_SEASONS)[number];

/** Inquiry channels — must match public.inquiry_channel after …17110000. */
export const INTAKE_INQUIRY_CHANNELS = [
  { value: "physical", label: "Physical Visit" },
  { value: "online", label: "Online" },
  { value: "phone", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral" },
  { value: "education_expo", label: "Education Expo" },
  { value: "social_media", label: "Social Media" },
  { value: "other", label: "Other" },
] as const;

export type IntakeInquiryChannelValue = (typeof INTAKE_INQUIRY_CHANNELS)[number]["value"];

/** Coarse mapping when extended enum values are not yet applied on the database. */
export function mapInquiryChannelForLegacyDb(
  channel: IntakeInquiryChannelValue | "",
): "physical" | "online" | null {
  if (!channel) return null;
  if (channel === "physical") return "physical";
  return "online";
}

export const INTAKE_INQUIRY_SOURCES = [
  "Google search",
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Friend / family referral",
  "Campus / school counsellor",
  "Education expo booth",
  "Walk-in / signboard",
  "WhatsApp broadcast",
  "Other",
] as const;

export const INTAKE_FEE_PAYMENT_METHODS = [
  "Cash",
  "Bank transfer",
  "JazzCash",
  "Easypaisa",
  "Card",
  "Other",
] as const;

export function intakeYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y, y + 1, y + 2, y + 3];
}

/** Map season + year → date for students.intake_date (date column). */
export function intakeSeasonYearToDate(
  season: IntakeSeason | "",
  year: number | "",
): string | null {
  if (!season || !year || !Number.isFinite(Number(year))) return null;
  const y = Number(year);
  const monthDay: Record<IntakeSeason, string> = {
    Winter: "01-15",
    Spring: "03-15",
    Summer: "06-15",
    Autumn: "09-15",
    Other: "01-01",
  };
  return `${y}-${monthDay[season]}`;
}

export function formatIntakeLabel(season: IntakeSeason | "", year: number | ""): string {
  if (!season || !year) return "";
  return `${season} ${year}`;
}

/** Resolve catalog value or custom Other text. */
export function resolveCatalogOrOther(
  selected: string,
  otherText: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const sel = selected.trim();
  if (!sel) return { ok: false, error: "Select a value." };
  if (sel === "Other") {
    const custom = otherText.trim();
    if (!custom) return { ok: false, error: "Enter a custom value for Other." };
    return { ok: true, value: custom };
  }
  return { ok: true, value: sel };
}

export function isValidIntakeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Lightweight phone check — digits, spaces, +, length 8–20. */
export function isValidIntakePhone(phone: string): boolean {
  const t = phone.trim();
  if (t.length < 8 || t.length > 20) return false;
  return /^[+\d][\d\s()-]*\d$/.test(t);
}
