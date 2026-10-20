import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import {
  intakePortalStatusFromRow,
  studentPortalAccountStatusLabel,
} from "@/lib/student-portal-account";
import {
  assignCounsellor,
  listCounsellorDesks,
  listFrontDeskIntake,
  provisionStudentPortalAccount,
} from "@/services";

export const Route = createFileRoute("/staff/intake")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: string | null; role?: string } }).auth;
    if (auth?.role === "consultant" && !isFrontDeskBusinessRole(auth.businessRole as never)) {
      throw redirect({ to: "/staff/students" });
    }
  },
  component: FrontDeskIntakeListPage,
});

function FrontDeskIntakeListPage() {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["front-desk", "intake"],
    queryFn: listFrontDeskIntake,
  });
  const desksQ = useQuery({
    queryKey: ["front-desk", "counsellor-desks"],
    queryFn: listCounsellorDesks,
    staleTime: 60_000,
  });

  const provisionM = useMutation({
    mutationFn: (studentId: string) => provisionStudentPortalAccount(studentId),
    onSuccess: async (result) => {
      setMsg(result?.message ?? "Student portal account updated.");
      setErr(null);
      setProvisioningId(null);
      await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: (e) => {
      setMsg(null);
      setProvisioningId(null);
      setErr(portalErrorMessage(e, "Could not create the student portal account."));
    },
  });

  const assignM = useMutation({
    mutationFn: (input: { studentId: string; consultantId: string }) => assignCounsellor(input),
    onSuccess: async () => {
      setMsg("Counsellor assigned.");
      setErr(null);
      setAssigningId(null);
      await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: (e) => {
      setMsg(null);
      setErr(portalErrorMessage(e, "Could not assign counsellor."));
    },
  });

  if (listQ.isLoading) return <LoadingRows rows={6} />;
  if (listQ.isError) {
    const message = portalErrorMessage(listQ.error);
    if (/403|permission|not authorized/i.test(message)) {
      return <PermissionDenied body={message} />;
    }
    return <ErrorState body={message} />;
  }

  const rows = listQ.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My registrations"
        subtitle="Intake records you registered. Confidential counsellor and admission files are not shown here."
        actions={
          <Button asChild>
            <Link to="/staff/register">Register student</Link>
          </Button>
        }
      />

      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}

      <Panel title={`Intake records (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="No intake records" body="Registrations you create will appear here." />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Destination</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Portal</th>
                  <th className="px-3 py-2">Counsellor</th>
                  <th className="px-3 py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 align-top">
                    <td className="px-3 py-2 font-medium text-navy">{row.caseId}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                      <div className="text-xs text-muted-foreground">{row.phone}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.destination || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.program}</div>
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {row.signupFeeStatus?.replaceAll("_", " ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-medium text-navy">
                        {studentPortalAccountStatusLabel(
                          intakePortalStatusFromRow({
                            profileId: row.profileId,
                            portalActivatedAt: row.portalActivatedAt,
                          }),
                        )}
                      </div>
                      {row.portalActivatedAt ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-1.5"
                          disabled={provisionM.isPending}
                          onClick={() => {
                            if (provisionM.isPending) return;
                            setProvisioningId(row.id);
                            provisionM.mutate(row.id);
                          }}
                        >
                          {provisioningId === row.id && provisionM.isPending
                            ? "Sending…"
                            : row.profileId
                              ? "Resend setup link"
                              : "Create Student Portal Account"}
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.assignmentStatus === "assigned" ? (
                        <span>{row.counsellorName || "Assigned"}</span>
                      ) : (
                        <div className="space-y-1.5">
                          <StatusBadge status="Pending" />
                          <select
                            className="flex h-8 w-full max-w-[12rem] rounded-md border border-input bg-background px-2 text-xs"
                            disabled={assignM.isPending}
                            value=""
                            onChange={(e) => {
                              const consultantId = e.target.value;
                              if (!consultantId) return;
                              setAssigningId(row.id);
                              assignM.mutate({ studentId: row.id, consultantId });
                            }}
                          >
                            <option value="">
                              {assigningId === row.id && assignM.isPending
                                ? "Assigning…"
                                : "Assign counsellor…"}
                            </option>
                            {(desksQ.data?.options ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
