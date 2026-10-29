/**
 * Authorized Admission Officer dashboard + students directory server functions.
 * Scopes all reads/mutations to the trusted session.
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import { appendStageHistory } from "@/data/application-history";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { appendAuditEvent } from "@/data/immutable-audit";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import type { PermissionLevel } from "@/lib/business-permissions";

async function requireConsultantDesk(
  session: TrustedSession,
  label = "consultant desk workflows",
  studentsMinimum: PermissionLevel = 1,
) {
  requireRoles(session, ["consultant", "admin", "super_admin"]);
  denyFrontDeskConsultantWorkflows(session, label);
  await requireModulePermission(session, "students", studentsMinimum, label);
}
import type {
  OfficerDashboardPayload,
  StudentDirectoryFilters,
  StudentDirectoryResult,
  StudentDirectoryRow,
  StudentSearchHit,
} from "@/types/portal-officer";
import type {
  AssessmentSaveInput,
  NewApplicationInput,
  StudentProfileWorkspace,
} from "@/types/student-profile";
import type { Application, Student } from "@/types";
import * as workspace from "@/data/student-workspace";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") {
    return session.consultantId ?? null;
  }
  return null;
}

function visibleStudents(session: TrustedSession, opts?: { includeArchived?: boolean }): Student[] {
  let rows = db.students;
  if (rolesAtLeastAdmin(session.role)) {
    // admins see all
  } else if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    rows = rows.filter((s) => s.consultantId === cid);
  } else {
    return [];
  }
  if (!opts?.includeArchived) {
    rows = rows.filter((s) => !s.archived);
  }
  return rows;
}

function assertStudentVisible(session: TrustedSession, studentId: string, includeArchived = true) {
  const allowed = visibleStudents(session, { includeArchived });
  if (!allowed.some((s) => s.id === studentId)) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
}

function stageLabel(key: string) {
  return db.STAGES.find((s) => s.key === key)?.label ?? key;
}

function studentApps(studentId: string): Application[] {
  return db.applications.filter((a) => a.studentId === studentId);
}

function studentIntake(studentId: string): string {
  const apps = studentApps(studentId);
  return apps[0]?.intake ?? "-";
}

const SUBMITTED_APP_STATUSES = new Set(["Submitted", "Offer Received", "Rejected", "Withdrawn"]);

const IN_PROGRESS_APP_STATUSES = new Set([
  "Docs Pending",
  "Under Review",
  "Ready to Submit",
  "Submitted",
]);

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function parseYmd(value: string): Date | null {
  if (!value || value === "-" || value === "\u2014") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDirectoryRow(s: Student): StudentDirectoryRow {
  const apps = studentApps(s.id);
  const submitted = apps.filter((a) => SUBMITTED_APP_STATUSES.has(a.status)).length;
  const consultant = db.consultants.find((c) => c.id === s.consultantId);
  return {
    id: s.id,
    caseId: s.caseId,
    name: s.name,
    destination: s.destination,
    intake: studentIntake(s.id),
    consultantId: s.consultantId,
    consultantName: consultant?.name ?? "Unassigned",
    appsSubmitted: submitted,
    appsTotal: Math.max(apps.length, 1),
    stage: s.stage,
    stageLabel: stageLabel(s.stage),
    archived: Boolean(s.archived),
    lastActivity: s.lastActivity,
  };
}

export const portalGetOfficerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    await requireConsultantDesk(session);

    const { usesSupabaseDataPlane, buildOfficerDashboardFromDb } = await import("@/server/ao-data");
    if (usesSupabaseDataPlane(session)) {
      return await buildOfficerDashboardFromDb(session);
    }

    const students = visibleStudents(session);
    const visibleIds = new Set(students.map((s) => s.id));
    const apps = db.applications.filter((a) => visibleIds.has(a.studentId));
    const docs = db.documents.filter((d) => visibleIds.has(d.studentId));
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const appsInProgress = apps.filter((a) => IN_PROGRESS_APP_STATUSES.has(a.status)).length;
    const docsToReview = docs.filter((d) => d.status === "Pending Review").length;

    const deadlineRows = apps
      .map((a) => {
        const deadline = parseYmd(a.deadline);
        if (!deadline) return null;
        const daysLeft = daysBetween(today, deadline);
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

    const deadlinesThisWeek = deadlineRows.filter((d) => {
      const dt = parseYmd(d.deadline);
      return dt ? dt >= today && dt < weekEnd : false;
    }).length;

    const assigneeId = consultantScopeId(session);
    let tasks = db.officerTasks.filter((t) => t.status === "open" || t.status === "in_progress");
    if (session.role === "consultant") {
      if (!assigneeId) tasks = [];
      else tasks = tasks.filter((t) => t.assigneeId === assigneeId);
    } else {
      tasks = tasks.filter((t) => !t.studentId || visibleIds.has(t.studentId));
    }

    const priorityRank = { overdue: 0, due_today: 1, upcoming: 2, normal: 3 } as const;
    const todaysTasks = [...tasks]
      .sort((a, b) => {
        const pr = priorityRank[a.priority] - priorityRank[b.priority];
        if (pr !== 0) return pr;
        return a.dueAt.localeCompare(b.dueAt);
      })
      .slice(0, 8)
      .map((t) => {
        const st = t.studentId ? students.find((s) => s.id === t.studentId) : undefined;
        return {
          id: t.id,
          title: t.title,
          studentId: t.studentId,
          studentName: st?.name ?? null,
          dueAt: t.dueAt,
          priority: t.priority,
          ...(t.reminderRef ? { reminderRef: t.reminderRef } : {}),
        };
      });

    const consultant = assigneeId != null ? db.consultants.find((c) => c.id === assigneeId) : null;
    const greetingName = consultant?.name.split(" ")[0] ?? session.email.split("@")[0] ?? "Officer";
    const deskLabel = consultant
      ? `${consultant.department} Desk`
      : rolesAtLeastAdmin(session.role)
        ? "Admin overview"
        : "Admission Officer";

    const payload: OfficerDashboardPayload = {
      greetingName,
      deskLabel,
      metrics: {
        assignedStudents: students.length,
        appsInProgress,
        docsToReview,
        deadlinesThisWeek,
        awaitingInitialAssessment: 0,
        counsellingCompleted: 0,
        followUpsDue: todaysTasks.filter(
          (t) => t.priority === "overdue" || t.priority === "due_today",
        ).length,
        awaitingResponse: 0,
        actionRequired: 0,
      },
      todaysTasks,
      assignedOverview: students.slice(0, 8).map((s) => ({
        id: s.id,
        name: s.name,
        destination: s.destination,
        stage: s.stage,
        stageLabel: stageLabel(s.stage),
        caseId: s.caseId,
        lastActivity: s.lastActivity,
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
      needsAttention: [],
      recentActivity: students.slice(0, 8).map((s) => ({
        id: s.id,
        name: s.name,
        destination: s.destination,
        stage: s.stage,
        stageLabel: stageLabel(s.stage),
        caseId: s.caseId,
        lastActivity: s.lastActivity,
      })),
      fetchedAt: new Date().toISOString(),
    };
    return payload;
  } catch (error) {
    toError(error);
  }
});

export const portalGetStudentsDirectory = createServerFn({ method: "GET" })
  .validator((data: StudentDirectoryFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<StudentDirectoryResult> => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session);

      const { usesSupabaseDataPlane, buildStudentsDirectoryFromDb } =
        await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const directoryFilters: {
          q?: string;
          country?: string;
          intake?: string;
          stage?: string;
          consultantId?: string;
          archived?: boolean;
          page?: number;
          pageSize?: number;
          focus?:
            | "awaiting_assessment"
            | "consent_recorded"
            | "awaiting_response"
            | "action_required"
            | "follow_ups";
        } = {};
        if (data.q !== undefined) directoryFilters.q = data.q;
        if (data.country !== undefined) directoryFilters.country = data.country;
        if (data.intake !== undefined) directoryFilters.intake = data.intake;
        if (data.stage !== undefined) directoryFilters.stage = data.stage;
        if (data.consultantId !== undefined) directoryFilters.consultantId = data.consultantId;
        if (data.archived !== undefined) directoryFilters.archived = data.archived;
        if (data.page !== undefined) directoryFilters.page = data.page;
        if (data.pageSize !== undefined) directoryFilters.pageSize = data.pageSize;
        if (data.focus !== undefined) directoryFilters.focus = data.focus;
        return (await buildStudentsDirectoryFromDb(
          session,
          directoryFilters,
        )) as StudentDirectoryResult;
      }

      const includeArchived = Boolean(data.archived);
      let rows = visibleStudents(session, { includeArchived }).map(buildDirectoryRow);
      if (includeArchived) rows = rows.filter((r) => r.archived);

      const q = data.q?.trim().toLowerCase();
      if (q) {
        rows = rows.filter((r) => {
          const phone = db.students.find((s) => s.id === r.id)?.phone ?? "";
          return (
            r.name.toLowerCase().includes(q) ||
            r.caseId.toLowerCase().includes(q) ||
            phone.toLowerCase().includes(q)
          );
        });
      }
      if (data.country) rows = rows.filter((r) => r.destination === data.country);
      if (data.intake) rows = rows.filter((r) => r.intake === data.intake);
      if (data.stage) rows = rows.filter((r) => r.stage === data.stage);

      const canFilterByConsultant = rolesAtLeastAdmin(session.role);
      if (canFilterByConsultant && data.consultantId) {
        rows = rows.filter((r) => r.consultantId === data.consultantId);
      }

      if (data.dateFrom) {
        const from = parseYmd(data.dateFrom);
        if (from) {
          rows = rows.filter((r) => {
            const d = parseYmd(r.lastActivity);
            return d ? d >= from : true;
          });
        }
      }
      if (data.dateTo) {
        const to = parseYmd(data.dateTo);
        if (to) {
          rows = rows.filter((r) => {
            const d = parseYmd(r.lastActivity);
            return d ? d <= to : true;
          });
        }
      }

      const pageSize = Math.min(Math.max(data.pageSize ?? 6, 1), 50);
      const page = Math.max(data.page ?? 1, 1);
      const total = rows.length;
      const start = (page - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);

      const allForOptions = visibleStudents(session, { includeArchived: true });
      const countries = [...new Set(allForOptions.map((s) => s.destination))].sort();
      const intakes = [
        ...new Set(allForOptions.map((s) => studentIntake(s.id)).filter((x) => x !== "-")),
      ].sort();
      const consultantOpts = rolesAtLeastAdmin(session.role)
        ? db.consultants.map((c) => ({ id: c.id, name: c.name }))
        : (() => {
            const cid = consultantScopeId(session);
            const c = cid ? db.consultants.find((x) => x.id === cid) : undefined;
            return c ? [{ id: c.id, name: c.name }] : [];
          })();

      return {
        rows: pageRows,
        total,
        page,
        pageSize,
        filterOptions: {
          countries,
          intakes,
          stages: db.STAGES.map((s) => ({ key: s.key, label: s.label })),
          consultants: consultantOpts,
          canFilterByConsultant,
          canRegister: rolesAtLeastAdmin(session.role) || session.role === "consultant",
          canExport: true,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSearchStudents = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<StudentSearchHit[]> => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session);
      const q = data.q.trim().toLowerCase();
      if (q.length < 2) return [];

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveConsultantDeskId } =
        await import("@/server/ao-data");
      const { sanitizeStudentSearchTerm, studentSearchOrClause, STUDENT_SEARCH_COLUMNS } =
        await import("@/lib/student-search-query");
      if (usesSupabaseDataPlane(session)) {
        const term = sanitizeStudentSearchTerm(data.q);
        if (!term) return [];
        const client = requireAoSupabaseClient();
        let query = client
          .from("students")
          .select(STUDENT_SEARCH_COLUMNS)
          .is("archived_at", null)
          .or(studentSearchOrClause(term))
          .order("updated_at", { ascending: false })
          .limit(8);
        if (session.role === "consultant") {
          const desk = await resolveConsultantDeskId(client, session);
          if (!desk) return [];
          query = query.eq("assigned_consultant_id", desk);
        }
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((s) => ({
          id: s.id,
          caseId: s.case_id,
          name: s.full_name,
          phone: s.phone ?? "",
          destination: s.destination ?? "",
        }));
      }

      return visibleStudents(session)
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.caseId.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q) ||
            s.id.toLowerCase() === q,
        )
        .slice(0, 8)
        .map((s) => ({
          id: s.id,
          caseId: s.caseId,
          name: s.name,
          phone: s.phone,
          destination: s.destination,
        }));
    } catch (error) {
      toError(error);
    }
  });

/**
 * Dashboard Approve/Reject — same authorized dual-plane path as the document queue.
 * Does not report success when the shared review operation fails.
 */
export const portalReviewDocument = createServerFn({ method: "POST" })
  .validator((data: { documentId: string; action: "Approved" | "Rejected" }) => data)
  .handler(async ({ data }) => {
    try {
      const { dashboardReviewToQueueAction } = await import("@/lib/portal-data-plane");
      const { portalReviewQueueDocument } = await import("@/server/portal-documents");
      const mapped = dashboardReviewToQueueAction(data.action);
      const result = await portalReviewQueueDocument({
        data: {
          documentId: data.documentId,
          action: mapped.action,
          ...(mapped.note ? { note: mapped.note } : {}),
        },
      });
      return {
        ok: result.ok,
        document: result.document,
        unchanged: result.unchanged,
      };
    } catch (error) {
      toError(error);
    }
  });

function buildStudentWorkspace(
  session: TrustedSession,
  studentId: string,
): StudentProfileWorkspace {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw new AuthError("Student not found.", 404);
  const consultant = db.consultants.find((c) => c.id === student.consultantId);
  const apps = studentApps(student.id);
  const docs = db.documents.filter((d) => d.studentId === student.id);
  const assessment = workspace.getOrCreateAssessment(student.id);
  // Prefer student academic fields when assessment blanks were never filled.
  if (!assessment.lastQualification && student.qualification) {
    assessment.lastQualification = student.qualification;
  }
  if (!assessment.marksCgpa && student.grade) {
    assessment.marksCgpa = student.grade;
  }
  if (!assessment.languageTest && student.englishTest) {
    assessment.languageTest = student.englishTest.includes("IELTS") ? "IELTS" : student.englishTest;
    assessment.languageScore = student.englishTest;
  }
  if (!assessment.preferredLevel && student.studyLevel) {
    assessment.preferredLevel = student.studyLevel;
  }
  if (!assessment.targetCountries && student.destination) {
    assessment.targetCountries = student.destination;
  }
  if (!assessment.targetIntake) {
    assessment.targetIntake = studentIntake(student.id);
  }

  const appsSubmittedCount = apps.filter((a) => SUBMITTED_APP_STATUSES.has(a.status)).length;
  const docsApprovedCount = docs.filter((d) => d.status === "Approved").length;
  const canEdit = session.role === "consultant" || rolesAtLeastAdmin(session.role);

  return {
    student: {
      ...student,
      consultantName: consultant?.name ?? "Unassigned",
      intake: studentIntake(student.id),
      stageLabel: stageLabel(student.stage),
    },
    assessment,
    shortlist: workspace.shortlistItems
      .filter((s) => s.studentId === student.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    documents: docs,
    applications: apps,
    appsSubmittedCount,
    docsApprovedCount,
    docsTotalCount: docs.length,
    notes: workspace.internalNotes
      .filter((n) => n.studentId === student.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    offersVisa: workspace.offerVisaRecords.filter((o) => o.studentId === student.id),
    canEdit,
    canAddNote: canEdit,
    canCreateApplication: canEdit,
  };
}

export const portalGetStudentProfile = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<StudentProfileWorkspace> => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session);

      const { usesSupabaseDataPlane, buildStudentWorkspaceFromDb } =
        await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        return await buildStudentWorkspaceFromDb(session, data.id);
      }

      assertStudentVisible(session, data.id, true);
      return buildStudentWorkspace(session, data.id);
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveStudentAssessment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      studentId: string;
      assessment: AssessmentSaveInput;
      expectedUpdatedAt?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session, "student assessment", 2);

      const a = data.assessment;
      const { validateAssessmentForSave } = await import("@/lib/counsellor-handover-rules");
      const validated = validateAssessmentForSave({
        eligibility: a.eligibility,
        applicationTarget: a.applicationTarget,
      });
      if (!validated.ok) {
        throw new AuthError(validated.message, 400);
      }
      const assessmentToSave = { ...a, eligibility: validated.eligibility };

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        saveStudentAssessmentDb,
        buildStudentWorkspaceFromDb,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const client = requireAoSupabaseClient();
        await assertStudentVisibleDb(client, session, data.studentId);
        await saveStudentAssessmentDb(
          client,
          session,
          data.studentId,
          assessmentToSave,
          data.expectedUpdatedAt != null
            ? { expectedUpdatedAt: data.expectedUpdatedAt }
            : undefined,
        );
        try {
          const { writeAudit } = await import("@/services/db");
          await writeAudit(client, {
            action: "student.assessment_saved",
            entity_type: "student_assessments",
            entity_id: data.studentId,
            student_id: data.studentId,
            metadata: { eligibility: validated.eligibility },
          });
        } catch {
          /* audit best-effort */
        }
        return await buildStudentWorkspaceFromDb(session, data.studentId);
      }

      assertStudentVisible(session, data.studentId, true);

      const assessor =
        session.role === "consultant" && session.consultantId
          ? db.consultants.find((c) => c.id === session.consultantId)
          : null;
      const now = new Date().toISOString();
      const saved = workspace.upsertAssessment({
        studentId: data.studentId,
        eligibility: validated.eligibility,
        languageTest: a.languageTest.trim(),
        languageScore: a.languageScore.trim(),
        annualBudget: a.annualBudget.trim(),
        fundingSource: a.fundingSource.trim(),
        applicationTarget: Math.floor(a.applicationTarget),
        lastQualification: a.lastQualification.trim(),
        marksCgpa: a.marksCgpa.trim(),
        educationGap: a.educationGap.trim(),
        workExperience: a.workExperience.trim(),
        preferredLevel: a.preferredLevel.trim(),
        targetCountries: a.targetCountries.trim(),
        targetIntake: a.targetIntake.trim(),
        studyPlan: a.studyPlan.trim(),
        immediateNextStep: a.immediateNextStep.trim(),
        assessedById: assessor?.id ?? session.userId ?? null,
        assessedByName: assessor?.name ?? session.email,
        assessedAt: now,
        updatedAt: now,
      });

      // Keep student academic snapshot in sync for Overview/Academic tabs.
      const student = db.students.find((s) => s.id === data.studentId);
      if (student) {
        if (saved.lastQualification) student.qualification = saved.lastQualification;
        if (saved.marksCgpa) student.grade = saved.marksCgpa;
        if (saved.languageScore) student.englishTest = saved.languageScore;
        if (saved.preferredLevel) student.studyLevel = saved.preferredLevel;
        student.lastActivity = now.slice(0, 10);
      }

      return buildStudentWorkspace(session, data.studentId);
    } catch (error) {
      toError(error);
    }
  });

export const portalAddStudentNote = createServerFn({ method: "POST" })
  .validator((data: { studentId: string; body: string; pinned?: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session, "student notes", 2);
      const body = data.body.trim();
      if (body.length < 2) throw new AuthError("Note body is required.", 400);

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        buildStudentWorkspaceFromDb,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { createInternalNote } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        await assertStudentVisibleDb(client, session, data.studentId);
        // internal_notes insert is auto-audited by the internal_notes_audit DB trigger.
        await createInternalNote(client, {
          student_id: data.studentId,
          author_id: session.userId ?? null,
          body,
          pinned: Boolean(data.pinned),
        });
        return await buildStudentWorkspaceFromDb(session, data.studentId);
      }

      assertStudentVisible(session, data.studentId, true);

      const assessor =
        session.role === "consultant" && session.consultantId
          ? db.consultants.find((c) => c.id === session.consultantId)
          : null;
      const noteId = `n-${Date.now().toString(36)}`;
      const createdAt = new Date().toISOString();
      workspace.internalNotes.unshift({
        id: noteId,
        studentId: data.studentId,
        authorId: assessor?.id ?? session.userId ?? null,
        authorName: assessor?.name ?? session.email,
        body,
        pinned: Boolean(data.pinned),
        createdAt,
      });
      appendAuditEvent({
        id: `al-note-${noteId}`,
        actorId: assessor?.id ?? session.userId ?? null,
        actorName: assessor?.name ?? session.email,
        action: `Added Internal Assessment Note on file`,
        actionType: "assessment_note",
        outcome: "Noted",
        entityType: "Note",
        entityId: noteId,
        studentId: data.studentId,
        detail: body.slice(0, 240),
        createdAt,
      });
      return buildStudentWorkspace(session, data.studentId);
    } catch (error) {
      toError(error);
    }
  });

export const portalCreateStudentApplication = createServerFn({ method: "POST" })
  .validator((data: NewApplicationInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      // Admission Team is students View-only in the matrix; admissions Edit/Full authorizes create.
      await requireConsultantDesk(session, "creating applications from student workspace", 1);
      await requireModulePermission(
        session,
        "admissions",
        2,
        "creating applications from student workspace",
      );

      const university = data.university.trim();
      const program = data.program.trim();
      const country = data.country.trim();
      const intake = data.intake.trim();
      if (!university || !program || !country || !intake) {
        throw new AuthError("University, program, country and intake are required.", 400);
      }

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        resolveConsultantDeskId,
        buildStudentWorkspaceFromDb,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { createApplication, listApplications } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        await assertStudentVisibleDb(client, session, data.studentId);

        const dupKey = [data.studentId, university, program, intake]
          .map((x) => x.trim().toLowerCase())
          .join("|");
        const existingApps = await listApplications(client, data.studentId);
        const duplicate = existingApps.find(
          (a) =>
            [a.student_id, a.university_name, a.program_name, a.intake]
              .map((x) => x.trim().toLowerCase())
              .join("|") === dupKey,
        );
        if (duplicate) {
          throw new AuthError(
            "An application for this student, university, program and intake already exists.",
            409,
          );
        }

        const ownedByConsultantId = await resolveConsultantDeskId(client, session);
        await createApplication(client, {
          student_id: data.studentId,
          university_name: university,
          program_name: program,
          country,
          intake,
          deadline: data.deadline.trim() || null,
          stage: "docs_pending",
          owned_by_consultant_id: ownedByConsultantId,
        });

        return await buildStudentWorkspaceFromDb(session, data.studentId);
      }

      assertStudentVisible(session, data.studentId, true);

      const officerId =
        (session.role === "consultant" ? session.consultantId : null) ??
        db.students.find((s) => s.id === data.studentId)?.consultantId ??
        "";
      if (!officerId) throw new AuthError("No consultant assignment available.", 403);

      const dupKey = [data.studentId, university, program, intake]
        .map((x) => x.trim().toLowerCase())
        .join("|");
      const duplicate = db.applications.find(
        (a) =>
          [a.studentId, a.university, a.program, a.intake]
            .map((x) => x.trim().toLowerCase())
            .join("|") === dupKey,
      );
      if (duplicate) {
        throw new AuthError(
          "An application for this student, university, program and intake already exists.",
          409,
        );
      }

      const nums = db.applications
        .map((a) => Number(a.id.replace(/\D/g, "")))
        .filter((n) => !Number.isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 3000) + 1;
      const app: Application = {
        id: `APP-${next}`,
        studentId: data.studentId,
        university,
        country,
        program,
        intake,
        appliedOn: "-",
        deadline: data.deadline.trim() || "-",
        status: "Docs Pending",
        officerId,
      };
      db.applications.push(app);
      const actorCid = session.role === "consultant" ? session.consultantId : null;
      const actorConsultant = actorCid ? db.consultants.find((c) => c.id === actorCid) : undefined;
      appendStageHistory({
        id: `ash-${Date.now().toString(36)}`,
        applicationId: app.id,
        fromStage: null,
        toStage: "Docs Pending",
        changedById: actorConsultant?.id ?? session.userId ?? null,
        changedByName: actorConsultant?.name ?? session.email,
        changedAt: new Date().toISOString(),
        note: "Application created",
      });
      return buildStudentWorkspace(session, data.studentId);
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveShortlistItem = createServerFn({ method: "POST" })
  .validator(
    (data: {
      studentId: string;
      universityName: string;
      programName: string;
      country: string;
      suitabilityNote: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session, "student shortlist", 2);
      const universityName = data.universityName.trim();
      const programName = data.programName.trim();
      if (!universityName || !programName) {
        throw new AuthError("University and program are required.", 400);
      }

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        buildStudentWorkspaceFromDb,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { listShortlistItems, upsertShortlistItem } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        await assertStudentVisibleDb(client, session, data.studentId);
        const existing = await listShortlistItems(client, data.studentId);
        const maxOrderDb = existing.reduce((m, s) => Math.max(m, s.sort_order), 0);
        await upsertShortlistItem(client, {
          student_id: data.studentId,
          university_name: universityName,
          program_name: programName,
          country: data.country.trim() || null,
          reason: data.suitabilityNote.trim() || null,
          sort_order: maxOrderDb + 1,
          created_by: session.userId ?? null,
        });
        return await buildStudentWorkspaceFromDb(session, data.studentId);
      }

      assertStudentVisible(session, data.studentId, true);
      const maxOrder = workspace.shortlistItems
        .filter((s) => s.studentId === data.studentId)
        .reduce((m, s) => Math.max(m, s.sortOrder), 0);
      workspace.shortlistItems.push({
        id: `sl-${Date.now().toString(36)}`,
        studentId: data.studentId,
        universityName,
        programName,
        country: data.country.trim(),
        suitabilityNote: data.suitabilityNote.trim(),
        sortOrder: maxOrder + 1,
      });
      return buildStudentWorkspace(session, data.studentId);
    } catch (error) {
      toError(error);
    }
  });

export const portalRegisterStudent = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fullName: string;
      email: string;
      phone: string;
      destination: string;
      program: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      await requireConsultantDesk(session, "student registration", 2);
      const name = data.fullName.trim();
      const email = data.email.trim().toLowerCase();
      if (!name || !email) throw new AuthError("Name and email are required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveConsultantDeskId } =
        await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { createStudentRecord, listConsultants } = await import("@/services/db");
        const client = requireAoSupabaseClient();

        let assignedConsultantId = await resolveConsultantDeskId(client, session);
        if (!assignedConsultantId && rolesAtLeastAdmin(session.role)) {
          const consultants = await listConsultants(client);
          assignedConsultantId = consultants.find((c) => c.status === "active")?.id ?? null;
        }
        if (!assignedConsultantId) {
          throw new AuthError("No consultant assignment available.", 403);
        }

        const created = await createStudentRecord(client, {
          case_id: `GR-${Date.now().toString(36).toUpperCase()}`,
          full_name: name,
          email,
          phone: data.phone.trim() || null,
          whatsapp: data.phone.trim() || null,
          destination: data.destination.trim() || null,
          program: data.program.trim() || null,
          journey_stage: "profile_submitted",
          assigned_consultant_id: assignedConsultantId,
        });

        const { mapStudentRow } = await import("@/lib/ao-mappers");
        const student = mapStudentRow(created);
        const { data: consultantProfile } = await client
          .from("profiles")
          .select("full_name")
          .eq("id", assignedConsultantId)
          .maybeSingle();
        return {
          ok: true as const,
          student: {
            id: student.id,
            caseId: student.caseId,
            name: student.name,
            destination: student.destination,
            intake: "-",
            consultantId: student.consultantId,
            consultantName: consultantProfile?.full_name || "Unassigned",
            appsSubmitted: 0,
            appsTotal: 1,
            stage: student.stage,
            stageLabel: stageLabel(student.stage),
            archived: false,
            lastActivity: student.lastActivity,
          },
        };
      }

      const cid =
        session.role === "consultant"
          ? consultantScopeId(session)
          : (db.consultants.find((c) => c.status === "Active")?.id ?? null);
      if (!cid) throw new AuthError("No consultant assignment available.", 403);

      const nextNum = db.students.length + 1;
      const row: Student = {
        id: `s${nextNum}-${Date.now().toString(36)}`,
        caseId: `GR-${1100 + nextNum}`,
        name,
        email,
        phone: data.phone.trim() || "-",
        whatsapp: data.phone.trim() || "-",
        city: "-",
        dob: "-",
        destination: data.destination.trim() || "-",
        program: data.program.trim() || "-",
        studyLevel: "Master's",
        stage: "profile_submitted",
        consultantId: cid,
        lastActivity: new Date().toISOString().slice(0, 10),
        qualification: "-",
        institution: "-",
        grade: "-",
        englishTest: "-",
      };
      db.students.push(row);
      return { ok: true as const, student: buildDirectoryRow(row) };
    } catch (error) {
      toError(error);
    }
  });
