/**
 * Pure validation / authorization mirrors for scholarships catalog.
 * Server + RLS remain authoritative.
 */
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import type { FundingType, ScholarshipStatus } from "@/types";
import { mapFundingTypeUi, isScholarshipStatus } from "./scholarship-mappers";

export type ScholarshipWriteInput = {
  title: string;
  description?: string;
  provider?: string;
  universityId?: string | null;
  country?: string;
  studyLevel?: string;
  fieldOfStudy?: string;
  funding?: FundingType | string;
  fundingDescription?: string;
  eligibility?: string;
  opensOn?: string | null;
  closesOn?: string | null;
  applicationUrl?: string | null;
  status?: ScholarshipStatus | string;
};

export function canViewScholarshipStaff(input: {
  appRole: AppRole;
}): boolean {
  return rolesAtLeastAdmin(input.appRole) || input.appRole === "consultant";
}

export function canMutateScholarshipStaff(input: {
  appRole: AppRole;
}): boolean {
  // Matrix edit is enforced via requireModulePermission(admissions, 2) on server.
  return rolesAtLeastAdmin(input.appRole) || input.appRole === "consultant";
}

export function studentMayMutateScholarships(): boolean {
  return false;
}

export function validateScholarshipWrite(
  input: ScholarshipWriteInput,
): { ok: true; normalized: NormalizedScholarshipWrite } | { ok: false; error: string } {
  const title = input.title?.trim() ?? "";
  if (title.length < 2) return { ok: false, error: "Title is required (min 2 characters)." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };

  const funding = mapFundingTypeUi(input.funding ?? "Partial Funding");
  if (!funding) return { ok: false, error: "Invalid funding type." };

  const statusRaw = input.status ?? "draft";
  if (!isScholarshipStatus(statusRaw)) return { ok: false, error: "Invalid status." };

  const opensOn = normalizeDate(input.opensOn);
  const closesOn = normalizeDate(input.closesOn);
  if (opensOn === "invalid" || closesOn === "invalid") {
    return { ok: false, error: "Dates must be YYYY-MM-DD or empty." };
  }
  if (opensOn && closesOn && closesOn < opensOn) {
    return { ok: false, error: "Closing date must be on or after opening date." };
  }

  const applicationUrl = (input.applicationUrl ?? "").trim();
  if (applicationUrl && !/^https?:\/\//i.test(applicationUrl)) {
    return { ok: false, error: "Application URL must start with http:// or https://." };
  }

  return {
    ok: true,
    normalized: {
      title,
      description: (input.description ?? "").trim(),
      provider: (input.provider ?? "").trim(),
      universityId: input.universityId?.trim() || null,
      country: (input.country ?? "").trim(),
      studyLevel: (input.studyLevel ?? "").trim(),
      fieldOfStudy: (input.fieldOfStudy ?? "").trim(),
      fundingType: funding,
      fundingDescription: (input.fundingDescription ?? "").trim(),
      eligibility: (input.eligibility ?? "").trim(),
      opensOn,
      closesOn,
      applicationUrl: applicationUrl || null,
      status: statusRaw,
    },
  };
}

export type NormalizedScholarshipWrite = {
  title: string;
  description: string;
  provider: string;
  universityId: string | null;
  country: string;
  studyLevel: string;
  fieldOfStudy: string;
  fundingType: "fully_funded" | "partial_funding" | "tuition_waiver";
  fundingDescription: string;
  eligibility: string;
  opensOn: string | null;
  closesOn: string | null;
  applicationUrl: string | null;
  status: ScholarshipStatus;
};

function normalizeDate(value: string | null | undefined): string | null | "invalid" {
  if (value == null || value === "") return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "invalid";
  return v;
}

export type ScholarshipListFilters = {
  q?: string;
  country?: string;
  level?: string;
  funding?: string;
  status?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export const SCHOLARSHIP_PAGE_SIZE = 25;

export function resolveScholarshipPage(filters: ScholarshipListFilters): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize ?? SCHOLARSHIP_PAGE_SIZE)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
