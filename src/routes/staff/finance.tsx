import { createFileRoute } from "@tanstack/react-router";
import { FinanceModulePage } from "@/routes/admin/finance";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export type FinanceSearch = {
  feeId?: string;
  studentId?: string;
  ledger?: "signup" | "university";
};

export const Route = createFileRoute("/staff/finance")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "fees_payments"),
  validateSearch: (raw: Record<string, unknown>): FinanceSearch => {
    const out: FinanceSearch = {};
    const feeId = raw["feeId"];
    if (typeof feeId === "string" && feeId.trim()) out.feeId = feeId.trim();
    const studentId = raw["studentId"];
    if (typeof studentId === "string" && studentId.trim()) out.studentId = studentId.trim();
    const ledger = raw["ledger"];
    if (ledger === "signup" || ledger === "university") out.ledger = ledger;
    return out;
  },
  component: StaffFinance,
});

function StaffFinance() {
  const search = Route.useSearch();
  return (
    <FinanceModulePage
      {...(search.feeId ? { initialFeeId: search.feeId } : {})}
      {...(search.studentId ? { initialStudentId: search.studentId } : {})}
      {...(search.ledger ? { initialLedger: search.ledger } : {})}
    />
  );
}
