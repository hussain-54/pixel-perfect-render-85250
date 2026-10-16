import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  clearPortalSessionCookie,
  establishDemoSession,
  establishSupabaseSession,
  readPortalSessionCookie,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { normalizeAppRole, rolesAtLeastAdmin, type AppRole } from "@/lib/roles";
import type { BusinessRole } from "@/lib/business-permissions";
import {
  activityForStudent,
  crmListOrEmpty,
  crmRecordOrNull,
  isMockCrmAllowed,
} from "@/lib/portal-data-plane";
import * as db from "@/data/mock";
import {
  businessRoleFromSession,
  denyFrontDeskConsultantWorkflows,
  requireModulePermission,
} from "@/server/staff-access";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type PublicSession = {
  role: AppRole;
  email: string;
  source: "supabase" | "demo";
  consultantId?: string;
  businessRole?: BusinessRole | null;
};

function toPublic(session: TrustedSession): PublicSession {
  return {
    role: session.role,
    email: session.email,
    source: session.source,
    ...(session.consultantId ? { consultantId: session.consultantId } : {}),
    businessRole: session.businessRole ?? null,
  };
}

/** Route-guard helper — httpOnly cookie; demo roles re-validated against DEMO_ACCOUNTS. */
export const getPortalSession = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = readPortalSessionCookie();
  if (!cookie) return null;

  if (cookie.source === "demo") {
    try {
      // Re-derive role from the allow-list so a tampered cookie cannot elevate privileges.
      const { findDemoAccountByEmail, isDemoAuthEnabled } = await import("@/lib/demo-auth");
      if (!isDemoAuthEnabled()) return null;
      const account = findDemoAccountByEmail(cookie.email);
      if (!account) return null;
      const role = normalizeAppRole(account.role);
      if (!role) return null;
      return {
        role,
        email: account.email,
        source: "demo" as const,
        ...(account.consultantId ? { consultantId: account.consultantId } : {}),
      } satisfies PublicSession;
    } catch {
      return null;
    }
  }

  const role = normalizeAppRole(cookie.role);
  if (!role) return null;
  return {
    role,
    email: cookie.email,
    source: cookie.source,
    ...(cookie.consultantId ? { consultantId: cookie.consultantId } : {}),
  } satisfies PublicSession;
});

export const establishSession = createServerFn({ method: "POST" })
  .validator((data: { accessToken?: string; demoEmail?: string; demoPassword?: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (data.accessToken) {
        return toPublic(await establishSupabaseSession(data.accessToken));
      }
      if (data.demoEmail && data.demoPassword) {
        return toPublic(establishDemoSession(data.demoEmail, data.demoPassword));
      }
      throw new AuthError("Missing credentials.");
    } catch (error) {
      toError(error);
    }
  });

export const clearSession = createServerFn({ method: "POST" }).handler(async () => {
  clearPortalSessionCookie();
  return { ok: true as const };
});

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") {
    // Never invent an officer id — unscoped consultants see nothing.
    return session.consultantId ?? null;
  }
  return null;
}

function filterStudentsForSession(session: TrustedSession) {
  if (rolesAtLeastAdmin(session.role)) return db.students.filter((s) => !s.archived);
  if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    return db.students.filter((s) => s.consultantId === cid && !s.archived);
  }
  if (session.role === "student") {
    const email = session.email.toLowerCase();
    // Never fall back to an unrelated mock student — empty means no linked record yet.
    return db.students.filter((s) => s.email.toLowerCase() === email && !s.archived);
  }
  return [];
}

function assertStudentVisible(session: TrustedSession, studentId: string) {
  const allowed = filterStudentsForSession(session);
  if (!allowed.some((s) => s.id === studentId)) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
}

export const portalGetStudents = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    denyFrontDeskConsultantWorkflows(session, "the consultant student directory");
    await requireModulePermission(session, "students", 1, "the consultant student directory");
    // Supabase sessions must never receive mock CRM rows as a silent fallback.
    return crmListOrEmpty(session.source, filterStudentsForSession(session));
  } catch (error) {
    toError(error);
  }
});

export const portalGetStudent = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      if (session.role !== "student") {
        denyFrontDeskConsultantWorkflows(session, "student records");
        await requireModulePermission(session, "students", 1, "student records");
      }
      if (!isMockCrmAllowed(session.source)) {
        return crmRecordOrNull(session.source, null);
      }
      assertStudentVisible(session, data.id);
      return crmRecordOrNull(session.source, db.students.find((s) => s.id === data.id) ?? null);
    } catch (error) {
      toError(error);
    }
  });

export const portalGetCurrentStudent = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["student"]);

    const { usesSupabaseDataPlane } = await import("@/server/ao-data");
    if (usesSupabaseDataPlane(session)) {
      const { requireAoSupabaseClient, resolveOwnStudentDb } = await import("@/server/ao-data");
      const { studentPortalAccessAllowed } = await import("@/lib/signup-fee-gate");
      const client = requireAoSupabaseClient();
      // Attempt email-based claim when Front Desk registered first (RPC; no client student id).
      const { error: claimErr } = await client.rpc("claim_own_student_record");
      void claimErr; // optional — resolveOwnStudentDb remains authoritative if unlinked
      // Ownership from students.profile_id = auth user — never from a client student id.
      const student = await resolveOwnStudentDb(client, session);
      const { data: liveRow, error: liveErr } = await client
        .from("students")
        .select("portal_activated_at")
        .eq("id", student.id)
        .maybeSingle();
      if (liveErr) throw new Error(liveErr.message);
      if (
        !studentPortalAccessAllowed({
          source: "supabase",
          portalActivatedAt: liveRow?.portal_activated_at ?? null,
        })
      ) {
        throw new AuthError(
          "Your student portal is not activated yet. Signup fee must be verified by Accounts/Admin.",
          403,
        );
      }
      if (student.consultantId) {
        const { namesForIds } = await import("@/server/ao-data");
        const names = await namesForIds(client, [student.consultantId]);
        const consultantName = names.get(student.consultantId)?.trim();
        if (consultantName) return { ...student, consultantName };
      }
      return student;
    }

    if (!isMockCrmAllowed(session.source)) {
      return crmRecordOrNull(session.source, null);
    }
    const rows = filterStudentsForSession(session);
    return crmRecordOrNull(session.source, rows[0] ?? null);
  } catch (error) {
    toError(error);
  }
});

/**
 * Student self-service contact update.
 * Ownership from resolveOwnStudentDb (profile_id = session.userId) — never client student id.
 * Allow-list only; staff-locked columns rejected by buildStudentSelfEditPatch + DB trigger.
 */
export const portalUpdateOwnStudentContact = createServerFn({ method: "POST" })
  .validator(
    (data: {
      phone?: string;
      whatsapp?: string;
      city?: string;
      dob?: string;
      destination?: string;
      program?: string;
      studyLevel?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student"]);

      const { buildStudentSelfEditPatch, studentSelfEditPatchIsSafe } =
        await import("@/lib/student-profile-self-edit-rules");
      const built = buildStudentSelfEditPatch(data);
      if (!built.ok) throw new AuthError(built.error, 400);
      if (!studentSelfEditPatchIsSafe(built.patch)) {
        throw new AuthError("Invalid profile fields.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveOwnStudentDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Saving profile contact requires the live data plane.", 400);
      }
      if (!session.userId) {
        throw new AuthError("Authenticated user id is required.", 403);
      }

      const { studentPortalAccessAllowed } = await import("@/lib/signup-fee-gate");
      const { updateOwnStudentContact } = await import("@/services/db");
      const { mapStudentRow } = await import("@/lib/ao-mappers");
      const client = requireAoSupabaseClient();

      const own = await resolveOwnStudentDb(client, session);
      const { data: liveRow, error: liveErr } = await client
        .from("students")
        .select("portal_activated_at")
        .eq("id", own.id)
        .maybeSingle();
      if (liveErr) throw new Error(liveErr.message);
      if (
        !studentPortalAccessAllowed({
          source: "supabase",
          portalActivatedAt: liveRow?.portal_activated_at ?? null,
        })
      ) {
        throw new AuthError(
          "Your student portal is not activated yet. Signup fee must be verified by Accounts/Admin.",
          403,
        );
      }

      const row = await updateOwnStudentContact(client, own.id, session.userId, built.patch);
      if (!row) throw new AuthError("Student record not found.", 404);
      return { ok: true as const, student: mapStudentRow(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetConsultants = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);

    const { usesSupabaseDataPlane } = await import("@/server/ao-data");
    if (usesSupabaseDataPlane(session)) {
      await requireModulePermission(session, "students", 1, "consultant roster");
      const { requireAoSupabaseClient } = await import("@/server/ao-data");
      const { listConsultants } = await import("@/services/db");
      const {
        countStudentsByConsultantId,
        mapConsultantDeskRow,
      } = await import("@/lib/consultant-mappers");
      const client = requireAoSupabaseClient();
      const desks = await listConsultants(client);
      if (!desks.length) return [];

      const ids = desks.map((d) => d.id);
      const [{ data: profiles, error: profileErr }, { data: studentRows, error: studentErr }] =
        await Promise.all([
          client.from("profiles").select("id,full_name,email").in("id", ids),
          client
            .from("students")
            .select("assigned_consultant_id")
            .is("archived_at", null)
            .in("assigned_consultant_id", ids),
        ]);
      if (profileErr) throw new Error(profileErr.message);
      if (studentErr) throw new Error(studentErr.message);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const studentCounts = countStudentsByConsultantId(studentRows ?? []);
      return desks.map((desk) =>
        mapConsultantDeskRow(desk, {
          profile: profileById.get(desk.id) ?? null,
          studentCount: studentCounts.get(desk.id) ?? 0,
        }),
      );
    }

    return crmListOrEmpty(session.source, db.consultants);
  } catch (error) {
    toError(error);
  }
});

export const portalGetConsultant = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      if (
        session.role === "consultant" &&
        session.consultantId &&
        data.id !== session.consultantId
      ) {
        throw new AuthError("You do not have access to this consultant record.", 403);
      }

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        if (rolesAtLeastAdmin(session.role)) {
          await requireModulePermission(session, "students", 1, "consultant records");
        }
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const { getConsultantById } = await import("@/services/db");
        const { mapConsultantDeskRow } = await import("@/lib/consultant-mappers");
        const client = requireAoSupabaseClient();
        const desk = await getConsultantById(client, data.id);
        if (!desk) return crmRecordOrNull(session.source, null);

        const [{ data: profile }, { count }] = await Promise.all([
          client.from("profiles").select("full_name,email").eq("id", desk.id).maybeSingle(),
          client
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("assigned_consultant_id", desk.id)
            .is("archived_at", null),
        ]);

        return mapConsultantDeskRow(desk, {
          profile: profile ?? null,
          studentCount: count ?? 0,
        });
      }

      if (!isMockCrmAllowed(session.source)) {
        return crmRecordOrNull(session.source, null);
      }
      return crmRecordOrNull(session.source, db.consultants.find((c) => c.id === data.id) ?? null);
    } catch (error) {
      toError(error);
    }
  });

export const portalGetAppointments = createServerFn({ method: "GET" })
  .validator((data: { studentId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      // Front Desk is not the appointments workspace; RLS remains authoritative.
      if (session.role !== "student") {
        denyFrontDeskConsultantWorkflows(session, "appointments");
        await requireModulePermission(session, "students", 1, "appointments");
      }

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          resolveOwnStudentDb,
          assertStudentVisibleDb,
          namesForIds,
        } = await import("@/server/ao-data");
        const { listAppointments } = await import("@/services/db");
        const { mapAppointmentRow } = await import("@/lib/appointment-mappers");
        const client = requireAoSupabaseClient();

        let studentFilter: string | undefined;
        let ownStudent: Awaited<ReturnType<typeof resolveOwnStudentDb>> | null = null;

        if (session.role === "student") {
          // Client studentId is ignored for authorization — profile link only.
          ownStudent = await resolveOwnStudentDb(client, session);
          studentFilter = ownStudent.id;
        } else if (data.studentId?.trim()) {
          await assertStudentVisibleDb(client, session, data.studentId.trim());
          studentFilter = data.studentId.trim();
        }

        // JWT user client — RLS appointments_access (SELECT) enforced. Errors propagate.
        const rows = await listAppointments(client, studentFilter);

        const studentIds = [...new Set(rows.map((r) => r.student_id))];
        const consultantIds = [
          ...new Set(rows.map((r) => r.consultant_id).filter((id): id is string => Boolean(id))),
        ];

        const studentById = new Map<
          string,
          { name: string; destination: string; studyLevel: string }
        >();
        if (ownStudent) {
          studentById.set(ownStudent.id, {
            name: ownStudent.name,
            destination: ownStudent.destination || "—",
            studyLevel: ownStudent.studyLevel || "—",
          });
        }
        const missingStudentIds = studentIds.filter((id) => !studentById.has(id));
        if (missingStudentIds.length) {
          const { data: studentRows, error: studentErr } = await client
            .from("students")
            .select("id,full_name,destination,study_level")
            .in("id", missingStudentIds);
          if (studentErr) throw new Error(studentErr.message);
          for (const s of studentRows ?? []) {
            studentById.set(s.id, {
              name: s.full_name,
              destination: s.destination?.trim() || "—",
              studyLevel: s.study_level?.trim() || "—",
            });
          }
        }

        const consultantNames = await namesForIds(client, consultantIds);

        return rows.map((row) => {
          const st = studentById.get(row.student_id);
          return mapAppointmentRow(row, {
            destination: st?.destination ?? null,
            studyLevel: st?.studyLevel ?? null,
            studentName: st?.name ?? null,
            consultantName: row.consultant_id
              ? (consultantNames.get(row.consultant_id) ?? null)
              : null,
          });
        });
      }

      if (!isMockCrmAllowed(session.source)) {
        return crmListOrEmpty(session.source, []);
      }
      let rows = db.appointments;
      if (session.role === "student") {
        const me = filterStudentsForSession(session)[0];
        rows = me ? rows.filter((a) => a.studentId === me.id) : [];
      } else if (session.role === "consultant") {
        const cid = consultantScopeId(session);
        // Fail closed when the trusted session has no consultant desk id.
        rows = cid ? rows.filter((a) => a.consultantId === cid) : [];
      }
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((a) => a.studentId === data.studentId);
      }
      return crmListOrEmpty(session.source, rows);
    } catch (error) {
      toError(error);
    }
  });

/**
 * Student self-service appointment request.
 * Ownership from resolveOwnStudentDb — never client studentId / consultantId / status.
 * Insert via JWT client; RLS appointments_access + can_access_student.
 */
export const portalRequestAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: { date: string; time: string; notes?: string; durationMinutes?: number }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student"]);

      const {
        buildStudentAppointmentBooking,
        appointmentBookingConflicts,
        studentBookingPayloadIsSafe,
      } = await import("@/lib/appointment-booking-rules");
      const built = buildStudentAppointmentBooking(data);
      if (!built.ok) throw new AuthError(built.error, 400);
      if (!studentBookingPayloadIsSafe(built.insert)) {
        throw new AuthError("Invalid appointment fields.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveOwnStudentDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Booking an appointment requires the live data plane.", 400);
      }
      if (!session.userId) {
        throw new AuthError("Authenticated user id is required.", 403);
      }

      const { studentPortalAccessAllowed } = await import("@/lib/signup-fee-gate");
      const { listAppointments, createAppointmentRequest } = await import("@/services/db");
      const { mapAppointmentRow } = await import("@/lib/appointment-mappers");
      const client = requireAoSupabaseClient();

      const own = await resolveOwnStudentDb(client, session);
      const { data: liveRow, error: liveErr } = await client
        .from("students")
        .select("portal_activated_at, assigned_consultant_id, destination, study_level, full_name")
        .eq("id", own.id)
        .maybeSingle();
      if (liveErr) throw new Error(liveErr.message);
      if (
        !studentPortalAccessAllowed({
          source: "supabase",
          portalActivatedAt: liveRow?.portal_activated_at ?? null,
        })
      ) {
        throw new AuthError(
          "Your student portal is not activated yet. Signup fee must be verified by Accounts/Admin.",
          403,
        );
      }

      const existing = await listAppointments(client, own.id);
      if (
        appointmentBookingConflicts(
          built.insert.scheduled_at,
          built.insert.duration_minutes,
          existing,
        )
      ) {
        throw new AuthError(
          "You already have an open appointment that overlaps this time. Choose another slot or contact your consultant.",
          409,
        );
      }

      // consultant_id from assigned desk only — never from client payload.
      const consultantId = liveRow?.assigned_consultant_id?.trim() || null;
      const row = await createAppointmentRequest(client, {
        student_id: own.id,
        consultant_id: consultantId,
        created_by: session.userId,
        ...built.insert,
      });

      return {
        ok: true as const,
        appointment: mapAppointmentRow(row, {
          destination: liveRow?.destination ?? own.destination,
          studyLevel: liveRow?.study_level ?? own.studyLevel,
          studentName: liveRow?.full_name ?? own.name,
        }),
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * Staff appointment status update (confirm / cancel / complete / etc.).
 * Loads appointment by id, then assertStudentVisibleDb — never trusts client studentId.
 */
export const portalUpdateAppointmentStatus = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; status: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "appointment status");
      await requireModulePermission(session, "students", 2, "appointment status updates");

      const appointmentId = data.appointmentId?.trim();
      if (!appointmentId) throw new AuthError("Appointment id is required.", 400);

      const { parseAppointmentStatusInput, appointmentStatusUpdateDenied } =
        await import("@/lib/appointment-status-rules");
      const nextStatus = parseAppointmentStatusInput(data.status);
      if (!nextStatus) throw new AuthError("Invalid appointment status.", 400);

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        resolveConsultantDeskId,
        namesForIds,
      } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Updating appointment status requires the live data plane.", 400);
      }

      const { getAppointmentById, updateAppointmentStatus } = await import("@/services/db");
      const { mapAppointmentRow } = await import("@/lib/appointment-mappers");
      const client = requireAoSupabaseClient();

      const existing = await getAppointmentById(client, appointmentId);
      if (!existing) throw new AuthError("Appointment not found.", 404);

      // Visibility from student ownership / assignment — not client-supplied student id.
      await assertStudentVisibleDb(client, session, existing.student_id);

      const denied = appointmentStatusUpdateDenied({
        fromStatus: existing.status,
        toStatus: nextStatus,
        actorIsStaff: true,
      });
      if (denied) throw new AuthError(denied, 400);

      const patch: { status: typeof nextStatus; consultant_id?: string } = {
        status: nextStatus,
      };
      // Claim desk when confirming an unassigned request.
      if (!existing.consultant_id && (nextStatus === "confirmed" || nextStatus === "rescheduled")) {
        const deskId = await resolveConsultantDeskId(client, session);
        if (deskId) patch.consultant_id = deskId;
      }

      const row = await updateAppointmentStatus(client, appointmentId, patch);
      if (!row) throw new AuthError("Appointment not found.", 404);

      const { data: studentRow, error: studentErr } = await client
        .from("students")
        .select("full_name, destination, study_level")
        .eq("id", row.student_id)
        .maybeSingle();
      if (studentErr) throw new Error(studentErr.message);

      const consultantNames = row.consultant_id
        ? await namesForIds(client, [row.consultant_id])
        : new Map<string, string>();

      return {
        ok: true as const,
        appointment: mapAppointmentRow(row, {
          destination: studentRow?.destination ?? null,
          studyLevel: studentRow?.study_level ?? null,
          studentName: studentRow?.full_name ?? null,
          consultantName: row.consultant_id
            ? (consultantNames.get(row.consultant_id) ?? null)
            : null,
        }),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetDocuments = createServerFn({ method: "GET" })
  .validator((data: { studentId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          resolveOwnStudentDb,
          assertStudentVisibleDb,
          listVisibleStudentsDb,
          listDocsForStudents,
        } = await import("@/server/ao-data");
        const { resolveCrmListStudentIds } = await import("@/lib/student-crm-scope");
        const client = requireAoSupabaseClient();

        let ownStudentId: string | null = null;
        let visibleStudentIds: string[] = [];
        if (session.role === "student") {
          const own = await resolveOwnStudentDb(client, session);
          ownStudentId = own.id;
        } else {
          denyFrontDeskConsultantWorkflows(session, "document lists");
          await requireModulePermission(session, "documents", 1, "document lists");
          if (data.studentId?.trim()) {
            await assertStudentVisibleDb(client, session, data.studentId.trim());
            visibleStudentIds = [data.studentId.trim()];
          } else {
            visibleStudentIds = (await listVisibleStudentsDb(client, session)).map((s) => s.id);
          }
        }

        const scope = resolveCrmListStudentIds({
          role: session.role,
          ownStudentId,
          requestedStudentId: data.studentId,
          visibleStudentIds,
        });
        if (!scope.ok) throw new AuthError(scope.error, scope.status);
        // JWT + RLS can_access_student on student_documents — never service role / fixtures.
        const docs = await listDocsForStudents(client, scope.studentIds);
        const studentIds = [...new Set(docs.map((d) => d.studentId))];
        if (!studentIds.length) return docs;
        const { data: nameRows, error: nameErr } = await client
          .from("students")
          .select("id,full_name")
          .in("id", studentIds);
        if (nameErr) throw new Error(nameErr.message);
        const { attachStudentNames, studentNameByIdFromRows } =
          await import("@/lib/crm-display-names");
        return attachStudentNames(docs, studentNameByIdFromRows(nameRows ?? []));
      }

      if (!isMockCrmAllowed(session.source)) {
        return [];
      }
      const visibleStudents = filterStudentsForSession(session);
      const visibleIds = new Set(visibleStudents.map((s) => s.id));
      let rows = db.documents.filter((d) => visibleIds.has(d.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((d) => d.studentId === data.studentId);
      }
      const { attachStudentNames, studentNameByIdFromRows } =
        await import("@/lib/crm-display-names");
      return crmListOrEmpty(
        session.source,
        attachStudentNames(rows, studentNameByIdFromRows(visibleStudents)),
      );
    } catch (error) {
      toError(error);
    }
  });

export const portalGetApplications = createServerFn({ method: "GET" })
  .validator((data: { studentId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          resolveOwnStudentDb,
          assertStudentVisibleDb,
          listVisibleStudentsDb,
          listAppsForStudents,
        } = await import("@/server/ao-data");
        const { resolveCrmListStudentIds } = await import("@/lib/student-crm-scope");
        const client = requireAoSupabaseClient();

        let ownStudentId: string | null = null;
        let visibleStudentIds: string[] = [];
        if (session.role === "student") {
          const own = await resolveOwnStudentDb(client, session);
          ownStudentId = own.id;
        } else {
          denyFrontDeskConsultantWorkflows(session, "application lists");
          await requireModulePermission(session, "admissions", 1, "application lists");
          if (data.studentId?.trim()) {
            await assertStudentVisibleDb(client, session, data.studentId.trim());
            visibleStudentIds = [data.studentId.trim()];
          } else {
            visibleStudentIds = (await listVisibleStudentsDb(client, session)).map((s) => s.id);
          }
        }

        const scope = resolveCrmListStudentIds({
          role: session.role,
          ownStudentId,
          requestedStudentId: data.studentId,
          visibleStudentIds,
        });
        if (!scope.ok) throw new AuthError(scope.error, scope.status);
        // JWT + RLS can_access_student on applications — never service role / fixtures.
        const apps = await listAppsForStudents(client, scope.studentIds);
        const studentIds = [...new Set(apps.map((a) => a.studentId))];
        if (!studentIds.length) return apps;
        const { data: nameRows, error: nameErr } = await client
          .from("students")
          .select("id,full_name")
          .in("id", studentIds);
        if (nameErr) throw new Error(nameErr.message);
        const { attachStudentNames, studentNameByIdFromRows } =
          await import("@/lib/crm-display-names");
        return attachStudentNames(apps, studentNameByIdFromRows(nameRows ?? []));
      }

      if (!isMockCrmAllowed(session.source)) {
        return [];
      }
      const visibleStudents = filterStudentsForSession(session);
      const visibleIds = new Set(visibleStudents.map((s) => s.id));
      let rows = db.applications.filter((a) => visibleIds.has(a.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((a) => a.studentId === data.studentId);
      }
      const { attachStudentNames, studentNameByIdFromRows } =
        await import("@/lib/crm-display-names");
      return crmListOrEmpty(
        session.source,
        attachStudentNames(rows, studentNameByIdFromRows(visibleStudents)),
      );
    } catch (error) {
      toError(error);
    }
  });

export const portalGetLeads = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    denyFrontDeskConsultantWorkflows(session, "leads");
    await requireModulePermission(session, "students", 1, "leads");

    const { usesSupabaseDataPlane } = await import("@/server/ao-data");
    if (usesSupabaseDataPlane(session)) {
      const { requireAoSupabaseClient, resolveConsultantDeskId } = await import("@/server/ao-data");
      const { listConsultationRequests } = await import("@/services/db");
      const { filterLeadsForDeskScope, mapConsultationRequestToLead } =
        await import("@/lib/lead-mappers");
      const client = requireAoSupabaseClient();
      // JWT client + RLS consultation_select_staff; never service role.
      const rows = await listConsultationRequests(client, 100);
      const isAdmin = rolesAtLeastAdmin(session.role);
      const businessRole = businessRoleFromSession(session);
      const isManager = businessRole === "manager";
      const deskId = isAdmin || isManager ? null : await resolveConsultantDeskId(client, session);
      const scoped = filterLeadsForDeskScope(rows, { isAdmin, isManager, deskId });
      return scoped.map(mapConsultationRequestToLead);
    }

    // Demo plane only — live/supabase never reaches fixtures.
    if (!isMockCrmAllowed(session.source)) {
      return [];
    }
    if (session.role === "consultant") {
      const cid = consultantScopeId(session);
      return crmListOrEmpty(
        session.source,
        cid ? db.leads.filter((l) => l.consultantId === cid) : [],
      );
    }
    return crmListOrEmpty(session.source, db.leads);
  } catch (error) {
    toError(error);
  }
});

export type LeadAssigneeOption = { id: string; label: string };

export const portalListLeadAssigneeOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeadAssigneeOption[]> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "lead assignment");
      await requireModulePermission(session, "students", 2, "lead assignment");
      const { canAssignConsultationLead, isEligibleLeadAssigneeStatus } =
        await import("@/lib/lead-mappers");
      if (
        !canAssignConsultationLead({
          appRole: session.role,
          businessRole: businessRoleFromSession(session),
        })
      ) {
        throw new AuthError("You do not have permission to assign leads.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient, namesForIds } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Lead assignees require the live data plane.", 400);
      }
      const { listConsultants } = await import("@/services/db");
      const client = requireAoSupabaseClient();
      const desks = (await listConsultants(client)).filter((c) =>
        isEligibleLeadAssigneeStatus(c.status),
      );
      const names = await namesForIds(
        client,
        desks.map((d) => d.id),
      );
      return desks.map((d) => ({
        id: d.id,
        label: names.get(d.id)?.trim() || d.desk?.trim() || d.department?.trim() || d.id,
      }));
    } catch (error) {
      toError(error);
    }
  },
);

export const portalAssignLead = createServerFn({ method: "POST" })
  .validator((data: { leadId: string; consultantId: string | null }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "lead assignment");
      await requireModulePermission(session, "students", 2, "lead assignment");
      const {
        canAssignConsultationLead,
        isEligibleLeadAssigneeStatus,
        mapConsultationRequestToLead,
      } = await import("@/lib/lead-mappers");
      if (
        !canAssignConsultationLead({
          appRole: session.role,
          businessRole: businessRoleFromSession(session),
        })
      ) {
        throw new AuthError("You do not have permission to assign leads.", 403);
      }

      const leadId = data.leadId?.trim();
      if (!leadId) throw new AuthError("Lead id is required.", 400);
      const consultantId =
        data.consultantId === null || data.consultantId === "" ? null : data.consultantId.trim();

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Lead assignment requires the live data plane.", 400);
      }
      const { getConsultationRequestById, getConsultantById, updateConsultationRequest } =
        await import("@/services/db");
      const client = requireAoSupabaseClient();

      const existing = await getConsultationRequestById(client, leadId);
      if (!existing) throw new AuthError("Lead not found.", 404);

      if (consultantId) {
        const desk = await getConsultantById(client, consultantId);
        if (!desk || !isEligibleLeadAssigneeStatus(desk.status)) {
          throw new AuthError("Selected consultant desk is not eligible.", 400);
        }
      }

      const row = await updateConsultationRequest(client, leadId, {
        assigned_consultant_id: consultantId,
      });
      if (!row) throw new AuthError("Lead not found.", 404);
      return { ok: true as const, lead: mapConsultationRequestToLead(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpdateLeadStatus = createServerFn({ method: "POST" })
  .validator((data: { leadId: string; status: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "lead status");
      await requireModulePermission(session, "students", 2, "lead status updates");

      const leadId = data.leadId?.trim();
      if (!leadId) throw new AuthError("Lead id is required.", 400);
      const {
        parseLeadStatusInput,
        leadStatusToDbValue,
        canUpdateConsultationLeadStatus,
        mapConsultationRequestToLead,
      } = await import("@/lib/lead-mappers");
      const nextStatus = parseLeadStatusInput(data.status);
      if (!nextStatus) throw new AuthError("Invalid lead status.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveConsultantDeskId } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Lead status updates require the live data plane.", 400);
      }
      const { getConsultationRequestById, updateConsultationRequest } =
        await import("@/services/db");
      const client = requireAoSupabaseClient();

      const existing = await getConsultationRequestById(client, leadId);
      if (!existing) throw new AuthError("Lead not found.", 404);

      const businessRole = businessRoleFromSession(session);
      const isAdmin = rolesAtLeastAdmin(session.role);
      const deskId =
        isAdmin || businessRole === "manager"
          ? null
          : await resolveConsultantDeskId(client, session);
      if (
        !canUpdateConsultationLeadStatus({
          appRole: session.role,
          businessRole,
          deskId,
          assignedConsultantId: existing.assigned_consultant_id,
        })
      ) {
        throw new AuthError("You may only update status for leads assigned to your desk.", 403);
      }

      const row = await updateConsultationRequest(client, leadId, {
        status: leadStatusToDbValue(nextStatus),
      });
      if (!row) throw new AuthError("Lead not found.", 404);
      return { ok: true as const, lead: mapConsultationRequestToLead(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetNotifications = createServerFn({ method: "GET" })
  .validator((data: { audience: "student" | "staff" | "admin" }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      if (data.audience === "student") requireRoles(session, ["student"]);
      else if (data.audience === "staff") requireRoles(session, ["consultant"]);
      else requireRoles(session, ["admin", "super_admin"]);

      const { mapNotificationRow } = await import("@/lib/notification-mappers");
      const { assertNotificationAudience, NOTIFICATION_LIST_LIMIT, shouldServeMockNotifications } =
        await import("@/lib/notification-rules");
      const audienceGate = assertNotificationAudience(session.role, data.audience);
      if (!audienceGate.ok) throw new AuthError(audienceGate.error, 403);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        if (!session.userId) {
          throw new AuthError("Authenticated user id is required for notifications.", 403);
        }
        // JWT user client only — never service role (see requireAoSupabaseClient).
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const { listNotifications } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        // RLS notifications_own + explicit user_id filter; ordered newest first.
        const rows = await listNotifications(client, session.userId, NOTIFICATION_LIST_LIMIT);
        return rows.map((row) => mapNotificationRow(row, audienceGate.audience));
      }

      // Live/supabase sessions never reach fixtures (shouldServeMockNotifications === false).
      if (!shouldServeMockNotifications(session.source)) {
        return [];
      }
      return crmListOrEmpty(
        session.source,
        db.notifications.filter((n) => n.audience === data.audience),
      );
    } catch (error) {
      toError(error);
    }
  });

export const portalMarkNotificationRead = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      const id = data.id?.trim();
      if (!id) throw new AuthError("Notification id is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Marking notifications read requires the live data plane.", 400);
      }
      if (!session.userId) {
        throw new AuthError("Authenticated user id is required.", 403);
      }

      const { markNotificationRead } = await import("@/services/db");
      const { audienceForAppRole, mapNotificationRow } = await import("@/lib/notification-mappers");
      const { canMarkOwnNotification } = await import("@/lib/notification-rules");
      const client = requireAoSupabaseClient();
      // Scoped by session.userId + RLS notifications_update_own — no client user id.
      // Missing / other-user rows return null (fail closed as 404; no existence leak).
      const row = await markNotificationRead(client, id, session.userId);
      if (
        !row ||
        !canMarkOwnNotification({ sessionUserId: session.userId, rowUserId: row.user_id })
      ) {
        throw new AuthError("Notification not found.", 404);
      }
      const audience = audienceForAppRole(session.role);
      if (!audience) throw new AuthError("Unsupported role for notifications.", 403);
      return { ok: true as const, notification: mapNotificationRow(row, audience) };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetActivity = createServerFn({ method: "GET" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin", "student"]);
      if (!isMockCrmAllowed(session.source)) {
        return crmListOrEmpty(session.source, []);
      }
      assertStudentVisible(session, data.studentId);
      // Never fall back to another student's timeline when this id has no rows.
      return activityForStudent(db.activity, data.studentId);
    } catch (error) {
      toError(error);
    }
  });

export const portalGetAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
    // Same reports module gate as the activity workspace; admin retains Full on reports.
    await requireModulePermission(session, "reports", 1, "audit logs");

    const { usesSupabaseDataPlane } = await import("@/server/ao-data");
    if (usesSupabaseDataPlane(session)) {
      const { requireAoSupabaseClient, listScopedAuditEvents } = await import("@/server/ao-data");
      const {
        ADMIN_AUDIT_LOG_LIMIT,
        mapPortalAuditEventToAdminLog,
      } = await import("@/lib/admin-audit-log");
      const client = requireAoSupabaseClient();
      // JWT + RLS on audit_events — same authorized source as portalGetActivityLog.
      const events = await listScopedAuditEvents(client, {});
      return events.slice(0, ADMIN_AUDIT_LOG_LIMIT).map(mapPortalAuditEventToAdminLog);
    }

    return crmListOrEmpty(session.source, db.auditLogs);
  } catch (error) {
    toError(error);
  }
});

export const portalGetMonthlyStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
    return crmListOrEmpty(session.source, db.monthlyLeads);
  } catch (error) {
    toError(error);
  }
});

/** Public marketing mutation — no portal auth required. */
export const portalSubmitConsultation = createServerFn({ method: "POST" })
  .validator((data: Record<string, string>) => data)
  .handler(async ({ data }) => {
    const {
      validateConsultationRequest,
      resolveConsultationReference,
      CONSULTATION_PERSISTENCE_ERROR,
    } = await import("@/lib/consultation");
    const parsed = validateConsultationRequest(data);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
      throw new Error(`400:${msg}`);
    }
    const input = parsed.data;
    // Reuse client-supplied ref on retry so unique(reference_code) makes retries idempotent.
    const ref = resolveConsultationReference(input.reference_code || data["reference_code"]);

    const { createServerSupabase } = await import("@/server/supabase");
    const client = createServerSupabase();
    if (!client) {
      return {
        ok: false as const,
        persisted: false as const,
        ref,
        error: CONSULTATION_PERSISTENCE_ERROR,
      };
    }

    const preferredDate = input.date?.trim() ? input.date.trim() : null;
    const { error } = await client.from("consultation_requests").insert({
      reference_code: ref,
      full_name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      destination: input.destination || null,
      study_level: input.level || null,
      program: input.program || null,
      preferred_date: preferredDate,
      message: input.message || null,
      status: "new",
    });

    if (error) {
      const code = `${error.code ?? ""}`;
      const message = `${error.message ?? ""}`;
      // Same reference already stored (retry after a successful insert) — treat as persisted.
      if (code === "23505" && /reference_code/i.test(message)) {
        return { ok: true as const, persisted: true as const, ref };
      }
      // Never claim success when the row was not written (incl. RLS 42501 / missing table).
      return {
        ok: false as const,
        persisted: false as const,
        ref,
        error: CONSULTATION_PERSISTENCE_ERROR,
      };
    }

    return { ok: true as const, persisted: true as const, ref };
  });
