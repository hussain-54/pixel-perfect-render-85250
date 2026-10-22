import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  LoadingRows,
  EmptyState,
  ErrorState,
  PermissionDenied,
  portalErrorMessage,
  FilterSelect,
  fmtDate,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStudentsDirectory, intakeRegisterStudent } from "@/services";
import type { StudentDirectoryFilters } from "@/types/portal-officer";
import type { InquiryChannelDb } from "@/types/database";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";

export const Route = createFileRoute("/staff/students")({
  component: StaffStudents,
});

function StaffStudents() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/staff/students") return <Outlet />;
  return <StudentsDirectory />;
}

function StudentsDirectory() {
  const queryClient = useQueryClient();
  useCounsellorWorkbenchRealtime(true);
  const [filters, setFilters] = useState<StudentDirectoryFilters>({
    page: 1,
    pageSize: 20,
    archived: false,
    q: "",
    country: "",
    intake: "",
    stage: "",
    consultantId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    destination: "",
    program: "",
    studyLevel: "",
    inquirySource: "",
    inquiryChannel: "" as "" | InquiryChannelDb,
    intakeDate: "",
    registrationNotes: "",
    feeAmount: "",
    feeMethod: "",
    feeReference: "",
    feeClaimed: false,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => {
        if ((prev.q ?? "") === searchInput) return prev;
        return { ...prev, q: searchInput, page: 1 };
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryFilters = useMemo((): StudentDirectoryFilters => {
    const out: StudentDirectoryFilters = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      archived: Boolean(filters.archived),
    };
    if (filters.q) out.q = filters.q;
    if (filters.country) out.country = filters.country;
    if (filters.intake) out.intake = filters.intake;
    if (filters.stage) out.stage = filters.stage;
    if (filters.consultantId) out.consultantId = filters.consultantId;
    if (filters.dateFrom) out.dateFrom = filters.dateFrom;
    if (filters.dateTo) out.dateTo = filters.dateTo;
    return out;
  }, [filters]);

  const dirQ = useQuery({
    queryKey: ["officer", "students-directory", queryFilters],
    queryFn: () => getStudentsDirectory(queryFilters),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const registerM = useMutation({
    mutationFn: () => {
      const amount = Number(form.feeAmount);
      const payload: Parameters<typeof intakeRegisterStudent>[0] = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        destination: form.destination,
        program: form.program,
      };
      if (form.studyLevel.trim()) payload.studyLevel = form.studyLevel.trim();
      if (form.inquirySource.trim()) payload.inquirySource = form.inquirySource.trim();
      if (form.inquiryChannel) payload.inquiryChannel = form.inquiryChannel;
      if (form.intakeDate.trim()) payload.intakeDate = form.intakeDate.trim();
      if (form.registrationNotes.trim()) payload.registrationNotes = form.registrationNotes.trim();
      if (form.feeAmount.trim() && !Number.isNaN(amount)) {
        payload.signupFee = {
          amount,
          markClaimed: form.feeClaimed,
        };
        if (form.feeMethod.trim()) payload.signupFee.paymentMethod = form.feeMethod.trim();
        if (form.feeReference.trim()) payload.signupFee.referenceReceipt = form.feeReference.trim();
      }
      return intakeRegisterStudent(payload);
    },
    onSuccess: async () => {
      setRegisterOpen(false);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        destination: "",
        program: "",
        studyLevel: "",
        inquirySource: "",
        inquiryChannel: "",
        intakeDate: "",
        registrationNotes: "",
        feeAmount: "",
        feeMethod: "",
        feeReference: "",
        feeClaimed: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["officer", "students-directory"] });
      await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    },
  });

  const opts = dirQ.data?.filterOptions;
  const total = dirQ.data?.total ?? 0;
  const page = dirQ.data?.page ?? 1;
  const pageSize = dirQ.data?.pageSize ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const patch = (partial: StudentDirectoryFilters) =>
    setFilters((prev) => ({
      ...prev,
      ...partial,
      page: partial.page ?? 1,
    }));

  const exportCsv = () => {
    const rows = dirQ.data?.rows ?? [];
    if (!rows.length || !opts?.canExport) return;
    const header = [
      "Student ID",
      "Name",
      "Destination",
      "Intake",
      "Consultant",
      "Apps Submitted",
      "Apps Total",
      "Stage",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.caseId,
          JSON.stringify(r.name),
          r.destination,
          JSON.stringify(r.intake),
          JSON.stringify(r.consultantName),
          r.appsSubmitted,
          r.appsTotal,
          JSON.stringify(r.stageLabel),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filters.archived ? "archived-students.csv" : "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const subtitle = useMemo(
    () =>
      filters.archived
        ? "Archived student records in your authorized scope."
        : "My assigned students — search, filter, and open the counselling workbench.",
    [filters.archived],
  );

  if (dirQ.isError) {
    const msg = portalErrorMessage(dirQ.error);
    if (String(dirQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} onRetry={() => void dirQ.refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Students"
        subtitle={subtitle}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => patch({ archived: !filters.archived, page: 1 })}
            >
              {filters.archived ? "Active students" : "Archived students"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/dashboard">Workbench</Link>
            </Button>
            {opts?.canRegister ? (
              <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)}>
                Quick register
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Input
          placeholder="Search name or case ID…"
          aria-label="Search students"
          className="h-10 sm:col-span-2"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <FilterSelect
          label="Country"
          value={filters.country ?? ""}
          onChange={(v) => patch({ country: v })}
          options={opts?.countries ?? []}
        />
        <FilterSelect
          label="Intake"
          value={filters.intake ?? ""}
          onChange={(v) => patch({ intake: v })}
          options={opts?.intakes ?? []}
        />
        <select
          aria-label="Application / journey stage"
          value={filters.stage ?? ""}
          onChange={(e) => patch({ stage: e.target.value })}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm text-navy"
        >
          <option value="">Stage: All</option>
          {(opts?.stages ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {opts?.canFilterByConsultant ? (
          <select
            aria-label="Consultant"
            value={filters.consultantId ?? ""}
            onChange={(e) => patch({ consultantId: e.target.value })}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm text-navy"
          >
            <option value="">Consultant: All</option>
            {(opts.consultants ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {dirQ.isLoading ? (
        <LoadingRows rows={8} />
      ) : !dirQ.data?.rows.length ? (
        <EmptyState
          title={filters.archived ? "No archived students" : "No students found"}
          body="Adjust filters, or wait for Front Desk to assign students to your desk."
          action={
            <Button size="sm" variant="outline" onClick={() => void dirQ.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>Case</th>
                <th>Student</th>
                <th className="hidden md:table-cell">Destination</th>
                <th className="hidden lg:table-cell">Updated</th>
                <th>Stage</th>
                <th className="hidden xl:table-cell">Counselling</th>
                <th>Next action</th>
                <th> </th>
              </tr>
            </thead>
            <tbody>
              {dirQ.data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-navy">{r.caseId}</td>
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{r.destination}</div>
                  </td>
                  <td className="hidden md:table-cell">{r.destination}</td>
                  <td className="hidden text-muted-foreground lg:table-cell">
                    {fmtDate(r.lastActivity.slice(0, 10))}
                  </td>
                  <td>
                    <StatusBadge status={r.stageLabel} />
                  </td>
                  <td className="hidden text-xs xl:table-cell">
                    {r.hasConsent ? "Consent recorded" : "Consent pending"}
                  </td>
                  <td className="max-w-[14rem] text-xs text-muted-foreground">
                    {r.nextActionLabel ?? "—"}
                  </td>
                  <td>
                    <Button asChild size="sm" variant="navy">
                      <Link
                        to="/staff/students/$studentId"
                        params={{ studentId: r.id }}
                        search={{ tab: "assessment" }}
                      >
                        View record
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {from} to {to} of {total} entries
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {opts?.canExport ? (
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  Export list
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => patch({ page: page - 1 })}
              >
                Prev
              </Button>
              <span className="text-sm text-navy">
                {page} / {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => patch({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Front desk intake / register student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(
              [
                ["fullName", "Full name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["destination", "Preferred country / destination"],
                ["program", "Preferred course / program"],
                ["studyLevel", "Study level"],
                ["inquirySource", "Inquiry source"],
                ["intakeDate", "Intake date (YYYY-MM-DD)"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                placeholder={label}
                aria-label={label}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
            <select
              aria-label="Inquiry channel"
              className="h-11 rounded-md border border-input bg-white px-3 text-sm"
              value={form.inquiryChannel}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  inquiryChannel: e.target.value as "" | InquiryChannelDb,
                }))
              }
            >
              <option value="">Channel: select</option>
              <option value="physical">Physical (walk-in)</option>
              <option value="online">Online</option>
            </select>
            <Input
              placeholder="Registration notes"
              aria-label="Registration notes"
              value={form.registrationNotes}
              onChange={(e) => setForm((f) => ({ ...f, registrationNotes: e.target.value }))}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signup fee (optional claim — not verified payment)
            </p>
            <Input
              placeholder="Fee amount"
              aria-label="Fee amount"
              value={form.feeAmount}
              onChange={(e) => setForm((f) => ({ ...f, feeAmount: e.target.value }))}
            />
            <Input
              placeholder="Payment method"
              aria-label="Payment method"
              value={form.feeMethod}
              onChange={(e) => setForm((f) => ({ ...f, feeMethod: e.target.value }))}
            />
            <Input
              placeholder="Reference / receipt"
              aria-label="Reference receipt"
              value={form.feeReference}
              onChange={(e) => setForm((f) => ({ ...f, feeReference: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.feeClaimed}
                onChange={(e) => setForm((f) => ({ ...f, feeClaimed: e.target.checked }))}
              />
              Mark fee as claimed (still requires Accounts verification)
            </label>
            {registerM.isError ? (
              <ErrorState body={portalErrorMessage(registerM.error, "Registration failed.")} />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={registerM.isPending || !form.fullName.trim() || !form.email.trim()}
              onClick={() => registerM.mutate()}
            >
              {registerM.isPending ? "Saving..." : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
