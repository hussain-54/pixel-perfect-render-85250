/**
 * Database-backed student journey timeline.
 * Students: own record only. Staff: visible students via RLS + assertStudentVisibleDb.
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import {
  assertTimelineOwner,
  buildStudentJourneyTimeline,
  type StudentJourneyTimelineSource,
} from "@/lib/student-journey-timeline";
import type { JourneyTimelinePayload } from "@/types/journey-timeline";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

async function loadTimelineSource(
  client: Awaited<ReturnType<typeof import("@/server/ao-data").requireAoSupabaseClient>>,
  studentId: string,
): Promise<StudentJourneyTimelineSource> {
  const [
    studentRes,
    feeRes,
    apptRes,
    assessRes,
    agreeRes,
    handRes,
    docRes,
    appRes,
    offerRes,
    feeUniRes,
    visaRes,
  ] = await Promise.all([
    client
      .from("students")
      .select(
        "id, created_at, portal_activated_at, assigned_consultant_id, journey_stage, inquiry_source",
      )
      .eq("id", studentId)
      .maybeSingle(),
    client
      .from("signup_fee_payments")
      .select("id, status, created_at, verified_at, amount, currency")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("appointments")
      .select("id, status, scheduled_at, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("student_assessments")
      .select("id, assessed_at, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("counselling_agreements")
      .select("id, consented, created_at, session_date")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("admission_handovers")
      .select("id, status, handed_over_at, summary")
      .eq("student_id", studentId)
      .order("handed_over_at", { ascending: false })
      .limit(10),
    client
      .from("student_documents")
      .select("id, label, status, created_at, updated_at, doc_type")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(40),
    client
      .from("applications")
      .select("id, university_name, program_name, stage, created_at, submitted_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("offers")
      .select("id, status, offer_type, created_at, offer_date")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("university_fee_obligations")
      .select("id, kind, label, status, amount, currency, created_at, verified_at, due_date")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("visa_milestones")
      .select("id, stage, decision, created_at, updated_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  if (studentRes.error) throw new Error(studentRes.error.message);
  if (!studentRes.data) throw new AuthError("Student not found.", 404);

  const row = studentRes.data;
  return {
    student: {
      id: row.id,
      createdAt: row.created_at,
      portalActivatedAt: row.portal_activated_at,
      assignedConsultantId: row.assigned_consultant_id,
      journeyStage: row.journey_stage,
      inquirySource: row.inquiry_source,
    },
    signupFee: feeRes.data
      ? {
          id: feeRes.data.id,
          status: feeRes.data.status,
          createdAt: feeRes.data.created_at,
          verifiedAt: feeRes.data.verified_at,
          amount: feeRes.data.amount != null ? Number(feeRes.data.amount) : null,
          currency: feeRes.data.currency,
        }
      : null,
    appointments: (apptRes.data ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      scheduledAt: a.scheduled_at,
      createdAt: a.created_at,
    })),
    assessments: (assessRes.data ?? []).map((a) => ({
      id: a.id,
      assessedAt: a.assessed_at,
      createdAt: a.created_at,
    })),
    agreements: (agreeRes.data ?? []).map((a) => ({
      id: a.id,
      consented: a.consented,
      createdAt: a.created_at,
      sessionDate: a.session_date,
    })),
    handovers: (handRes.data ?? []).map((h) => ({
      id: h.id,
      status: h.status,
      handedOverAt: h.handed_over_at,
      summary: h.summary,
    })),
    documents: (docRes.data ?? []).map((d) => ({
      id: d.id,
      label: d.label || d.doc_type || "Document",
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
    applications: (appRes.data ?? []).map((a) => ({
      id: a.id,
      university: a.university_name,
      program: a.program_name,
      stage: a.stage,
      createdAt: a.created_at,
      submittedAt: a.submitted_at,
    })),
    offers: (offerRes.data ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      offerType: o.offer_type,
      createdAt: o.created_at,
      offerDate: o.offer_date,
    })),
    universityFees: (feeUniRes.data ?? []).map((f) => ({
      id: f.id,
      kind: f.kind,
      label: f.label,
      status: f.status,
      amount: Number(f.amount),
      currency: f.currency,
      createdAt: f.created_at,
      verifiedAt: f.verified_at,
      dueDate: f.due_date,
    })),
    visas: (visaRes.data ?? []).map((v) => ({
      id: v.id,
      stage: v.stage,
      decision: v.decision,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    })),
  };
}

export const portalGetStudentJourneyTimeline = createServerFn({ method: "GET" })
  .validator((data: { studentId?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<JourneyTimelinePayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);

      const {
        usesSupabaseDataPlane,
        requireAoSupabaseClient,
        resolveOwnStudentDb,
        assertStudentVisibleDb,
      } = await import("@/server/ao-data");

      if (!usesSupabaseDataPlane(session)) {
        // Demo plane: empty real timeline (never invent completed statuses from mock activity).
        const demoId = data.studentId?.trim() || "demo";
        return {
          studentId: demoId,
          journeyStage: "profile_submitted",
          items: [],
          pendingActions: [],
        };
      }

      const client = requireAoSupabaseClient();
      let studentId: string;

      if (session.role === "student") {
        const own = await resolveOwnStudentDb(client, session);
        if (data.studentId?.trim() && data.studentId.trim() !== own.id) {
          throw new AuthError("Students may only view their own journey timeline.", 403);
        }
        studentId = own.id;
        if (
          !assertTimelineOwner({
            sessionStudentId: own.id,
            timelineStudentId: studentId,
            isStaff: false,
          })
        ) {
          throw new AuthError("Students may only view their own journey timeline.", 403);
        }
      } else {
        denyFrontDeskConsultantWorkflows(session, "student journey timeline");
        requireModulePermission(session, "students", 1, "student journey timeline");
        const requested = data.studentId?.trim();
        if (!requested) throw new AuthError("studentId is required for staff timeline views.", 400);
        await assertStudentVisibleDb(client, session, requested);
        studentId = requested;
      }

      const source = await loadTimelineSource(client, studentId);
      return buildStudentJourneyTimeline(source);
    } catch (error) {
      toError(error);
    }
  });
