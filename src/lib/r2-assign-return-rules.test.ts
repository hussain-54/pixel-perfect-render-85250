import { describe, expect, it } from "vitest";
import {
  R2_MIGRATION_FILENAME,
  R2_NARROW_RETURN_COLUMNS,
  R2_PRODUCTION_RETURN,
  R2_REMOTE_PROOF_REQUIRED,
  R2_SENSITIVE_EXCLUDED_COLUMNS,
  assignRpcResultHasSensitiveColumn,
  assignRpcResultIsNarrow,
} from "./r2-assign-return-rules";

describe("R2 front_desk_assign_counsellor narrow return", () => {
  it("documents migration filename and production residual shape", () => {
    expect(R2_MIGRATION_FILENAME).toBe(
      "20261014080000_front_desk_assign_counsellor_narrow_return.sql",
    );
    expect(R2_PRODUCTION_RETURN).toBe("public.students");
  });

  it("proves sensitive columns are absent from the narrow return contract", () => {
    expect(assignRpcResultIsNarrow(R2_NARROW_RETURN_COLUMNS)).toBe(true);
    expect(assignRpcResultHasSensitiveColumn(R2_NARROW_RETURN_COLUMNS, "dob")).toBe(false);
    for (const col of R2_SENSITIVE_EXCLUDED_COLUMNS) {
      expect(R2_NARROW_RETURN_COLUMNS).not.toContain(col);
      expect(assignRpcResultHasSensitiveColumn(R2_NARROW_RETURN_COLUMNS, col)).toBe(false);
    }
  });

  it("rejects a full students-shaped result as non-narrow", () => {
    const fullRow = [...R2_NARROW_RETURN_COLUMNS, "dob", "portal_activated_at", "profile_id"];
    expect(assignRpcResultIsNarrow(fullRow)).toBe(false);
    expect(assignRpcResultHasSensitiveColumn(fullRow, "dob")).toBe(true);
  });

  it("lists remote proofs required before R2 can be marked closed", () => {
    expect(R2_REMOTE_PROOF_REQUIRED.some((s) => s.includes("dob"))).toBe(true);
  });
});
