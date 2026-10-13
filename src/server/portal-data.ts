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
import {
  activityForStudent,
  crmListOrEmpty,
  crmRecordOrNull,
  isMockCrmAllowed,
} from "@/lib/portal-data-plane";
import * as db from "@/data/mock";

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
  /** From Auth app_metadata — forces /change-password until cleared server-side. */
  mustChangePassword?: boolean;
};

function toPublic(session: TrustedSession): PublicSession {
  return {
    role: session.role,
    email: session.email,
    source: session.source,
    ...(session.consultantId ? { consultantId: session.consultantId } : {}),
    ...(session.mustChangePassword ? { mustChangePassword: true } : {}),
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

export const portalGetConsultants = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
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
      if (!isMockCrmAllowed(session.source)) {
        return crmRecordOrNull(session.source, null);
      }
      if (
        session.role === "consultant" &&
        session.consultantId &&
        data.id !== session.consultantId
      ) {
        throw new AuthError("You do not have access to this consultant record.", 403);
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

export const portalGetDocuments = createServerFn({ method: "GET" })
  .validator((data: { studentId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      if (!isMockCrmAllowed(session.source)) {
        return crmListOrEmpty(session.source, []);
      }
      const visibleIds = new Set(filterStudentsForSession(session).map((s) => s.id));
      let rows = db.documents.filter((d) => visibleIds.has(d.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((d) => d.studentId === data.studentId);
      }
      return crmListOrEmpty(session.source, rows);
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
      if (!isMockCrmAllowed(session.source)) {
        return crmListOrEmpty(session.source, []);
      }
      const visibleIds = new Set(filterStudentsForSession(session).map((s) => s.id));
      let rows = db.applications.filter((a) => visibleIds.has(a.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((a) => a.studentId === data.studentId);
      }
      return crmListOrEmpty(session.source, rows);
    } catch (error) {
      toError(error);
    }
  });

export const portalGetLeads = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    if (!isMockCrmAllowed(session.source)) {
      return crmListOrEmpty(session.source, []);
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

export const portalGetNotifications = createServerFn({ method: "GET" })
  .validator((data: { audience: "student" | "staff" | "admin" }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      if (data.audience === "student") requireRoles(session, ["student"]);
      else if (data.audience === "staff") requireRoles(session, ["consultant"]);
      else requireRoles(session, ["admin", "super_admin"]);
      return crmListOrEmpty(
        session.source,
        db.notifications.filter((n) => n.audience === data.audience),
      );
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
