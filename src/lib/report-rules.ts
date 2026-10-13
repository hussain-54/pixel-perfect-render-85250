/**
 * Pure reporting helpers — unavailable vs zero, date filters, export safety, section auth.
 */
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { canViewModule, hasMinPermission, type BusinessRole } from "@/lib/business-permissions";
import { canViewHr, canMutateHr } from "@/lib/hr-rules";
import { canViewMarketing } from "@/lib/marketing-rules";
import { canViewOfficeOps } from "@/lib/ops-rules";
import { canViewAdminFinanceDetails } from "@/lib/admin-ops-overview";
import { JOURNEY_STAGE_ORDER } from "@/lib/journey-stage";

/** null = unavailable (not zero). */
export type MetricCount = number | null;

export type ReportSectionKey =
  "journey" | "admissions" | "finance" | "hr" | "marketing" | "operations";

export function formatMetricCount(value: MetricCount): string {
  if (value === null) return "N/A";
  return String(value);
}

export function isUnavailable(value: MetricCount): boolean {
  return value === null;
}

export function parseReportDateKey(raw: string | null | undefined): string | null {
  if (!raw || raw === "—" || raw === "-") return null;
  const t = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function inDateRange(
  dateKey: string | null,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!dateKey) return false;
  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;
  return true;
}

export function countByKey<T extends string>(
  rows: Array<{ key: T | null | undefined }>,
  knownKeys?: readonly T[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (knownKeys) for (const k of knownKeys) out[k] = 0;
  for (const r of rows) {
    if (r.key == null || r.key === "") continue;
    out[r.key] = (out[r.key] ?? 0) + 1;
  }
  return out;
}

export function registrationTrendByDay(
  dates: Array<string | null | undefined>,
  start: string | null | undefined,
  end: string | null | undefined,
): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const raw of dates) {
    const key = parseReportDateKey(raw);
    if (!key || !inDateRange(key, start ?? null, end ?? null)) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function workloadByAssignee(
  rows: Array<{ assigneeId: string | null | undefined }>,
): Array<{ assigneeId: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.assigneeId) continue;
    map.set(r.assigneeId, (map.get(r.assigneeId) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([assigneeId, count]) => ({ assigneeId, count }))
    .sort((a, b) => b.count - a.count || a.assigneeId.localeCompare(b.assigneeId));
}

export function emptyJourneyStageCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of JOURNEY_STAGE_ORDER) out[s] = 0;
  return out;
}

/**
 * Spreadsheet formula injection guard for CSV cells.
 * Prefixes values that Excel/Sheets would treat as formulas.
 */
export function sanitizeSpreadsheetCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

export function canViewReportsPortal(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "manager") return true;
  return canViewModule(input.businessRole, "reports");
}

export function canExportReports(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  return canViewReportsPortal(input);
}

export function reportSectionAccess(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): Record<ReportSectionKey, boolean> {
  const finance = canViewAdminFinanceDetails(input);
  return {
    journey:
      rolesAtLeastAdmin(input.appRole) ||
      input.businessRole === "manager" ||
      canViewModule(input.businessRole, "students"),
    admissions:
      rolesAtLeastAdmin(input.appRole) ||
      input.businessRole === "manager" ||
      canViewModule(input.businessRole, "admissions") ||
      canViewModule(input.businessRole, "documents"),
    finance,
    hr: canViewHr(input),
    marketing: canViewMarketing(input),
    // Office Ops portal only — Accounts use Finance section, not ops purchase/sales.
    operations: canViewOfficeOps(input),
  };
}

export function canViewHrEmployeeSummaries(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  return canMutateHr(input) || hasMinPermission(input.businessRole, "hr_attendance", 2);
}

/** Claimed payments are never counted as verified. */
export function signupFeeStatusBuckets(statuses: string[]): {
  claimedAwaiting: number;
  verified: number;
  rejected: number;
  unpaid: number;
  waived: number;
} {
  let claimedAwaiting = 0;
  let verified = 0;
  let rejected = 0;
  let unpaid = 0;
  let waived = 0;
  for (const s of statuses) {
    if (s === "claimed") claimedAwaiting += 1;
    else if (s === "verified") verified += 1;
    else if (s === "rejected") rejected += 1;
    else if (s === "unpaid") unpaid += 1;
    else if (s === "waived") waived += 1;
  }
  return { claimedAwaiting, verified, rejected, unpaid, waived };
}

export function universityFeeByKindAndStatus(
  rows: Array<{ kind: string; status: string }>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!out[r.kind]) out[r.kind] = {};
    out[r.kind]![r.status] = (out[r.kind]![r.status] ?? 0) + 1;
  }
  return out;
}
