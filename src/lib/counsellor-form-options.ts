/**
 * Counsellor assessment UI catalogs — text fields only (no invented university UUIDs).
 * Reuses Front Desk intake catalogs where the values overlap.
 */

import {
  INTAKE_DESTINATIONS,
  INTAKE_PROGRAMMES,
  INTAKE_SEASONS,
  INTAKE_STUDY_LEVELS,
  formatIntakeLabel,
  intakeSeasonYearToDate,
  intakeYearOptions,
  type IntakeSeason,
} from "@/lib/intake-form-options";
import { ELIGIBILITY_OUTCOMES } from "@/lib/counsellor-handover-rules";

export const COUNSELLOR_DESTINATIONS = INTAKE_DESTINATIONS;
export const COUNSELLOR_PROGRAMMES = INTAKE_PROGRAMMES;
export const COUNSELLOR_STUDY_LEVELS = INTAKE_STUDY_LEVELS;
export const COUNSELLOR_SEASONS = INTAKE_SEASONS;
export const COUNSELLOR_ELIGIBILITY = ELIGIBILITY_OUTCOMES;
export { formatIntakeLabel, intakeSeasonYearToDate, intakeYearOptions };
export type { IntakeSeason };

export const COUNSELLOR_QUALIFICATIONS = [
  "Matric / O-Levels",
  "Intermediate / A-Levels / FSc",
  "Diploma",
  "Bachelor's degree",
  "Master's degree",
  "MPhil",
  "PhD",
  "Other",
] as const;

export const COUNSELLOR_LANGUAGE_TESTS = [
  "IELTS",
  "TOEFL",
  "PTE",
  "Duolingo",
  "Not taken yet",
  "Other",
] as const;

export const COUNSELLOR_FUNDING_SOURCES = [
  "Self / family",
  "Education loan",
  "Scholarship (seeking)",
  "Scholarship (confirmed)",
  "Sponsor / employer",
  "Mixed",
  "Other",
] as const;

/** Parse "Winter 2027" style labels saved in target_intake / preferred_intake. */
export function parseIntakeSeasonYear(stored: string): {
  season: IntakeSeason | "";
  year: number | "";
} {
  const t = stored.trim();
  if (!t) return { season: "", year: "" };
  const m = /^(Winter|Summer|Spring|Autumn|Other)\s+(\d{4})$/i.exec(t);
  if (m?.[1] && m[2]) {
    const raw = m[1];
    const season = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as IntakeSeason;
    const year = Number(m[2]);
    if ((COUNSELLOR_SEASONS as readonly string[]).includes(season) && Number.isFinite(year)) {
      return { season, year };
    }
  }
  return { season: "", year: "" };
}

/** Keep legacy free-text intake when it does not match season+year. */
export function resolveTargetIntakeDisplay(
  season: IntakeSeason | "",
  year: number | "",
  legacy: string,
): string {
  const label = formatIntakeLabel(season, year);
  return label || legacy.trim();
}
