/**
 * Map live consultants (+ profiles) onto the existing Consultant UI type.
 * Metrics beyond active student count are not inventable without extra aggregates.
 */
import type { Consultant } from "@/types";
import type { ConsultantRow } from "@/types/database";

export type ConsultantProfileFields = {
  full_name?: string | null;
  email?: string | null;
};

export function mapConsultantStatus(status: string): Consultant["status"] {
  return status === "active" ? "Active" : "Inactive";
}

export function emptyConsultantMetrics(studentCount = 0): Consultant["metrics"] {
  return {
    students: studentCount,
    appointmentsCompleted: 0,
    applicationsSubmitted: 0,
    offers: 0,
    visaCases: 0,
    completedCases: 0,
  };
}

export function mapConsultantDeskRow(
  row: ConsultantRow,
  ctx?: {
    profile?: ConsultantProfileFields | null;
    studentCount?: number;
  },
): Consultant {
  const name =
    ctx?.profile?.full_name?.trim() ||
    row.desk?.trim() ||
    row.department?.trim() ||
    "Consultant";
  return {
    id: row.id,
    name,
    role: row.job_title?.trim() || "Consultant",
    department: row.department?.trim() || row.desk?.trim() || "—",
    email: ctx?.profile?.email?.trim() || "",
    phone: row.phone?.trim() || "",
    status: mapConsultantStatus(row.status),
    metrics: emptyConsultantMetrics(ctx?.studentCount ?? 0),
  };
}

/** Count active (non-archived) students per assigned consultant — one pass. */
export function countStudentsByConsultantId(
  rows: Array<{ assigned_consultant_id: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.assigned_consultant_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}
