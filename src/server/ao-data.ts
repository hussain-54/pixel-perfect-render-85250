/**
 * Admission Officer Supabase data access (JWT user client only — never service role).
 * Used when TrustedSession.source === "supabase". Demo sessions keep the mock plane.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationStageHistoryRow,
  AuditEventRow,
  CasI20Row,
  Database,
  DepositRow,
  DocumentVersionRow,
  OfferConditionRow,
  OfferRow,
  TaskRow,
  VisaMilestoneRow,
} from "@/types/database";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  inferActionType,
  inferOutcome,
  toneFor,
} from "@/data/immutable-audit";
import {
  mapApplicationRow,
  mapDocumentRow,
  mapStudentRow,
  profileGreeting,
  stageToUi,
} from "@/lib/ao-mappers";
import { AuthError, type TrustedSession } from "@/server/portal-auth";
import { createServerSupabase } from "@/server/supabase";
import * as dbSvc from "@/services/db";
import type { OfficerDashboardPayload } from "@/types/portal-officer";
import type { ApplicationStageHistoryRecord } from "@/types/applications-pipeline";
import {
  CAS_I20_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  VISA_STAGE_LABELS,
  type CasI20Record,
  type DepositRecord,
  type OfferConditionRecord,
  type OfferRecord,
  type VisaMilestoneRecord,
} from "@/types/offers-visa";
import type {
  AssessmentSaveInput,
  InternalNoteRecord,
  OfferVisaRecord,
  ShortlistItemRecord,
  StudentAssessmentRecord,
  StudentProfileWorkspace,
} from "@/types/student-profile";
import type {
  ActivityActionFilter,
  ActivityFilters,
  ActivityGroup,
  ActivityLogPayload,
  PortalAuditEvent,
} from "@/types/activity-ops";
import type { PortalTaskRecord } from "@/types/tasks-ops";
import type { Application, Student, StudentDocument } from "@/types";

export type AoDb = SupabaseClient<Database>;

/** Shared Journey/Application stage key -> Title Case label. */
export function stageLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Batched profiles.full_name lookup for actor/author display names. */
export async function namesForIds(client: AoDb, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await client.from("profiles").select("id,full_name").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

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
      q = q.or(`assignee_id.eq.${session.userId},student_id.in.(${studentIds.join(",")})`);
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
    country?: string;
    intake?: string;
    stage?: string;
    consultantId?: string;
    archived?: boolean;
    page?: number;
    pageSize?: number;
  },
) {
  const client = requireAoSupabaseClient();
  const includeArchived = Boolean(filters.archived);
  const allVisible = await listVisibleStudentsDb(client, session, { includeArchived: true });
  let students = includeArchived
    ? allVisible.filter((s) => s.archived)
    : allVisible.filter((s) => !s.archived);
  if (filters.country) {
    students = students.filter((s) => s.destination === filters.country);
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
        s.caseId.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q),
    );
  }
  const apps = await listAppsForStudents(
    client,
    students.map((s) => s.id),
  );
  if (filters.intake) {
    const allowed = new Set(
      apps.filter((a) => a.intake === filters.intake).map((a) => a.studentId),
    );
    students = students.filter((s) => allowed.has(s.id));
  }
  const submitted = new Set(["Submitted", "Offer Received", "Rejected", "Withdrawn"]);
  const stageLabel = (key: string) =>
    key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const { data: consultants } = await client.from("consultants").select("id");
  const consultantIds = (consultants ?? []).map((c) => c.id);
  const { data: profiles } = consultantIds.length
    ? await client.from("profiles").select("id,full_name").in("id", consultantIds)
    : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const pageSize = Math.min(Math.max(filters.pageSize ?? 6, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const total = students.length;
  const pageRows = students.slice((page - 1) * pageSize, page * pageSize);

  const allApps = await listAppsForStudents(
    client,
    allVisible.map((s) => s.id),
  );

  return {
    rows: pageRows.map((s) => {
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
    total,
    page,
    pageSize,
    filterOptions: {
      countries: [...new Set(allVisible.map((s) => s.destination).filter(Boolean))].sort(),
      intakes: [...new Set(allApps.map((a) => a.intake).filter(Boolean))].sort(),
      stages: [...new Set(allVisible.map((s) => s.stage))].map((key) => ({
        key,
        label: stageLabel(key),
      })),
      consultants: consultantIds.map((id) => ({
        id,
        name: nameById.get(id) || id,
      })),
      canFilterByConsultant: rolesAtLeastAdmin(session.role),
      canRegister: true,
      canExport: true,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Scoping guards                                                           */
/* ------------------------------------------------------------------------ */

/** Throws 403 if the student is outside the caller's scope. Returns the mapped row. */
export async function assertStudentVisibleDb(
  client: AoDb,
  session: TrustedSession,
  studentId: string,
): Promise<Student> {
  const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
  const student = students.find((s) => s.id === studentId);
  if (!student) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
  return student;
}

/**
 * Resolve the authenticated student's CRM row via profile link (trusted session.userId).
 * Fail closed when the account is not linked — never trust a client-supplied student id alone.
 */
export async function resolveOwnStudentDb(client: AoDb, session: TrustedSession): Promise<Student> {
  if (session.role !== "student") {
    throw new AuthError("Only student sessions can resolve an own student record.", 403);
  }
  if (!session.userId) {
    throw new AuthError("Student profile is not linked to this account.", 403);
  }
  const { data, error } = await client
    .from("students")
    .select("*")
    .eq("profile_id", session.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new AuthError("Student record not found for this account.", 403);
  }
  return mapStudentRow(data);
}

/** Loads an application and asserts its student is in scope. */
export async function getScopedApplication(
  client: AoDb,
  session: TrustedSession,
  applicationId: string,
): Promise<Application> {
  const row = await dbSvc.getApplicationById(client, applicationId);
  if (!row) throw new AuthError("Application not found.", 404);
  await assertStudentVisibleDb(client, session, row.student_id);
  return mapApplicationRow(row);
}

/** Loads a student_documents row and asserts its student is in scope. */
export async function getScopedDocumentRow(
  client: AoDb,
  session: TrustedSession,
  documentId: string,
): Promise<{ row: NonNullable<Awaited<ReturnType<typeof dbSvc.getStudentDocumentById>>>; student: Student }> {
  const row = await dbSvc.getStudentDocumentById(client, documentId);
  if (!row) throw new AuthError("Document not found.", 404);
  const student = await assertStudentVisibleDb(client, session, row.student_id);
  return { row, student };
}

/* ------------------------------------------------------------------------ */
/* Application stage history                                                */
/* ------------------------------------------------------------------------ */

/** Maps raw stage-history rows to the UI record shape (actor names optional). */
export function mapStageHistoryRows(
  rows: ApplicationStageHistoryRow[],
  namesById: Map<string, string> = new Map(),
): ApplicationStageHistoryRecord[] {
  return rows.map((r) => ({
    id: r.id,
    applicationId: r.application_id,
    fromStage: r.from_stage ? stageToUi(r.from_stage) : null,
    toStage: stageToUi(r.to_stage),
    changedById: r.changed_by,
    changedByName: (r.changed_by && namesById.get(r.changed_by)) || "System",
    changedAt: r.changed_at,
    note: r.note,
  }));
}

/** Convenience: fetch + map stage history with actor names resolved in one round trip. */
export async function listScopedStageHistory(
  client: AoDb,
  applicationId: string,
): Promise<ApplicationStageHistoryRecord[]> {
  const rows = await dbSvc.listApplicationStageHistory(client, applicationId);
  const names = await namesForIds(
    client,
    rows.map((r) => r.changed_by).filter((x): x is string => Boolean(x)),
  );
  return mapStageHistoryRows(rows, names);
}

/* ------------------------------------------------------------------------ */
/* Documents                                                                */
/* ------------------------------------------------------------------------ */

/**
 * For every document with a current version, attach the latest document_versions
 * storage metadata so hasPrivateFile / preview can work for DB-backed documents.
 */
export async function enrichDocumentsWithVersions(
  client: AoDb,
  docs: StudentDocument[],
): Promise<StudentDocument[]> {
  const ids = docs.filter((d) => (d.version ?? 0) > 0).map((d) => d.id);
  if (!ids.length) return docs;
  const { data, error } = await client
    .from("document_versions")
    .select("*")
    .in("document_id", ids)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  const latestByDoc = new Map<string, DocumentVersionRow>();
  for (const row of data ?? []) {
    if (!latestByDoc.has(row.document_id)) latestByDoc.set(row.document_id, row);
  }
  return docs.map((d) => {
    const v = latestByDoc.get(d.id);
    if (!v) return d;
    return {
      ...d,
      storageBucket: v.storage_bucket,
      storagePath: v.storage_path,
      ...(v.mime_type ? { mimeType: v.mime_type } : {}),
      ...(v.file_size_bytes != null ? { fileSizeBytes: v.file_size_bytes } : {}),
      version: v.version_number,
      currentVersionId: v.id,
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Student profile workspace                                                */
/* ------------------------------------------------------------------------ */

type AssessmentExtras = Partial<{
  fundingSource: string;
  applicationTarget: number;
  educationGap: string;
  preferredLevel: string;
  targetCountries: string;
  studyPlan: string;
  eligibility: string;
}>;

async function buildAssessmentFromDb(
  client: AoDb,
  studentId: string,
): Promise<StudentAssessmentRecord> {
  const [academic, assessments] = await Promise.all([
    dbSvc.getAcademicProfile(client, studentId),
    dbSvc.listAssessments(client, studentId),
  ]);
  const latest = assessments[0] ?? null;

  let extras: AssessmentExtras = {};
  const rawNotes = academic?.notes?.trim();
  if (rawNotes && rawNotes.startsWith("{")) {
    try {
      extras = JSON.parse(rawNotes) as AssessmentExtras;
    } catch {
      extras = {};
    }
  }

  let assessedByName = "";
  if (latest?.assessed_by) {
    const names = await namesForIds(client, [latest.assessed_by]);
    assessedByName = names.get(latest.assessed_by) ?? "";
  }

  return {
    studentId,
    eligibility: extras.eligibility ?? latest?.summary ?? "",
    languageTest: academic?.english_test ?? "",
    languageScore: academic?.english_score ?? "",
    annualBudget: academic?.budget_range ?? "",
    fundingSource: extras.fundingSource ?? "",
    applicationTarget: extras.applicationTarget ?? 0,
    lastQualification: academic?.highest_qualification ?? "",
    marksCgpa: academic?.gpa_or_percentage ?? "",
    educationGap: extras.educationGap ?? "",
    workExperience:
      academic?.work_experience_years != null ? String(academic.work_experience_years) : "",
    preferredLevel: extras.preferredLevel ?? "",
    targetCountries: extras.targetCountries ?? "",
    targetIntake: academic?.preferred_intake ?? "",
    studyPlan: extras.studyPlan ?? "",
    immediateNextStep: latest?.recommended_next_steps ?? "",
    assessedById: latest?.assessed_by ?? null,
    assessedByName,
    assessedAt: latest?.assessed_at ?? null,
    updatedAt: academic?.updated_at ?? latest?.updated_at ?? null,
  };
}

/** Persists assessment + academic snapshot. Extras without a dedicated column are packed as JSON. */
export async function saveStudentAssessmentDb(
  client: AoDb,
  session: TrustedSession,
  studentId: string,
  assessment: AssessmentSaveInput,
): Promise<void> {
  const extras: AssessmentExtras = {
    fundingSource: assessment.fundingSource,
    applicationTarget: assessment.applicationTarget,
    educationGap: assessment.educationGap,
    preferredLevel: assessment.preferredLevel,
    targetCountries: assessment.targetCountries,
    studyPlan: assessment.studyPlan,
    eligibility: assessment.eligibility,
  };

  const workExperienceYears = assessment.workExperience.trim()
    ? Number.parseInt(assessment.workExperience, 10)
    : null;

  await dbSvc.upsertAcademicProfile(client, {
    student_id: studentId,
    highest_qualification: assessment.lastQualification.trim() || null,
    gpa_or_percentage: assessment.marksCgpa.trim() || null,
    english_test: assessment.languageTest.trim() || null,
    english_score: assessment.languageScore.trim() || null,
    preferred_intake: assessment.targetIntake.trim() || null,
    budget_range: assessment.annualBudget.trim() || null,
    work_experience_years:
      workExperienceYears != null && !Number.isNaN(workExperienceYears) ? workExperienceYears : null,
    notes: JSON.stringify(extras),
  });

  await dbSvc.createAssessment(client, {
    student_id: studentId,
    assessed_by: session.userId ?? null,
    summary: assessment.eligibility.trim() || "",
    recommended_next_steps: assessment.immediateNextStep.trim() || null,
  });

  if (assessment.preferredLevel.trim()) {
    const { error } = await client
      .from("students")
      .update({ study_level: assessment.preferredLevel.trim() })
      .eq("id", studentId);
    if (error) throw new Error(error.message);
  }
}

async function buildOfferVisaRecordsFromDb(
  client: AoDb,
  studentId: string,
  applications: Application[],
): Promise<OfferVisaRecord[]> {
  const offers = await dbSvc.listOffers(client, studentId);
  if (!offers.length) return [];
  const [deposits, casRecords, visaRecords] = await Promise.all([
    dbSvc.listDeposits(client, studentId),
    dbSvc.listCasI20Records(client, studentId),
    dbSvc.listVisaMilestones(client, studentId),
  ]);
  const result: OfferVisaRecord[] = [];
  for (const offer of offers) {
    const conditions = await dbSvc.listOfferConditions(client, offer.id);
    const app = applications.find((a) => a.id === offer.application_id);
    const total = conditions.length;
    const met = conditions.filter((c) => c.met).length;
    const deposit = deposits.find((d) => d.offer_id === offer.id) ?? null;
    const cas = casRecords.find((c) => c.offer_id === offer.id) ?? null;
    const visa = visaRecords.find((v) => v.application_id === offer.application_id) ?? null;
    result.push({
      id: offer.id,
      studentId: offer.student_id,
      university: app?.university ?? "—",
      offerType: offer.offer_type === "conditional" ? "Conditional" : "Unconditional",
      status: OFFER_STATUS_LABELS[offer.status],
      conditionsSummary: total === 0 ? "None (Clear)" : `${met} of ${total} conditions met`,
      acceptDeadline: offer.response_deadline ?? "—",
      depositStatus: deposit ? DEPOSIT_STATUS_LABELS[deposit.status] : "—",
      casI20Status: cas ? CAS_I20_STATUS_LABELS[cas.status] : "—",
      visaStage: visa ? VISA_STAGE_LABELS[visa.stage] : "—",
    });
  }
  return result;
}

/** Builds the full student profile workspace payload from Supabase. */
export async function buildStudentWorkspaceFromDb(
  session: TrustedSession,
  studentId: string,
): Promise<StudentProfileWorkspace> {
  const client = requireAoSupabaseClient();
  const student = await assertStudentVisibleDb(client, session, studentId);

  const [assessment, shortlistRows, docRows, appRows, noteRows] = await Promise.all([
    buildAssessmentFromDb(client, studentId),
    dbSvc.listShortlistItems(client, studentId),
    dbSvc.listStudentDocuments(client, studentId),
    dbSvc.listApplications(client, studentId),
    dbSvc.listInternalNotes(client, studentId),
  ]);

  const documents = await enrichDocumentsWithVersions(client, docRows.map(mapDocumentRow));
  const applications = appRows.map(mapApplicationRow);

  const authorIds = noteRows.map((n) => n.author_id).filter((x): x is string => Boolean(x));
  const authorNames = await namesForIds(client, authorIds);
  const notes: InternalNoteRecord[] = noteRows.map((n) => ({
    id: n.id,
    studentId: n.student_id,
    authorId: n.author_id,
    authorName: (n.author_id && authorNames.get(n.author_id)) || "",
    body: n.body,
    pinned: n.pinned,
    createdAt: n.created_at,
  }));

  const shortlist: ShortlistItemRecord[] = shortlistRows
    .map((s) => ({
      id: s.id,
      studentId: s.student_id,
      universityName: s.university_name,
      programName: s.program_name,
      country: s.country ?? "",
      suitabilityNote: s.reason ?? s.ranking_note ?? "",
      sortOrder: s.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const offersVisa = await buildOfferVisaRecordsFromDb(client, studentId, applications);

  const SUBMITTED = new Set(["Submitted", "Offer Received", "Rejected", "Withdrawn"]);
  const appsSubmittedCount = applications.filter((a) => SUBMITTED.has(a.status)).length;
  const docsApprovedCount = documents.filter((d) => d.status === "Approved").length;

  let consultantName = "Unassigned";
  if (student.consultantId) {
    const { data } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", student.consultantId)
      .maybeSingle();
    if (data?.full_name) consultantName = data.full_name;
  }

  const canEdit = session.role === "consultant" || rolesAtLeastAdmin(session.role);

  return {
    student: {
      ...student,
      consultantName,
      intake: applications[0]?.intake ?? "-",
      stageLabel: stageLabel(student.stage),
    },
    assessment,
    shortlist,
    documents,
    applications,
    appsSubmittedCount,
    docsApprovedCount,
    docsTotalCount: documents.length,
    notes,
    offersVisa,
    canEdit,
    canAddNote: canEdit,
    canCreateApplication: canEdit,
  };
}

/* ------------------------------------------------------------------------ */
/* Offers / deposits / CAS-I20 / visa — row mappers (DB -> UI record shape)  */
/* ------------------------------------------------------------------------ */

export function mapOfferRow(row: OfferRow): OfferRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    studentId: row.student_id,
    offerType: row.offer_type,
    status: row.status,
    offerDate: row.offer_date,
    responseDeadline: row.response_deadline,
    tuitionFee: row.tuition_fee,
    scholarshipNote: row.scholarship_note,
  };
}

export function mapDepositRow(row: DepositRow): DepositRecord {
  return {
    id: row.id,
    offerId: row.offer_id,
    studentId: row.student_id,
    amount: row.amount ?? 0,
    currency: row.currency ?? "",
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    reference: row.reference,
    notes: row.notes,
  };
}

export function mapCasI20Row(row: CasI20Row): CasI20Record {
  return {
    id: row.id,
    studentId: row.student_id,
    applicationId: row.application_id,
    offerId: row.offer_id,
    recordType: row.record_type,
    status: row.status,
    referenceNumber: row.reference_number,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    notes: row.notes,
  };
}

export function mapVisaMilestoneRow(row: VisaMilestoneRow): VisaMilestoneRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    applicationId: row.application_id,
    casI20Id: row.cas_i20_id,
    stage: row.stage,
    decision: row.decision,
    filedAt: row.filed_at,
    biometricsAt: row.biometrics_at,
    decisionAt: row.decision_at,
    notes: row.notes,
  };
}

export function mapOfferConditionRow(row: OfferConditionRow): OfferConditionRecord {
  return {
    id: row.id,
    offerId: row.offer_id,
    description: row.description,
    met: row.met,
    metAt: row.met_at,
    sortOrder: row.sort_order,
  };
}

export async function listOffersForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<OfferRecord[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client
    .from("offers")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOfferRow);
}

export async function listDepositsForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<DepositRecord[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client.from("deposits").select("*").in("student_id", studentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDepositRow);
}

export async function listCasI20RecordsForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<CasI20Record[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client.from("cas_i20_records").select("*").in("student_id", studentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCasI20Row);
}

export async function listVisaMilestonesForStudents(
  client: AoDb,
  studentIds: string[],
): Promise<VisaMilestoneRecord[]> {
  if (!studentIds.length) return [];
  const { data, error } = await client.from("visa_milestones").select("*").in("student_id", studentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVisaMilestoneRow);
}

export async function listOfferConditionsForOffers(
  client: AoDb,
  offerIds: string[],
): Promise<OfferConditionRecord[]> {
  if (!offerIds.length) return [];
  const { data, error } = await client
    .from("offer_conditions")
    .select("*")
    .in("offer_id", offerIds)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOfferConditionRow);
}

/** Batched document_reviews for turnaround-time style reporting (approve/reject actions only). */
export async function listDocumentReviewRowsForDocuments(
  client: AoDb,
  documentIds: string[],
): Promise<{ documentId: string; action: "approve" | "reject"; at: string }[]> {
  if (!documentIds.length) return [];
  const { data, error } = await client
    .from("document_reviews")
    .select("*")
    .in("document_id", documentIds)
    .in("action", ["approved", "rejected"])
    .order("reviewed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    documentId: r.document_id,
    action: r.action === "approved" ? ("approve" as const) : ("reject" as const),
    at: r.reviewed_at,
  }));
}

/* ------------------------------------------------------------------------ */
/* Tasks                                                                     */
/* ------------------------------------------------------------------------ */

/** DB `tasks` row -> mock-shaped PortalTaskRecord. Priority 'overdue' collapses to 'high'. */
export function mapTaskRow(row: TaskRow): PortalTaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    studentId: row.student_id,
    assigneeId: row.assignee_id ?? "",
    createdById: row.created_by,
    dueAt: row.due_at,
    priorityLevel: row.priority === "overdue" ? "high" : row.priority,
    status: row.status,
    source: row.reminder_ref ? "system" : "manual",
    reminderRef: row.reminder_ref,
    relatedApplicationId: row.related_application_id,
    relatedDocumentId: row.related_document_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Tasks visible to this session: admin/super_admin see all; consultants see their own desk's tasks + tasks tied to their students. */
export async function listVisibleTasksDb(client: AoDb, session: TrustedSession): Promise<PortalTaskRecord[]> {
  if (rolesAtLeastAdmin(session.role)) {
    const { data, error } = await client.from("tasks").select("*").order("due_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapTaskRow);
  }
  if (session.role === "consultant") {
    const desk = await resolveConsultantDeskId(client, session);
    if (!desk) return [];
    const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
    const studentIds = students.map((s) => s.id);
    const orParts = [`assignee_id.eq.${desk}`];
    if (studentIds.length) orParts.push(`student_id.in.(${studentIds.join(",")})`);
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .or(orParts.join(","))
      .order("due_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapTaskRow);
  }
  return [];
}

/* ------------------------------------------------------------------------ */
/* Activity log (audit events)                                              */
/* ------------------------------------------------------------------------ */

function actionMatchesFilter(ev: PortalAuditEvent, filter: ActivityActionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "document") return ev.actionType.startsWith("document_");
  if (filter === "application") return ev.actionType.startsWith("application_");
  if (filter === "offer") {
    return (
      ev.actionType.startsWith("offer_") ||
      ev.actionType === "deposit_updated" ||
      ev.actionType === "cas_i20_updated"
    );
  }
  if (filter === "visa") return ev.actionType.startsWith("visa_");
  if (filter === "note") return ev.actionType === "assessment_note";
  if (filter === "task") return ev.actionType === "task_event";
  return ev.actionType === "other";
}

function mapAuditEventRow(row: AuditEventRow, namesById: Map<string, string>): PortalAuditEvent {
  const actionType = inferActionType(row.action, row.entity_type);
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const metaApplicationId =
    typeof metadata["application_id"] === "string" ? (metadata["application_id"] as string) : null;
  const applicationId = row.entity_type === "application" ? row.entity_id : metaApplicationId;
  const documentId = row.entity_type === "student_document" ? row.entity_id : null;
  const outcome = inferOutcome(row.action, actionType);
  const noteField = metadata["note"];
  const detail = typeof noteField === "string" ? noteField : null;
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: (row.actor_id && namesById.get(row.actor_id)) || "System",
    action: row.action,
    actionType,
    outcome,
    entityType: row.entity_type,
    entityId: row.entity_id ?? "",
    studentId: row.student_id,
    applicationId,
    documentId,
    detail,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [k, v == null ? "" : String(v)]),
    ),
    createdAt: row.created_at,
    tone: toneFor(actionType, outcome),
  };
}

function formatDayHeadingUtc(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

/** Scoped, filtered, newest-first audit events (RLS already restricts rows by assignment). */
export async function listScopedAuditEvents(
  client: AoDb,
  filters: ActivityFilters,
): Promise<PortalAuditEvent[]> {
  const rows = await dbSvc.listAuditEvents(client, filters.studentId || undefined);
  const names = await namesForIds(
    client,
    rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)),
  );
  let mapped = rows.map((r) => mapAuditEventRow(r, names));

  const actionType: ActivityActionFilter = filters.actionType ?? "all";
  if (actionType !== "all") mapped = mapped.filter((ev) => actionMatchesFilter(ev, actionType));

  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();
  if (dateFrom) mapped = mapped.filter((ev) => ev.createdAt.slice(0, 10) >= dateFrom);
  if (dateTo) mapped = mapped.filter((ev) => ev.createdAt.slice(0, 10) <= dateTo);
  if (filters.applicationId) {
    mapped = mapped.filter((ev) => ev.applicationId === filters.applicationId);
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    mapped = mapped.filter((ev) => {
      const hay = [ev.action, ev.actorName, ev.outcome, ev.entityId, ev.applicationId, ev.documentId, ev.detail, ev.studentId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return mapped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Builds the grouped + paginated activity log payload from Supabase. */
export async function buildActivityLogFromDb(
  session: TrustedSession,
  filters: ActivityFilters,
): Promise<ActivityLogPayload> {
  const client = requireAoSupabaseClient();
  const all = await listScopedAuditEvents(client, filters);
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const page = all.slice(offset, offset + limit);

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = new Date(Date.parse(`${todayKey}T12:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const groupMap = new Map<string, PortalAuditEvent[]>();
  for (const ev of page) {
    const day = ev.createdAt.slice(0, 10);
    const list = groupMap.get(day) ?? [];
    list.push(ev);
    groupMap.set(day, list);
  }
  const groups: ActivityGroup[] = [...groupMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayKey, items]) => ({
      dayKey,
      label:
        dayKey === todayKey
          ? `Today — ${formatDayHeadingUtc(dayKey)}`
          : dayKey === yesterdayKey
            ? `Yesterday — ${formatDayHeadingUtc(dayKey)}`
            : formatDayHeadingUtc(dayKey),
      items,
    }));

  const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
  const apps = await listAppsForStudents(client, students.map((s) => s.id));

  return {
    groups,
    total: all.length,
    offset,
    limit,
    hasMore: offset + limit < all.length,
    filterOptions: {
      students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
      applications: apps.map((a) => ({ id: a.id, studentId: a.studentId, label: `${a.id} · ${a.university}` })),
    },
    immutable: true as const,
  };
}
