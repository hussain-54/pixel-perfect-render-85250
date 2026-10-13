import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  claimUniversityFeePayment,
  createUniversityFeeObligation,
  listUniversityFeeQueue,
  verifyUniversityFeePayment,
} from "@/services";
import type { UniversityFeeKindDb, UniversityFeeStatusDb } from "@/types/database";

export const Route = createFileRoute("/admin/finance")({
  component: AdminFinance,
});

type StatusFilter = UniversityFeeStatusDb | "queue";

const FEE_KINDS: UniversityFeeKindDb[] = [
  "application_fee",
  "tuition",
  "offer_deposit",
  "visa_fee",
  "other",
];

function AdminFinance() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("queue");
  const [msg, setMsg] = useState<string | null>(null);
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "university-fee-queue"] });
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
      await invalidate();
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
      setMsg("Payment claimed — still pending Accounts verification.");
      setClaimForm({ obligationId: "", paymentMethod: "", referenceReceipt: "" });
      await invalidate();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Claim failed.")),
  });

  const verifyM = useMutation({
    mutationFn: (input: { obligationId: string; action: "verify" | "waive" | "reject" }) =>
      verifyUniversityFeePayment(input),
    onSuccess: async (_data, vars) => {
      setMsg(`Fee ${vars.action} recorded with audit history.`);
      await invalidate();
    },
    onError: (err) => setMsg(portalErrorMessage(err, "Verification denied or failed.")),
  });

  if (feesQ.isLoading) return <LoadingRows rows={8} />;
  if (feesQ.isError) {
    const text = portalErrorMessage(feesQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const fees = feesQ.data?.fees ?? [];

  return (
    <div>
      <PageHeader
        title="Finance — university fees"
        subtitle="Accounts verification queue. Signup fees stay on the student lifecycle; this ledger covers application, tuition, offer deposit and visa fees."
      />

      {msg ? <p className="mb-3 text-sm text-navy">{msg}</p> : null}

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

        <Panel title="Claim payment (not verified)">
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
              Claimed payments stay unpaid until Accounts/Admin verifies. Unauthorized verify is
              rejected server-side.
            </p>
          </div>
        </Panel>
      </div>

      {!fees.length ? (
        <EmptyState
          title="No fee rows"
          body="Create an obligation or claim a payment to populate the Accounts queue."
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
  );
}
