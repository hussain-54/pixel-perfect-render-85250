import { useMemo, useState } from "react";
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
import { getStudentsDirectory, registerStudent } from "@/services";
import type { StudentDirectoryFilters } from "@/types/portal-officer";

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
  const [filters, setFilters] = useState<StudentDirectoryFilters>({
    page: 1,
    pageSize: 6,
    archived: false,
    q: "",
    country: "",
    intake: "",
    stage: "",
    consultantId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    destination: "",
    program: "",
  });

  const queryFilters = useMemo((): StudentDirectoryFilters => {
    const out: StudentDirectoryFilters = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 6,
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
  });

  const registerM = useMutation({
    mutationFn: () => registerStudent(form),
    onSuccess: async () => {
      setRegisterOpen(false);
      setForm({ fullName: "", email: "", phone: "", destination: "", program: "" });
      await queryClient.invalidateQueries({ queryKey: ["officer", "students-directory"] });
      await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    },
  });

  const opts = dirQ.data?.filterOptions;
  const total = dirQ.data?.total ?? 0;
  const page = dirQ.data?.page ?? 1;
  const pageSize = dirQ.data?.pageSize ?? 6;
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
        : "Manage assigned student records and monitor application progress.",
    [filters.archived],
  );

  if (dirQ.isError) {
    const msg = portalErrorMessage(dirQ.error);
    if (String(dirQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  return (
    <div>
      <PageHeader
        title="Students"
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
            {opts?.canRegister ? (
              <Button size="sm" variant="navy" onClick={() => setRegisterOpen(true)}>
                + Register new student
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Input
          type="date"
          aria-label="Date from"
          className="h-11 w-full lg:w-40"
          value={filters.dateFrom ?? ""}
          onChange={(e) => patch({ dateFrom: e.target.value })}
        />
        <Input
          type="date"
          aria-label="Date to"
          className="h-11 w-full lg:w-40"
          value={filters.dateTo ?? ""}
          onChange={(e) => patch({ dateTo: e.target.value })}
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
          aria-label="Stage"
          value={filters.stage ?? ""}
          onChange={(e) => patch({ stage: e.target.value })}
          className="h-11 rounded-md border border-input bg-white px-3 text-sm text-navy"
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
            className="h-11 rounded-md border border-input bg-white px-3 text-sm text-navy"
          >
            <option value="">Consultant: All</option>
            {(opts.consultants ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          placeholder="Search name, ID, phone..."
          aria-label="Search students"
          className="h-11 w-full lg:min-w-[220px] lg:flex-1"
          value={filters.q ?? ""}
          onChange={(e) => patch({ q: e.target.value })}
        />
      </div>

      {dirQ.isLoading ? (
        <LoadingRows rows={6} />
      ) : !(dirQ.data?.rows.length) ? (
        <EmptyState
          title={filters.archived ? "No archived students" : "No students found"}
          body="Adjust filters or register a new student if you are authorized."
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Destination</th>
                <th>Intake</th>
                <th>Consultant</th>
                <th>Apps submitted</th>
                <th>Stage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dirQ.data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-navy">{r.caseId}</td>
                  <td>{r.name}</td>
                  <td>{r.destination}</td>
                  <td>{r.intake}</td>
                  <td>{r.consultantName}</td>
                  <td>
                    {r.appsSubmitted} / {r.appsTotal}
                  </td>
                  <td>
                    <StatusBadge status={r.stageLabel} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: r.id }}
                          search={{ tab: "assessment" }}
                        >
                          View profile
                        </Link>
                      </Button>
                    </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register new student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(
              [
                ["fullName", "Full name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["destination", "Destination"],
                ["program", "Program"],
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
