/**
 * Pure HR business rules — testable without Supabase.
 * Server handlers remain authoritative; matrix levels are evaluated separately.
 */
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  canEditModule,
  canFullyApproveModule,
  canViewModule,
  type BusinessRole,
} from "@/lib/business-permissions";

export type HrEmploymentStatus = "active" | "on_leave" | "terminated";
export type HrAttendanceStatus = "present" | "absent" | "late" | "leave" | "holiday";
export type HrLeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

const EMPLOYMENT_TRANSITIONS: Record<HrEmploymentStatus, HrEmploymentStatus[]> = {
  active: ["on_leave", "terminated"],
  on_leave: ["active", "terminated"],
  terminated: [], // rehire only via Super Admin (checked separately)
};

export function canViewHr(input: { appRole: AppRole; businessRole: BusinessRole | null }): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "hr_system" || input.businessRole === "manager") return true;
  return canViewModule(input.businessRole, "hr_attendance");
}

export function canMutateHr(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "hr_system" || input.businessRole === "manager") return true;
  return canEditModule(input.businessRole, "hr_attendance");
}

export function canDecideLeave(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "hr_system" || input.businessRole === "manager") return true;
  return canFullyApproveModule(input.businessRole, "hr_attendance");
}

/** Only Super Admin may rehire a terminated employee (Admin ≠ Super Admin). */
export function canRehireTerminated(appRole: AppRole): boolean {
  return appRole === "super_admin";
}

export function isValidEmploymentTransition(input: {
  from: HrEmploymentStatus;
  to: HrEmploymentStatus;
  appRole: AppRole;
}): boolean {
  if (input.from === input.to) return true;
  if (input.from === "terminated" && input.to === "active") {
    return canRehireTerminated(input.appRole);
  }
  return EMPLOYMENT_TRANSITIONS[input.from].includes(input.to);
}

export function validateEmployeeCreate(input: {
  employeeCode: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.employeeCode.trim()) return { ok: false, error: "Employee code is required." };
  if (input.employeeCode.trim().length < 2) {
    return { ok: false, error: "Employee code must be at least 2 characters." };
  }
  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    return { ok: false, error: "Full name is required." };
  }
  return { ok: true };
}

export function validateAttendanceDate(
  workDate: string,
  nowIso?: string,
):
  | {
      ok: true;
      date: string;
    }
  | { ok: false; error: string } {
  const trimmed = workDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Work date must be YYYY-MM-DD." };
  }
  const d = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid work date." };
  const now = new Date(nowIso ?? Date.now());
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  if (d.getTime() >= tomorrow.getTime()) {
    return { ok: false, error: "Cannot record attendance for a future date." };
  }
  return { ok: true, date: trimmed };
}

export function validateLeaveRange(
  startDate: string,
  endDate: string,
):
  | {
      ok: true;
    }
  | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: "Leave dates must be YYYY-MM-DD." };
  }
  if (endDate < startDate) return { ok: false, error: "End date must be on or after start date." };
  return { ok: true };
}

export function canDecideLeaveRequest(input: {
  currentStatus: HrLeaveStatus;
  action: "approve" | "reject" | "cancel";
  isOwner: boolean;
  canDecide: boolean;
}): { ok: true; next: HrLeaveStatus } | { ok: false; error: string } {
  if (input.currentStatus !== "pending") {
    return { ok: false, error: "Only pending leave requests can be decided." };
  }
  if (input.action === "cancel") {
    if (!input.isOwner && !input.canDecide) {
      return { ok: false, error: "Not allowed to cancel this leave request." };
    }
    return { ok: true, next: "cancelled" };
  }
  if (!input.canDecide) {
    return { ok: false, error: "Only HR/Manager/Admin may approve or reject leave." };
  }
  return { ok: true, next: input.action === "approve" ? "approved" : "rejected" };
}

export function summarizeAttendance(
  rows: Array<{ status: string }>,
): Record<"present" | "absent" | "late" | "leave" | "holiday" | "other", number> {
  const out = { present: 0, absent: 0, late: 0, leave: 0, holiday: 0, other: 0 };
  for (const r of rows) {
    if (r.status in out) {
      out[r.status as keyof typeof out] += 1;
    } else {
      out.other += 1;
    }
  }
  return out;
}

/** Duplicate attendance for same employee+date is not allowed. */
export function isDuplicateAttendanceKey(
  existingKeys: Array<{ employeeId: string; workDate: string }>,
  employeeId: string,
  workDate: string,
): boolean {
  return existingKeys.some((k) => k.employeeId === employeeId && k.workDate === workDate);
}
