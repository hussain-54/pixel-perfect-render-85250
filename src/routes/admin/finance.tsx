import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  claimUniversityFeePayment,
  createUniversityFeeObligation,
  listFeeVerificationRequests,
  listSignupFeeQueue,
  listUniversityFeeQueue,
  verifySignupFee,
  verifyUniversityFeePayment,
} from "@/services";
import type {
  SignupFeeStatusDb,
  UniversityFeeKindDb,
  UniversityFeeStatusDb,
} from "@/types/database";
import { isSignupFeeVerified } from "@/lib/signup-fee-gate";
import { FEE_QUEUE_KEY } from "@/lib/use-fee-verification-queue-realtime";
import { useFinanceWorkspaceRealtime } from "@/lib/use-finance-workspace-realtime";
import { cn } from "@/lib/utils";

type SignupFeeQueueStatusFilter = "pending" | "verified" | "waived" | "rejected" | "all";

export const Route = createFileRoute("/admin/finance")({
  component: FinanceModulePage,
});

type LedgerTab = "signup" | "university";
type UniStatusFilter = UniversityFeeStatusDb | "queue";

const FEE_KINDS: UniversityFeeKindDb[] = [
  "application_fee",
  "tuition",
  "offer_deposit",
  "visa_fee",
  "other",
];

const SIGNUP_STATUS_TABS: { id: SignupFeeQueueStatusFilter; label: string }[] = [
  { id: "pending", label: "Pending verification" },
  { id: "verified", label: "Verified" },
  { id: "waived", label: "Waived" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

/** Shared fees workspace — also mounted at `/staff/finance` for specialty desks. */
export function FinanceModulePage() {
  const queryClient = useQueryClient();
  const liveStatus = useFinanceWorkspaceRealtime(true);
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>("signup");
  const [signupStatus, setSignupStatus] = useState<SignupFeeQueueStatusFilter>("pending");
  const [signupSearch, setSignupSearch] = useState("");
  const [signupSearchApplied, setSignupSearchApplied] = useState("");
  const [signupOffset, setSignupOffset] = useState(0);
  const signupPageSize = 50;
  const [statusFilter, setStatusFilter] = useState<UniStatusFilter>("queue");
  const [msg, setMsg] = useState<string | null>(null);
  const [signupNotes, setSignupNotes] = useState("");
  const [confirmSignup, setConfirmSignup] = useState<{
    studentId: string;
    feeId: string;
    action: "verify" | "waive" | "reject";
    label: string;
    amountLabel: string;
    status: string;
  } | null>(null);
  const [createForm, setCreateForm] = useState({
    studentId: "",
    amount: "",
    kind: "application_fee" as UniversityFeeKindDb,
    label: "",
    currency: "PKR",
    applicationId: "",
    offerId: "",
  });
  const [claimForm, setClaimForm] = useState({
    obligationId: "",
    paymentMethod: "",
    referenceReceipt: "",
  });

  const uniFilters = useMemo(() => {
    if (statusFilter === "queue") return {};
    return { status: statusFilter };
  }, [statusFilter]);

  const feesQ = useQuery({
    queryKey: ["admin", "university-fee-queue", uniFilters],
    queryFn: () => listUniversityFeeQueue(uniFilters),
    staleTime: 15_000,
    enabled: ledgerTab === "university",
  });

  const signupQ = useQuery({
    queryKey: [
      "admin",
      "signup-fee-queue",
      signupStatus,
      signupSearchApplied,
      signupOffset,
      signupPageSize,
    ],
    queryFn: () => {
      const filters: Parameters<typeof listSignupFeeQueue>[0] = {
        status: signupStatus,
        limit: signupPageSize,
        offset: signupOffset,
      };
      if (signupSearchApplied) filters.search = signupSearchApplied;
      return listSignupFeeQueue(filters);
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    enabled: ledgerTab === "signup",
  });

  const coordQ = useQuery({
    queryKey: [...FEE_QUEUE_KEY, "finance"],
    queryFn: () => listFeeVerificationRequests({ includeResolved: false }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    enabled: ledgerTab === "signup",
  });

  const invalidateUni = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "university-fee-queue"] });
  };

  const invalidateSignup = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "signup-fee-queue"] });
    await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
  };

  const createM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof createUniversityFeeObligation>[0] = {
        studentId: createForm.studentId.trim(),
        amount: Number(createForm.amount),
        kind: createForm.kind,
        label: createForm.label.trim() || createForm.kind,
        currency: createForm.currency.trim() || "PKR",
      };
      const applicationId = createForm.applicationId.trim();
      const offerId = createForm.offerId.trim();
      if (applicationId) payload.applicationId = applicationId;
      if (offerId) payload.offerId = offerId;
      return createUniversityFeeObligation(payload);
    },
    onSuccess: async () => {
      setMsg("University fee obligation created (separate from signup fees).");
      setCreateForm({
        studentId: "",
        amount: "",
        kind: "application_fee",
        label: "",
        currency: "PKR",
        applicationId: "",
        offerId: "",
      });
      await invalidateUni();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Could not create fee obligation.")),
  });

  const claimM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof claimUniversityFeePayment>[0] = {
        obligationId: claimForm.obligationId.trim(),
      };
      const paymentMethod = claimForm.paymentMethod.trim();
      const referenceReceipt = claimForm.referenceReceipt.trim();
      if (paymentMethod) payload.paymentMethod = paymentMethod;
      if (referenceReceipt) payload.referenceReceipt = referenceReceipt;
      return claimUniversityFeePayment(payload);
    },
    onSuccess: async () => {
      setMsg("University payment claimed — still pending Accounts verification.");
      setClaimForm({ obligationId: "", paymentMethod: "", referenceReceipt: "" });
      await invalidateUni();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Claim failed.")),
  });

  const verifyM = useMutation({
    mutationFn: (input: { obligationId: string; action: "verify" | "waive" | "reject" }) =>
      verifyUniversityFeePayment(input),
    onSuccess: async (_data, vars) => {
      setMsg(`University fee ${vars.action} recorded with audit history.`);
      await invalidateUni();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Verification denied or failed.")),
  });

  const signupVerifyM = useMutation({
    mutationFn: (input: { studentId: string; action: "verify" | "waive" | "reject" }) =>
      verifySignupFee({
        studentId: input.studentId,
        action: input.action,
        activatePortal: input.action === "verify" || input.action === "waive",
        ...(signupNotes.trim() ? { notes: signupNotes.trim() } : {}),
      }),
    onSuccess: async (data, vars) => {
      const unchanged =
        data && typeof data === "object" && "unchanged" in data
          ? Boolean((data as { unchanged?: boolean }).unchanged)
          : false;
      const warn =
        data && typeof data === "object" && "requestSyncWarning" in data
          ? (data as { requestSyncWarning?: string | null }).requestSyncWarning
          : null;
      const serverMsg =
        data && typeof data === "object" && "message" in data
          ? String((data as { message?: string | null }).message ?? "")
          : "";
      setMsg(
        unchanged
          ? serverMsg || `Already ${vars.action}d — ledger refreshed.`
          : warn
            ? `Signup fee ${vars.action} recorded. ${warn}`
            : `Signup fee ${vars.action} recorded. Front Desk request closed when present. Claimed is never treated as verified.`,
      );
      setSignupNotes("");
      setConfirmSignup(null);
      await invalidateSignup();
    },
    onError: (err) => {
      setConfirmSignup(null);
      setMsg(portalErrorMessage(err, "Signup fee verification denied or failed."));
      void invalidateSignup();
    },
  });

  const fees = feesQ.data?.fees ?? [];
  const signupRows = signupQ.data?.rows ?? [];
  const forwarded = (coordQ.data?.rows ?? []).filter((r) => r.status === "in_progress");

  const uniBlocked =
    feesQ.isError &&
    (/403|permission/i.test(portalErrorMessage(feesQ.error)) ||
      portalErrorMessage(feesQ.error).includes("403"));

  const financeTitle = "Finance — fees & verification";
  const financeSubtitle =
    "Signup/intake and university/application fees are separate ledgers. Claimed is never treated as verified.";

  if (ledgerTab === "signup" && signupQ.isLoading && !signupQ.data) {
    return (
      <PageLoadState title={financeTitle} subtitle={financeSubtitle}>
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (ledgerTab === "university" && feesQ.isLoading && !feesQ.data) {
    return (
      <PageLoadState title={financeTitle} subtitle={financeSubtitle}>
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (uniBlocked && signupQ.isError) {
    return (
      <PageLoadState title={financeTitle} subtitle={financeSubtitle}>
        <PermissionDenied body={portalErrorMessage(feesQ.error)} />
      </PageLoadState>
    );
  }

  const pendingCount = signupQ.data?.pendingCount ?? 0;
  const verifiedCount = signupQ.data?.verifiedCount ?? 0;
  const rejectedCount = signupQ.data?.rejectedCount ?? 0;
  const waivedCount = signupQ.data?.waivedCount ?? 0;
  const verifiedByCurrency = signupQ.data?.verifiedByCurrency ?? [];
  const verifiedTodayByCurrency = signupQ.data?.verifiedTodayByCurrency ?? [];
  const matchedCount = signupQ.data?.matchedCount ?? signupRows.length;
  const canPagePrev = signupOffset > 0;
  const canPageNext = signupOffset + signupPageSize < matchedCount;
  const lastSync = signupQ.data?.fetchedAt
    ? new Date(signupQ.data.fetchedAt).toLocaleTimeString()
    : null;
  const formatCash = (rows: { currency: string; total: number }[]) =>
    rows.length ? rows.map((r) => `${r.currency} ${r.total.toLocaleString()}`).join(" · ") : "—";

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={financeTitle}
        subtitle={financeSubtitle}
        actions={<LiveBadge status={liveStatus} lastSync={lastSync} />}
      />

      {msg ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            /denied|failed|error|already marked/i.test(msg)
              ? "border-danger/30 bg-danger-soft text-danger"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
          role="status"
        >
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <Button
          size="sm"
          variant={ledgerTab === "signup" ? "navy" : "outline"}
          onClick={() => setLedgerTab("signup")}
        >
          Signup / intake fees
        </Button>
        <Button
          size="sm"
          variant={ledgerTab === "university" ? "navy" : "outline"}
          onClick={() => setLedgerTab("university")}
        >
          University / application fees
        </Button>
      </div>

      {ledgerTab === "signup" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Pending verification"
              value={signupQ.isLoading && !signupQ.data ? "…" : String(pendingCount)}
              hint="Unpaid + claimed only (not revenue)"
            />
            <StatCard
              label="Verified (count)"
              value={signupQ.isLoading && !signupQ.data ? "…" : String(verifiedCount)}
              hint="Cash received — excludes waived"
            />
            <StatCard
              label="Rejected"
              value={signupQ.isLoading && !signupQ.data ? "…" : String(rejectedCount)}
              hint="Needs correction / re-claim"
            />
            <StatCard
              label="Waived"
              value={signupQ.isLoading && !signupQ.data ? "…" : String(waivedCount)}
              hint="Not counted as cash received"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Verified cash (all time)"
              value={signupQ.isLoading && !signupQ.data ? "…" : formatCash(verifiedByCurrency)}
              hint="Sum of verified amounts by currency — no FX conversion"
            />
            <StatCard
              label="Verified cash (today)"
              value={signupQ.isLoading && !signupQ.data ? "…" : formatCash(verifiedTodayByCurrency)}
              hint="Based on verified_at date (local midnight)"
            />
          </div>

          {forwarded.length > 0 ? (
            <Panel title="Needs attention — Front Desk forwards">
              <p className="mb-2 text-sm text-muted-foreground">
                Counsellor requests marked in progress / forwarded. Match against unpaid or claimed
                signup fees below — payment status remains the source of truth.
              </p>
              <ul className="divide-y divide-border text-sm">
                {forwarded.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-navy">
                        {r.fullName || r.caseId || r.studentId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {r.summary || "No summary"}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Signup fee ledger"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={signupQ.isFetching}
                onClick={() => void signupQ.refetch()}
              >
                {signupQ.isFetching ? "Refreshing…" : "Refresh"}
              </Button>
            }
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Authoritative signup_fee_payments records. Claimed is never verified until Accounts
              acts. Verifying here also closes linked Front Desk counselling requests (same
              decision).
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              {SIGNUP_STATUS_TABS.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={signupStatus === t.id ? "navy" : "outline"}
                  onClick={() => {
                    setSignupStatus(t.id);
                    setSignupOffset(0);
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <Input
                  placeholder="Search student name, case ID, or receipt/reference"
                  value={signupSearch}
                  onChange={(e) => setSignupSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSignupSearchApplied(signupSearch.trim());
                      setSignupOffset(0);
                    }
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSignupSearchApplied(signupSearch.trim());
                  setSignupOffset(0);
                }}
              >
                Search
              </Button>
              {signupSearchApplied ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSignupSearch("");
                    setSignupSearchApplied("");
                    setSignupOffset(0);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="mb-3">
              <Textarea
                placeholder="Notes required for reject / waive (optional for verify)"
                value={signupNotes}
                onChange={(e) => setSignupNotes(e.target.value)}
              />
            </div>

            {confirmSignup ? (
              <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm">
                <p className="font-medium text-navy">
                  Confirm {confirmSignup.action} for {confirmSignup.label}?
                </p>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="uppercase tracking-wide">Amount</dt>
                    <dd className="font-medium text-navy">{confirmSignup.amountLabel}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide">Current status</dt>
                    <dd className="font-medium text-navy capitalize">
                      {confirmSignup.status.replaceAll("_", " ")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  Runs the trusted verify RPC (not a direct table edit). Closes open Front Desk
                  coordination requests. Reject/waive require notes above.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="navy"
                    disabled={signupVerifyM.isPending}
                    onClick={() => {
                      setMsg(null);
                      signupVerifyM.mutate({
                        studentId: confirmSignup.studentId,
                        action: confirmSignup.action,
                      });
                    }}
                  >
                    {signupVerifyM.isPending ? "Saving…" : `Confirm ${confirmSignup.action}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={signupVerifyM.isPending}
                    onClick={() => setConfirmSignup(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {signupQ.isLoading && !signupQ.data ? (
              <p className="text-sm text-muted-foreground">Loading signup fee ledger…</p>
            ) : signupQ.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-danger">
                  Unable to load signup fees. This is an error, not an empty ledger. Retry.
                </p>
                <p className="text-xs text-muted-foreground">{portalErrorMessage(signupQ.error)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void signupQ.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : !signupRows.length ? (
              <EmptyState
                title={
                  signupStatus === "pending"
                    ? "No signup fees awaiting verification"
                    : "No matching signup fee records"
                }
                body="Adjust filters or search. Historical verified/rejected/waived rows appear under those tabs."
              />
            ) : (
              <>
                <TableWrap>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Student / case</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Claim</th>
                        <th className="px-3 py-2">Obligation → claim → decision</th>
                        <th className="px-3 py-2">Counsellor request</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signupRows.map((row) => {
                        const stillOpen = !isSignupFeeVerified(row.status as SignupFeeStatusDb);
                        const actionable =
                          stillOpen && (row.status === "unpaid" || row.status === "claimed");
                        return (
                          <tr key={row.feeId} className="border-b border-border/60 align-top">
                            <td className="px-3 py-2">
                              <div className="font-medium text-navy">
                                {row.studentName ?? row.studentId.slice(0, 8)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Case {row.caseId || "—"}
                              </div>
                              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                {row.studentId.slice(0, 8)}…
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {row.currency} {row.amount.toLocaleString()}
                            </td>
                            <td className="max-w-[12rem] px-3 py-2 text-xs text-muted-foreground">
                              {[
                                row.paymentMethod,
                                row.referenceReceipt ? `Ref: ${row.referenceReceipt}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No method/reference recorded"}
                              <div className="mt-1 text-[11px]">
                                Claimed/updated {fmtDate(row.updatedAt.slice(0, 10))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={row.status} />
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {row.status === "unpaid"
                                  ? "Obligation open — not claimed"
                                  : row.status === "claimed"
                                    ? "Payment claimed — awaiting verify"
                                    : row.verifiedAt
                                      ? `Decision ${fmtDate(row.verifiedAt.slice(0, 10))}`
                                      : "Closed"}
                              </div>
                            </td>
                            <td className="max-w-[12rem] px-3 py-2 text-xs text-muted-foreground">
                              {row.openRequestStatus ? (
                                <>
                                  <StatusBadge status={row.openRequestStatus} />
                                  <p className="mt-1">{row.openRequestSummary || "—"}</p>
                                </>
                              ) : (
                                "No open counsellor request"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {actionable ? (
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    size="sm"
                                    variant="navy"
                                    disabled={signupVerifyM.isPending}
                                    onClick={() => {
                                      setMsg(null);
                                      setConfirmSignup({
                                        studentId: row.studentId,
                                        feeId: row.feeId,
                                        action: "verify",
                                        label: row.caseId || row.studentName || "student",
                                        amountLabel: `${row.currency} ${row.amount.toLocaleString()}`,
                                        status: row.status,
                                      });
                                    }}
                                  >
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      signupVerifyM.isPending || signupNotes.trim().length < 3
                                    }
                                    onClick={() => {
                                      setMsg(null);
                                      setConfirmSignup({
                                        studentId: row.studentId,
                                        feeId: row.feeId,
                                        action: "waive",
                                        label: row.caseId || row.studentName || "student",
                                        amountLabel: `${row.currency} ${row.amount.toLocaleString()}`,
                                        status: row.status,
                                      });
                                    }}
                                  >
                                    Waive
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={
                                      signupVerifyM.isPending || signupNotes.trim().length < 3
                                    }
                                    onClick={() => {
                                      setMsg(null);
                                      setConfirmSignup({
                                        studentId: row.studentId,
                                        feeId: row.feeId,
                                        action: "reject",
                                        label: row.caseId || row.studentName || "student",
                                        amountLabel: `${row.currency} ${row.amount.toLocaleString()}`,
                                        status: row.status,
                                      });
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {row.status.replaceAll("_", " ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Showing {signupRows.length} of {matchedCount} (offset {signupOffset})
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canPagePrev || signupQ.isFetching}
                      onClick={() => setSignupOffset((o) => Math.max(0, o - signupPageSize))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canPageNext || signupQ.isFetching}
                      onClick={() => setSignupOffset((o) => o + signupPageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}

            {coordQ.isError ? (
              <p className="mt-3 text-xs text-danger">
                Could not load Front Desk coordination count: {portalErrorMessage(coordQ.error)}
              </p>
            ) : null}
          </Panel>
        </>
      ) : (
        <div>
          <PageHeader
            title="University fees"
            subtitle="Application, tuition, offer deposit and visa fee obligations — separate from signup fees. Verifying a university fee does not close signup coordination requests."
          />

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["queue", "Pending queue"],
                ["claimed", "Claimed"],
                ["due", "Due"],
                ["verified", "Verified"],
                ["waived", "Waived"],
                ["rejected", "Rejected"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={statusFilter === value ? "navy" : "outline"}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={feesQ.isFetching}
              onClick={() => void feesQ.refetch()}
            >
              {feesQ.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Create university fee obligation">
              <div className="grid gap-2 text-sm">
                <Input
                  placeholder="Student ID (UUID)"
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, studentId: e.target.value }))}
                />
                <Input
                  placeholder="Amount"
                  type="number"
                  min={0}
                  value={createForm.amount}
                  onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <select
                  className="h-9 rounded-md border border-border bg-background px-2"
                  value={createForm.kind}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, kind: e.target.value as UniversityFeeKindDb }))
                  }
                >
                  {FEE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Label (optional)"
                  value={createForm.label}
                  onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))}
                />
                <Input
                  placeholder="Currency"
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value }))}
                />
                <Input
                  placeholder="Application ID (optional)"
                  value={createForm.applicationId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, applicationId: e.target.value }))}
                />
                <Input
                  placeholder="Offer ID (optional)"
                  value={createForm.offerId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, offerId: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="navy"
                  disabled={!createForm.studentId.trim() || !createForm.amount || createM.isPending}
                  onClick={() => {
                    setMsg(null);
                    createM.mutate();
                  }}
                >
                  Create obligation
                </Button>
              </div>
            </Panel>

            <Panel title="Claim university payment (not verified)">
              <div className="grid gap-2 text-sm">
                <Input
                  placeholder="Obligation ID"
                  value={claimForm.obligationId}
                  onChange={(e) => setClaimForm((f) => ({ ...f, obligationId: e.target.value }))}
                />
                <Input
                  placeholder="Payment method"
                  value={claimForm.paymentMethod}
                  onChange={(e) => setClaimForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                />
                <Input
                  placeholder="Reference / receipt"
                  value={claimForm.referenceReceipt}
                  onChange={(e) =>
                    setClaimForm((f) => ({ ...f, referenceReceipt: e.target.value }))
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!claimForm.obligationId.trim() || claimM.isPending}
                  onClick={() => {
                    setMsg(null);
                    claimM.mutate();
                  }}
                >
                  Mark claimed
                </Button>
                <p className="text-xs text-muted-foreground">
                  Claimed university payments stay unpaid until Accounts/Admin verifies.
                </p>
              </div>
            </Panel>
          </div>

          {feesQ.isLoading && !feesQ.data ? (
            <p className="text-sm text-muted-foreground">Loading university fee queue…</p>
          ) : feesQ.isError ? (
            <ErrorState body={portalErrorMessage(feesQ.error)} />
          ) : !fees.length ? (
            <EmptyState
              title="No university fee rows"
              body="Create an obligation or claim a payment to populate this ledger. Signup fees are on the Signup / intake tab."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Kind</th>
                  <th>Label</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id}>
                    <td className="font-medium text-navy">
                      {fee.studentName ?? fee.studentId.slice(0, 8)}
                      {fee.studentCaseId ? (
                        <span className="block text-xs text-muted-foreground">
                          {fee.studentCaseId}
                        </span>
                      ) : null}
                    </td>
                    <td>{fee.kind}</td>
                    <td>{fee.label}</td>
                    <td>
                      {fee.currency} {fee.amount.toLocaleString()}
                    </td>
                    <td>
                      <StatusBadge status={fee.status} />
                    </td>
                    <td className="max-w-[10rem] truncate text-xs">
                      {fee.referenceReceipt ?? fee.paymentMethod ?? "—"}
                    </td>
                    <td>{fee.dueDate ? fmtDate(fee.dueDate) : "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {fee.status === "due" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setClaimForm({
                                obligationId: fee.id,
                                paymentMethod: fee.paymentMethod ?? "",
                                referenceReceipt: fee.referenceReceipt ?? "",
                              });
                            }}
                          >
                            Claim…
                          </Button>
                        ) : null}
                        {fee.status === "claimed" || fee.status === "due" ? (
                          <>
                            <Button
                              size="sm"
                              variant="navy"
                              disabled={verifyM.isPending}
                              onClick={() => {
                                setMsg(null);
                                verifyM.mutate({ obligationId: fee.id, action: "verify" });
                              }}
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={verifyM.isPending}
                              onClick={() => {
                                setMsg(null);
                                verifyM.mutate({ obligationId: fee.id, action: "waive" });
                              }}
                            >
                              Waive
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={verifyM.isPending}
                              onClick={() => {
                                setMsg(null);
                                verifyM.mutate({ obligationId: fee.id, action: "reject" });
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {fee.verifiedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(fee.verifiedAt)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}
    </div>
  );
}

function LiveBadge({
  status,
  lastSync,
}: {
  status: "live" | "reconnecting" | "offline" | "connecting";
  lastSync: string | null;
}) {
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting" || status === "connecting"
        ? "Reconnecting"
        : lastSync
          ? `Last updated ${lastSync}`
          : "Offline";
  return (
    <span
      className={cn(
        "rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        status === "live"
          ? "bg-emerald-50 text-emerald-800"
          : status === "offline"
            ? "bg-slate-100 text-slate-600"
            : "bg-amber-50 text-amber-800",
      )}
      title={lastSync ? `Synced ${lastSync}` : undefined}
    >
      {label}
    </span>
  );
}
