import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
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

export const Route = createFileRoute("/admin/finance")({
  component: FinanceModulePage,
});

type StatusFilter = UniversityFeeStatusDb | "queue";

const FEE_KINDS: UniversityFeeKindDb[] = [
  "application_fee",
  "tuition",
  "offer_deposit",
  "visa_fee",
  "other",
];

/** Shared fees workspace — also mounted at `/staff/finance` for specialty desks. */
export function FinanceModulePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("queue");
  const [msg, setMsg] = useState<string | null>(null);
  const [signupNotes, setSignupNotes] = useState("");
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

  const filters = useMemo(() => {
    if (statusFilter === "queue") return {};
    return { status: statusFilter };
  }, [statusFilter]);

  const feesQ = useQuery({
    queryKey: ["admin", "university-fee-queue", filters],
    queryFn: () => listUniversityFeeQueue(filters),
    staleTime: 15_000,
  });

  const signupQ = useQuery({
    queryKey: ["admin", "signup-fee-queue"],
    queryFn: listSignupFeeQueue,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const coordQ = useQuery({
    queryKey: ["front-desk", "fee-verification-requests", "finance"],
    queryFn: () => listFeeVerificationRequests({ includeResolved: false }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const invalidateUni = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "university-fee-queue"] });
  };

  const invalidateSignup = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "signup-fee-queue"] });
    await queryClient.invalidateQueries({ queryKey: ["front-desk", "fee-verification-requests"] });
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
    mutationFn: (input: {
      studentId: string;
      action: "verify" | "waive" | "reject";
    }) =>
      verifySignupFee({
        studentId: input.studentId,
        action: input.action,
        activatePortal: input.action === "verify" || input.action === "waive",
        ...(signupNotes.trim() ? { notes: signupNotes.trim() } : {}),
      }),
    onSuccess: async (_data, vars) => {
      setMsg(
        `Signup fee ${vars.action} recorded. Claimed is never treated as verified. Front Desk and counsellor notified.`,
      );
      setSignupNotes("");
      await invalidateSignup();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Signup fee verification denied or failed.")),
  });

  const fees = feesQ.data?.fees ?? [];
  const signupRows = signupQ.data?.rows ?? [];
  const forwarded = (coordQ.data?.rows ?? []).filter((r) => r.status === "in_progress");

  const uniBlocked =
    feesQ.isError &&
    (/403|permission/i.test(portalErrorMessage(feesQ.error)) ||
      portalErrorMessage(feesQ.error).includes("403"));

  if (feesQ.isLoading && signupQ.isLoading) return <LoadingRows rows={8} />;
  if (uniBlocked && signupQ.isError) {
    return <PermissionDenied body={portalErrorMessage(feesQ.error)} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance — fees & verification"
        subtitle="Signup fees (intake) and university/application fees are separate ledgers. Claimed is never verified until Accounts/Admin acts."
      />

      {msg ? <p className="text-sm text-navy">{msg}</p> : null}

      <Panel
        title="Signup fee verification queue"
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
          Unpaid and claimed intake signup fees awaiting authorized verify, waive, or reject.
          Counsellor coordination requests forwarded by Front Desk appear below when present.
        </p>
        <div className="mb-3">
          <Textarea
            placeholder="Notes required for reject / waive (optional for verify)"
            value={signupNotes}
            onChange={(e) => setSignupNotes(e.target.value)}
          />
        </div>
        {signupQ.isLoading && !signupQ.data ? (
          <p className="text-sm text-muted-foreground">Loading signup fee queue…</p>
        ) : signupQ.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-danger">
              Unable to load signup fees. The queue may be out of date. Retry.
            </p>
            <p className="text-xs text-muted-foreground">
              {portalErrorMessage(signupQ.error)}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void signupQ.refetch()}>
              Retry
            </Button>
          </div>
        ) : !signupRows.length ? (
          <EmptyState
            title="No signup fees awaiting verification"
            body="When Front Desk records a claimed or unpaid signup fee, or a counsellor request is forwarded, it appears here."
          />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Claim</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Counsellor request</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {signupRows.map((row) => {
                  const stillOpen = !isSignupFeeVerified(row.status as SignupFeeStatusDb);
                  return (
                    <tr key={row.feeId} className="border-b border-border/60 align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-navy">
                          {row.studentName ?? row.studentId.slice(0, 8)}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.caseId || "—"}</div>
                        <Button asChild size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs">
                          <Link
                            to="/staff/students/$studentId"
                            params={{ studentId: row.studentId }}
                            search={{ tab: "assessment" }}
                          >
                            View case
                          </Link>
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {row.currency} {row.amount.toLocaleString()}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2 text-xs text-muted-foreground">
                        {[row.paymentMethod, row.referenceReceipt ? `Ref: ${row.referenceReceipt}` : null]
                          .filter(Boolean)
                          .join(" · ") || "No method/reference"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Updated {fmtDate(row.updatedAt.slice(0, 10))}
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
                        {stillOpen ? (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="navy"
                              disabled={signupVerifyM.isPending}
                              onClick={() => {
                                setMsg(null);
                                signupVerifyM.mutate({
                                  studentId: row.studentId,
                                  action: "verify",
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
                                signupVerifyM.mutate({
                                  studentId: row.studentId,
                                  action: "waive",
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
                                signupVerifyM.mutate({
                                  studentId: row.studentId,
                                  action: "reject",
                                });
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}

        {!coordQ.isError && forwarded.length > 0 ? (
          <div className="mt-4 rounded border border-border/70 bg-accent/20 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-navy">{forwarded.length}</strong> counsellor request
            {forwarded.length === 1 ? "" : "s"} marked{" "}
            <span className="font-medium text-navy">forwarded / in progress</span> by Front Desk.
            Matching unpaid/claimed signup fees are listed above for verification.
          </div>
        ) : null}
      </Panel>

      <div>
        <PageHeader
          title="University fees"
          subtitle="Application, tuition, offer deposit and visa fee obligations — separate from signup fees."
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
                onChange={(e) => setClaimForm((f) => ({ ...f, referenceReceipt: e.target.value }))}
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
            body="Create an obligation or claim a payment to populate this ledger. Signup fees are listed in the section above."
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
                      <span className="block text-xs text-muted-foreground">{fee.studentCaseId}</span>
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
    </div>
  );
}
