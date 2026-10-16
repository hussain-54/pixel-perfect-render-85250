/**
 * Batched display-name helpers for CRM list rows (apps / docs / appointments).
 * Server handlers load names in one query; UI falls back safely when absent.
 */

export function studentNameByIdFromRows(
  rows: Array<{ id: string; full_name?: string | null; name?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const name = (row.full_name ?? row.name ?? "").trim();
    if (name) map.set(row.id, name);
  }
  return map;
}

/** Attach optional studentName when a non-empty name exists; omit when missing. */
export function attachStudentNames<T extends { studentId: string }>(
  rows: T[],
  nameById: Map<string, string>,
): Array<T & { studentName?: string }> {
  return rows.map((row) => {
    const name = nameById.get(row.studentId)?.trim();
    if (!name) return row;
    return { ...row, studentName: name };
  });
}
