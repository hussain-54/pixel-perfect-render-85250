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
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  correctHrAttendance,
  decideHrLeave,
  getHrDashboard,
  recordHrAttendance,
  submitHrLeave,
  upsertHrEmployee,
} from "@/services";
import type { HrAttendanceStatus, HrEmploymentStatus } from "@/lib/hr-rules";

export const Route = createFileRoute("/admin/hr")({
  component: HrModulePage,
});

/** Shared HR workspace — also mounted at `/staff/hr` for specialty desks. */
export function HrModulePage() {
  const queryClient = useQueryClient();
  const dashQ = useQuery({
    queryKey: ["admin", "hr-dashboard"],
    queryFn: getHrDashboard,
    staleTime: 15_000,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [empForm, setEmpForm] = useState({
    id: "",
    employeeCode: "",
    fullName: "",
    department: "",
    jobTitle: "",
    status: "active" as HrEmploymentStatus,
    hiredOn: "",
    profileId: "",
    reportingManagerId: "",
  });
  const [attForm, setAttForm] = useState({
    employeeId: "",
    workDate: "",
    status: "present" as HrAttendanceStatus,
    notes: "",
  });
  const [corrForm, setCorrForm] = useState({
    attendanceId: "",
    status: "present" as HrAttendanceStatus,
    reason: "",
  });
  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    leaveType: "annual" as "annual" | "sick" | "unpaid" | "other",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "hr-dashboard"] });
  };

  const empM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof upsertHrEmployee>[0] = {
        employeeCode: empForm.employeeCode,
        fullName: empForm.fullName,
        department: empForm.department,
        jobTitle: empForm.jobTitle,
        status: empForm.status,
      };
      if (empForm.id.trim()) payload.id = empForm.id.trim();
      if (empForm.hiredOn.trim()) payload.hiredOn = empForm.hiredOn.trim();
      if (empForm.profileId.trim()) payload.profileId = empForm.profileId.trim();
      if (empForm.reportingManagerId.trim()) {
        payload.reportingManagerId = empForm.reportingManagerId.trim();
      }
      return upsertHrEmployee(payload);
    },
    onSuccess: async () => {
      setMsg("Employee saved.");
      setEmpForm({
        id: "",
        employeeCode: "",
        fullName: "",
        department: "",
        jobTitle: "",
        status: "active",
        hiredOn: "",
        profileId: "",
        reportingManagerId: "",
      });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Could not save employee.")),
  });

  const attM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof recordHrAttendance>[0] = {
        employeeId: attForm.employeeId,
        workDate: attForm.workDate,
        status: attForm.status,
      };
      if (attForm.notes.trim()) payload.notes = attForm.notes.trim();
      return recordHrAttendance(payload);
    },
    onSuccess: async () => {
      setMsg("Attendance recorded.");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Attendance record failed.")),
  });

  const corrM = useMutation({
    mutationFn: () =>
      correctHrAttendance({
        attendanceId: corrForm.attendanceId,
        status: corrForm.status,
        reason: corrForm.reason,
      }),
    onSuccess: async () => {
      setMsg("Attendance corrected (audited).");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Correction failed.")),
  });

  const leaveM = useMutation({
    mutationFn: () =>
      submitHrLeave({
        employeeId: leaveForm.employeeId,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      }),
    onSuccess: async () => {
      setMsg("Leave request submitted.");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Leave submit failed.")),
  });

  const decideM = useMutation({
    mutationFn: (input: { leaveId: string; action: "approve" | "reject" }) => decideHrLeave(input),
    onSuccess: async (_d, vars) => {
      setMsg(`Leave ${vars.action}d.`);
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Leave decision denied.")),
  });

  const employees = useMemo(() => dashQ.data?.employees ?? [], [dashQ.data?.employees]);
  const attendance = dashQ.data?.attendance ?? [];
  const filteredEmployees = useMemo(() => {
    const q = employeeFilter.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q),
    );
  }, [employees, employeeFilter]);

  if (dashQ.isLoading) return <LoadingRows rows={8} />;
  if (dashQ.isError) {
    const text = portalErrorMessage(dashQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const data = dashQ.data;
  if (!data) return <ErrorState body="HR dashboard unavailable." />;

  const s = data.summaries;

  return (
    <div>
      <PageHeader
        title="HR & Attendance"
        subtitle="Employee directory, attendance and leave — separate from student CRM and finance."
      />
      {msg ? <p className="mb-3 text-sm text-navy">{msg}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Employees" value={employees.length} />
        <StatCard label="Present (recent)" value={s.present} />
        <StatCard label="Absent" value={s.absent} />
        <StatCard label="Late" value={s.late} />
        <StatCard label="Leave days logged" value={s.leave} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={data.canMutate ? "Create / update employee" : "Employee form (view only)"}>
          <div className="grid gap-2 text-sm">
            <Input
              placeholder="Employee code *"
              value={empForm.employeeCode}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, employeeCode: e.target.value }))}
            />
            <Input
              placeholder="Full name *"
              value={empForm.fullName}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              placeholder="Department"
              value={empForm.department}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, department: e.target.value }))}
            />
            <Input
              placeholder="Designation / job title"
              value={empForm.jobTitle}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, jobTitle: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={empForm.status}
              disabled={!data.canMutate}
              onChange={(e) =>
                setEmpForm((f) => ({ ...f, status: e.target.value as HrEmploymentStatus }))
              }
            >
              <option value="active">active</option>
              <option value="on_leave">on_leave</option>
              <option value="terminated">terminated</option>
            </select>
            <Input
              type="date"
              value={empForm.hiredOn}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, hiredOn: e.target.value }))}
            />
            <Input
              placeholder="Profile ID (optional UUID)"
              value={empForm.profileId}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, profileId: e.target.value }))}
            />
            <Input
              placeholder="Reporting manager employee ID (optional)"
              value={empForm.reportingManagerId}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, reportingManagerId: e.target.value }))}
            />
            <Input
              placeholder="Existing employee ID to update (optional)"
              value={empForm.id}
              disabled={!data.canMutate}
              onChange={(e) => setEmpForm((f) => ({ ...f, id: e.target.value }))}
            />
            {data.canMutate ? (
              <Button
                size="sm"
                variant="navy"
                disabled={
                  empM.isPending || !empForm.employeeCode.trim() || !empForm.fullName.trim()
                }
                onClick={() => {
                  setMsg(null);
                  empM.mutate();
                }}
              >
                Save employee
              </Button>
            ) : null}
            {data.isSuperAdmin ? (
              <p className="text-xs text-muted-foreground">
                Super Admin: may rehire terminated employees.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Record attendance">
          <div className="grid gap-2 text-sm">
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={attForm.employeeId}
              disabled={!data.canMutate}
              onChange={(e) => setAttForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeCode})
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={attForm.workDate}
              disabled={!data.canMutate}
              onChange={(e) => setAttForm((f) => ({ ...f, workDate: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={attForm.status}
              disabled={!data.canMutate}
              onChange={(e) =>
                setAttForm((f) => ({ ...f, status: e.target.value as HrAttendanceStatus }))
              }
            >
              <option value="present">present</option>
              <option value="absent">absent</option>
              <option value="late">late</option>
              <option value="leave">leave</option>
              <option value="holiday">holiday</option>
            </select>
            <Input
              placeholder="Notes (optional)"
              value={attForm.notes}
              disabled={!data.canMutate}
              onChange={(e) => setAttForm((f) => ({ ...f, notes: e.target.value }))}
            />
            {data.canMutate ? (
              <Button
                size="sm"
                variant="navy"
                disabled={!attForm.employeeId || !attForm.workDate || attM.isPending}
                onClick={() => {
                  setMsg(null);
                  attM.mutate();
                }}
              >
                Record attendance
              </Button>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Correct attendance">
          <div className="grid gap-2 text-sm">
            <Input
              placeholder="Attendance record ID"
              value={corrForm.attendanceId}
              disabled={!data.canMutate}
              onChange={(e) => setCorrForm((f) => ({ ...f, attendanceId: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={corrForm.status}
              disabled={!data.canMutate}
              onChange={(e) =>
                setCorrForm((f) => ({ ...f, status: e.target.value as HrAttendanceStatus }))
              }
            >
              <option value="present">present</option>
              <option value="absent">absent</option>
              <option value="late">late</option>
              <option value="leave">leave</option>
              <option value="holiday">holiday</option>
            </select>
            <Input
              placeholder="Reason (required)"
              value={corrForm.reason}
              disabled={!data.canMutate}
              onChange={(e) => setCorrForm((f) => ({ ...f, reason: e.target.value }))}
            />
            {data.canMutate ? (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !corrForm.attendanceId.trim() ||
                  corrForm.reason.trim().length < 3 ||
                  corrM.isPending
                }
                onClick={() => {
                  setMsg(null);
                  corrM.mutate();
                }}
              >
                Apply correction
              </Button>
            ) : null}
          </div>
        </Panel>

        <Panel title="Submit leave request">
          <div className="grid gap-2 text-sm">
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={leaveForm.employeeId}
              onChange={(e) => setLeaveForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={leaveForm.leaveType}
              onChange={(e) =>
                setLeaveForm((f) => ({
                  ...f,
                  leaveType: e.target.value as typeof leaveForm.leaveType,
                }))
              }
            >
              <option value="annual">annual</option>
              <option value="sick">sick</option>
              <option value="unpaid">unpaid</option>
              <option value="other">other</option>
            </select>
            <Input
              type="date"
              value={leaveForm.startDate}
              onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <Input
              type="date"
              value={leaveForm.endDate}
              onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))}
            />
            <Input
              placeholder="Reason"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                !leaveForm.employeeId ||
                !leaveForm.startDate ||
                !leaveForm.endDate ||
                !leaveForm.reason.trim() ||
                leaveM.isPending
              }
              onClick={() => {
                setMsg(null);
                leaveM.mutate();
              }}
            >
              Submit leave
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Pending leave requests" className="mb-6">
        {!data.leavePending.length ? (
          <EmptyState title="No pending leave" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.leavePending.map((l) => {
                const emp = employees.find((e) => e.id === l.employeeId);
                return (
                  <tr key={l.id}>
                    <td className="font-medium text-navy">
                      {emp?.fullName ?? l.employeeId.slice(0, 8)}
                    </td>
                    <td>{l.leaveType}</td>
                    <td>
                      {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                    </td>
                    <td className="max-w-xs truncate text-xs">{l.reason}</td>
                    <td>
                      {data.canDecideLeave ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="navy"
                            disabled={decideM.isPending}
                            onClick={() => {
                              setMsg(null);
                              decideM.mutate({ leaveId: l.id, action: "approve" });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decideM.isPending}
                            onClick={() => {
                              setMsg(null);
                              decideM.mutate({ leaveId: l.id, action: "reject" });
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending HR decision</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Employee directory" className="mb-6">
        <Input
          className="mb-3"
          placeholder="Search name, code, department…"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
        />
        {!filteredEmployees.length ? (
          <EmptyState
            title="No HR employees"
            body="Apply M3 HR migrations and create employee rows. Figures are not fabricated."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Hired</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((e) => (
                <tr key={e.id}>
                  <td>{e.employeeCode}</td>
                  <td className="font-medium text-navy">{e.fullName}</td>
                  <td>{e.department || "—"}</td>
                  <td>{e.jobTitle || "—"}</td>
                  <td className="text-xs">{e.reportingManagerName ?? "—"}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>{e.hiredOn ? fmtDate(e.hiredOn) : "—"}</td>
                  <td>
                    {data.canMutate ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEmpForm({
                            id: e.id,
                            employeeCode: e.employeeCode,
                            fullName: e.fullName,
                            department: e.department,
                            jobTitle: e.jobTitle,
                            status: e.status as HrEmploymentStatus,
                            hiredOn: e.hiredOn ?? "",
                            profileId: e.profileId ?? "",
                            reportingManagerId: e.reportingManagerId ?? "",
                          })
                        }
                      >
                        Edit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Attendance history">
        {!attendance.length ? (
          <EmptyState
            title="No attendance rows"
            body="Record attendance for an employee and date."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((r) => {
                const emp = employees.find((e) => e.id === r.employeeId);
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.workDate)}</td>
                    <td>{emp?.fullName ?? r.employeeId.slice(0, 8)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                    <td>
                      {data.canMutate ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setCorrForm({
                              attendanceId: r.id,
                              status: r.status as HrAttendanceStatus,
                              reason: "",
                            })
                          }
                        >
                          Correct…
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
