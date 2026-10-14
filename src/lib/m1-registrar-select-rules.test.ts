import { describe, expect, it } from "vitest";
import {
  INTAKE_REGISTER_STUDENT_ARG_TYPES,
  INTAKE_REGISTER_STUDENT_DROP_SQL,
  M1_CLOSURE_GATE,
  M1_MIGRATION_ORDER,
  M1_OUT_OF_SCOPE_RESIDUALS,
  M1_POLICY_DROP_PG_INTEGRATION_PLAN,
  M1_POLICY_DROP_PREREQUISITES,
  M1_REGISTRAR_SELECT_DROP_SQL,
  M1_REGISTRAR_SELECT_POLICY,
  M1_REGISTRAR_SELECT_ROLLBACK_SQL,
  M1_STAGING_EVIDENCE_GATES,
  STUDENTS_SELECT_POLICIES_AFTER_DROP,
  STUDENTS_SENSITIVE_COLUMNS,
  fdOwnedRestSelectShouldDeny,
  m1PolicyDropLocallyReady,
  m1RegistrarPiiClaimFixed,
} from "./m1-registrar-select-rules";
import { FRONT_DESK_INTAKE_SELECT_COLUMNS } from "./staff-business-access";
import { INTAKE_REGISTER_EXCLUDED_COLUMNS } from "./intake-register-rules";

describe("Option 5/6 M1 registrar SELECT (unit — not DB)", () => {
  it("orders migrations 14020000 → 14060000 and targets the exact policy", () => {
    expect(M1_MIGRATION_ORDER[0]).toContain("14020000");
    expect(M1_MIGRATION_ORDER[M1_MIGRATION_ORDER.length - 1]).toContain("14060000");
    expect(M1_REGISTRAR_SELECT_POLICY).toBe("students_select_intake_registrar");
    expect(M1_REGISTRAR_SELECT_DROP_SQL).toContain(M1_REGISTRAR_SELECT_POLICY);
    expect(M1_REGISTRAR_SELECT_ROLLBACK_SQL).toContain("registered_by = auth.uid()");
  });

  it("Option 7 ledger gates A–G with E1 as mandatory M1 closure gate", () => {
    expect([...M1_STAGING_EVIDENCE_GATES]).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(M1_CLOSURE_GATE).toBe("E1");
  });

  it("documents exact intake_register_student drop signature", () => {
    expect(INTAKE_REGISTER_STUDENT_ARG_TYPES).toContain("public.inquiry_channel");
    expect(INTAKE_REGISTER_STUDENT_DROP_SQL).toContain("drop function if exists");
    expect(INTAKE_REGISTER_STUDENT_DROP_SQL).toContain("intake_register_student");
    expect(INTAKE_REGISTER_STUDENT_DROP_SQL).toContain("inquiry_channel");
  });

  it("models permissive OR: FD owned REST deny only when no other SELECT policy matches", () => {
    expect(
      fdOwnedRestSelectShouldDeny({
        isAdmin: false,
        canVerifySignupFee: false,
        isAssignedConsultantOnRow: false,
        isStudentSelfProfile: false,
      }),
    ).toBe(true);
    expect(
      fdOwnedRestSelectShouldDeny({
        isAdmin: false,
        canVerifySignupFee: false,
        isAssignedConsultantOnRow: true,
        isStudentSelfProfile: false,
      }),
    ).toBe(false);
    expect(
      fdOwnedRestSelectShouldDeny({
        isAdmin: false,
        canVerifySignupFee: true,
        isAssignedConsultantOnRow: false,
        isStudentSelfProfile: false,
      }),
    ).toBe(false);
  });

  it("preserves access and fee-verifier policies after drop; R1–R3 stay out of M1 closure", () => {
    expect(STUDENTS_SELECT_POLICIES_AFTER_DROP).toContain("students_select_access");
    expect(STUDENTS_SELECT_POLICIES_AFTER_DROP).toContain("students_select_fee_verifier");
    expect(STUDENTS_SELECT_POLICIES_AFTER_DROP).not.toContain(M1_REGISTRAR_SELECT_POLICY);
    expect(M1_OUT_OF_SCOPE_RESIDUALS.map((r) => r.id)).toEqual(["R1", "R2", "R3"]);
  });

  it("intake_register_student drop signature matches …14050000 grant/revoke arg list", () => {
    const expected =
      "text, text, text, text, text, text, text, text, text, uuid, text, public.inquiry_channel, date, text, uuid";
    expect(INTAKE_REGISTER_STUDENT_ARG_TYPES).toBe(expected);
    expect(INTAKE_REGISTER_STUDENT_DROP_SQL).toContain(expected.replace(/^/, "").slice(0, 20));
    expect(INTAKE_REGISTER_STUDENT_DROP_SQL.replace(/\s+/g, " ")).toContain(
      "drop function if exists public.intake_register_student( text, text, text, text, text, text, text, text, text, uuid, text, public.inquiry_channel, date, text, uuid )".replace(
        /\s+/g,
        " ",
      ),
    );
  });

  it("documents sensitive columns that row-level SELECT=* would expose", () => {
    expect(STUDENTS_SENSITIVE_COLUMNS).toContain("dob");
    expect(FRONT_DESK_INTAKE_SELECT_COLUMNS).not.toContain("dob");
    for (const col of INTAKE_REGISTER_EXCLUDED_COLUMNS) {
      expect(STUDENTS_SENSITIVE_COLUMNS as readonly string[]).toContain(col);
    }
  });

  it("local code ready; catalog + REST proof false → M1 not fixed", () => {
    expect(m1PolicyDropLocallyReady()).toBe(true);
    expect(
      M1_POLICY_DROP_PREREQUISITES.find((p) => p.id === "catalog_parity")?.localSatisfied,
    ).toBe(false);
    expect(
      M1_POLICY_DROP_PREREQUISITES.find((p) => p.id === "staging_rest_proof")?.localSatisfied,
    ).toBe(false);
    expect(
      m1RegistrarPiiClaimFixed({
        catalogParityDocumented: false,
        stagingRestOwnedSelectDenied: false,
      }),
    ).toBe(false);
    expect(
      m1RegistrarPiiClaimFixed({
        catalogParityDocumented: true,
        stagingRestOwnedSelectDenied: true,
      }),
    ).toBe(true);
  });

  it("integration plan covers catalog, FD-A/B REST, child tables, officer, admin, student", () => {
    const blob = M1_POLICY_DROP_PG_INTEGRATION_PLAN.map((p) => `${p.actor} ${p.action}`).join(
      " | ",
    );
    expect(blob).toMatch(/Catalog/i);
    expect(blob).toMatch(/FD-A/);
    expect(blob).toMatch(/FD-B/);
    expect(blob).toMatch(/applications|documents|offers|internal_notes/i);
    expect(blob).toMatch(/Officer/i);
    expect(blob).toMatch(/Admin/i);
    expect(blob).toMatch(/Student/i);
  });
});
