import { rolesAtLeastAdmin, type AppRole } from "@/lib/roles";
import { canFullyApproveModule, type BusinessRole } from "@/lib/business-permissions";
import type { UniversityFeeStatusDb } from "@/types/database";

/** App-layer gate for university fee verify/waive/reject (claimed ≠ verified). */
export function canVerifyUniversityFeePayment(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "accounts_banking_finance" || input.businessRole === "manager") {
    return true;
  }
  return (
    canFullyApproveModule(input.businessRole, "fees_payments") ||
    canFullyApproveModule(input.businessRole, "banking_finance")
  );
}

const TERMINAL_UNIVERSITY_FEE_STATUSES: ReadonlySet<UniversityFeeStatusDb> = new Set([
  "verified",
  "waived",
]);

/** Verify/reject require a prior claim; waive may also clear an open `due` obligation. */
export function assertUniversityFeeVerifyTransition(input: {
  current: UniversityFeeStatusDb;
  action: "verify" | "waive" | "reject";
}): void {
  if (TERMINAL_UNIVERSITY_FEE_STATUSES.has(input.current)) {
    throw new Error(`This fee is already finalized (${input.current}).`);
  }
  if (input.action === "waive") {
    if (input.current !== "due" && input.current !== "claimed" && input.current !== "rejected") {
      throw new Error(`Cannot waive a fee in status "${input.current}".`);
    }
    return;
  }
  // verify | reject — must be claimed (payment asserted) first
  if (input.current !== "claimed") {
    throw new Error(
      `Fee must be claimed before ${input.action}. Current status: ${input.current}.`,
    );
  }
}
