import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertBusinessModulePermissionsSelectSql,
  BUSINESS_MODULE_PERMISSIONS_SELECT_MIGRATION,
  permissionMatrixUnavailableMessage,
} from "./permission-matrix-rls-rules";

describe("business_module_permissions SELECT for authenticated authz", () => {
  it("migration grants SELECT to authenticated without PUBLIC/anon or write broaden", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations", BUSINESS_MODULE_PERMISSIONS_SELECT_MIGRATION),
      "utf8",
    );
    expect(assertBusinessModulePermissionsSelectSql(sql)).toEqual({ ok: true });
    expect(sql).not.toMatch(/grant\s+[\s\S]*\bto\s+anon\b/i);
    expect(sql).not.toMatch(/grant\s+[\s\S]*\bto\s+public\b/i);
    expect(sql.toLowerCase()).not.toContain("for insert");
    expect(sql.toLowerCase()).not.toContain("for update");
  });

  it("rejects SQL that grants table access to anon", () => {
    const bad = `
      create policy business_module_permissions_select_authenticated
      on public.business_module_permissions for select to authenticated
      using (auth.uid() is not null);
      grant select on public.business_module_permissions to anon;
    `;
    expect(assertBusinessModulePermissionsSelectSql(bad).ok).toBe(false);
  });

  it("keeps the counsellor-facing unavailable copy stable", () => {
    expect(permissionMatrixUnavailableMessage()).toMatch(/temporarily unavailable/i);
  });
});
