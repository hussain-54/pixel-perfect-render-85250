import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { canEditModule, canViewModule, type BusinessRole } from "@/lib/business-permissions";

export type OpsPurchaseStatus =
  "draft" | "submitted" | "approved" | "partially_received" | "received" | "cancelled";

export type OpsExpenseStatus = "draft" | "submitted" | "reviewed" | "rejected";

const PURCHASE_TRANSITIONS: Record<OpsPurchaseStatus, OpsPurchaseStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["partially_received", "received", "cancelled"],
  partially_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export function canViewOfficeOps(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  // Accounts uses Finance / expense visibility — not the Office Ops portal.
  if (input.businessRole === "accounts_banking_finance") return false;
  if (input.businessRole === "office_ops" || input.businessRole === "manager") return true;
  return canViewModule(input.businessRole, "orders_sales_purchase");
}

export function canMutateOfficeOps(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  // Keep Office Ops mutations distinct from Accounts even if matrix grants orders view/edit.
  if (input.businessRole === "accounts_banking_finance") return false;
  if (input.businessRole === "office_ops" || input.businessRole === "manager") return true;
  return canEditModule(input.businessRole, "orders_sales_purchase");
}

/** Accounts may view expenses but not mutate office inventory/purchases via this module. */
export function canViewOpsExpenses(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (canViewOfficeOps(input)) return true;
  if (input.businessRole === "accounts_banking_finance") return true;
  return canViewModule(input.businessRole, "fees_payments");
}

export function isValidPurchaseTransition(from: OpsPurchaseStatus, to: OpsPurchaseStatus): boolean {
  if (from === to) return true;
  return PURCHASE_TRANSITIONS[from].includes(to);
}

export function validateMoneyAmount(amount: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Amount must be a non-negative number." };
  }
  return { ok: true };
}

export function validateReceiveQuantity(input: {
  ordered: number;
  alreadyReceived: number;
  receiving: number;
}): { ok: true; nextReceived: number; fullyReceived: boolean } | { ok: false; error: string } {
  if (!Number.isFinite(input.receiving) || input.receiving <= 0) {
    return { ok: false, error: "Receive quantity must be greater than zero." };
  }
  const next = input.alreadyReceived + input.receiving;
  if (next > input.ordered + 1e-9) {
    return { ok: false, error: "Cannot receive more than ordered quantity." };
  }
  return {
    ok: true,
    nextReceived: next,
    fullyReceived: next >= input.ordered - 1e-9,
  };
}

/** Expenses are never auto-verified payments. */
export function expenseImpliesVerifiedPayment(_status: OpsExpenseStatus): false {
  return false;
}

export function isStudentFeeEntity(entityType: string): boolean {
  return (
    entityType === "signup_fee_payments" ||
    entityType === "university_fee_obligations" ||
    entityType === "deposits"
  );
}
