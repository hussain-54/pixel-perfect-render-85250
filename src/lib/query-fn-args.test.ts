import { describe, expect, it } from "vitest";
import { isQueryFunctionContext, optionalFilters, optionalStudentId } from "./query-fn-args";

describe("query-fn-args", () => {
  const fakeContext = {
    queryKey: ["applications"],
    signal: {} as AbortSignal,
    meta: undefined,
  };

  it("detects React Query QueryFunctionContext shapes", () => {
    expect(isQueryFunctionContext(fakeContext)).toBe(true);
    expect(isQueryFunctionContext({ studentId: "s1" })).toBe(false);
    expect(isQueryFunctionContext("s1")).toBe(false);
    expect(isQueryFunctionContext(null)).toBe(false);
  });

  it("ignores QueryFunctionContext for optional student ids (Seroval regression)", () => {
    expect(optionalStudentId(fakeContext)).toBeUndefined();
    expect(optionalStudentId("s10")).toBe("s10");
    expect(optionalStudentId("  s1  ")).toBe("s1");
    expect(optionalStudentId("")).toBeUndefined();
    expect(optionalStudentId(undefined)).toBeUndefined();
  });

  it("ignores QueryFunctionContext for optional filter objects", () => {
    expect(optionalFilters(fakeContext, { status: "open" })).toEqual({ status: "open" });
    expect(optionalFilters({ status: "submitted" }, {})).toEqual({ status: "submitted" });
    expect(optionalFilters(undefined, { page: 1 })).toEqual({ page: 1 });
  });
});
