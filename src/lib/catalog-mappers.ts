/**
 * Map live universities / programs rows onto existing UI catalog types.
 */
import type { University } from "@/types";
import type { Tables } from "@/types/database";

type UniversityRow = Tables<"universities">;
type ProgramRow = Tables<"programs">;

export type CatalogProgramView = {
  id: string;
  universityId: string;
  universityName: string;
  name: string;
  level: string;
  duration: string;
  tuitionFee: string;
};

export function mapUniversityWithPrograms(
  uni: UniversityRow,
  programs: ProgramRow[],
): University {
  const levels = [
    ...new Set(
      programs
        .map((p) => p.level?.trim())
        .filter((x): x is string => Boolean(x)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const programNames = programs.map((p) => p.name).filter(Boolean);
  return {
    id: uni.id,
    name: uni.name,
    country: uni.country,
    city: uni.city?.trim() || "—",
    levels,
    programs: programNames,
    /** No scholarships table / flag on universities — never invent true. */
    scholarship: false,
    /** No ranking column in DB — surface website when present for staff. */
    ranking: uni.website?.trim() || "—",
  };
}

export function mapProgramRow(
  row: ProgramRow,
  universityNameById: Map<string, string>,
): CatalogProgramView {
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: universityNameById.get(row.university_id)?.trim() || "—",
    name: row.name,
    level: row.level?.trim() || "—",
    duration: row.duration?.trim() || "—",
    tuitionFee: row.tuition_fee?.trim() || "—",
  };
}

/** Status note for UI/docs — live table exists; empty list is not a fixture fallback. */
export const SCHOLARSHIPS_MIGRATION_PENDING =
  "Scholarships catalog is live (20261016010000 + 20261016020000). Empty lists mean no published/matching rows — no demo fallback.";

/** @deprecated Use SCHOLARSHIPS_MIGRATION_PENDING. */
export const SCHOLARSHIPS_SCHEMA_GAP = SCHOLARSHIPS_MIGRATION_PENDING;
