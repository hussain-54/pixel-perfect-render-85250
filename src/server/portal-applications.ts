/**
 * Authorized University Applications pipeline server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import { appendStageHistory, historyForApplication } from "@/data/application-history";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import type { Application, ApplicationStatus, Student } from "@/types";
import {
  APPLICATION_PIPELINE_STAGES,
  canTransitionApplicationStage,
  isApplicationStageTarget,
  isPipelineStage,
  isTerminalOutcome,
  type ApplicationDetailPayload,
  type ApplicationPipelineFilters,
  type ApplicationPipelinePayload,
  type ApplicationPipelineRow,
  type ApplicationPipelineStage,
  type ApplicationStageTarget,
  type NewPipelineApplicationInput,
} from "@/types/applications-pipeline";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") return session.consultantId ?? null;
  return null;
}

function visibleStudents(session: TrustedSession): Student[] {
  if (rolesAtLeastAdmin(session.role)) return db.students.filter((s) => !s.archived);
  if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    return db.students.filter((s) => s.consultantId === cid && !s.archived);
  }
  return [];
}

function assertStudentVisible(session: TrustedSession, studentId: string) {
  if (!visibleStudents(session).some((s) => s.id === studentId)) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
}

function visibleApplications(session: TrustedSession): Application[] {
  const ids = new Set(visibleStudents(session).map((s) => s.id));
  return db.applications.filter((a) => ids.has(a.studentId));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysLeft(deadline: string): number | null {
  if (!deadline || deadline === "-" || deadline === "\u2014") return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
}

function normalizeKey(studentId: string, university: string, program: string, intake: string) {
  return [studentId, university, program, intake]
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function toRow(app: Application, students: Student[]): ApplicationPipelineRow {
  const st = students.find((s) => s.id === app.studentId);
  const left = daysLeft(app.deadline);
  return {
    id: app.id,
    studentId: app.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "-",
    university: app.university,
    program: app.program,
    country: app.country,
    intake: app.intake,
    stage: app.status,
    deadline: app.deadline,
    daysLeft: left,
    deadlineWarning: left !== null && left >= 0 && left < 7,
    officerId: app.officerId,
    appliedOn: app.appliedOn,
  };
}

function actorMeta(session: TrustedSession) {
  const cid = consultantScopeId(session);
  const consultant = cid ? db.consultants.find((c) => c.id === cid) : undefined;
  return {
    id: consultant?.id ?? session.userId ?? null,
    name: consultant?.name ?? session.email,
  };
}

const idempotencyCache = new Map<string, string>();

export const portalGetApplicationsPipeline = createServerFn({ method: "GET" })
  .validator((data: ApplicationPipelineFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ApplicationPipelinePayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "applications");
      await requireModulePermission(session, "admissions", 1, "applications");

      const {
        usesSupabaseDataPlane,
        listVisibleStudentsDb,
        listAppsForStudents,
        requireAoSupabaseClient,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const client = requireAoSupabaseClient();
        const students = await listVisibleStudentsDb(client, session);
        let apps = (
          await listAppsForStudents(
            client,
            students.map((s) => s.id),
          )
        ).filter((a) => isPipelineStage(a.status));
        const stageFilter = data.stage && data.stage !== "all" ? data.stage : null;
        if (stageFilter) apps = apps.filter((a) => a.status === stageFilter);
        if (data.studentId) {
          // Deep-link filter: empty apps if not visible (do not 403 the whole workspace —
          // incoming handovers may still load for submitted cases).
          if (!students.some((s) => s.id === data.studentId)) {
            apps = [];
          } else {
            apps = apps.filter((a) => a.studentId === data.studentId);
          }
        }
        const q = data.q?.trim().toLowerCase();
        if (q) {
          apps = apps.filter((a) => {
            const st = students.find((s) => s.id === a.studentId);
            return (
              a.id.toLowerCase().includes(q) ||
              a.studentId.toLowerCase().includes(q) ||
              a.university.toLowerCase().includes(q) ||
              a.program.toLowerCase().includes(q) ||
              (st?.name ?? "").toLowerCase().includes(q) ||
              (st?.caseId ?? "").toLowerCase().includes(q)
            );
          });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rows: ApplicationPipelineRow[] = apps.map((a) => {
          const st = students.find((s) => s.id === a.studentId);
          let daysLeft: number | null = null;
          if (a.deadline) {
            const d = new Date(a.deadline);
            if (!Number.isNaN(d.getTime())) {
              daysLeft = Math.round((d.getTime() - today.getTime()) / 86_400_000);
            }
          }
          return {
            id: a.id,
            studentId: a.studentId,
            studentName: st?.name ?? "Student",
            studentCaseId: st?.caseId ?? "",
            university: a.university,
            program: a.program,
            country: a.country,
            intake: a.intake,
            stage: a.status,
            deadline: a.deadline,
            daysLeft,
            deadlineWarning: daysLeft != null && daysLeft >= 0 && daysLeft <= 7,
            officerId: a.officerId,
            appliedOn: a.appliedOn,
          };
        });
        const counts = {
          all: rows.length,
          "Docs Pending": 0,
          "Under Review": 0,
          "Ready to Submit": 0,
          Submitted: 0,
          "Offer Received": 0,
        } as ApplicationPipelinePayload["counts"];
        for (const r of rows) {
          if (isPipelineStage(r.stage)) counts[r.stage] += 1;
        }
        return {
          rows,
          counts,
          students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
          canCreate: true,
        };
      }

      const students = visibleStudents(session);
      // Pipeline UI excludes rejected/withdrawn; offer/deposit/visa stay on separate surfaces.
      let apps = visibleApplications(session).filter((a) => isPipelineStage(a.status));

      const stageFilter = data.stage && data.stage !== "all" ? data.stage : null;
      if (stageFilter) {
        apps = apps.filter((a) => a.status === stageFilter);
      }
      if (data.studentId) {
        if (!students.some((s) => s.id === data.studentId)) {
          apps = [];
        } else {
          apps = apps.filter((a) => a.studentId === data.studentId);
        }
      }
      const q = data.q?.trim().toLowerCase();
      if (q) {
        apps = apps.filter((a) => {
          const st = students.find((s) => s.id === a.studentId);
          return (
            a.id.toLowerCase().includes(q) ||
            a.studentId.toLowerCase().includes(q) ||
            a.university.toLowerCase().includes(q) ||
            a.program.toLowerCase().includes(q) ||
            (st?.name ?? "").toLowerCase().includes(q) ||
            (st?.caseId ?? "").toLowerCase().includes(q)
          );
        });
      }

      const allPipeline = visibleApplications(session).filter((a) => isPipelineStage(a.status));
      const counts = {
        all: allPipeline.length,
        "Docs Pending": 0,
        "Under Review": 0,
        "Ready to Submit": 0,
        Submitted: 0,
        "Offer Received": 0,
      } as ApplicationPipelinePayload["counts"];
      for (const a of allPipeline) {
        if (isPipelineStage(a.status)) counts[a.status] += 1;
      }

      const rows = apps
        .map((a) => toRow(a, students))
        .sort((a, b) => {
          const da = a.daysLeft ?? 9999;
          const dbv = b.daysLeft ?? 9999;
          return da - dbv;
        });

      return {
        rows,
        counts,
        students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
        canCreate: session.role === "consultant" || rolesAtLeastAdmin(session.role),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetApplicationDetail = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<ApplicationDetailPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "applications");
      await requireModulePermission(session, "admissions", 1, "applications");

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        getScopedApplication,
        assertStudentVisibleDb,
        listScopedStageHistory,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const client = requireAoSupabaseClient();
        const app = await getScopedApplication(client, session, data.id);
        const student = await assertStudentVisibleDb(client, session, app.studentId);
        return {
          application: {
            id: app.id,
            studentId: app.studentId,
            studentName: student.name,
            studentCaseId: student.caseId,
            university: app.university,
            program: app.program,
            country: app.country,
            intake: app.intake,
            stage: app.status,
            deadline: app.deadline,
            daysLeft: daysLeft(app.deadline),
            deadlineWarning: (() => {
              const d = daysLeft(app.deadline);
              return d !== null && d >= 0 && d < 7;
            })(),
            officerId: app.officerId,
            appliedOn: app.appliedOn,
          },
          history: await listScopedStageHistory(client, app.id),
        };
      }

      const students = visibleStudents(session);
      const app = visibleApplications(session).find((a) => a.id === data.id);
      if (!app) throw new AuthError("Application not found.", 404);
      return {
        application: toRow(app, students),
        history: historyForApplication(app.id),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalChangeApplicationStage = createServerFn({ method: "POST" })
  .validator(
    (data: { applicationId: string; toStage: ApplicationStageTarget; note?: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "applications");
      await requireModulePermission(session, "admissions", 2, "application stage changes");

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        getScopedApplication,
        assertStudentVisibleDb,
        listScopedStageHistory,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { uiStatusToAppStage } = await import("@/lib/ao-mappers");
        const { updateApplicationStage } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const app = await getScopedApplication(client, session, data.applicationId);

        if (!isApplicationStageTarget(data.toStage)) {
          throw new AuthError("Invalid application stage.", 400);
        }
        if (!isPipelineStage(app.status)) {
          throw new AuthError(
            "This application is outside the submission pipeline (rejected/withdrawn).",
            400,
          );
        }
        const student = await assertStudentVisibleDb(client, session, app.studentId);
        if (app.status === data.toStage) {
          return {
            ok: true as const,
            application: toRow(app, [student]),
            unchanged: true as const,
          };
        }
        if (!canTransitionApplicationStage(app.status, data.toStage)) {
          throw new AuthError(
            `Transition from "${app.status}" to "${data.toStage}" is not allowed.`,
            400,
          );
        }

        const dbStage = uiStatusToAppStage(data.toStage);
        const note = data.note?.trim();
        const extra: {
          decision_at?: string;
          submitted_at?: string;
          notes?: string;
        } = {};
        if (isTerminalOutcome(data.toStage)) {
          extra.decision_at = new Date().toISOString();
        }
        if (data.toStage === "Submitted") {
          extra.submitted_at = new Date().toISOString();
        }
        if (note) extra.notes = note;
        await updateApplicationStage(
          client,
          app.id,
          dbStage,
          Object.keys(extra).length ? extra : undefined,
        );

        const refreshed = await getScopedApplication(client, session, data.applicationId);

        // Student-safe stage alerts — only for consequential / visible milestones.
        try {
          const notifyStages = new Set([
            "Docs Pending",
            "Submitted",
            "Offer Received",
            "Rejected",
            "Withdrawn",
          ]);
          if (notifyStages.has(data.toStage)) {
            const { notifyLinkedStudent } = await import("@/lib/notify-linked-student");
            const title =
              data.toStage === "Submitted"
                ? "Application submitted to university"
                : data.toStage === "Offer Received"
                  ? "Admission decision / offer update"
                  : data.toStage === "Docs Pending"
                    ? "Documents needed for your application"
                    : `Application ${data.toStage.toLowerCase()}`;
            const body =
              data.toStage === "Submitted"
                ? `${app.university} · ${app.program} has been submitted to the university.`
                : data.toStage === "Docs Pending"
                  ? `${app.university}: please upload or correct required documents.`
                  : `${app.university} · ${app.program} is now marked ${data.toStage}.`;
            await notifyLinkedStudent(client, app.studentId, {
              title,
              body,
              linkPath: "/student/applications",
            });
          }
        } catch {
          /* best-effort */
        }

        return {
          ok: true as const,
          unchanged: false as const,
          application: toRow(refreshed, [student]),
          history: await listScopedStageHistory(client, app.id),
        };
      }

      const app = visibleApplications(session).find((a) => a.id === data.applicationId);
      if (!app) throw new AuthError("Application not found.", 404);

      if (!isApplicationStageTarget(data.toStage)) {
        throw new AuthError("Invalid application stage.", 400);
      }
      if (!isPipelineStage(app.status)) {
        throw new AuthError(
          "This application is outside the submission pipeline (rejected/withdrawn).",
          400,
        );
      }
      if (app.status === data.toStage) {
        return { ok: true as const, application: app, unchanged: true as const };
      }

      if (!canTransitionApplicationStage(app.status, data.toStage)) {
        throw new AuthError(
          `Transition from "${app.status}" to "${data.toStage}" is not allowed.`,
          400,
        );
      }

      const fromStage = app.status;
      app.status = data.toStage;
      if (data.toStage === "Submitted" && (!app.appliedOn || app.appliedOn === "-")) {
        app.appliedOn = new Date().toISOString().slice(0, 10);
      }

      const actor = actorMeta(session);
      appendStageHistory({
        id: `ash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        applicationId: app.id,
        fromStage,
        toStage: data.toStage,
        changedById: actor.id,
        changedByName: actor.name,
        changedAt: new Date().toISOString(),
        note: data.note?.trim() || null,
      });

      const students = visibleStudents(session);
      return {
        ok: true as const,
        unchanged: false as const,
        application: toRow(app, students),
        history: historyForApplication(app.id),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalCreatePipelineApplication = createServerFn({ method: "POST" })
  .validator((data: NewPipelineApplicationInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "applications");
      await requireModulePermission(session, "admissions", 2, "creating applications");

      const university = data.university.trim();
      const program = data.program.trim();
      const country = data.country.trim();
      const intake = data.intake.trim();
      const deadline = data.deadline.trim();
      if (!university || !program || !country || !intake) {
        throw new AuthError("University, program, country and intake are required.", 400);
      }
      if (deadline && Number.isNaN(new Date(deadline).getTime())) {
        throw new AuthError("Deadline must be a valid date.", 400);
      }

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        assertStudentVisibleDb,
        resolveConsultantDeskId,
      } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { createApplication, listApplications } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const student = await assertStudentVisibleDb(client, session, data.studentId);

        const key = normalizeKey(student.id, university, program, intake);
        const existingApps = await listApplications(client, student.id);
        const duplicate = existingApps.find(
          (a) => normalizeKey(a.student_id, a.university_name, a.program_name, a.intake) === key,
        );
        if (duplicate) {
          throw new AuthError(
            "An application for this student, university, program and intake already exists.",
            409,
          );
        }

        const ownedByConsultantId = await resolveConsultantDeskId(client, session);
        const created = await createApplication(client, {
          student_id: student.id,
          university_name: university,
          program_name: program,
          country,
          intake,
          deadline: deadline || null,
          stage: "docs_pending",
          owned_by_consultant_id: ownedByConsultantId,
        });

        const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
        const { data: journeyRow } = await client
          .from("students")
          .select("journey_stage")
          .eq("id", student.id)
          .maybeSingle();
        const nextStage = nextJourneyStageIfAdvanced(
          journeyRow?.journey_stage,
          "application_submitted",
        );
        if (nextStage) {
          await client.from("students").update({ journey_stage: nextStage }).eq("id", student.id);
        }

        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "application.create",
          entity_type: "applications",
          entity_id: created.id,
          student_id: student.id,
          metadata: { university, program, intake, journey_stage: nextStage },
        });

        const { mapApplicationRow } = await import("@/lib/ao-mappers");
        const app = mapApplicationRow(created);
        return {
          ok: true as const,
          duplicate: false as const,
          application: toRow(app, [student]),
        };
      }

      assertStudentVisible(session, data.studentId);

      if (data.idempotencyKey) {
        const cached = idempotencyCache.get(data.idempotencyKey);
        if (cached) {
          const existing = db.applications.find((a) => a.id === cached);
          if (existing) {
            return {
              ok: true as const,
              duplicate: true as const,
              application: toRow(existing, visibleStudents(session)),
            };
          }
        }
      }

      const key = normalizeKey(data.studentId, university, program, intake);
      const duplicate = db.applications.find(
        (a) => normalizeKey(a.studentId, a.university, a.program, a.intake) === key,
      );
      if (duplicate) {
        throw new AuthError(
          "An application for this student, university, program and intake already exists.",
          409,
        );
      }

      const officerId =
        (session.role === "consultant" ? session.consultantId : null) ??
        db.students.find((s) => s.id === data.studentId)?.consultantId ??
        "";
      if (!officerId) throw new AuthError("No consultant assignment available.", 403);

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
        deadline: deadline || "-",
        status: "Docs Pending",
        officerId,
      };
      db.applications.push(app);

      const actor = actorMeta(session);
      appendStageHistory({
        id: `ash-${Date.now().toString(36)}`,
        applicationId: app.id,
        fromStage: null,
        toStage: "Docs Pending",
        changedById: actor.id,
        changedByName: actor.name,
        changedAt: new Date().toISOString(),
        note: "Application created",
      });

      if (data.idempotencyKey) idempotencyCache.set(data.idempotencyKey, app.id);

      return {
        ok: true as const,
        duplicate: false as const,
        application: toRow(app, visibleStudents(session)),
      };
    } catch (error) {
      toError(error);
    }
  });

export { APPLICATION_PIPELINE_STAGES };
