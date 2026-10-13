import type { JourneyStage } from "@/types/database";

/** Forward-only order used when advancing students.journey_stage from workflow events. */
export const JOURNEY_STAGE_ORDER: JourneyStage[] = [
  "profile_submitted",
  "consultation_completed",
  "documents_submitted",
  "documents_under_review",
  "university_shortlisting",
  "application_submitted",
  "offer_received",
  "visa_preparation",
  "visa_submitted",
  "visa_approved",
  "travel_preparation",
  "completed",
];

export function journeyStageRank(stage: JourneyStage | string | null | undefined): number {
  if (!stage) return -1;
  return JOURNEY_STAGE_ORDER.indexOf(stage as JourneyStage);
}

/** Returns target only when it is strictly ahead of current (no regressions). */
export function nextJourneyStageIfAdvanced(
  current: JourneyStage | string | null | undefined,
  target: JourneyStage,
): JourneyStage | null {
  const curRank = journeyStageRank(current);
  const targetRank = journeyStageRank(target);
  if (targetRank < 0) return null;
  if (targetRank > curRank) return target;
  return null;
}
