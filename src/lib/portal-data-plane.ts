/**
 * Production data-plane integrity helpers (Phase 1).
 * Pure functions — mock CRM is demo-session only; never substitute fixtures for Supabase.
 */

export type SessionSource = "supabase" | "demo";

/** Demo fixtures may be served only for explicitly authorized demo sessions. */
export function isMockCrmAllowed(source: SessionSource): boolean {
  return source === "demo";
}

/**
 * List payload for mock-backed CRM reads.
 * Supabase sessions get an empty list — never demo rows as a silent fallback.
 */
export function crmListOrEmpty<T>(source: SessionSource, demoRows: T[]): T[] {
  return isMockCrmAllowed(source) ? demoRows : [];
}

/** Single-record CRM read: null when live plane has no mock-backed implementation. */
export function crmRecordOrNull<T>(source: SessionSource, demoRow: T | null | undefined): T | null {
  if (!isMockCrmAllowed(source)) return null;
  return demoRow ?? null;
}

/**
 * Activity for one student only — never fall back to another student's timeline.
 */
export function activityForStudent<T>(
  activityByStudentId: Record<string, T[] | undefined>,
  studentId: string,
): T[] {
  const rows = activityByStudentId[studentId];
  return Array.isArray(rows) ? rows : [];
}

/** Map dashboard Approve/Reject onto the shared queue review actions. */
export function dashboardReviewToQueueAction(
  action: "Approved" | "Rejected",
): { action: "approve" | "reject"; note?: string } {
  if (action === "Approved") return { action: "approve" };
  return { action: "reject", note: "Rejected during officer review." };
}

/** Demo-session chrome is driven by the trusted session source, not client flags alone. */
export function shouldShowDemoSessionIndicator(source: SessionSource | null | undefined): boolean {
  return source === "demo";
}