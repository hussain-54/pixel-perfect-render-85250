/**
 * Counsellor → Admission handover authorization and prerequisites.
 * Handover is a counselling workflow action (not admissions Edit).
 */

import type { AssessmentSaveInput } from "@/types/student-profile";

/** Module used for initiating handover (matches counsellor matrix Full on counselling). */
export const HANDOVER_INITIATE_MODULE = "counselling" as const;
export const HANDOVER_INITIATE_MINIMUM = 2 as const;

/** Module used for the admission handover queue. */
export const HANDOVER_QUEUE_MODULE = "admissions" as const;
/** View submitted handovers (counsellors have admissions View). */
export const HANDOVER_QUEUE_VIEW_MINIMUM = 1 as const;
/** Accept/return handovers (Admission Team / Manager Edit+). */
export const HANDOVER_QUEUE_MUTATE_MINIMUM = 2 as const;

export const ELIGIBILITY_OUTCOMES = [
  "Good Fit",
  "Borderline",
  "Not Ready",
  "Pending Review",
] as const;

export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

export function isEligibilityOutcome(value: string): value is EligibilityOutcome {
  return (ELIGIBILITY_OUTCOMES as readonly string[]).includes(value.trim());
}

/**
 * Save validation — eligibility outcome is required; other fields may be empty
 * until the counsellor completes them (do not invent mandatory academic fields).
 */
export function validateAssessmentForSave(input: Pick<AssessmentSaveInput, "eligibility" | "applicationTarget">): {
  ok: true;
} | { ok: false; message: string; missing: string[] } {
  const missing: string[] = [];
  const eligibility = input.eligibility?.trim() ?? "";
  if (!eligibility) {
    missing.push("eligibility outcome");
  } else if (!isEligibilityOutcome(eligibility)) {
    return {
      ok: false,
      message: `Select a valid eligibility outcome (${ELIGIBILITY_OUTCOMES.join(", ")}).`,
      missing: ["eligibility outcome"],
    };
  }
  if (
    typeof input.applicationTarget !== "number" ||
    input.applicationTarget < 0 ||
    input.applicationTarget > 50
  ) {
    return {
      ok: false,
      message: "Application target must be between 0 and 50.",
      missing: ["application target"],
    };
  }
  if (missing.length) {
    return {
      ok: false,
      message: `Complete the eligibility assessment before saving. Missing: ${missing.join(", ")}.`,
      missing,
    };
  }
  return { ok: true };
}

/** Handover requires a saved assessment with a real eligibility outcome (not blank). */
export function assessmentSatisfiesHandover(input: {
  hasAssessmentRow: boolean;
  eligibilitySummary: string | null | undefined;
}): { ok: true } | { ok: false; message: string } {
  if (!input.hasAssessmentRow) {
    return {
      ok: false,
      message: "Save the eligibility assessment before handing this student over.",
    };
  }
  const summary = input.eligibilitySummary?.trim() ?? "";
  if (!summary) {
    return {
      ok: false,
      message:
        "Save an eligibility outcome (Good Fit, Borderline, Not Ready, or Pending Review) before handover.",
    };
  }
  return { ok: true };
}

export function handoverDuplicateMessage(): string {
  return "A handover is already in the Admission Team queue for this student.";
}
