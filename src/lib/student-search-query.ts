/**
 * Bound staff header search to a PostgREST `or` filter.
 * Strips separators and LIKE wildcards so a typed query cannot widen the filter.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeStudentSearchTerm(raw: string): string | null {
  const term = raw
    .trim()
    .replace(/[%_,()*"\\]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  if (term.length < 2) return null;
  return term;
}

/** Columns needed by the header search hit — not a full student row. */
export const STUDENT_SEARCH_COLUMNS = "id, case_id, full_name, phone, destination" as const;

export function studentSearchOrClause(term: string): string {
  const quoted = `"%${term}%"`;
  const parts = [
    `full_name.ilike.${quoted}`,
    `case_id.ilike.${quoted}`,
    `phone.ilike.${quoted}`,
  ];
  if (UUID_RE.test(term)) parts.push(`id.eq.${term}`);
  return parts.join(",");
}
