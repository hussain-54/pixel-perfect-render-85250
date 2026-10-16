/**
 * Milestone 3 — HR & Attendance workflows (permission-gated; separate from student CRM).
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  isValidEmploymentTransition,
  summarizeAttendance,
  validateAttendanceDate,
  validateEmployeeCreate,
  validateLeaveRange,
  canDecideLeaveRequest,
  type HrAttendanceStatus,
  type HrEmploymentStatus,
} from "@/lib/hr-rules";
import {
  getPermissionLevelFromMatrix,
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  businessRoleFromSession,
  requireModulePermission,
} from "@/server/staff-access";
import { loadAuthorizationMatrix } from "@/server/permission-matrix-store";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

async function resolveSessionBusinessRole(session: TrustedSession): Promise<BusinessRole | null> {
  const mapped = resolveBusinessRoleFromTrustedAppRole(session.role);
  if (!session.userId || session.source !== "supabase") return mapped;
  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("business_role")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

/** Loaded matrix gate (DB authoritative on live); preserves role restrictions via requireModulePermission. */
async function requireHrView(session: TrustedSession) {
  await requireModulePermission(session, "hr_attendance", 1, "HR & Attendance");
}

async function requireHrMutate(session: TrustedSession) {
  await requireModulePermission(session, "hr_attendance", 2, "HR record changes");
}

async function hrCapabilityFlags(session: TrustedSession, businessRole: BusinessRole | null) {
  if (rolesAtLeastAdmin(session.role)) {
    return { canMutate: true, canDecideLeave: true };
  }
  const loaded = await loadAuthorizationMatrix(session);
  if (loaded.source === "unavailable") {
    throw new AuthError(
      "Permission matrix is temporarily unavailable. Try again or contact an administrator.",
      503,
    );
  }
  const role = businessRoleFromSession(session) ?? businessRole;
  const level = getPermissionLevelFromMatrix(loaded.matrix, role, "hr_attendance");
  return { canMutate: level >= 2, canDecideLeave: level >= 3 };
}

export type HrEmployeeView = {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string;
  jobTitle: string;
  status: string;
  hiredOn: string | null;
  profileId: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
};

export type HrAttendanceView = {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  notes: string | null;
};

export type HrLeaveView = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

function mapEmployee(
  e: {
    id: string;
    employee_code: string;
    full_name: string;
    department: string;
    job_title: string;
    status: string;
    hired_on: string | null;
    profile_id: string | null;
    reporting_manager_id?: string | null;
  },
  managerName: string | null = null,
): HrEmployeeView {
  return {
    id: e.id,
    employeeCode: e.employee_code,
    fullName: e.full_name,
    department: e.department,
    jobTitle: e.job_title,
    status: e.status,
    hiredOn: e.hired_on,
    profileId: e.profile_id,
    reportingManagerId: e.reporting_manager_id ?? null,
    reportingManagerName: managerName,
  };
}

export const portalGetHrDashboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    const businessRole = await resolveSessionBusinessRole(session);
    await requireHrView(session);
    const caps = await hrCapabilityFlags(session, businessRole);

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");

    if (!usesSupabaseDataPlane(session)) {
      return {
        ok: true as const,
        employees: [] as HrEmployeeView[],
        attendance: [] as HrAttendanceView[],
        leavePending: [] as HrLeaveView[],
        summaries: summarizeAttendance([]),
        canMutate: caps.canMutate,
        canDecideLeave: caps.canDecideLeave,
        isSuperAdmin: session.role === "super_admin",
      };
    }

    const client = requireAoSupabaseClient();
    const [empRes, attRes, leaveRes] = await Promise.all([
      client
        .from("hr_employees")
        .select(
          "id, employee_code, full_name, department, job_title, status, hired_on, profile_id, reporting_manager_id",
        )
        .order("full_name", { ascending: true })
        .limit(200),
      client
        .from("hr_attendance_records")
        .select("id, employee_id, work_date, status, notes")
        .order("work_date", { ascending: false })
        .limit(200),
      client
        .from("hr_leave_requests")
        .select(
          "id, employee_id, leave_type, start_date, end_date, reason, status, decided_at, decision_note, created_at",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (empRes.error) throw new Error(empRes.error.message);
    if (attRes.error) throw new Error(attRes.error.message);
    if (leaveRes.error) throw new Error(leaveRes.error.message);

    const nameById = new Map((empRes.data ?? []).map((e) => [e.id, e.full_name]));
    const employees = (empRes.data ?? []).map((e) =>
      mapEmployee(
        e,
        e.reporting_manager_id ? (nameById.get(e.reporting_manager_id) ?? null) : null,
      ),
    );
    const attendance = (attRes.data ?? []).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      workDate: r.work_date,
      status: r.status,
      notes: r.notes,
    }));
    const leavePending = (leaveRes.data ?? []).map((l) => ({
      id: l.id,
      employeeId: l.employee_id,
      leaveType: l.leave_type,
      startDate: l.start_date,
      endDate: l.end_date,
      reason: l.reason,
      status: l.status,
      decidedAt: l.decided_at,
      decisionNote: l.decision_note,
      createdAt: l.created_at,
    }));

    return {
      ok: true as const,
      employees,
      attendance,
      leavePending,
      summaries: summarizeAttendance(attendance),
      canMutate: caps.canMutate,
      canDecideLeave: caps.canDecideLeave,
      isSuperAdmin: session.role === "super_admin",
    };
  } catch (error) {
    toError(error);
  }
});

export const portalListHrEmployees = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    await requireHrView(session);

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    if (!usesSupabaseDataPlane(session)) {
      return { ok: true as const, employees: [] as HrEmployeeView[] };
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client
      .from("hr_employees")
      .select(
        "id, employee_code, full_name, department, job_title, status, hired_on, profile_id, reporting_manager_id",
      )
      .order("full_name", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const nameById = new Map((data ?? []).map((e) => [e.id, e.full_name]));
    return {
      ok: true as const,
      employees: (data ?? []).map((e) =>
        mapEmployee(
          e,
          e.reporting_manager_id ? (nameById.get(e.reporting_manager_id) ?? null) : null,
        ),
      ),
    };
  } catch (error) {
    toError(error);
  }
});

export const portalListHrAttendance = createServerFn({ method: "GET" })
  .validator((data: { from?: string; to?: string; employeeId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      await requireHrView(session);
      const caps = await hrCapabilityFlags(session, businessRole);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return {
          ok: true as const,
          records: [] as HrAttendanceView[],
          canMutate: caps.canMutate,
        };
      }

      const client = requireAoSupabaseClient();
      let q = client
        .from("hr_attendance_records")
        .select("id, employee_id, work_date, status, notes")
        .order("work_date", { ascending: false })
        .limit(200);
      if (data.from?.trim()) q = q.gte("work_date", data.from.trim());
      if (data.to?.trim()) q = q.lte("work_date", data.to.trim());
      if (data.employeeId?.trim()) q = q.eq("employee_id", data.employeeId.trim());

      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);

      return {
        ok: true as const,
        records: (rows ?? []).map((r) => ({
          id: r.id,
          employeeId: r.employee_id,
          workDate: r.work_date,
          status: r.status,
          notes: r.notes,
        })),
        canMutate: caps.canMutate,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertHrEmployee = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      employeeCode: string;
      fullName: string;
      department?: string;
      jobTitle?: string;
      status?: HrEmploymentStatus;
      hiredOn?: string;
      profileId?: string | null;
      reportingManagerId?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireHrMutate(session);

      const validated = validateEmployeeCreate(data);
      if (!validated.ok) throw new AuthError(validated.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("HR mutations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const profileId = data.profileId?.trim() || null;
      if (profileId) {
        let dupQ = client.from("hr_employees").select("id").eq("profile_id", profileId).limit(1);
        if (data.id?.trim()) dupQ = dupQ.neq("id", data.id.trim());
        const { data: dup } = await dupQ.maybeSingle();
        if (dup) {
          throw new AuthError("This profile is already linked to another employee.", 409);
        }
      }

      if (data.id?.trim()) {
        const { data: existing, error: loadErr } = await client
          .from("hr_employees")
          .select("*")
          .eq("id", data.id.trim())
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);
        if (!existing) throw new AuthError("Employee not found.", 404);

        const nextStatus = (data.status ?? existing.status) as HrEmploymentStatus;
        if (
          !isValidEmploymentTransition({
            from: existing.status as HrEmploymentStatus,
            to: nextStatus,
            appRole: session.role,
          })
        ) {
          throw new AuthError(
            "Invalid employment status transition (rehire of terminated staff requires Super Admin).",
            400,
          );
        }

        const { data: row, error } = await client
          .from("hr_employees")
          .update({
            employee_code: data.employeeCode.trim(),
            full_name: data.fullName.trim(),
            department: data.department?.trim() ?? existing.department,
            job_title: data.jobTitle?.trim() ?? existing.job_title,
            status: nextStatus,
            hired_on: data.hiredOn?.trim() || existing.hired_on,
            profile_id: profileId,
            reporting_manager_id:
              data.reportingManagerId === undefined
                ? existing.reporting_manager_id
                : data.reportingManagerId?.trim() || null,
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) {
          if (/unique|duplicate/i.test(error.message)) {
            throw new AuthError("Employee code or profile link already exists.", 409);
          }
          throw new Error(error.message);
        }

        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "hr.employee.update",
          entity_type: "hr_employees",
          entity_id: row.id,
          metadata: { status: row.status, employee_code: row.employee_code },
        });

        return { ok: true as const, employee: mapEmployee(row) };
      }

      const { data: row, error } = await client
        .from("hr_employees")
        .insert({
          employee_code: data.employeeCode.trim(),
          full_name: data.fullName.trim(),
          department: data.department?.trim() || "",
          job_title: data.jobTitle?.trim() || "",
          status: data.status ?? "active",
          hired_on: data.hiredOn?.trim() || null,
          profile_id: profileId,
          reporting_manager_id: data.reportingManagerId?.trim() || null,
        })
        .select("*")
        .single();
      if (error) {
        if (/unique|duplicate/i.test(error.message)) {
          throw new AuthError("Employee code or profile link already exists.", 409);
        }
        throw new Error(error.message);
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "hr.employee.create",
        entity_type: "hr_employees",
        entity_id: row.id,
        metadata: { status: row.status, employee_code: row.employee_code },
      });

      return { ok: true as const, employee: mapEmployee(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalRecordHrAttendance = createServerFn({ method: "POST" })
  .validator(
    (data: { employeeId: string; workDate: string; status: HrAttendanceStatus; notes?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireHrMutate(session);

      const dateCheck = validateAttendanceDate(data.workDate);
      if (!dateCheck.ok) throw new AuthError(dateCheck.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Attendance requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: emp } = await client
        .from("hr_employees")
        .select("id, status")
        .eq("id", data.employeeId)
        .maybeSingle();
      if (!emp) throw new AuthError("Employee not found.", 404);
      if (emp.status === "terminated") {
        throw new AuthError("Cannot record attendance for a terminated employee.", 400);
      }

      const { data: existing } = await client
        .from("hr_attendance_records")
        .select("id")
        .eq("employee_id", data.employeeId)
        .eq("work_date", dateCheck.date)
        .maybeSingle();
      if (existing) {
        throw new AuthError(
          "Attendance already exists for this employee and date. Use correction instead.",
          409,
        );
      }

      const { data: row, error } = await client
        .from("hr_attendance_records")
        .insert({
          employee_id: data.employeeId,
          work_date: dateCheck.date,
          status: data.status,
          notes: data.notes?.trim() || null,
          recorded_by: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) {
        if (/unique|duplicate/i.test(error.message)) {
          throw new AuthError(
            "Attendance already exists for this employee and date. Use correction instead.",
            409,
          );
        }
        throw new Error(error.message);
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "hr.attendance.record",
        entity_type: "hr_attendance_records",
        entity_id: row.id,
        metadata: { employee_id: row.employee_id, work_date: row.work_date, status: row.status },
      });

      return {
        ok: true as const,
        record: {
          id: row.id,
          employeeId: row.employee_id,
          workDate: row.work_date,
          status: row.status,
          notes: row.notes,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalCorrectHrAttendance = createServerFn({ method: "POST" })
  .validator((data: { attendanceId: string; status: HrAttendanceStatus; reason: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireHrMutate(session);

      const reason = data.reason.trim();
      if (reason.length < 3)
        throw new AuthError("Correction reason is required (min 3 chars).", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Attendance correction requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: existing, error: loadErr } = await client
        .from("hr_attendance_records")
        .select("*")
        .eq("id", data.attendanceId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Attendance record not found.", 404);
      if (existing.status === data.status) {
        throw new AuthError("New status must differ from the current status.", 400);
      }

      const { data: row, error } = await client
        .from("hr_attendance_records")
        .update({
          status: data.status,
          notes: existing.notes,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { error: corrErr } = await client.from("hr_attendance_corrections").insert({
        attendance_id: existing.id,
        previous_status: existing.status,
        new_status: data.status,
        reason,
        corrected_by: session.userId ?? null,
      });
      if (corrErr) throw new Error(corrErr.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "hr.attendance.correct",
        entity_type: "hr_attendance_records",
        entity_id: row.id,
        metadata: {
          previous_status: existing.status,
          new_status: data.status,
          reason,
        },
      });

      return {
        ok: true as const,
        record: {
          id: row.id,
          employeeId: row.employee_id,
          workDate: row.work_date,
          status: row.status,
          notes: row.notes,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSubmitHrLeave = createServerFn({ method: "POST" })
  .validator(
    (data: {
      employeeId: string;
      leaveType?: "annual" | "sick" | "unpaid" | "other";
      startDate: string;
      endDate: string;
      reason: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      // Employees linked by profile may submit; HR may submit on behalf.
      const mutateOk = (await hrCapabilityFlags(session, businessRole)).canMutate;

      const range = validateLeaveRange(data.startDate, data.endDate);
      if (!range.ok) throw new AuthError(range.error, 400);
      if (!data.reason.trim()) throw new AuthError("Leave reason is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Leave requests require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: emp } = await client
        .from("hr_employees")
        .select("id, profile_id, status")
        .eq("id", data.employeeId)
        .maybeSingle();
      if (!emp) throw new AuthError("Employee not found.", 404);
      const isOwner = Boolean(session.userId && emp.profile_id === session.userId);
      if (!mutateOk && !isOwner) {
        throw new AuthError("You may only submit leave for your own employee record.", 403);
      }

      const { data: row, error } = await client
        .from("hr_leave_requests")
        .insert({
          employee_id: data.employeeId,
          leave_type: data.leaveType ?? "annual",
          start_date: data.startDate.trim(),
          end_date: data.endDate.trim(),
          reason: data.reason.trim(),
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "hr.leave.submit",
        entity_type: "hr_leave_requests",
        entity_id: row.id,
        metadata: { employee_id: row.employee_id, status: row.status },
      });

      return {
        ok: true as const,
        leave: {
          id: row.id,
          employeeId: row.employee_id,
          leaveType: row.leave_type,
          startDate: row.start_date,
          endDate: row.end_date,
          reason: row.reason,
          status: row.status,
          decidedAt: row.decided_at,
          decisionNote: row.decision_note,
          createdAt: row.created_at,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalDecideHrLeave = createServerFn({ method: "POST" })
  .validator(
    (data: { leaveId: string; action: "approve" | "reject" | "cancel"; note?: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Leave decisions require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: existing, error: loadErr } = await client
        .from("hr_leave_requests")
        .select("*")
        .eq("id", data.leaveId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Leave request not found.", 404);

      const { data: emp } = await client
        .from("hr_employees")
        .select("profile_id")
        .eq("id", existing.employee_id)
        .maybeSingle();
      const ownerProfileId = emp?.profile_id ?? null;

      const isOwner = Boolean(session.userId && ownerProfileId === session.userId);
      const decideOk = (await hrCapabilityFlags(session, businessRole)).canDecideLeave;
      const decision = canDecideLeaveRequest({
        currentStatus: existing.status,
        action: data.action,
        isOwner,
        canDecide: decideOk,
      });
      if (!decision.ok) throw new AuthError(decision.error, 403);

      const { data: row, error } = await client
        .from("hr_leave_requests")
        .update({
          status: decision.next,
          decided_by:
            data.action === "cancel" && isOwner && !decideOk ? null : (session.userId ?? null),
          decided_at: new Date().toISOString(),
          decision_note: data.note?.trim() || null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      if (decision.next === "approved") {
        await client
          .from("hr_employees")
          .update({ status: "on_leave" })
          .eq("id", row.employee_id)
          .eq("status", "active");
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `hr.leave.${data.action}`,
        entity_type: "hr_leave_requests",
        entity_id: row.id,
        metadata: { status: row.status, employee_id: row.employee_id },
      });

      return {
        ok: true as const,
        leave: {
          id: row.id,
          employeeId: row.employee_id,
          leaveType: row.leave_type,
          startDate: row.start_date,
          endDate: row.end_date,
          reason: row.reason,
          status: row.status,
          decidedAt: row.decided_at,
          decisionNote: row.decision_note,
          createdAt: row.created_at,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalListHrLeave = createServerFn({ method: "GET" })
  .validator((data: { status?: string; employeeId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      await requireHrView(session);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return { ok: true as const, leaves: [] as HrLeaveView[] };
      }
      const client = requireAoSupabaseClient();
      let q = client
        .from("hr_leave_requests")
        .select(
          "id, employee_id, leave_type, start_date, end_date, reason, status, decided_at, decision_note, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      const statusFilter = data.status?.trim();
      if (
        statusFilter === "pending" ||
        statusFilter === "approved" ||
        statusFilter === "rejected" ||
        statusFilter === "cancelled"
      ) {
        q = q.eq("status", statusFilter);
      }
      if (data.employeeId?.trim()) q = q.eq("employee_id", data.employeeId.trim());

      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);

      return {
        ok: true as const,
        leaves: (rows ?? []).map((l) => ({
          id: l.id,
          employeeId: l.employee_id,
          leaveType: l.leave_type,
          startDate: l.start_date,
          endDate: l.end_date,
          reason: l.reason,
          status: l.status,
          decidedAt: l.decided_at,
          decisionNote: l.decision_note,
          createdAt: l.created_at,
        })),
      };
    } catch (error) {
      toError(error);
    }
  });
