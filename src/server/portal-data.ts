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
};

function toPublic(session: TrustedSession): PublicSession {
  return {
    role: session.role,
    email: session.email,
    source: session.source,
    ...(session.consultantId ? { consultantId: session.consultantId } : {}),
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
    return filterStudentsForSession(session);
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
      assertStudentVisible(session, data.id);
      return db.students.find((s) => s.id === data.id) ?? null;
    } catch (error) {
      toError(error);
    }
  });

export const portalGetCurrentStudent = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["student"]);
    const rows = filterStudentsForSession(session);
    return rows[0] ?? null;
  } catch (error) {
    toError(error);
  }
});

export const portalGetConsultants = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
    return db.consultants;
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
      if (session.role === "consultant" && session.consultantId && data.id !== session.consultantId) {
        throw new AuthError("You do not have access to this consultant record.", 403);
      }
      return db.consultants.find((c) => c.id === data.id) ?? null;
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
      let rows = db.appointments;
      if (session.role === "student") {
        const me = filterStudentsForSession(session)[0];
        rows = me ? rows.filter((a) => a.studentId === me.id) : [];
      } else if (session.role === "consultant") {
        const cid = consultantScopeId(session);
        rows = rows.filter((a) => a.consultantId === cid);
      }
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((a) => a.studentId === data.studentId);
      }
      return rows;
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
      const visibleIds = new Set(filterStudentsForSession(session).map((s) => s.id));
      let rows = db.documents.filter((d) => visibleIds.has(d.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((d) => d.studentId === data.studentId);
      }
      return rows;
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
      const visibleIds = new Set(filterStudentsForSession(session).map((s) => s.id));
      let rows = db.applications.filter((a) => visibleIds.has(a.studentId));
      if (data.studentId) {
        assertStudentVisible(session, data.studentId);
        rows = rows.filter((a) => a.studentId === data.studentId);
      }
      return rows;
    } catch (error) {
      toError(error);
    }
  });

export const portalGetLeads = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    if (session.role === "consultant") {
      const cid = consultantScopeId(session);
      return db.leads.filter((l) => l.consultantId === cid);
    }
    return db.leads;
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
      return db.notifications.filter((n) => n.audience === data.audience);
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
      assertStudentVisible(session, data.studentId);
      return db.activity[data.studentId] ?? db.activity["s1"] ?? [];
    } catch (error) {
      toError(error);
    }
  });

export const portalGetAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
    return db.auditLogs;
  } catch (error) {
    toError(error);
  }
});

export const portalGetMonthlyStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["admin", "super_admin"]);
    return db.monthlyLeads;
  } catch (error) {
    toError(error);
  }
});

/** Public marketing mutation — no portal auth required. */
export const portalSubmitConsultation = createServerFn({ method: "POST" })
  .validator((data: Record<string, string>) => data)
  .handler(async ({ data }) => {
    const { validateConsultationRequest, newConsultationReference } = await import(
      "@/lib/consultation"
    );
    const parsed = validateConsultationRequest(data);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
      throw new Error(`400:${msg}`);
    }
    const input = parsed.data;
    const ref = newConsultationReference();

    const { createServerSupabase } = await import("@/server/supabase");
    const client = createServerSupabase();
    if (!client) {
      // Supabase not configured — acknowledge without claiming persistence.
      return { ok: true as const, ref, persisted: false as const };
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
      // Table missing or public INSERT policy not applied yet — acknowledge without fake DB success.
      const notReady =
        /consultation_requests|schema cache|does not exist|PGRST|row-level security|42501/i.test(
          `${error.code ?? ""} ${error.message ?? ""}`,
        );
      if (notReady) {
        return { ok: true as const, ref, persisted: false as const };
      }
      throw new Error(`503:${error.message || "Unable to save your consultation request."}`);
    }

    return { ok: true as const, ref, persisted: true as const };
  });