import { DEADLINE_ALERT_DAYS, DOCUMENT_EXPIRY_ALERT_DAYS, TASK_TIMEZONE } from "@/types/tasks-ops";

/** Calendar day key (yyyy-mm-dd) in the portal timezone. */
export function dayKeyInPortalTz(input: string | Date | null | undefined, timeZone = TASK_TIMEZONE): string | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayKey(timeZone = TASK_TIMEZONE): string {
  return dayKeyInPortalTz(new Date(), timeZone)!;
}

/** Inclusive end of "this week" Sunday (local portal tz day keys via UTC noon probes). */
export function weekRangeKeys(timeZone = TASK_TIMEZONE): { start: string; end: string } {
  const today = todayKey(timeZone)!;
  const [y, m, d] = today.split("-").map(Number);
  const anchor = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  const dow = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(anchor);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const offset = map[dow] ?? 0;
  const startDate = new Date(anchor);
  startDate.setUTCDate(startDate.getUTCDate() - offset);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  return {
    start: dayKeyInPortalTz(startDate, timeZone)!,
    end: dayKeyInPortalTz(endDate, timeZone)!,
  };
}

export function daysUntilDateKey(dateKey: string | null | undefined, timeZone = TASK_TIMEZONE): number | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const today = todayKey(timeZone)!;
  const t0 = Date.parse(`${today}T12:00:00Z`);
  const t1 = Date.parse(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return Math.round((t1 - t0) / 86_400_000);
}

export function isWithinAlertWindow(dateKey: string | null | undefined, windowDays: number): boolean {
  const left = daysUntilDateKey(dateKey);
  return left !== null && left >= 0 && left <= windowDays;
}

export function isPastOrMissingDue(dueAt: string | null | undefined): boolean {
  const key = dayKeyInPortalTz(dueAt);
  if (!key) return false;
  const left = daysUntilDateKey(key);
  return left !== null && left < 0;
}

export function isDueToday(dueAt: string | null | undefined): boolean {
  const key = dayKeyInPortalTz(dueAt);
  return Boolean(key && key === todayKey());
}

export { DEADLINE_ALERT_DAYS, DOCUMENT_EXPIRY_ALERT_DAYS };