import { describe, expect, it } from "vitest";
import { attachStudentNames, studentNameByIdFromRows } from "./crm-display-names";

describe("crm display name enrichment", () => {
  it("builds a batched id→name map and skips blank names", () => {
    const map = studentNameByIdFromRows([
      { id: "s1", full_name: "Ada Khan" },
      { id: "s2", name: "  Bilal  " },
      { id: "s3", full_name: "   " },
      { id: "s4", full_name: null },
    ]);
    expect(map.get("s1")).toBe("Ada Khan");
    expect(map.get("s2")).toBe("Bilal");
    expect(map.has("s3")).toBe(false);
    expect(map.has("s4")).toBe(false);
  });

  it("attaches studentName only when present (safe missing-name fallback)", () => {
    const map = new Map([["s1", "Ada Khan"]]);
    const rows = attachStudentNames(
      [
        { id: "a1", studentId: "s1", university: "U1" },
        { id: "a2", studentId: "missing", university: "U2" },
      ],
      map,
    );
    expect(rows[0]?.studentName).toBe("Ada Khan");
    expect(rows[1]?.studentName).toBeUndefined();
  });
});
