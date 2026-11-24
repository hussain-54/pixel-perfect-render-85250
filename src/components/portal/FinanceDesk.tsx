import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  InlineFeedback,
  PageHeader,
  PageLoadState,
  Panel,
  PortalPage,
  PermissionDenied,
  StatCard,
  StatGrid,
  TableWrap,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFinanceDesk,
  postFinanceDeskEntry,
  reverseFinanceDeskEntry,
  saveFinanceDeskEntry,
} from "@/services";
import {
  FINANCE_DESK_KIND_OPTIONS,
  FINANCE_DESK_TABS,
  FINANCE_DESK_TITLES,
  NON_POSTABLE_KINDS,
  filterEntriesForTab,
  formatPkr,
  type FinanceDeskEntry,
  type FinanceDeskTabId,
} from "@/lib/finance-desk";

type Props = {
  tab: FinanceDeskTabId;
  onTabChange: (tab: FinanceDeskTabId) => void;
  staffShell?: boolean;
  basePath: "/admin/banking" | "/staff/banking";
};

type EntryFormState = {
  kind: string;
  title: string;
  date: string;
  amount: string;
  billId?: string;
  fund?: string;
  count?: string;
  principal?: string;
  interest?: string;
  carrying?: string;
  proceeds?: string;
  withheld?: string;
  net?: string;
  number?: string;
  parentId?: string;
  reference?: string;
  department?: string;
};

const emptyEntryForm = (kind: string): EntryFormState => ({
  kind,
  title: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
});

export function FinanceDesk({ tab, onTabChange, staffShell = false, basePath }: Props) {
  const queryClient = useQueryClient();
  const deskQ = useQuery({
    queryKey: ["admin", "finance-desk", staffShell],
    queryFn: () => getFinanceDesk({ staffShell }),
    staleTime: 10_000,
  });

  const denied =
    !!deskQ.error && /403|permission|not authorized/i.test(portalErrorMessage(deskQ.error));

  const saveMut = useMutation({
    mutationFn: saveFinanceDeskEntry,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "finance-desk"] }),
  });
  const postMut = useMutation({
    mutationFn: (id: string) => postFinanceDeskEntry(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "finance-desk"] }),
  });
  const reverseMut = useMutation({
    mutationFn: (data: { id: string; reason: string }) => reverseFinanceDeskEntry(data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "finance-desk"] }),
  });

  const busy = saveMut.isPending || postMut.isPending || reverseMut.isPending;
  const actionError = saveMut.error || postMut.error || reverseMut.error;

  if (deskQ.isLoading) {
    return (
      <PageLoadState title="Banking & Finance" subtitle="Loading desk…">
        <p className="text-sm text-muted-foreground">Loading the books…</p>
      </PageLoadState>
    );
  }

  if (denied) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Banking & Finance"
          subtitle="Accounts workspace for office ledgers and student fee follow-up."
        />
        <PermissionDenied body="You do not have access to banking and finance records." />
      </div>
    );
  }

  if (deskQ.isError || !deskQ.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Banking & Finance" subtitle="Could not load the finance desk." />
        <ErrorState body={portalErrorMessage(deskQ.error)} />
      </div>
    );
  }

  const data = deskQ.data;
  const entries = filterEntriesForTab(data.entries, tab);
  const title = FINANCE_DESK_TITLES[tab];

  return (
    <PortalPage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Banking & Finance"
          subtitle="Office ledger desk with live student fee balances. Fee verification stays in Fees & Payments."
        />
        <Button asChild size="sm" variant="outline">
          <Link to={data.feesHref}>Open Fees & Payments</Link>
        </Button>
      </div>

      <AdminModuleSubnav
        items={FINANCE_DESK_TABS.map((t) => ({
          to: basePath,
          label: t.label,
          tab: t.id,
        }))}
      />

      <h2 className="font-display text-xl font-semibold text-navy">{title}</h2>
      <p className="text-sm text-muted-foreground">{data.note}</p>
      {actionError ? (
        <InlineFeedback kind="err">{portalErrorMessage(actionError)}</InlineFeedback>
      ) : null}

      {!data.schemaReady &&
      /20261108160000|finance desk tables are not available/i.test(data.note) ? (
        <Panel compact title="Office ledger setup">
          <p className="text-sm text-muted-foreground">
            Apply <code>20261108160000_finance_desk_foundation.sql</code> to enable drafts, posting,
            and finance audit rows. Student balances still load from live fee tables.
          </p>
        </Panel>
      ) : null}

      {tab === "statements" ? <StatementsView data={data} /> : null}
      {tab === "clients" ? <ClientsView bills={data.bills} feesHref={data.feesHref} /> : null}
      {tab === "fbr-integration" ? <FbrView connections={data.connections} /> : null}
      {tab === "audit" ? <AuditView rows={data.audits} /> : null}

      {tab === "tax" ? (
        <StatGrid className="sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
          <StatCard label="Tax payable on the books" value={formatPkr(data.taxPayable)} />
          <StatCard
            label="Typed challans"
            value={String(data.entries.filter((e) => e.kind === "tax-challan").length)}
          />
          <StatCard
            label="Typed withholding"
            value={String(data.entries.filter((e) => e.kind === "withholding").length)}
          />
        </StatGrid>
      ) : null}

      {tab === "assets" ? (
        <StatGrid className="sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
          <StatCard
            label="Asset purchases"
            value={formatPkr(
              data.entries
                .filter((e) => e.kind === "asset-buy")
                .reduce((sum, e) => sum + e.amount, 0),
            )}
          />
          <StatCard
            label="Depreciation typed"
            value={formatPkr(
              data.entries
                .filter((e) => e.kind === "depreciation")
                .reduce((sum, e) => sum + e.amount, 0),
            )}
          />
          <StatCard label="Pay orders not cleared" value={formatPkr(data.clearing)} />
        </StatGrid>
      ) : null}

      {tab === "budgets" ? (
        <p className="text-sm text-muted-foreground">
          A budget row is a plan. It is not compared with posted expenses, and it cannot be posted.
        </p>
      ) : null}

      {tab !== "statements" &&
      tab !== "clients" &&
      tab !== "fbr-integration" &&
      tab !== "audit" &&
      tab !== "approvals" &&
      data.schemaReady ? (
        <EntryForm
          tab={tab}
          bills={data.bills}
          entries={data.entries}
          busy={busy}
          onSubmit={(body) => saveMut.mutate(body)}
        />
      ) : null}

      {tab === "approvals" && data.schemaReady ? (
        <p className="text-sm text-muted-foreground">
          Posting updates the office ledger only. It does not verify student signup or university
          fees — use Fees & Payments for those actions.
        </p>
      ) : null}

      {entries.length > 0 ? (
        <Panel compact title={`${entries.length} record${entries.length === 1 ? "" : "s"}`}>
          <TableWrap>
            <thead>
              <tr>
                <th>Record</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="font-medium text-navy">{entry.title}</td>
                  <td className="text-muted-foreground">{entry.kind}</td>
                  <td className="tabular-nums">{formatPkr(entry.amount)}</td>
                  <td>
                    {entry.status}
                    {entry.detail.state ? ` · ${String(entry.detail.state)}` : ""}
                    {entry.detail.external === false ? " · not filed" : ""}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {entry.status === "draft" && !NON_POSTABLE_KINDS.has(entry.kind) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="navy"
                          className="h-8"
                          disabled={busy}
                          onClick={() => postMut.mutate(entry.id)}
                        >
                          Post
                        </Button>
                      ) : null}
                      {entry.status === "posted" && entry.kind !== "reversal" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt("Reason for the reversal");
                            if (reason?.trim()) {
                              reverseMut.mutate({ id: entry.id, reason: reason.trim() });
                            }
                          }}
                        >
                          Reverse
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      ) : null}

      {entries.length === 0 &&
      tab !== "statements" &&
      tab !== "clients" &&
      tab !== "fbr-integration" &&
      tab !== "audit" ? (
        <EmptyState
          title="No records in this view"
          body={
            data.schemaReady
              ? "Save a draft below, or open Fees & Payments for student fee work."
              : "Apply the finance desk migration to create office ledger drafts."
          }
        />
      ) : null}
    </PortalPage>
  );
}

function StatementsView({ data }: { data: Awaited<ReturnType<typeof getFinanceDesk>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Student receivable" value={formatPkr(data.receivable)} />
        <StatCard label="Ops payables (open)" value={formatPkr(data.payable)} />
        <StatCard label="Signup fees pending" value={String(data.pendingSignupFees)} />
        <StatCard label="University fees pending" value={String(data.pendingUniversityFees)} />
        <StatCard label="Office cash (posted)" value={formatPkr(data.cash)} />
        <StatCard label="Petty cash" value={formatPkr(data.petty)} />
        <StatCard label="Loan payable" value={formatPkr(data.loanPayable)} />
        <StatCard label="Pending ops expenses" value={String(data.pendingOpsExpenses)} />
      </div>
      <Panel compact title="Books snapshot (office ledger)">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniKpi label="Assets" value={formatPkr(data.books.assets)} />
          <MiniKpi label="Liabilities" value={formatPkr(data.books.liabilities)} />
          <MiniKpi label="Equity" value={formatPkr(data.books.equity)} />
          <MiniKpi label="Income" value={formatPkr(data.books.income)} />
          <MiniKpi label="Expenses" value={formatPkr(data.books.expenses)} />
          <MiniKpi label="Profit" value={formatPkr(data.books.profit)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Debit {formatPkr(data.books.debit)} · Credit {formatPkr(data.books.credit)} · Equation{" "}
          {data.books.equation ? "balanced" : "check entries"}
        </p>
      </Panel>
      <Panel compact title="Related modules">
        <p className="text-sm text-muted-foreground">
          Verify student fees in{" "}
          <Link
            to={data.feesHref}
            className="font-medium text-royal underline-offset-2 hover:underline"
          >
            Fees & Payments
          </Link>
          . Office purchases remain in{" "}
          <Link
            to={data.operationsHref}
            className="font-medium text-royal underline-offset-2 hover:underline"
          >
            Orders / Sales / Purchase
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold tabular-nums text-navy">{value}</p>
    </div>
  );
}

function ClientsView({
  bills,
  feesHref,
}: {
  bills: Awaited<ReturnType<typeof getFinanceDesk>>["bills"];
  feesHref: string;
}) {
  return (
    <Panel compact title="Student fee balances">
      <p className="mb-3 text-sm text-muted-foreground">
        Outstanding is invoice/obligation total minus verified or waived amounts. Client money held
        on the statements page is not fee income until verified.{" "}
        <Link to={feesHref} className="font-medium text-royal underline-offset-2 hover:underline">
          Open Fees & Payments
        </Link>
      </p>
      <TableWrap>
        <thead>
          <tr>
            <th>Student</th>
            <th>Item</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => (
            <tr key={`${bill.source}-${bill.id}`}>
              <td className="font-medium text-navy">{bill.studentName}</td>
              <td>
                {bill.title}
                <span className="ml-1 text-xs text-muted-foreground">· {bill.source}</span>
              </td>
              <td className="tabular-nums">{formatPkr(bill.amount)}</td>
              <td className="tabular-nums">{formatPkr(bill.paid)}</td>
              <td className="tabular-nums">{formatPkr(bill.outstanding)}</td>
            </tr>
          ))}
          {bills.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted-foreground">
                No fee rows are visible on this plane.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableWrap>
    </Panel>
  );
}

function FbrView({ connections }: { connections: Record<string, boolean> }) {
  return (
    <Panel compact title="Filing portals">
      <p className="text-sm text-muted-foreground">
        SRB, PRA, KPRA, and BRA are not signed in. Preparing a paper on this desk does not file it
        with FBR or a provincial authority.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {Object.entries(connections).map(([name, connected]) => (
          <li key={name} className="flex justify-between border-b border-border py-1.5">
            <span className="text-navy">{name}</span>
            <span className="text-muted-foreground">
              {connected ? "connected" : "not connected"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function AuditView({ rows }: { rows: Awaited<ReturnType<typeof getFinanceDesk>>["audits"] }) {
  return (
    <Panel compact title="Finance desk audit">
      <TableWrap compact>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="tabular-nums text-muted-foreground">
                {row.createdAt.slice(0, 16).replace("T", " ")}
              </td>
              <td>{row.action}</td>
              <td>{row.detail || row.target}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-muted-foreground">
                No finance audit row is stored yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableWrap>
    </Panel>
  );
}

function EntryForm({
  tab,
  bills,
  entries,
  busy,
  onSubmit,
}: {
  tab: FinanceDeskTabId;
  bills: Awaited<ReturnType<typeof getFinanceDesk>>["bills"];
  entries: FinanceDeskEntry[];
  busy: boolean;
  onSubmit: (body: Parameters<typeof saveFinanceDeskEntry>[0]) => void;
}) {
  const options = FINANCE_DESK_KIND_OPTIONS[tab] ?? ["capital"];
  const [form, setForm] = useState<EntryFormState>(() => emptyEntryForm(options[0] ?? "capital"));
  const kind = form.kind || options[0] || "capital";
  const set = <K extends keyof EntryFormState>(key: K, value: EntryFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openPayOrders = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.kind === "payorder-issue" &&
          entry.status === "posted" &&
          entry.detail.state !== "cleared" &&
          entry.detail.state !== "cancelled",
      ),
    [entries],
  );

  return (
    <Panel compact title="Save draft">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const body: Parameters<typeof saveFinanceDeskEntry>[0] = {
            kind,
            title: form.title || "",
            amount: Number(form.amount || 0),
            entryDate: form.date,
          };
          if (form.billId) body.billId = form.billId;
          if (form.fund) body.fund = form.fund;
          if (form.count) body.count = Number(form.count);
          if (form.principal) body.principal = Number(form.principal);
          if (form.interest) body.interest = Number(form.interest);
          if (form.carrying) body.carrying = Number(form.carrying);
          if (form.proceeds) body.proceeds = Number(form.proceeds);
          if (form.withheld) body.withheld = Number(form.withheld);
          if (form.net) body.net = Number(form.net);
          if (form.number) body.number = form.number;
          if (form.parentId) body.parentId = form.parentId;
          if (form.reference) body.reference = form.reference;
          if (form.department) body.department = form.department;
          onSubmit(body);
          setForm(emptyEntryForm(options[0] ?? "capital"));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="fd-kind">Kind</Label>
          <select
            id="fd-kind"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {options.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fd-title">Title</Label>
          <Input
            id="fd-title"
            required
            value={form.title || ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fd-date">Date</Label>
          <Input
            id="fd-date"
            required
            type="date"
            value={form.date || ""}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
        {![
          "invoice",
          "installment",
          "loan-repay",
          "invest-sell",
          "withholding",
          "payorder-clear",
          "payorder-cancel",
        ].includes(kind) ? (
          <div className="space-y-1">
            <Label htmlFor="fd-amount">Amount PKR</Label>
            <Input
              id="fd-amount"
              required
              inputMode="numeric"
              value={form.amount || ""}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        ) : null}

        {["invoice", "receipt", "installment"].includes(kind) ? (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="fd-bill">Fee / invoice row</Label>
            <select
              id="fd-bill"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required={kind !== "receipt"}
              value={form.billId || ""}
              onChange={(e) => set("billId", e.target.value)}
            >
              <option value="">{kind === "receipt" ? "Advance, no invoice" : "Choose"}</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.studentName} · {bill.title} · due {formatPkr(bill.outstanding)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {kind === "receipt" ? (
          <div className="space-y-1">
            <Label htmlFor="fd-fund">Received into</Label>
            <select
              id="fd-fund"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.fund || "bank"}
              onChange={(e) => set("fund", e.target.value)}
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        ) : null}

        {kind === "installment" ? (
          <div className="space-y-1">
            <Label htmlFor="fd-count">Number of instalments</Label>
            <Input
              id="fd-count"
              required
              inputMode="numeric"
              value={form.count || ""}
              onChange={(e) => set("count", e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        ) : null}

        {kind === "loan-repay" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="fd-principal">Principal PKR</Label>
              <Input
                id="fd-principal"
                required
                inputMode="numeric"
                value={form.principal || ""}
                onChange={(e) => set("principal", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fd-interest">Interest PKR</Label>
              <Input
                id="fd-interest"
                required
                inputMode="numeric"
                value={form.interest || ""}
                onChange={(e) => set("interest", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </>
        ) : null}

        {kind === "invest-sell" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="fd-carrying">Carrying amount PKR</Label>
              <Input
                id="fd-carrying"
                required
                inputMode="numeric"
                value={form.carrying || ""}
                onChange={(e) => set("carrying", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fd-proceeds">Proceeds PKR</Label>
              <Input
                id="fd-proceeds"
                required
                inputMode="numeric"
                value={form.proceeds || ""}
                onChange={(e) => set("proceeds", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </>
        ) : null}

        {kind === "withholding" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="fd-withheld">Withheld PKR</Label>
              <Input
                id="fd-withheld"
                required
                inputMode="numeric"
                value={form.withheld || ""}
                onChange={(e) => set("withheld", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fd-net">Paid net PKR</Label>
              <Input
                id="fd-net"
                required
                inputMode="numeric"
                value={form.net || ""}
                onChange={(e) => set("net", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </>
        ) : null}

        {kind === "payorder-issue" ? (
          <div className="space-y-1">
            <Label htmlFor="fd-number">Instrument number</Label>
            <Input
              id="fd-number"
              value={form.number || ""}
              onChange={(e) => set("number", e.target.value)}
            />
          </div>
        ) : null}

        {kind === "payorder-clear" || kind === "payorder-cancel" ? (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="fd-parent">Issued pay order</Label>
            <select
              id="fd-parent"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.parentId || ""}
              onChange={(e) => set("parentId", e.target.value)}
            >
              <option value="">Choose</option>
              {openPayOrders.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {kind === "tax-challan" || kind === "tax-return" ? (
          <div className="space-y-1">
            <Label htmlFor="fd-ref">Reference typed here</Label>
            <Input
              id="fd-ref"
              value={form.reference || ""}
              onChange={(e) => set("reference", e.target.value)}
            />
          </div>
        ) : null}

        {kind === "budget" ? (
          <div className="space-y-1">
            <Label htmlFor="fd-dept">Department</Label>
            <Input
              id="fd-dept"
              value={form.department || ""}
              onChange={(e) => set("department", e.target.value)}
            />
          </div>
        ) : null}

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" variant="navy" disabled={busy}>
            Save draft
          </Button>
          {kind === "budget" ? (
            <span className="text-xs text-muted-foreground">
              A budget is not a transaction and cannot be posted.
            </span>
          ) : null}
          {kind === "tax-return" ? (
            <span className="text-xs text-muted-foreground">
              Saving papers does not file a return.
            </span>
          ) : null}
          {kind === "receipt" && !form.billId ? (
            <span className="text-xs text-muted-foreground">
              An advance is held as client funds. It is not fee income until verified.
            </span>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
