/**
 * Map scholarships DB rows ↔ UI Scholarship type.
 * Offers.scholarship_note is unrelated and must not be rewritten here.
 */
import type { FundingType, Scholarship, ScholarshipStatus } from "@/types";
import type {
  ScholarshipFundingTypeDb,
  ScholarshipRow,
  ScholarshipStatusDb,
} from "@/types/database";

export const FUNDING_UI_TO_DB: Record<FundingType, ScholarshipFundingTypeDb> = {
  "Fully Funded": "fully_funded",
  "Partial Funding": "partial_funding",
  "Tuition Waiver": "tuition_waiver",
};

export const FUNDING_DB_TO_UI: Record<ScholarshipFundingTypeDb, FundingType> = {
  fully_funded: "Fully Funded",
  partial_funding: "Partial Funding",
  tuition_waiver: "Tuition Waiver",
};

export function mapFundingTypeDb(value: string | null | undefined): FundingType {
  if (value === "fully_funded") return "Fully Funded";
  if (value === "tuition_waiver") return "Tuition Waiver";
  return "Partial Funding";
}

export function mapFundingTypeUi(value: string | null | undefined): ScholarshipFundingTypeDb | null {
  if (value === "Fully Funded" || value === "fully_funded") return "fully_funded";
  if (value === "Tuition Waiver" || value === "tuition_waiver") return "tuition_waiver";
  if (value === "Partial Funding" || value === "partial_funding") return "partial_funding";
  return null;
}

export function mapScholarshipStatusDb(value: string | null | undefined): ScholarshipStatus {
  if (value === "published" || value === "archived") return value;
  return "draft";
}

export function isScholarshipStatus(value: unknown): value is ScholarshipStatusDb {
  return value === "draft" || value === "published" || value === "archived";
}

export function mapScholarshipRow(
  row: ScholarshipRow,
  universityName?: string | null,
): Scholarship {
  return {
    id: row.id,
    name: row.title,
    country: row.country?.trim() || "—",
    level: row.study_level?.trim() || "—",
    funding: mapFundingTypeDb(row.funding_type),
    field: row.field_of_study?.trim() || "—",
    eligibility: row.eligibility?.trim() || "—",
    deadline: row.closes_on ?? "—",
    description: row.description,
    provider: row.provider,
    universityId: row.university_id,
    universityName: universityName?.trim() || null,
    fundingDescription: row.funding_description,
    opensOn: row.opens_on,
    applicationUrl: row.application_url,
    status: mapScholarshipStatusDb(row.status),
    updatedAt: row.updated_at,
  };
}

/** Public card must never expose draft/archived (defense if a row slips through). */
export function isPubliclyVisibleScholarship(s: Pick<Scholarship, "status">): boolean {
  return s.status === "published";
}
