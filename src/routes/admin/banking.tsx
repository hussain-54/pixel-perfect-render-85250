import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { FinanceDesk } from "@/components/portal/FinanceDesk";
import { parseFinanceDeskTab, type FinanceDeskTabId } from "@/lib/finance-desk";

export type BankingModuleSearch = {
  tab: FinanceDeskTabId;
};

export const Route = createFileRoute("/admin/banking")({
  validateSearch: (search: Record<string, unknown>): BankingModuleSearch => ({
    tab: parseFinanceDeskTab(search["tab"]),
  }),
  component: AdminBanking,
});

function AdminBanking() {
  const tab = Route.useSearch({ select: (s) => s.tab });
  const navigate = Route.useNavigate();
  return (
    <BankingModulePage
      tab={tab}
      onTabChange={(next) => {
        void navigate({ search: { tab: next } });
      }}
    />
  );
}

/** Shared banking workspace — also mounted at `/staff/banking` for specialty desks. */
export function BankingModulePage(props?: {
  tab?: FinanceDeskTabId;
  onTabChange?: (tab: FinanceDeskTabId) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const staffShell = pathname.startsWith("/staff");
  const tab = props?.tab ?? parseFinanceDeskTab("");
  const basePath = staffShell ? "/staff/banking" : "/admin/banking";

  return (
    <FinanceDesk
      tab={tab}
      staffShell={staffShell}
      basePath={basePath}
      onTabChange={props?.onTabChange ?? (() => undefined)}
    />
  );
}
