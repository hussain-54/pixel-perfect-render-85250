import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { FrontDeskRegistrationFormA4 } from "@/components/portal/FrontDeskRegistrationFormA4";
import { SignupFeeVoucherA4 } from "@/components/portal/SignupFeeVoucherA4";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { describeJourneyStageLabel, deriveFrontDeskNextAction } from "@/lib/front-desk-workspace";
import {
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  requestStuckAfterFeeDecision,
} from "@/lib/fee-verification-workflow";
import { INTAKE_FEE_PAYMENT_METHODS } from "@/lib/intake-form-options";
import {
  describePersistedSignupFeeStatus,
  printCaseDocumentPdf,
  printRegistrationFormPdf,
} from "@/lib/registration-form-a4";
import {
  describeSignupFeeOperationalStatus,
  formatSignupFeeAmount,
  voucherPrintFilename,
} from "@/lib/signup-fee-voucher";
import {
  intakePortalStatusFromRow,
  studentPortalAccountStatusLabel,
} from "@/lib/student-portal-account";
import { FEE_QUEUE_KEY } from "@/lib/use-fee-verification-queue-realtime";
import { cn } from "@/lib/utils";
import {
  assignCounsellor,
  forwardFeeVerificationRequest,
  getFrontDeskIntakeRecord,
  listCounsellorDesks,
  reconcileFeeVerificationFromFee,
  recordSignupFee,
  returnFeeVerificationRequest,
} from "@/services";

export const Route = createFileRoute("/staff/intake/$studentId")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: string | null; role?: string } }).auth;
    if (auth?.role === "consultant" && !isFrontDeskBusinessRole(auth.businessRole as never)) {
      throw redirect({ to: "/staff/students" });
    }
  },
  component: FrontDeskIntakeRecordPage,
});

function FrontDeskIntakeRecordPage() {
  const { studentId } = Route.useParams();
  const queryClient = useQueryClient();
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeCurrency, setFeeCurrency] = useState("PKR");
  const [feeMethod, setFeeMethod] = useState("");
  const [feeReference, setFeeReference] = useState("");
  const [feeNotes, setFeeNotes] = useState("");

  const recordQ = useQuery({
    queryKey: ["front-desk", "record", studentId],
    queryFn: () => getFrontDeskIntakeRecord(studentId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const desksQ = useQuery({
    queryKey: ["front-desk", "counsellor-desks"],
    queryFn: listCounsellorDesks,
    staleTime: 60_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
  };

  const assignM = useMutation({
    mutationFn: (consultantId: string) => assignCounsellor({ studentId, consultantId }),
    onSuccess: async () => {
      setActionMsg("Counsellor assigned.");
      await invalidate();
    },
    onError: (e) => setActionMsg(portalErrorMessage(e, "Could not assign counsellor.")),
  });

  const forwardM = useMutation({
    mutationFn: (requestId: string) => forwardFeeVerificationRequest({ requestId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Forwarded to Accounts / Finance.");
      await invalidate();
    },
    onError: (e) => setActionMsg(portalErrorMessage(e, "Could not forward request.")),
  });

  const returnM = useMutation({
    mutationFn: () =>
      returnFeeVerificationRequest({ requestId: returnForId!, reason: returnReason }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Returned to counsellor.");
      setReturnForId(null);
      setReturnReason("");
      await invalidate();
    },
    onError: (e) => setActionMsg(portalErrorMessage(e, "Could not return request.")),
  });

  const reconcileM = useMutation({
    mutationFn: () => reconcileFeeVerificationFromFee({ studentId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Request synced from fee status.");
      await invalidate();
    },
    onError: (e) => setActionMsg(portalErrorMessage(e, "Could not sync request.")),
  });

  useEffect(() => {
    const fee = recordQ.data?.signupFee;
    if (!fee) return;
    setFeeAmount((prev) => (prev ? prev : String(fee.amount)));
    setFeeCurrency(fee.currency || "PKR");
    setFeeMethod(fee.paymentMethod || "");
    setFeeReference(fee.referenceReceipt || "");
    setFeeNotes(fee.notes || "");
  }, [recordQ.data?.signupFee]);

  const feeM = useMutation({
    mutationFn: (input: { markClaimed: boolean }) => {
      const amount = Number(feeAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Enter a valid fee amount.");
      }
      const payload: Parameters<typeof recordSignupFee>[0] = {
        studentId,
        amount,
        currency: feeCurrency.trim() || "PKR",
        markClaimed: input.markClaimed,
      };
      if (feeMethod.trim()) payload.paymentMethod = feeMethod.trim();
      if (feeReference.trim()) payload.referenceReceipt = feeReference.trim();
      if (feeNotes.trim()) payload.notes = feeNotes.trim();
      return recordSignupFee(payload);
    },
    onSuccess: async (res, vars) => {
      setActionMsg(
        vars.markClaimed
          ? "Payment proof submitted — awaiting Finance verification. This is not verified."
          : "Fee voucher obligation saved (unpaid). Print the voucher for the student.",
      );
      setShowVoucher(true);
      await invalidate();
      await recordQ.refetch();
      if (res?.fee) {
        setFeeAmount(String(res.fee.amount));
        setFeeCurrency(res.fee.currency || "PKR");
        setFeeMethod(res.fee.paymentMethod || "");
        setFeeReference(res.fee.referenceReceipt || "");
      }
    },
    onError: (e) => setActionMsg(portalErrorMessage(e, "Could not save signup fee.")),
  });

  if (recordQ.isLoading) {
    return (
      <PageLoadState title="Registration record">
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (recordQ.isError) {
    const msg = portalErrorMessage(recordQ.error);
    if (/403|404|permission|not authorized|not found/i.test(msg)) {
      return (
        <PageLoadState title="Registration record">
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title="Registration record">
        <ErrorState body={msg} onRetry={() => void recordQ.refetch()} />
      </PageLoadState>
    );
  }

  const data = recordQ.data;
  if (!data?.student) {
    return (
      <PageLoadState title="Registration record">
        <EmptyState
          title="Record not found"
          body="This registration is not available to Front Desk."
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/intake">Back to registrations</Link>
            </Button>
          }
        />
      </PageLoadState>
    );
  }

  const student = data.student;
  const feeRequests = data.feeRequests ?? [];
  const openFeeRequest =
    feeRequests.find((r) => r.status === "open" || r.status === "in_progress") ??
    feeRequests.find((r) => r.status === "cancelled") ??
    null;
  const nextAction =
    data.nextAction ??
    deriveFrontDeskNextAction({
      assignmentStatus: student.assignmentStatus,
      signupFeeStatus: student.signupFeeStatus,
      openFeeRequest,
    });
  const signupFee = data.signupFee;
  const feeStatus = signupFee?.status ?? student.signupFeeStatus;
  const feeDisplay = describePersistedSignupFeeStatus(feeStatus);
  const feeOps = describeSignupFeeOperationalStatus(feeStatus);
  const portalStatus = intakePortalStatusFromRow({
    profileId: student.profileId,
    portalActivatedAt: student.portalActivatedAt,
  });
  const timeline = data.timeline ?? [];
  const feeFinalized = feeStatus === "verified" || feeStatus === "waived";
  const canIssueVoucher = !feeFinalized;
  const canSubmitProof =
    !feeFinalized &&
    (feeStatus === "unpaid" || feeStatus === "claimed" || feeStatus === "rejected" || !feeStatus);

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title={student.fullName}
        subtitle={`${student.caseId} · Front Desk registration record`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/intake">All registrations</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/front-desk">Dashboard</Link>
            </Button>
            <Button type="button" size="sm" variant="navy" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Hide form" : "View / PDF"}
            </Button>
          </div>
        }
      />

      {actionMsg ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-navy">
          {actionMsg}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Registration summary">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Case
              </dt>
              <dd className="mt-0.5 font-medium text-navy">{student.caseId}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Registered
              </dt>
              <dd className="mt-0.5">{fmtDate(student.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="mt-0.5 break-all">{student.email}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </dt>
              <dd className="mt-0.5">{student.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Destination / programme
              </dt>
              <dd className="mt-0.5">
                {student.destination || "—"}
                {student.program ? ` · ${student.program}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Last updated
              </dt>
              <dd className="mt-0.5">{fmtDate(student.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Registrar
              </dt>
              <dd className="mt-0.5">{student.registrarName || "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Portal login
              </dt>
              <dd className="mt-0.5">{studentPortalAccountStatusLabel(portalStatus)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Status & next step">
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-navy/15 bg-navy/[0.03] px-3 py-2.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Next required action
              </p>
              <p className="mt-1 font-medium text-navy">{nextAction.label}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Counsellor</span>
              {student.assignmentStatus === "pending" ? (
                <StatusBadge status="Pending" />
              ) : (
                <span className="font-medium">{student.counsellorName || "Assigned"}</span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Signup fee (Accounts decides verify)</p>
              <p className="font-medium text-navy">{feeDisplay.label}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Journey stage (not an application decision)
              </p>
              <p className="capitalize font-medium text-navy">
                {describeJourneyStageLabel(student.journeyStage)}
              </p>
            </div>
            {student.assignmentStatus === "pending" ? (
              <div>
                <label htmlFor="fd-record-assign" className="text-xs font-medium text-navy">
                  Assign counsellor
                </label>
                <select
                  id="fd-record-assign"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  disabled={assignM.isPending}
                  defaultValue=""
                  onChange={(e) => {
                    const consultantId = e.target.value;
                    if (!consultantId) return;
                    assignM.mutate(consultantId);
                  }}
                >
                  <option value="">
                    {assignM.isPending ? "Assigning…" : "Select counsellor…"}
                  </option>
                  {(desksQ.data?.options ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Signup fee voucher & payment proof">
        <p className="mb-3 text-sm text-navy/70">
          Authoritative ledger: signup/intake fee only. Issuing a voucher or uploading proof never
          verifies payment — Finance decides via the trusted Accounts workflow.
        </p>
        <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium text-navy">{feeOps.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {signupFee
              ? `${signupFee.voucherNumber} · ${formatSignupFeeAmount(signupFee.amount, signupFee.currency)}`
              : feeDisplay.label}
          </p>
        </div>

        {canIssueVoucher ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="fd-fee-amount">Amount</Label>
              <Input
                id="fd-fee-amount"
                type="number"
                min={0}
                step="0.01"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                disabled={feeM.isPending || (Boolean(signupFee) && feeStatus === "claimed")}
              />
            </div>
            <div>
              <Label htmlFor="fd-fee-currency">Currency</Label>
              <Input
                id="fd-fee-currency"
                value={feeCurrency}
                onChange={(e) => setFeeCurrency(e.target.value)}
                disabled={feeM.isPending || (Boolean(signupFee) && feeStatus === "claimed")}
              />
            </div>
            <div>
              <Label htmlFor="fd-fee-method">Payment method</Label>
              <select
                id="fd-fee-method"
                className="mt-0 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={feeMethod}
                onChange={(e) => setFeeMethod(e.target.value)}
                disabled={feeM.isPending}
              >
                <option value="">Select…</option>
                {INTAKE_FEE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="fd-fee-ref">Transaction / receipt reference</Label>
              <Input
                id="fd-fee-ref"
                value={feeReference}
                onChange={(e) => setFeeReference(e.target.value)}
                disabled={feeM.isPending}
                placeholder="Required when submitting proof"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label htmlFor="fd-fee-notes">Notes (optional)</Label>
              <Textarea
                id="fd-fee-notes"
                value={feeNotes}
                onChange={(e) => setFeeNotes(e.target.value)}
                disabled={feeM.isPending}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canIssueVoucher ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={feeM.isPending || !feeAmount.trim()}
              onClick={() => feeM.mutate({ markClaimed: false })}
            >
              {signupFee ? "Update unpaid voucher" : "Issue unpaid voucher"}
            </Button>
          ) : null}
          {canSubmitProof ? (
            <Button
              type="button"
              size="sm"
              variant="navy"
              disabled={feeM.isPending || !feeAmount.trim()}
              onClick={() => feeM.mutate({ markClaimed: true })}
            >
              Submit payment proof
            </Button>
          ) : null}
          {signupFee ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowVoucher(true);
                window.setTimeout(() => {
                  printCaseDocumentPdf(
                    voucherPrintFilename(student.caseId, signupFee.voucherNumber),
                    "fee-voucher",
                  );
                }, 80);
              }}
            >
              Print / Save voucher PDF
            </Button>
          ) : null}
          {signupFee ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowVoucher((v) => !v)}
            >
              {showVoucher ? "Hide voucher" : "Show voucher"}
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Keep payment screenshots with the case. Reference and method are stored on the fee row for
          Finance review. You cannot mark this fee verified.
        </p>
        {showVoucher && signupFee ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
            <SignupFeeVoucherA4
              feeId={signupFee.feeId}
              caseId={student.caseId}
              studentName={student.fullName}
              amount={signupFee.amount}
              currency={signupFee.currency}
              status={signupFee.status}
              issuedAt={signupFee.createdAt}
            />
          </div>
        ) : null}
      </Panel>

      <Panel title="Counsellor fee-verification coordination">
        {feeRequests.length === 0 ? (
          <EmptyState
            title="No counsellor fee-verification requests"
            body="When a counsellor requests signup-fee verification, the request and Finance handoff appear here. This does not replace the signup fee ledger above."
          />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {feeRequests.map((row) => {
                  const stuck = requestStuckAfterFeeDecision({
                    requestStatus: row.status,
                    signupFeeStatus: row.signupFeeStatus,
                  });
                  const feeOk = feeStatusAllowsAdmissionHandover(row.signupFeeStatus);
                  const claim = describeFeeClaimDisplay({
                    signupFeeStatus: row.signupFeeStatus,
                    feeAmount: row.feeAmount,
                    feeCurrency: row.feeCurrency,
                    feePaymentMethod: row.feePaymentMethod,
                    feeReferenceReceipt: row.feeReferenceReceipt,
                  });
                  const forwarded = Boolean(row.forwardedAt) || row.status === "in_progress";
                  return (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          Submitted {fmtDate(row.createdAt.slice(0, 10))}
                        </div>
                        <p className="mt-1 text-xs">{row.summary || "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium text-navy">{claim.feeStatusLabel}</div>
                        <div className="text-muted-foreground">{claim.claimLabel}</div>
                        {feeOk ? (
                          <div className="mt-1 text-[11px] text-emerald-800">
                            Fee gate satisfied
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                        {forwarded && row.status !== "resolved" ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Forwarded
                            {row.forwardedAt ? ` · ${fmtDate(row.forwardedAt.slice(0, 10))}` : ""}
                          </div>
                        ) : null}
                        {stuck ? (
                          <div className="mt-1 text-[11px] font-medium text-amber-900">
                            Out of sync with fee decision
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {stuck ? (
                            <Button
                              size="sm"
                              variant="navy"
                              disabled={reconcileM.isPending}
                              onClick={() => reconcileM.mutate()}
                            >
                              Sync from fee
                            </Button>
                          ) : null}
                          {!stuck &&
                          (row.status === "open" ||
                            (row.status === "in_progress" && !row.forwardedAt)) ? (
                            <Button
                              size="sm"
                              variant="navy"
                              disabled={forwardM.isPending}
                              onClick={() => forwardM.mutate(row.id)}
                            >
                              Send to Accounts
                            </Button>
                          ) : null}
                          {!stuck && (row.status === "open" || row.status === "in_progress") ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReturnForId(row.id);
                                setReturnReason("");
                              }}
                            >
                              Return
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/staff/finance">Finance</Link>
                          </Button>
                        </div>
                        {returnForId === row.id ? (
                          <div className="mt-2 space-y-2 rounded border border-border p-2">
                            <Textarea
                              placeholder="Required reason (min 5 characters)"
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              aria-label="Return reason"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={returnM.isPending || returnReason.trim().length < 5}
                                onClick={() => returnM.mutate()}
                              >
                                Confirm return
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReturnForId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Activity timeline">
        <p className="mb-3 text-xs text-muted-foreground">
          Events are shown separately for registration, counsellor assignment, signup fee, fee
          verification, journey stage, and portal — never merged into one status.
        </p>
        {timeline.length === 0 ? (
          <EmptyState title="No timeline events" body="No authorized events are available yet." />
        ) : (
          <ol className="space-y-0 border-l border-border pl-4">
            {timeline.map((item) => (
              <li key={item.id} className="relative pb-4 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                    item.kind === "signup_fee" || item.kind === "fee_verification"
                      ? "bg-amber-600"
                      : item.kind === "counsellor"
                        ? "bg-royal"
                        : "bg-navy",
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-navy">{item.title}</p>
                  <time className="text-[11px] text-muted-foreground">
                    {fmtDate(item.at.slice(0, 10))}
                  </time>
                </div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {item.kind.replaceAll("_", " ")}
                </p>
                {item.detail ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {showForm ? (
        <Panel
          title={`Registration form — ${student.caseId}`}
          action={
            <Button
              type="button"
              size="sm"
              variant="navy"
              onClick={() => printRegistrationFormPdf(student.caseId)}
            >
              Print / Save PDF
            </Button>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <FrontDeskRegistrationFormA4 row={student} mode="view" />
          </div>
        </Panel>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Application stages, documents, and admission decisions are managed in counsellor and
        Admission workflows. Front Desk coordinates intake, assignment, and fee-verification handoff
        only.
      </p>
    </div>
  );
}
