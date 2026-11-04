import { describe, expect, it } from "vitest";
import { normalizeOptionalApplicationDeadline } from "./application-deadline";

describe("normalizeOptionalApplicationDeadline", () => {
  it("treats blank and dash as null", () => {
    expect(normalizeOptionalApplicationDeadline("")).toEqual({ ok: true, value: null });
    expect(normalizeOptionalApplicationDeadline("  ")).toEqual({ ok: true, value: null });
    expect(normalizeOptionalApplicationDeadline("-")).toEqual({ ok: true, value: null });
    expect(normalizeOptionalApplicationDeadline("—")).toEqual({ ok: true, value: null });
  });

  it("accepts valid YYYY-MM-DD", () => {
    expect(normalizeOptionalApplicationDeadline("2027-01-15")).toEqual({
      ok: true,
      value: "2027-01-15",
    });
  });

  it("rejects invalid formats and impossible dates", () => {
    expect(normalizeOptionalApplicationDeadline("15/01/2027").ok).toBe(false);
    expect(normalizeOptionalApplicationDeadline("2027-02-30").ok).toBe(false);
    expect(normalizeOptionalApplicationDeadline("not-a-date").ok).toBe(false);
  });
});
