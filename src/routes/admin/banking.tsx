import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  StatCard,
  portalErrorMessage,
} from "@/components/common";
import { getOpsDashboard, listUniversityFeeQueue } from "@/services";

export const Route = createFileRoute("/admin/banking")({
  component: BankingModulePage,
});

/** Shared banking workspace — also mounted at `/staff/banking` for specialty desks. */
export function BankingModulePage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onStaffShell = pathname.startsWith("/staff");
  const financeTo = onStaffShell ? "/staff/finance" : "/admin/finance";
  const operationsTo = onStaffShell ? "/staff/operations" : "/admin/operations";

  const opsQ = useQuery({
    queryKey: ["admin", "banking", "ops-dashboard"],
    queryFn: getOpsDashboard,
    staleTime: 15_000,
  });
  const feesQ = useQuery({
    queryKey: ["admin", "banking", "fee-queue"],
    queryFn: () => listUniversityFeeQueue({}),
    staleTime: 15_000,
  });

  const opsDenied =
    !!opsQ.error && /403|permission|not authorized/i.test(portalErrorMessage(opsQ.error));
  const feesDenied =
    !!feesQ.error && /403|permission|not authorized/i.test(portalErrorMessage(feesQ.error));
  // Accounts / Front Desk with banking View may lack Ops module access — do not
  // treat Ops 403 alone as a full banking denial when fee records are visible.
  const fullyDenied = feesDenied && opsDenied;

  const feeCount = feesQ.data?.ok ? feesQ.data.fees.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banking & Finance"
        subtitle="Accounts and finance workspace for banking-adjacent ledgers, expenses, and fee verification follow-up."
      />

      {fullyDenied ? (
        <PermissionDenied body="You do not have access to banking and finance records." />
      ) : null}

      {opsQ.isLoading || feesQ.isLoading ? <LoadingRows /> : null}
      {opsQ.isError && !opsDenied ? <ErrorState body={portalErrorMessage(opsQ.error)} /> : null}

      {opsQ.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Pending expenses" value={opsQ.data.pendingExpenses} />
          <StatCard label="Pending purchases" value={opsQ.data.pendingPurchases} />
          <StatCard
            label="Expense rows visible"
            value={opsQ.data.canSeeExpenses ? (opsQ.data.expenses?.length ?? 0) : "N/A"}
          />
        </div>
      ) : opsDenied && !fullyDenied ? (
        <p className="text-sm text-muted-foreground">
          Office Operations ledgers are outside this role&apos;s module access. Fee follow-up below
          remains available when Fees &amp; Payments View is granted.
        </p>
      ) : null}

      <Panel title="University fee follow-up">
        <p className="mb-3 text-sm text-muted-foreground">
          Fee obligations and verification actions live under Fees & Payments. Use this view for a
          quick finance queue count.
        </p>
        {feesQ.isError && !feesDenied ? (
          <ErrorState body={portalErrorMessage(feesQ.error)} />
        ) : feesDenied ? (
          <PermissionDenied body="You do not have permission to view fee obligations." />
        ) : feeCount > 0 ? (
          <p className="text-sm text-navy">
            <span className="font-semibold">{feeCount}</span> fee obligation
            {feeCount === 1 ? "" : "s"} currently visible.{" "}
            <Link
              to={financeTo}
              className="font-medium text-bright underline-offset-2 hover:underline"
            >
              Open Fees & Payments
            </Link>
          </p>
        ) : (
          <EmptyState
            title="No fee obligations"
            body="No university fee rows are visible on this plane."
          />
        )}
      </Panel>

      <Panel title="Expense review">
        <p className="text-sm text-muted-foreground">
          Detailed purchase and expense mutations remain in{" "}
          <Link
            to={operationsTo}
            className="font-medium text-bright underline-offset-2 hover:underline"
          >
            Orders / Sales / Purchase
          </Link>
          . Accounts retains expense visibility per module rules.
        </p>
      </Panel>
    </div>
  );
}
