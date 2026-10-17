import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WRITE_AUDIT_GRANTS_MIGRATION,
  assertWriteAuditGrantsSql,
  mapWriteAuditPermissionError,
} from "./write-audit-grants-rules";

describe("write_audit_event grants contract", () => {
  it("hardens EXECUTE for authenticated only", () => {
    const sql = readFileSync(resolve("supabase/migrations", WRITE_AUDIT_GRANTS_MIGRATION), "utf8");
    expect(assertWriteAuditGrantsSql(sql)).toEqual({ ok: true });
  });

  it("rejects re-granting anon or rewriting the function", () => {
    expect(
      assertWriteAuditGrantsSql(`
        revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from public;
        revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from anon;
        grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb) to authenticated;
        grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb) to anon;
      `).ok,
    ).toBe(false);
  });

  it("maps the live permission-denied failure for Front Desk staff messaging", () => {
    const mapped = mapWriteAuditPermissionError(
      "permission denied for function write_audit_event",
    );
    expect(mapped.isPermissionDenied).toBe(true);
    expect(mapped.staffMessage).toMatch(/Do not re-register/i);
    expect(mapped.staffMessage).toMatch(/20261017100000/);
  });
});
