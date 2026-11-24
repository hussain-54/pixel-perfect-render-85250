/**
 * React Query invokes queryFn(context). Service helpers used as queryFn must ignore that
 * context when it would be mistaken for a business argument (Seroval / wrong filters).
 */

export function isQueryFunctionContext(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as { queryKey?: unknown; signal?: unknown; meta?: unknown };
  return Array.isArray(record.queryKey);
}

/** Only real student id strings are filters — never a QueryFunctionContext. */
export function optionalStudentId(value: unknown): string | undefined {
  if (isQueryFunctionContext(value)) return undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Drop QueryFunctionContext masquerading as list filters. */
export function optionalFilters<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T = {} as T,
): T {
  if (value == null || isQueryFunctionContext(value)) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) return fallback;
  return value as T;
}
