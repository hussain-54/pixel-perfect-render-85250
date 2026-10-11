import fs from "node:fs";

fs.writeFileSync(
  "src/lib/ao-mappers.ts",
  `/** Map Supabase AO rows to existing UI types (Title Case statuses, etc.). */
import type {
  Application,
  ApplicationStatus,
  DocumentStatus,
  Student,
  StageKey,
  StudentDocument,
} from "@/types";
import type {
  ApplicationRow,
  ApplicationStage,
  DocumentStatusDb,
  JourneyStage,
  ProfileRow,
  StudentDocumentRow,
  StudentRow,
} from "@/types/database";

const APP_STAGE_TO_UI: Record<ApplicationStage, ApplicationStatus> = {
  docs_pending: "Docs Pending",
  under_review: "Under Review",
  ready_to_submit: "Ready to Submit",
  submitted: "Submitted",
  offer_received: "Offer Received",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  draft: "Docs Pending",
};

const DOC_STATUS_TO_UI: Record<DocumentStatusDb, DocumentStatus> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  needs_correction: "Needs Correction",
};

export function journeyToStageKey(stage: JourneyStage): StageKey {
  return stage as StageKey;
}

export function mapStudentRow(row: StudentRow): Student {
  return {
    id: row.id,
    caseId: row.case_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    city: row.city ?? "",
    dob: row.dob ?? "",
    destination: row.destination ?? "",
    program: row.program ?? "",
    studyLevel: row.study_level ?? "",
    stage: journeyToStageKey(row.journey_stage),
    consultantId: row.assigned_consultant_id ?? "",
    lastActivity: row.last_activity_at ?? row.updated_at,
    qualification: "",
    institution: "",
    grade: "",
    englishTest: "",
    archived: Boolean(row.archived_at),
  };
}

export function mapApplicationRow(row: ApplicationRow): Application {
  return {
    id: row.id,
    studentId: row.student_id,
    university: row.university_name,
    country: row.country ?? "",
    program: row.program_name,
    intake: row.intake,
    appliedOn: row.submitted_at?.slice(0, 10) ?? row.created_at.slice(0, 10),
    deadline: row.deadline ?? "",
    status: APP_STAGE_TO_UI[row.stage] ?? "Docs Pending",
    officerId: row.owned_by_consultant_id ?? "",
  };
}

export function mapDocumentRow(row: StudentDocumentRow): StudentDocument {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.label,
    category: row.doc_type,
    uploaded: row.updated_at.slice(0, 10),
    status: DOC_STATUS_TO_UI[row.status] ?? "Pending Review",
    version: row.current_version || undefined,
    linkedApplicationId: row.linked_application_id ?? undefined,
    awaitingUpload: row.awaiting_upload,
    expiresOn: row.expires_on ?? undefined,
  };
}

export function profileGreeting(profile: ProfileRow | null, email: string): string {
  const name = profile?.full_name?.trim();
  if (name) return name.split(/\\s+/)[0] ?? name;
  return email.split("@")[0] ?? "Officer";
}

export function uiStatusToAppStage(status: ApplicationStatus): ApplicationStage {
  const entry = (Object.entries(APP_STAGE_TO_UI) as [ApplicationStage, ApplicationStatus][]).find(
    ([, ui]) => ui === status,
  );
  return entry?.[0] ?? "docs_pending";
}
`,
  "utf8",
);

fs.writeFileSync(
  "src/server/ao-data.ts",
  `/**
 * Admission Officer Supabase data access (JWT user client only — never service role).
 * Used when TrustedSession.source === "supabase". Demo sessions keep the mock plane.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TaskRow } from "@/types/database";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  mapApplicationRow,
  mapDocumentRow,
  mapStudentRow,
  profileGreeting,
} from "@/lib/ao-mappers";
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import { createServerSupabase } from "@/server/supabase";
import type { OfficerDashboardPayload } from "@/types/portal-officer";
import type { Application, Student, StudentDocument } from "@/types";

export type AoDb = SupabaseClient<Database>;

export function bearerFromRequest(): string | undefined {
  const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return bearer || undefined;
}

export function requireAoSupabaseClient(): AoDb {
  const token = bearerFromRequest();
  if (!token) {
    throw new AuthError("Sign in required. Missing access token.", 401);
  }
  const client = createServerSupabase(token);
  if (!client) {
    throw new AuthError("Database is not configured.", 503);
  }
  return client;
}

export function usesSupabaseDataPlane(session: TrustedSession): boolean {
  return session.source === "supabase";
}

/** Resolve consultant desk id (= consultants.id = auth.uid()) for AO scope. */
export async function resolveConsultantDeskId(
  client: AoDb,
  session: TrustedSession,
): Promise<string | null> {
  if (rolesAtLeastAdmin(session.role)) return null;
  if (session.role !== "consultant") return null;
  if (!session.userId) {
    throw new AuthError("Staff profile is not linked to this account.", 403);
  }
  const { data, error } = await client
    .from("consultants")
    .select("id,status")
    .eq("id", session.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new AuthError(
      "No consultant desk is linked to this account. Ask an admin to create your consultants row.",
      403,
    );
  }
  if (data.status !== "active") {
    throw new AuthError("Your consultant desk is inactive.", 403);
  }
  return data.id;
}

export async function listVisibleStudentsDb(
  client: AoDb,
  session: TrustedSession,
  opts?: { includeArchived?: boolean },
): Promise<Student[]> {
  let q = client.from("students").select("*").order("updated_at", { ascending: false });
  if (!opts?.includeArchived) q = q.is("archived_at", null);
  if (session.role === "consultant") {
    const desk = await resolveConsultantDeskId(client, session);
    if (!desk) return [];
    q = q.eq("assigned_consultant_id", desk);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapStudentRow);
}

export async function listAppsForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<Application[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client
    .from("applications")
    .select("*")
    .in("student_id", studentIds)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapApplicationRow);
}

export async function listDocsForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<StudentDocument[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client
    .from("student_documents")
    .select("*")
    .in("student_id", studentIds)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDocumentRow);
}

export async function listOpenTasksForDesk(
  client: AoDb,
  session: TrustedSession,
  studentIds: string[],
): Promise<TaskRow[]> {
  let q = client
    .from("tasks")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("due_at", { ascending: true });
  if (session.role === "consultant" && session.userId) {
    if (studentIds.length) {
      q = q.or(\`assignee_id.eq.\${session.userId},student_id.in.(\${studentIds.join(",")})\`);
    } else {
      q = q.eq("assignee_id", session.userId);
    }
  } else if (studentIds.length) {
    q = q.in("student_id", studentIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buildOfficerDashboardFromDb(
  session: TrustedSession,
): Promise<OfficerDashboardPayload> {
  const client = requireAoSupabaseClient();
  const students = await listVisibleStudentsDb(client, session);
  const ids = students.map((s) => s.id);
  const [apps, docs, tasks, profileRes] = await Promise.all([
    listAppsForStudents(client, ids),
    listDocsForStudents(client, ids),
    listOpenTasksForDesk(client, session, ids),
    session.userId
      ? client.from("profiles").select("*").eq("id", session.userId).maybeSingle()
      : Promise.resolve({ data: null, error: null as null }),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);

  const inProgress = new Set([
    "Docs Pending",
    "Under Review",
    "Ready to Submit",
    "Submitted",
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const deadlineRows = apps
    .map((a) => {
      if (!a.deadline) return null;
      const d = new Date(a.deadline);
      if (Number.isNaN(d.getTime())) return null;
      const daysLeft = Math.round((d.getTime() - today.getTime()) / 86_400_000);
      if (daysLeft < 0 || daysLeft > 14) return null;
      const st = students.find((s) => s.id === a.studentId);
      return {
        id: a.id,
        kind: "application" as const,
        label: a.university,
        studentId: a.studentId,
        studentName: st?.name ?? "Student",
        deadline: a.deadline,
        daysLeft,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const stageLabel = (key: string) =>
    key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return {
    greetingName: profileGreeting(profileRes.data, session.email),
    deskLabel: rolesAtLeastAdmin(session.role) ? "Admin overview" : "Admission Officer",
    metrics: {
      assignedStudents: students.length,
      appsInProgress: apps.filter((a) => inProgress.has(a.status)).length,
      docsToReview: docs.filter((d) => d.status === "Pending Review").length,
      deadlinesThisWeek: deadlineRows.filter((d) => {
        const dt = new Date(d.deadline);
        return dt >= today && dt < weekEnd;
      }).length,
    },
    todaysTasks: tasks.slice(0, 8).map((t) => {
      const st = t.student_id ? students.find((s) => s.id === t.student_id) : undefined;
      return {
        id: t.id,
        title: t.title,
        studentId: t.student_id,
        studentName: st?.name ?? null,
        dueAt: t.due_at ?? t.created_at,
        priority:
          t.priority === "high" || t.priority === "overdue"
            ? ("overdue" as const)
            : ("normal" as const),
        ...(t.reminder_ref ? { reminderRef: t.reminder_ref } : {}),
      };
    }),
    assignedOverview: students.slice(0, 8).map((s) => ({
      id: s.id,
      name: s.name,
      destination: s.destination,
      stage: s.stage,
      stageLabel: stageLabel(s.stage),
    })),
    docsWaiting: docs
      .filter((d) => d.status === "Pending Review")
      .slice(0, 10)
      .map((d) => {
        const st = students.find((s) => s.id === d.studentId);
        return {
          id: d.id,
          studentId: d.studentId,
          studentName: st?.name ?? "Student",
          category: d.category,
          uploaded: d.uploaded,
          status: d.status,
        };
      }),
    upcomingDeadlines: deadlineRows.slice(0, 8),
  };
}

export async function buildStudentsDirectoryFromDb(
  session: TrustedSession,
  filters: {
    q?: string;
    destination?: string;
    stage?: string;
    consultantId?: string;
    archived?: boolean;
  },
) {
  const client = requireAoSupabaseClient();
  const includeArchived = Boolean(filters.archived);
  let students = await listVisibleStudentsDb(client, session, { includeArchived });
  if (includeArchived) students = students.filter((s) => s.archived);
  if (filters.destination) {
    students = students.filter((s) => s.destination === filters.destination);
  }
  if (filters.stage) {
    students = students.filter((s) => s.stage === filters.stage);
  }
  if (filters.consultantId) {
    students = students.filter((s) => s.consultantId === filters.consultantId);
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    students = students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.caseId.toLowerCase().includes(q),
    );
  }
  const apps = await listAppsForStudents(
    client,
    students.map((s) => s.id),
  );
  const submitted = new Set(["Submitted", "Offer Received", "Rejected", "Withdrawn"]);
  const stageLabel = (key: string) =>
    key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const { data: consultants } = await client.from("consultants").select("id");
  const { data: profiles } = await client
    .from("profiles")
    .select("id,full_name")
    .in(
      "id",
      (consultants ?? []).map((c) => c.id),
    );

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return {
    rows: students.map((s) => {
      const studentApps = apps.filter((a) => a.studentId === s.id);
      return {
        id: s.id,
        caseId: s.caseId,
        name: s.name,
        destination: s.destination,
        intake: studentApps[0]?.intake ?? "-",
        consultantId: s.consultantId,
        consultantName: nameById.get(s.consultantId) || "Unassigned",
        appsSubmitted: studentApps.filter((a) => submitted.has(a.status)).length,
        appsTotal: Math.max(studentApps.length, 1),
        stage: s.stage,
        stageLabel: stageLabel(s.stage),
        archived: Boolean(s.archived),
        lastActivity: s.lastActivity,
      };
    }),
    total: students.length,
  };
}
`,
  "utf8",
);

const migration = `-- =============================================================================
-- Phase B — Allow anonymous/authenticated public consultation inserts
-- Forward-only. DO NOT apply without approval.
-- Probe evidence: INSERT as anon failed with 42501 (RLS) on consultation_requests.
-- =============================================================================

alter table if exists public.consultation_requests enable row level security;

drop policy if exists consultation_insert_public on public.consultation_requests;
create policy consultation_insert_public on public.consultation_requests
  for insert to anon, authenticated
  with check (
    length(btrim(full_name)) > 1
    and length(btrim(email)) > 3
    and length(btrim(phone)) >= 8
    and reference_code ~ '^REQ-[A-Z0-9]+$'
  );

grant insert on table public.consultation_requests to anon;
grant select, insert, update on table public.consultation_requests to authenticated;
`;

fs.writeFileSync(
  "supabase/migrations/20261010214500_consultation_public_insert.sql",
  migration,
  "utf8",
);

console.log("wrote ao layer + consultation migration");
