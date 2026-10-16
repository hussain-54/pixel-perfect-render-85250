import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHOLARSHIPS_MUTATE_FN,
  SCHOLARSHIPS_MUTATE_FN_BUSINESS_ROLES,
  SCHOLARSHIPS_MUTATE_FN_EXECUTE_ROLES,
  SCHOLARSHIPS_MUTATE_FN_REVOKED_ROLES,
  SCHOLARSHIPS_MUTATE_GRANTS_MIGRATION,
  SCHOLARSHIPS_MUTATE_RLS_MIGRATION,
  assertScholarshipsMutateGrantsSql,
  scholarshipsMutateFnAllowsBusinessRole,
} from "./scholarship-mutate-grants-rules";

describe("scholarships mutate function grants contract", () => {
  it("documents EXECUTE allowlist / denylist and mutate business roles", () => {
    expect(SCHOLARSHIPS_MUTATE_FN).toBe("can_mutate_scholarships_catalog");
    expect([...SCHOLARSHIPS_MUTATE_FN_EXECUTE_ROLES]).toEqual(["authenticated"]);
    expect([...SCHOLARSHIPS_MUTATE_FN_REVOKED_ROLES]).toEqual(["public", "anon"]);
    expect([...SCHOLARSHIPS_MUTATE_FN_BUSINESS_ROLES]).toEqual([
      "admission_team",
      "manager",
      "admin",
    ]);
    expect(scholarshipsMutateFnAllowsBusinessRole("admission_team")).toBe(true);
    expect(scholarshipsMutateFnAllowsBusinessRole("counsellor_consultant")).toBe(false);
    expect(scholarshipsMutateFnAllowsBusinessRole(null)).toBe(false);
  });

  it("hardens grants migration SQL without rewriting function or RLS", () => {
    const sql = readFileSync(
      resolve("supabase/migrations", SCHOLARSHIPS_MUTATE_GRANTS_MIGRATION),
      "utf8",
    );
    const check = assertScholarshipsMutateGrantsSql(sql);
    expect(check).toEqual({ ok: true });
    expect(sql).toContain(SCHOLARSHIPS_MUTATE_RLS_MIGRATION);
  });

  it("rejects SQL that re-grants anon or recreates the function", () => {
    expect(
      assertScholarshipsMutateGrantsSql(`
        revoke all on function public.can_mutate_scholarships_catalog() from public;
        revoke all on function public.can_mutate_scholarships_catalog() from anon;
        grant execute on function public.can_mutate_scholarships_catalog() to authenticated;
        grant execute on function public.can_mutate_scholarships_catalog() to anon;
      `).ok,
    ).toBe(false);

    expect(
      assertScholarshipsMutateGrantsSql(`
        create or replace function public.can_mutate_scholarships_catalog() returns boolean as $$ select true $$ language sql;
        revoke all on function public.can_mutate_scholarships_catalog() from public;
        revoke all on function public.can_mutate_scholarships_catalog() from anon;
        grant execute on function public.can_mutate_scholarships_catalog() to authenticated;
      `).ok,
    ).toBe(false);
  });
});
