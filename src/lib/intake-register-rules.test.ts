import { describe, expect, it } from "vitest";
import {
  INTAKE_REGISTER_EXCLUDED_COLUMNS,
  INTAKE_REGISTER_PG_INTEGRATION_PLAN,
  INTAKE_REGISTER_RETURN_COLUMNS,
  M1_REGISTRAR_SELECT_FOLLOWUP,
  forcedRegisteredBy,
  intakeRegisterExcludesSensitive,
  intakeRegisterReturnsColumn,
  mapIntakeRegisterRpcError,
} from "./intake-register-rules";

describe("intake_register_student column contract (unit — not DB)", () => {
  it("returns only allowlisted columns and excludes DOB / activation / archive", () => {
    expect(intakeRegisterReturnsColumn("id")).toBe(true);
    expect(intakeRegisterReturnsColumn("registered_by")).toBe(true);
    expect(intakeRegisterReturnsColumn("dob")).toBe(false);
    expect(intakeRegisterExcludesSensitive("dob")).toBe(true);
    expect(INTAKE_REGISTER_RETURN_COLUMNS).not.toContain("dob");
    for (const col of INTAKE_REGISTER_EXCLUDED_COLUMNS) {
      expect(INTAKE_REGISTER_RETURN_COLUMNS).not.toContain(col);
    }
  });

  it("forces registered_by to auth.uid and ignores client ownership", () => {
    expect(
      forcedRegisteredBy({
        authUid: "fd-a",
        clientRegisteredBy: "attacker",
      }),
    ).toBe("fd-a");
    expect(forcedRegisteredBy({ authUid: null, clientRegisteredBy: "x" })).toBeNull();
  });

  it("maps authz and validation RPC errors safely", () => {
    expect(mapIntakeRegisterRpcError("authentication required").status).toBe(401);
    expect(mapIntakeRegisterRpcError("not authorized to register intake").status).toBe(403);
    expect(mapIntakeRegisterRpcError("duplicate student email").status).toBe(409);
    expect(mapIntakeRegisterRpcError("profile already linked to a student").status).toBe(409);
    expect(mapIntakeRegisterRpcError("Could not find the function").status).toBe(503);
    const generic = mapIntakeRegisterRpcError("permission denied for table secrets");
    expect(generic.status).toBe(400);
    expect(generic.message.toLowerCase()).not.toContain("secrets");
  });

  it("documents follow-up policy drop and integration plan (not executed)", () => {
    expect(M1_REGISTRAR_SELECT_FOLLOWUP.policy).toBe("students_select_intake_registrar");
    expect(M1_REGISTRAR_SELECT_FOLLOWUP.migration).toContain("14060000");
    expect(M1_REGISTRAR_SELECT_FOLLOWUP.dropSql).toContain("drop policy");
    expect(INTAKE_REGISTER_PG_INTEGRATION_PLAN.length).toBeGreaterThanOrEqual(5);
  });
});
