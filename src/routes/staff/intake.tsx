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
import {
  countIntakeStatusFilters,
  filterIntakeRowsByStatus,
  INTAKE_STATUS_FILTERS,
  type IntakeFilterId,
  type IntakeFilterTone,
} from "@/lib/front-desk-intake-filters";
import { FEE_QUEUE_KEY } from "@/lib/use-fee-verification-queue-realtime";
import { cn } from "@/lib/utils";
import type { FrontDeskIntakeRow } from "@/server/portal-front-desk";
import {
  archiveFrontDeskIntake,
  assignCounsellor,
  listCounsellorDesks,
  listFeeVerificationRequests,
  listFrontDeskIntake,
  provisionStudentPortalAccount,
  updateFrontDeskIntake,
} from "@/services";

const FILTER_TONE_CLASS: Record<
  IntakeFilterTone,
  { idle: string; active: string; dot: string; count: string }
> = {
  slate: {
    idle: "border-slate-200/80 bg-slate-50/80 text-slate-800 hover:border-slate-300",
    active: "border-slate-400 bg-slate-100 ring-2 ring-slate-300/60",
    dot: "bg-slate-500",
    count: "text-slate-700",
  },
  blue: {
    idle: "border-sky-200/80 bg-sky-50/70 text-sky-950 hover:border-sky-300",
    active: "border-sky-400 bg-sky-100 ring-2 ring-sky-300/50",
    dot: "bg-sky-500",
    count: "text-sky-800",
  },
  purple: {
    idle: "border-violet-200/80 bg-violet-50/70 text-violet-950 hover:border-violet-300",
    active: "border-violet-400 bg-violet-100 ring-2 ring-violet-300/50",
    dot: "bg-violet-500",
    count: "text-violet-800",
  },
  amber: {
    idle: "border-amber-200/80 bg-amber-50/70 text-amber-950 hover:border-amber-300",
    active: "border-amber-400 bg-amber-100 ring-2 ring-amber-300/50",
    dot: "bg-amber-500",
    count: "text-amber-900",
  },
  orange: {
    idle: "border-orange-200/80 bg-orange-50/70 text-orange-950 hover:border-orange-300",
    active: "border-orange-400 bg-orange-100 ring-2 ring-orange-300/50",
    dot: "bg-orange-500",
    count: "text-orange-900",
  },
  yellow: {
    idle: "border-yellow-200/80 bg-yellow-50/70 text-yellow-950 hover:border-yellow-300",
    active: "border-yellow-400 bg-yellow-100 ring-2 ring-yellow-300/50",
    dot: "bg-yellow-500",
    count: "text-yellow-900",
  },
  green: {
    idle: "border-emerald-200/80 bg-emerald-50/70 text-emerald-950 hover:border-emerald-300",
    active: "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/50",
    dot: "bg-emerald-500",
    count: "text-emerald-800",
  },
  teal: {
    idle: "border-teal-200/80 bg-teal-50/70 text-teal-950 hover:border-teal-300",
    active: "border-teal-400 bg-teal-100 ring-2 ring-teal-300/50",
    dot: "bg-teal-500",
    count: "text-teal-800",
  },
  red: {
    idle: "border-rose-200/80 bg-rose-50/70 text-rose-950 hover:border-rose-300",
    active: "border-rose-400 bg-rose-100 ring-2 ring-rose-300/50",
    dot: "bg-rose-500",
    count: "text-rose-800",
  },
};

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
  const [statusFilter, setStatusFilter] = useState<IntakeFilterId>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const listQ = useQuery({
    queryKey: ["front-desk", "intake"],
    queryFn: listFrontDeskIntake,
  });
  const feeReqQ = useQuery({
    queryKey: [...FEE_QUEUE_KEY, "intake-filters"],
    queryFn: () => listFeeVerificationRequests({ includeResolved: true }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
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
  const feeRequests = feeReqQ.data?.rows ?? [];
  const statusCounts = useMemo(
    () => countIntakeStatusFilters({ rows, feeRequests }),
    [rows, feeRequests],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = filterIntakeRowsByStatus({
      rows,
      filter: statusFilter,
      feeRequests,
    });
    if (q) {
      list = list.filter((r) =>
        [r.caseId, r.fullName, r.email, r.phone, r.destination, r.program]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      return String(bv).localeCompare(String(av));
    });
    return list;
  }, [rows, search, statusFilter, feeRequests, sortKey]);

  function selectStatusFilter(next: IntakeFilterId) {
    setStatusFilter(next);
    setPage(0);
  }

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
          subtitle="Search, filter, and open intake records."
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
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)]">
              <div>
                <Label htmlFor="fd-search">Search</Label>
                <Input
                  id="fd-search"
                  className="mt-1 h-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Name, email, case ID…"
                />
              </div>
              <div>
                <Label htmlFor="fd-sort">Sort by</Label>
                <select
                  id="fd-sort"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status filters
                </p>
                {statusFilter !== "all" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => selectStatusFilter("all")}
                  >
                    Clear filter
                  </Button>
                ) : null}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5 xl:grid-cols-9">
                {INTAKE_STATUS_FILTERS.map((def) => {
                  const tone = FILTER_TONE_CLASS[def.tone];
                  const active = statusFilter === def.id;
                  const count = statusCounts[def.id] ?? 0;
                  return (
                    <button
                      key={def.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectStatusFilter(def.id)}
                      className={cn(
                        "flex min-w-[7.5rem] shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 md:min-w-0",
                        active ? tone.active : tone.idle,
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)}
                          aria-hidden
                        />
                        <span className="truncate text-[0.7rem] font-semibold leading-tight">
                          {def.label}
                        </span>
                      </span>
                      <span className={cn("text-sm font-semibold tabular-nums", tone.count)}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
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
            key={`${editRow.id}:${editRow.updatedAt}`}
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

        <Panel
          title={`Intake records (${filtered.length})`}
          action={
            statusFilter !== "all" ? (
              <span className="text-xs text-muted-foreground">
                Filter:{" "}
                {INTAKE_STATUS_FILTERS.find((f) => f.id === statusFilter)?.label ?? statusFilter}
              </span>
            ) : null
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              title="No records found"
              body="Clear filters or register a student."
            />
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
