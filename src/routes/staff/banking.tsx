import { createFileRoute } from "@tanstack/react-router";
import { BankingModulePage } from "@/routes/admin/banking";
import { parseFinanceDeskTab, type FinanceDeskTabId } from "@/lib/finance-desk";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/banking")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "banking_finance"),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseFinanceDeskTab(search["tab"]),
  }),
  component: StaffBanking,
});

function StaffBanking() {
  const tab = Route.useSearch({ select: (s) => s.tab });
  const navigate = Route.useNavigate();
  return (
    <BankingModulePage
      tab={tab}
      onTabChange={(next: FinanceDeskTabId) => {
        void navigate({ search: { tab: next } });
      }}
    />
  );
}
