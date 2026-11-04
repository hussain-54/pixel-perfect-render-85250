/**
 * Optional application deadline helpers — persist as DATE or null.
 * Never invent a default deadline.
 */

/** Normalize form/API deadline input to YYYY-MM-DD or null. */
export function normalizeOptionalApplicationDeadline(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const t = (raw ?? "").trim();
  if (!t || t === "-" || t === "\u2014") {
    return { ok: true, value: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return {
      ok: false,
      message: "Deadline must be a valid date (YYYY-MM-DD).",
    };
  }
  const [y, m, d] = t.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return {
      ok: false,
      message: "Deadline must be a valid calendar date.",
    };
  }
  return { ok: true, value: t };
}
