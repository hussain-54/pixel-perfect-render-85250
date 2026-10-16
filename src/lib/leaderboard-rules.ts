/**
 * Consultant leaderboard — pure period windows, counts, and ranking.
 * No invented scores or fake period multipliers. null value = Not available.
 */
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { canViewModule, type BusinessRole } from "@/lib/business-permissions";

export const LEADERBOARD_PERIODS = ["week", "month", "quarter", "year", "all"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const LEADERBOARD_METRICS = [
  "students",
  "appointmentsCompleted",
  "applicationsSubmitted",
  "offers",
  "visaCases",
  "completedCases",
] as const;
export type LeaderboardMetricKey = (typeof LEADERBOARD_METRICS)[number];

export const LEADERBOARD_METRIC_LABELS: Record<LeaderboardMetricKey, string> = {
  students: "Active students",
  appointmentsCompleted: "Appointments completed",
  applicationsSubmitted: "Applications submitted",
  offers: "Offers received",
  visaCases: "Visa cases",
  completedCases: "Cases completed",
};

export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  quarter: "Last 90 days",
  year: "Last 365 days",
  all: "All time",
};

/** Snapshot metrics ignore the period filter (no reliable event timestamp). */
export function metricIsPeriodAware(metric: LeaderboardMetricKey): boolean {
  return (
    metric === "appointmentsCompleted" ||
    metric === "applicationsSubmitted" ||
    metric === "offers" ||
    metric === "visaCases"
  );
}

export function isLeaderboardPeriod(value: unknown): value is LeaderboardPeriod {
  return typeof value === "string" && (LEADERBOARD_PERIODS as readonly string[]).includes(value);
}

export function isLeaderboardMetric(value: unknown): value is LeaderboardMetricKey {
  return typeof value === "string" && (LEADERBOARD_METRICS as readonly string[]).includes(value);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(day: string, delta: number): string {
  const ms = Date.parse(`${day}T12:00:00.000Z`) + delta * 86_400_000;
  return dayKey(new Date(ms));
}

/**
 * Inclusive date window (YYYY-MM-DD). `start: null` means unbounded past.
 */
export function resolveLeaderboardWindow(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): { start: string | null; end: string } {
  const end = dayKey(now);
  if (period === "all") return { start: null, end };
  const days =
    period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
  return { start: addUtcDays(end, -(days - 1)), end };
}

export function parseLeaderboardDateKey(raw: string | null | undefined): string | null {
  if (!raw || raw === "—" || raw === "-") return null;
  const t = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return dayKey(new Date(t));
}

export function inLeaderboardDateRange(
  dateKey: string | null,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!dateKey) return false;
  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;
  return true;
}

export function countByConsultantId(
  consultantIds: Array<string | null | undefined>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of consultantIds) {
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/** Submitted = has submitted_at, or an explicit post-submit stage. */
export function isSubmittedApplication(input: {
  stage: string | null | undefined;
  submittedAt: string | null | undefined;
}): boolean {
  if (input.submittedAt) return true;
  const stage = input.stage ?? "";
  return stage === "submitted" || stage === "offer_received";
}

export type LeaderboardConsultant = {
  id: string;
  name: string;
  department: string;
  status: "Active" | "Inactive";
};

export type LeaderboardMetricBundle = {
  /** null = query failed / source missing for that metric */
  students: Map<string, number> | null;
  appointmentsCompleted: Map<string, number> | null;
  applicationsSubmitted: Map<string, number> | null;
  offers: Map<string, number> | null;
  visaCases: Map<string, number> | null;
  completedCases: Map<string, number> | null;
};

export type LeaderboardRow = {
  consultantId: string;
  name: string;
  department: string;
  status: "Active" | "Inactive";
  value: number | null;
  rank: number | null;
};

/**
 * Rank consultants by the selected metric. Unavailable metrics → value null, sorted last.
 * Ties share the same rank (competition ranking: 1,2,2,4).
 */
export function buildLeaderboardRows(
  consultants: LeaderboardConsultant[],
  metrics: LeaderboardMetricBundle,
  metric: LeaderboardMetricKey,
): LeaderboardRow[] {
  const source = metrics[metric];
  const rows: LeaderboardRow[] = consultants.map((c) => ({
    consultantId: c.id,
    name: c.name,
    department: c.department,
    status: c.status,
    value: source == null ? null : (source.get(c.id) ?? 0),
    rank: null,
  }));

  rows.sort((a, b) => {
    if (a.value == null && b.value == null) return a.name.localeCompare(b.name);
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });

  let lastValue: number | null | undefined = undefined;
  let lastRank = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (row.value == null) {
      row.rank = null;
      continue;
    }
    if (lastValue === undefined || row.value !== lastValue) {
      lastRank = i + 1;
      lastValue = row.value;
    }
    row.rank = lastRank;
  }
  return rows;
}

export function formatLeaderboardValue(value: number | null): string {
  if (value == null) return "Not available";
  return String(value);
}

/**
 * Firm-wide consultant ranking exposes cross-desk aggregates.
 * Restricted to technical admins and managers (not ordinary counsellor desks).
 */
export function canViewConsultantLeaderboard(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "manager") {
    return canViewModule("manager", "reports") && canViewModule("manager", "students");
  }
  return false;
}

export function leaderboardMetricAttribution(metric: LeaderboardMetricKey): string {
  switch (metric) {
    case "students":
      return "Active (non-archived) students by assigned_consultant_id. Period filter does not apply.";
    case "appointmentsCompleted":
      return "Appointments with status=completed by consultant_id, filtered on scheduled_at.";
    case "applicationsSubmitted":
      return "Applications with a submission signal by owned_by_consultant_id, filtered on submitted_at (fallback created_at).";
    case "offers":
      return "Offers attributed via applications.owned_by_consultant_id (fallback student assigned consultant), filtered on offer_date (fallback created_at).";
    case "visaCases":
      return "Visa milestones attributed via application owner when present, else student assigned consultant; filtered on filed_at (fallback created_at).";
    case "completedCases":
      return "Students with journey_stage=completed by assigned_consultant_id. Period filter does not apply (no completed_at column).";
  }
}

/** Aggregate offers/visa events onto consultant ids using attribution maps. */
export function attributeEventsToConsultants(
  events: Array<{ subjectId: string; dateRaw: string | null | undefined }>,
  subjectToConsultant: Map<string, string | null | undefined>,
  start: string | null,
  end: string,
): Map<string, number> {
  const ids: Array<string | null> = [];
  for (const ev of events) {
    const dateKey = parseLeaderboardDateKey(ev.dateRaw);
    if (!inLeaderboardDateRange(dateKey, start, end)) continue;
    const consultantId = subjectToConsultant.get(ev.subjectId) ?? null;
    ids.push(consultantId ?? null);
  }
  return countByConsultantId(ids);
}

export function filterTimedConsultantEvents(
  events: Array<{ consultantId: string | null | undefined; dateRaw: string | null | undefined }>,
  start: string | null,
  end: string,
): Map<string, number> {
  const ids: Array<string | null> = [];
  for (const ev of events) {
    const dateKey = parseLeaderboardDateKey(ev.dateRaw);
    if (!inLeaderboardDateRange(dateKey, start, end)) continue;
    ids.push(ev.consultantId ?? null);
  }
  return countByConsultantId(ids);
}
