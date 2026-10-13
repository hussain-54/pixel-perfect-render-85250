import { rolesAtLeastAdmin, type AppRole } from "@/lib/roles";
import { canFullyApproveModule, type BusinessRole } from "@/lib/business-permissions";

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
