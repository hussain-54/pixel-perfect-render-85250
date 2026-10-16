/**
 * Admin Students roster data-path helpers.
 * Live Supabase must use the officer directory (not portalGetStudents / crmListOrEmpty).
 */
import type { StudentDirectoryFilters, StudentDirectoryResult } from "@/types/portal-officer";

/** Directory API caps pageSize at 50 (see buildStudentsDirectoryFromDb / portal-officer). */
export const ADMIN_ROSTER_PAGE_SIZE = 50;

/** Filters for the Admin roster table (no client-side mock CRM). */
export function adminStudentsRosterFilters(page = 1): StudentDirectoryFilters {
  return {
    page: Math.max(page, 1),
    pageSize: ADMIN_ROSTER_PAGE_SIZE,
    archived: false,
  };
}

export function adminStudentsRosterQueryKey(filters: StudentDirectoryFilters): unknown[] {
  return ["admin", "students-directory", filters];
}

/** True when the Admin page must not use getStudents / crmListOrEmpty. */
export function adminRosterUsesStudentsDirectory(): true {
  return true;
}

export type AdminRosterViewState =
  | { kind: "loading" }
  | { kind: "permission"; message: string }
  | { kind: "error"; message: string }
  | { kind: "empty"; total: number }
  | { kind: "rows"; result: StudentDirectoryResult };

/**
 * Map react-query status + directory payload to distinct UI states.
 * Never treat thrown errors as an empty roster.
 */
export function resolveAdminRosterViewState(input: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  data: StudentDirectoryResult | undefined;
}): AdminRosterViewState {
  if (input.isLoading) return { kind: "loading" };
  if (input.isError) {
    const msg = input.errorMessage.trim() || "Something went wrong.";
    const lower = msg.toLowerCase();
    if (lower.includes("403") || lower.includes("permission")) {
      return { kind: "permission", message: msg };
    }
    return { kind: "error", message: msg };
  }
  const result = input.data;
  if (!result) {
    return { kind: "error", message: "Student directory unavailable." };
  }
  if (result.rows.length === 0) {
    return { kind: "empty", total: result.total };
  }
  return { kind: "rows", result };
}
