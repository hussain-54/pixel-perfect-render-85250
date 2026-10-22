import { createFileRoute } from "@tanstack/react-router";
import { BankingModulePage } from "@/routes/admin/banking";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/banking")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "banking_finance"),
  component: BankingModulePage,
});
