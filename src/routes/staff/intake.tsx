import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { FrontDeskEditRegistrationPanel } from "@/components/portal/FrontDeskEditRegistrationPanel";
import { FrontDeskRegistrationFormA4 } from "@/components/portal/FrontDeskRegistrationFormA4";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import {
  intakePortalStatusFromRow,
  studentPortalAccountStatusLabel,
} from "@/lib/student-portal-account";
import {
  describePersistedSignupFeeStatus,
  printRegistrationFormPdf,
} from "@/lib/registration-form-a4";
import type { FrontDeskIntakeRow } from "@/server/portal-front-desk";
import {
  archiveFrontDeskIntake,
  assignCounsellor,
  listCounsellorDesks,
  listFrontDeskIntake,
  provisionStudentPortalAccount,
  updateFrontDeskIntake,
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

type SortKey = "createdAt" | "fullName" | "nextFollowUpAt" | "updatedAt";

function FrontDeskIntakeListPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/staff/intake") return <Outlet />;

  return <FrontDeskIntakeListContent />;
}

function FrontDeskIntakeListContent() {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [formStudentId, setFormStudentId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [search, setSearch] = useState("");
  const [feeFilter, setFeeFilter] = useState("all");
  const [assignFilter, setAssignFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [page, setPage] = useState(0);
  const pageSize = 20;

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
    mutationFn: (input: {
      studentId: string;
      temporaryPassword: string;
      confirmPassword: string;
    }) => provisionStudentPortalAccount(input),
    onSuccess: async (result) => {
      setMsg(result?.message ?? "Student portal account created.");
      setErr(null);
      setFormError(null);
      setFormStudentId(null);
      setPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: (e) => {
      setMsg(null);
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

  const updateM = useMutation({
    mutationFn: updateFrontDeskIntake,
    onSuccess: async (result) => {
      setMsg(result?.message ?? "Registration updated.");
      setErr(null);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: (e) => {
      setMsg(null);
      setErr(portalErrorMessage(e, "Could not update registration."));
    },
  });

  const archiveM = useMutation({
    mutationFn: archiveFrontDeskIntake,
    onSuccess: async (result) => {
      setMsg(result?.message ?? "Registration archived.");
      setErr(null);
      setArchiveId(null);
      setArchiveReason("");
      await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: (e) => {
      setMsg(null);
      setErr(portalErrorMessage(e, "Could not archive registration."));
    },
  });

  const rows = listQ.data?.rows ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (feeFilter !== "all" && (r.signupFeeStatus || "none") !== feeFilter) return false;
      if (assignFilter === "pending" && r.assignmentStatus !== "pending") return false;
      if (assignFilter === "assigned" && r.assignmentStatus !== "assigned") return false;
      if (!q) return true;
      return [r.caseId, r.fullName, r.email, r.phone, r.destination, r.program]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      return String(bv).localeCompare(String(av));
    });
    return list;
  }, [rows, search, feeFilter, assignFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const formRow = formStudentId ? rows.find((r) => r.id === formStudentId) : null;
  const editRow = editingId ? rows.find((r) => r.id === editingId) : null;
  const viewRow = viewingId ? rows.find((r) => r.id === viewingId) : null;
  const archiveRow = archiveId ? rows.find((r) => r.id === archiveId) : null;

  if (listQ.isLoading) return <LoadingRows rows={6} />;
  if (listQ.isError) {
    const message = portalErrorMessage(listQ.error);
    if (/403|permission|not authorized/i.test(message)) {
      return <PermissionDenied body={message} />;
    }
    return <ErrorState body={message} />;
  }

  function openCreateForm(studentId: string) {
    setFormStudentId(studentId);
    setEditingId(null);
    setPassword("");
    setConfirmPassword("");
    setFormError(null);
    setErr(null);
  }

  function submitCreate() {
    if (!formRow || provisionM.isPending) return;
    const check = validatePasswordConfirmation(password, confirmPassword);
    if (!check.ok) {
      setFormError(check.error);
      return;
    }
    setFormError(null);
    provisionM.mutate({
      studentId: formRow.id,
      temporaryPassword: password,
      confirmPassword,
    });
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="fd-intake-no-print space-y-4 md:space-y-5">
        <PageHeader
          compact
          title="My registrations"
          subtitle="Your intake records â€” view, edit, assign, or download the registration PDF."
          actions={
            <Button asChild size="sm">
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

        <Panel title="Find registrations">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="fd-search">Search</Label>
              <Input
                id="fd-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Name, email, case IDâ€¦"
              />
            </div>
            <div>
              <Label htmlFor="fd-fee">Signup fee</Label>
              <select
                id="fd-fee"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={feeFilter}
                onChange={(e) => {
                  setFeeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="claimed">Claimed</option>
                <option value="verified">Verified</option>
                <option value="waived">Waived</option>
                <option value="rejected">Rejected</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fd-assign">Counsellor</Label>
              <select
                id="fd-assign"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={assignFilter}
                onChange={(e) => {
                  setAssignFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="pending">Awaiting assignment</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fd-sort">Sort by</Label>
              <select
                id="fd-sort"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="createdAt">Registration date</option>
                <option value="updatedAt">Last updated</option>
                <option value="nextFollowUpAt">Follow-up date</option>
                <option value="fullName">Student name</option>
              </select>
            </div>
          </div>
        </Panel>

        {formRow ? (
          <Panel title="Create Student Portal Account">
            <div className="grid max-w-lg gap-3 text-sm">
              <p className="text-muted-foreground">
                Creates a login using the staff password pattern. No invitation email. Portal CRM
                access still requires signup-fee verification.
              </p>
              <div>
                <Label>Student email</Label>
                <Input value={formRow.email} readOnly className="bg-muted/40" />
              </div>
              <div>
                <Label htmlFor="fd-portal-password">Password</Label>
                <Input
                  id="fd-portal-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                />
              </div>
              <div>
                <Label htmlFor="fd-portal-confirm">Confirm password</Label>
                <Input
                  id="fd-portal-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="navy"
                  disabled={provisionM.isPending}
                  onClick={submitCreate}
                >
                  {provisionM.isPending ? "Creating accountâ€¦" : "Create account"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={provisionM.isPending}
                  onClick={() => setFormStudentId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        {editRow ? (
          <FrontDeskEditRegistrationPanel
            row={editRow}
            pending={updateM.isPending}
            onCancel={() => setEditingId(null)}
            onSave={(payload) => {
              updateM.mutate(payload);
            }}
          />
        ) : null}

        {viewRow ? (
          <Panel
            title={`Registration form â€” ${viewRow.caseId}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => printRegistrationFormPdf(viewRow.caseId)}
                >
                  Print
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="navy"
                  onClick={() => printRegistrationFormPdf(viewRow.caseId)}
                >
                  Download Registration Form (PDF)
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setViewingId(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <p className="mb-2 text-xs text-muted-foreground">
              Choose â€œSave as PDFâ€ and enable background graphics if colours are missing.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <FrontDeskRegistrationFormA4 row={viewRow} mode="view" />
            </div>
          </Panel>
        ) : null}
      </div>

      {viewRow ? (
        <div id="fd-registration-print-root" className="hidden print:block">
          <FrontDeskRegistrationFormA4 row={viewRow} mode="print" />
        </div>
      ) : null}

      <div className="fd-intake-no-print space-y-6">
        {archiveRow ? (
          <Panel title="Archive registration">
            <div className="grid max-w-lg gap-3 text-sm">
              <p className="text-muted-foreground">
                Soft-archive <strong>{archiveRow.fullName}</strong> ({archiveRow.caseId}).
                Documents, fees, applications, audit history, and portal accounts are retained. The
                record leaves the active list.
              </p>
              <div>
                <Label htmlFor="fd-archive-reason">Reason *</Label>
                <Input
                  id="fd-archive-reason"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Duplicate registration / student withdrew"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={archiveM.isPending}
                  onClick={() =>
                    archiveM.mutate({
                      studentId: archiveRow.id,
                      archive: true,
                      reason: archiveReason,
                    })
                  }
                >
                  {archiveM.isPending ? "Archivingâ€¦" : "Confirm archive"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={archiveM.isPending}
                  onClick={() => {
                    setArchiveId(null);
                    setArchiveReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel title={`Intake records (${filtered.length})`}>
          {filtered.length === 0 ? (
            <EmptyState title="No matching records" body="Adjust filters or register a student." />
          ) : (
            <>
              <TableWrap>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 sm:px-3">Case</th>
                      <th className="px-2 py-2 sm:px-3">Student</th>
                      <th className="hidden px-3 py-2 md:table-cell">Registered</th>
                      <th className="px-2 py-2 sm:px-3">Counsellor</th>
                      <th className="px-2 py-2 sm:px-3">Fee</th>
                      <th className="hidden px-3 py-2 xl:table-cell">Updated</th>
                      <th className="hidden px-3 py-2 lg:table-cell">Portal</th>
                      <th className="px-2 py-2 sm:px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const portalStatus = intakePortalStatusFromRow({
                        profileId: row.profileId,
                        portalActivatedAt: row.portalActivatedAt,
                      });
                      return (
                        <tr key={row.id} className="border-b border-border/60 align-top">
                          <td className="px-2 py-2 font-medium text-navy sm:px-3">{row.caseId}</td>
                          <td className="px-2 py-2 sm:px-3">
                            <div className="font-medium">{row.fullName}</div>
                            <div className="text-xs text-muted-foreground">{row.email}</div>
                            <div className="text-xs text-muted-foreground md:hidden">
                              {fmtDate(row.createdAt)}
                            </div>
                          </td>
                          <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                            {fmtDate(row.createdAt)}
                          </td>
                          <td className="px-2 py-2 sm:px-3">
                            {row.assignmentStatus === "assigned" ? (
                              <span>{row.counsellorName || "Counsellor assigned"}</span>
                            ) : (
                              <div className="space-y-1.5">
                                <StatusBadge status="Pending" />
                                <select
                                  className="flex h-8 w-full max-w-[11rem] rounded-md border border-input bg-background px-2 text-xs"
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
                                      ? "Assigningâ€¦"
                                      : "Assignâ€¦"}
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
                          <td className="px-2 py-2 text-xs sm:px-3">
                            {describePersistedSignupFeeStatus(row.signupFeeStatus).label}
                          </td>
                          <td className="hidden px-3 py-2 text-muted-foreground xl:table-cell">
                            {fmtDate(row.updatedAt)}
                          </td>
                          <td className="hidden px-3 py-2 lg:table-cell">
                            <div className="text-xs font-medium text-navy">
                              {studentPortalAccountStatusLabel(portalStatus)}
                            </div>
                            {portalStatus === "not_provisioned" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-1.5"
                                disabled={provisionM.isPending}
                                onClick={() => openCreateForm(row.id)}
                              >
                                Create portal account
                              </Button>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 sm:px-3">
                            <div className="flex min-w-[7.5rem] flex-col gap-1 sm:min-w-[9rem]">
                              <Button asChild size="sm" variant="navy">
                                <Link to="/staff/intake/$studentId" params={{ studentId: row.id }}>
                                  View record
                                </Link>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingId(row.id);
                                  setEditingId(null);
                                  setFormStudentId(null);
                                  setArchiveId(null);
                                }}
                              >
                                View / PDF
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(row.id);
                                  setViewingId(null);
                                  setFormStudentId(null);
                                  setArchiveId(null);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  setArchiveId(row.id);
                                  setArchiveReason("");
                                  setEditingId(null);
                                }}
                              >
                                Archive
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Page {page + 1} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      {viewRow ? (
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            html, body {
              background: #fff !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * { visibility: hidden !important; }
            #fd-registration-print-root,
            #fd-registration-print-root * { visibility: visible !important; }
            .fd-intake-no-print { display: none !important; }
            aside, nav, [data-sidebar], header.staff-chrome { display: none !important; }
            #fd-registration-print-root {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #fd-registration-print-root .registration-a4-banner {
              background-color: #17365D !important;
              color: #fff !important;
            }
            #fd-registration-print-root .registration-a4-idbox,
            #fd-registration-print-root .registration-a4-note {
              background-color: #F3F6FA !important;
            }
          }
        `}</style>
      ) : null}
    </div>
  );
}
