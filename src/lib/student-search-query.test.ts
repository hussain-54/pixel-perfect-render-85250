import { describe, expect, it } from "vitest";
import { sanitizeStudentSearchTerm, studentSearchOrClause } from "./student-search-query";

describe("student search query", () => {
  it("drops PostgREST separators and LIKE wildcards", () => {
    expect(sanitizeStudentSearchTerm("  Al%,i_(a)*  ")).toBe("Alia");
    expect(sanitizeStudentSearchTerm("Ali, Khan")).toBe("Ali Khan");
    expect(sanitizeStudentSearchTerm("a")).toBeNull();
    expect(sanitizeStudentSearchTerm("   ")).toBeNull();
  });

  it("builds a bounded or-clause and matches a uuid exactly", () => {
    expect(studentSearchOrClause("Ali")).toBe(
      'full_name.ilike."%Ali%",case_id.ilike."%Ali%",phone.ilike."%Ali%"',
    );
    const id = "11111111-1111-4111-8111-111111111111";
    expect(studentSearchOrClause(id)).toContain(`id.eq.${id}`);
  });
});
