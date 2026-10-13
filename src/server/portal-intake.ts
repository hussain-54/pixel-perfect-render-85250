/**
 * Milestone 1 intake lifecycle: registration, signup fee, assignment,
 * counselling agreement, admission handover. JWT client + RLS only.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { canActivatePortalFromFeeStatus, isSignupFeeVerified } from "@/lib/signup-fee-gate";
import {
  canEditModule,
  canFullyApproveModule,
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import type {
  AdmissionHandoverInput,
  AssignCounsellorInput,
  CounsellingAgreementInput,
  IntakeRegisterInput,
  SignupFeeRecordInput,
  SignupFeeView,
  VerifySignupFeeInput,
} from "@/types/intake";

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
    const br = data?.business_role;
    if (br) return br as BusinessRole;
  } catch {
    /* fall through to AppRole mapping */
  }
  return mapped;
}

function requireIntakeEdit(businessRole: BusinessRole | null, session: TrustedSession) {
  if (rolesAtLeastAdmin(session.role)) return;
  if (canEditModule(businessRole, "students") || canEditModule(businessRole, "counselling")) {
    return;
  }
  // Technical consultant path (desk) may register before business_role is set.
  if (session.role === "consultant") return;
  throw new AuthError("You do not have permission to register students.", 403);
}

export const portalIntakeRegisterStudent = createServerFn({ method: "POST" })
  .validator((data: IntakeRegisterInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireIntakeEdit(businessRole, session);

      const name = data.fullName.trim();
      const email = data.email.trim().toLowerCase();
      if (!name || !email) throw new AuthError("Name and email are required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveConsultantDeskId } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        // Demo plane: persist into mock store (same shape as portalRegisterStudent).
        const db = await import("@/data/mock");
        const cid =
          session.role === "consultant"
            ? (session.consultantId ?? null)
            : (db.consultants.find((c) => c.status === "Active")?.id ?? null);
        if (!cid) throw new AuthError("No consultant assignment available.", 403);
        const nextNum = db.students.length + 1;
        const row = {
          id: `s${nextNum}-${Date.now().toString(36)}`,
          caseId: `GR-${1100 + nextNum}`,
          name,
          email,
          phone: data.phone.trim() || "-",
          whatsapp: data.whatsapp?.trim() || data.phone.trim() || "-",
          city: data.city?.trim() || "-",
          dob: "-",
          destination: data.destination.trim() || "-",
          program: data.program.trim() || "-",
          studyLevel: data.studyLevel?.trim() || "Master's",
          stage: "profile_submitted" as const,
          consultantId: cid,
          lastActivity: new Date().toISOString().slice(0, 10),
          qualification: "-",
          institution: "-",
          grade: "-",
          englishTest: "-",
        };
        db.students.push(row);
        return {
          ok: true as const,
          student: {
            id: row.id,
            caseId: row.caseId,
            name: row.name,
            email: row.email,
            consultantId: row.consultantId,
            stage: row.stage,
            portalActivated: true,
            signupFeeStatus: "waived" as const,
          },
        };
      }

      const { createStudentRecord, listConsultants, writeAudit } = await import("@/services/db");
      const client = requireAoSupabaseClient();

      const { data: dup, error: dupErr } = await client
        .from("students")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (dupErr) throw new Error(dupErr.message);
      if (dup) throw new AuthError("A student with this email is already registered.", 409);

      let assignedConsultantId =
        data.assignedConsultantId?.trim() ||
        (await resolveConsultantDeskId(client, session)) ||
        null;
      if (!assignedConsultantId && rolesAtLeastAdmin(session.role)) {
        const consultants = await listConsultants(client);
        assignedConsultantId = consultants.find((c) => c.status === "active")?.id ?? null;
      }
      if (!assignedConsultantId) {
        throw new AuthError("Assign a counsellor before completing registration.", 400);
      }

      if (
        session.role === "consultant" &&
        session.userId &&
        assignedConsultantId !== session.userId
      ) {
        if (!rolesAtLeastAdmin(session.role) && businessRole !== "front_desk_student_affairs") {
          throw new AuthError("Consultants may only assign registrations to their own desk.", 403);
        }
      }

      // If the student already created an Auth/profile account, link on intake.
      const { data: existingProfile } = await client
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      const { resolveProfileIdForIntake } = await import("@/lib/student-profile-link");
      const link = resolveProfileIdForIntake({
        studentEmail: email,
        existingProfileId: existingProfile?.id ?? null,
      });

      const created = await createStudentRecord(client, {
        case_id: `GR-${Date.now().toString(36).toUpperCase()}`,
        full_name: name,
        email,
        phone: data.phone.trim() || null,
        whatsapp: data.whatsapp?.trim() || data.phone.trim() || null,
        city: data.city?.trim() || null,
        destination: data.destination.trim() || null,
        program: data.program.trim() || null,
        study_level: data.studyLevel?.trim() || null,
        journey_stage: "profile_submitted",
        assigned_consultant_id: assignedConsultantId,
        inquiry_source: data.inquirySource?.trim() || null,
        inquiry_channel: data.inquiryChannel ?? null,
        intake_date: data.intakeDate?.trim() || null,
        registration_notes: data.registrationNotes?.trim() || null,
        portal_activated_at: null,
        profile_id: link.profileId,
      });

      let feeStatus: SignupFeeView["status"] = "unpaid";
      if (data.signupFee && data.signupFee.amount >= 0) {
        const status = data.signupFee.markClaimed ? "claimed" : "unpaid";
        const { error: feeErr } = await client.from("signup_fee_payments").insert({
          student_id: created.id,
          amount: data.signupFee.amount,
          currency: data.signupFee.currency?.trim() || "PKR",
          payment_method: data.signupFee.paymentMethod?.trim() || null,
          reference_receipt: data.signupFee.referenceReceipt?.trim() || null,
          notes: data.signupFee.notes?.trim() || null,
          status,
          recorded_by: session.userId ?? null,
        });
        if (feeErr) throw new Error(feeErr.message);
        feeStatus = status;
      }

      await writeAudit(client, {
        action: "student.intake_register",
        entity_type: "students",
        entity_id: created.id,
        student_id: created.id,
        metadata: {
          assignedConsultantId,
          feeStatus,
          inquiryChannel: data.inquiryChannel ?? null,
        },
      });

      const { mapStudentRow } = await import("@/lib/ao-mappers");
      const student = mapStudentRow(created);
      return {
        ok: true as const,
        student: {
          id: student.id,
          caseId: student.caseId,
          name: student.name,
          email: student.email,
          consultantId: student.consultantId,
          stage: student.stage,
          portalActivated: false,
          signupFeeStatus: feeStatus,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalRecordSignupFee = createServerFn({ method: "POST" })
  .validator((data: SignupFeeRecordInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Signup fee recording requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      await assertStudentVisibleDb(client, session, data.studentId);
      if (data.amount < 0) throw new AuthError("Fee amount is invalid.", 400);

      const status = data.markClaimed ? "claimed" : "unpaid";
      const { data: row, error } = await client
        .from("signup_fee_payments")
        .upsert(
          {
            student_id: data.studentId,
            amount: data.amount,
            currency: data.currency?.trim() || "PKR",
            payment_method: data.paymentMethod?.trim() || null,
            reference_receipt: data.referenceReceipt?.trim() || null,
            notes: data.notes?.trim() || null,
            status,
            recorded_by: session.userId ?? null,
            verified_by: null,
            verified_at: null,
          },
          { onConflict: "student_id" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      // Never auto-activate on claim.
      return {
        ok: true as const,
        fee: {
          studentId: row.student_id,
          status: row.status,
          amount: Number(row.amount),
          currency: row.currency,
          paymentMethod: row.payment_method,
          referenceReceipt: row.reference_receipt,
          verifiedAt: row.verified_at,
          portalActivatedAt: null as string | null,
        } satisfies SignupFeeView,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalVerifySignupFee = createServerFn({ method: "POST" })
  .validator((data: VerifySignupFeeInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["admin", "super_admin", "consultant"]);
      const businessRole = await resolveSessionBusinessRole(session);
      const canVerify =
        rolesAtLeastAdmin(session.role) ||
        canFullyApproveModule(businessRole, "fees_payments") ||
        businessRole === "accounts_banking_finance" ||
        businessRole === "manager";
      if (!canVerify) {
        throw new AuthError("Only Accounts/Finance or Admin may verify signup fees.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee verification requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      await assertStudentVisibleDb(client, session, data.studentId);

      const nextStatus =
        data.action === "verify" ? "verified" : data.action === "waive" ? "waived" : "rejected";
      // Load then update by primary key — never reassign student_id; only status/verifier fields.
      const { data: existingFee, error: loadFeeErr } = await client
        .from("signup_fee_payments")
        .select("id, student_id, status")
        .eq("student_id", data.studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (loadFeeErr) throw new Error(loadFeeErr.message);
      if (!existingFee) throw new AuthError("Signup fee record not found.", 404);

      const { data: fee, error } = await client
        .from("signup_fee_payments")
        .update({
          status: nextStatus,
          verified_by: session.userId ?? null,
          verified_at: new Date().toISOString(),
          notes: data.notes?.trim() || null,
        })
        .eq("id", existingFee.id)
        .eq("student_id", data.studentId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      let portalActivatedAt: string | null = null;
      const shouldActivate =
        data.activatePortal !== false && canActivatePortalFromFeeStatus(nextStatus);
      if (shouldActivate) {
        const activated = new Date().toISOString();
        const { data: stu, error: actErr } = await client
          .from("students")
          .update({ portal_activated_at: activated })
          .eq("id", data.studentId)
          .select("portal_activated_at")
          .single();
        if (actErr) {
          const { formatFeeActivationPartialFailure } = await import("@/lib/signup-fee-gate");
          throw new Error(
            formatFeeActivationPartialFailure({
              feeStatus: nextStatus,
              activationError: actErr.message,
            }),
          );
        }
        portalActivatedAt = stu.portal_activated_at;
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `signup_fee.${data.action}`,
        entity_type: "signup_fee_payments",
        entity_id: fee.id,
        student_id: data.studentId,
        metadata: { status: nextStatus, portalActivated: Boolean(portalActivatedAt) },
      });

      return {
        ok: true as const,
        fee: {
          studentId: fee.student_id,
          status: fee.status,
          amount: Number(fee.amount),
          currency: fee.currency,
          paymentMethod: fee.payment_method,
          referenceReceipt: fee.reference_receipt,
          verifiedAt: fee.verified_at,
          portalActivatedAt,
        } satisfies SignupFeeView,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalAssignCounsellor = createServerFn({ method: "POST" })
  .validator((data: AssignCounsellorInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Counsellor assignment requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      await assertStudentVisibleDb(client, session, data.studentId);

      if (
        session.role === "consultant" &&
        !rolesAtLeastAdmin(session.role) &&
        businessRole !== "front_desk_student_affairs" &&
        businessRole !== "manager"
      ) {
        // Assigned counsellor cannot reassign away from self unless front desk/manager/admin.
        if (session.userId && data.consultantId !== session.userId) {
          throw new AuthError("Only Front Desk, Manager, or Admin may reassign counsellors.", 403);
        }
      }

      const { assignConsultant } = await import("@/services/db");
      const row = await assignConsultant(client, data.studentId, data.consultantId);
      const { mapStudentRow } = await import("@/lib/ao-mappers");
      return { ok: true as const, student: mapStudentRow(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalRecordCounsellingAgreement = createServerFn({ method: "POST" })
  .validator((data: CounsellingAgreementInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Agreement recording requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const student = await assertStudentVisibleDb(client, session, data.studentId);
      if (
        session.role === "consultant" &&
        session.userId &&
        student.consultantId &&
        student.consultantId !== session.userId &&
        !rolesAtLeastAdmin(session.role)
      ) {
        throw new AuthError("You may only record agreements for your assigned students.", 403);
      }

      const { data: row, error } = await client
        .from("counselling_agreements")
        .insert({
          student_id: data.studentId,
          consented: data.consented,
          consent_label: data.consentLabel?.trim() || "Counselling agreement / consent recorded",
          session_date: data.sessionDate?.trim() || null,
          session_mode: data.sessionMode ?? null,
          attendance: data.attendance?.trim() || null,
          summary: data.summary?.trim() || null,
          outcome: data.outcome?.trim() || null,
          recorded_by: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      if (data.consented) {
        const { error: stageErr } = await client
          .from("students")
          .update({ journey_stage: "consultation_completed" })
          .eq("id", data.studentId);
        if (stageErr) {
          throw new Error(
            `Counselling agreement was saved, but journey stage update failed: ${stageErr.message}. Re-run stage sync; do not treat activation of the next step as complete.`,
          );
        }
      }

      return { ok: true as const, agreementId: row.id, consented: row.consented };
    } catch (error) {
      toError(error);
    }
  });

export const portalHandoverToAdmission = createServerFn({ method: "POST" })
  .validator((data: AdmissionHandoverInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Admission handover requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const student = await assertStudentVisibleDb(client, session, data.studentId);
      if (
        session.role === "consultant" &&
        session.userId &&
        student.consultantId &&
        student.consultantId !== session.userId &&
        !rolesAtLeastAdmin(session.role)
      ) {
        throw new AuthError("You may only hand over your assigned students.", 403);
      }

      const summary = data.summary.trim();
      if (summary.length < 10) {
        throw new AuthError("Handover summary must describe the case (min 10 characters).", 400);
      }

      const { data: agreement } = await client
        .from("counselling_agreements")
        .select("id,consented")
        .eq("student_id", data.studentId)
        .eq("consented", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!agreement) {
        throw new AuthError("Record counselling agreement/consent before handover.", 400);
      }

      const { data: assessment } = await client
        .from("student_assessments")
        .select("id")
        .eq("student_id", data.studentId)
        .limit(1)
        .maybeSingle();
      if (!assessment) {
        throw new AuthError("Complete a counsellor assessment before handover.", 400);
      }

      const { data: handover, error } = await client
        .from("admission_handovers")
        .insert({
          student_id: data.studentId,
          from_consultant_id: student.consultantId || session.userId || null,
          to_owner_id: data.toOwnerId?.trim() || null,
          status: "submitted",
          checklist: data.checklist ?? {},
          summary,
          missing_information: data.missingInformation?.trim() || null,
          handed_over_by: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { error: stageErr } = await client
        .from("students")
        .update({ journey_stage: "university_shortlisting" })
        .eq("id", data.studentId);
      if (stageErr) {
        throw new Error(
          `Admission handover was saved, but journey stage update failed: ${stageErr.message}. Confirm handover row ${handover.id} and re-run stage sync; do not treat the case as fully advanced.`,
        );
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "student.admission_handover",
        entity_type: "admission_handovers",
        entity_id: handover.id,
        student_id: data.studentId,
        metadata: { status: "submitted" },
      });

      return {
        ok: true as const,
        handover: {
          id: handover.id,
          studentId: handover.student_id,
          status: handover.status,
          summary: handover.summary,
          handedOverAt: handover.handed_over_at,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetSignupFeeStatus = createServerFn({ method: "GET" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }) => {
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
        return {
          ok: true as const,
          fee: null as SignupFeeView | null,
        };
      }
      const client = requireAoSupabaseClient();
      let studentId = data.studentId;
      if (session.role === "student") {
        const own = await resolveOwnStudentDb(client, session);
        studentId = own.id;
      } else {
        await assertStudentVisibleDb(client, session, studentId);
      }

      const { data: fee } = await client
        .from("signup_fee_payments")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();
      const { data: stu } = await client
        .from("students")
        .select("portal_activated_at")
        .eq("id", studentId)
        .maybeSingle();

      if (!fee) {
        return {
          ok: true as const,
          fee: {
            studentId,
            status: "unpaid" as const,
            amount: 0,
            currency: "PKR",
            paymentMethod: null,
            referenceReceipt: null,
            verifiedAt: null,
            portalActivatedAt: stu?.portal_activated_at ?? null,
          } satisfies SignupFeeView,
        };
      }

      return {
        ok: true as const,
        fee: {
          studentId: fee.student_id,
          status: fee.status,
          amount: Number(fee.amount),
          currency: fee.currency,
          paymentMethod: fee.payment_method,
          referenceReceipt: fee.reference_receipt,
          verifiedAt: fee.verified_at,
          portalActivatedAt: stu?.portal_activated_at ?? null,
        } satisfies SignupFeeView,
        feeVerified: isSignupFeeVerified(fee.status),
      };
    } catch (error) {
      toError(error);
    }
  });

export type AdmissionHandoverView = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentCaseId: string | null;
  status: "submitted" | "accepted" | "returned";
  summary: string;
  missingInformation: string | null;
  handedOverAt: string;
  fromConsultantId: string | null;
  toOwnerId: string | null;
};

export const portalListAdmissionHandovers = createServerFn({ method: "GET" })
  .validator((data: { status?: "submitted" | "accepted" | "returned" } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return { ok: true as const, handovers: [] as AdmissionHandoverView[] };
      }
      const client = requireAoSupabaseClient();
      let q = client
        .from("admission_handovers")
        .select("*")
        .order("handed_over_at", { ascending: false })
        .limit(100);
      if (data.status) q = q.eq("status", data.status);
      else q = q.eq("status", "submitted");

      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const studentIds = [...new Set((rows ?? []).map((r) => r.student_id))];
      const nameById = new Map<string, { full_name: string; case_id: string }>();
      if (studentIds.length) {
        const { data: students } = await client
          .from("students")
          .select("id, full_name, case_id")
          .in("id", studentIds);
        for (const s of students ?? []) {
          nameById.set(s.id, { full_name: s.full_name, case_id: s.case_id });
        }
      }

      const handovers: AdmissionHandoverView[] = (rows ?? []).map((row) => {
        const student = nameById.get(row.student_id);
        return {
          id: row.id,
          studentId: row.student_id,
          studentName: student?.full_name ?? null,
          studentCaseId: student?.case_id ?? null,
          status: row.status,
          summary: row.summary,
          missingInformation: row.missing_information,
          handedOverAt: row.handed_over_at,
          fromConsultantId: row.from_consultant_id,
          toOwnerId: row.to_owner_id,
        };
      });
      return { ok: true as const, handovers };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpdateAdmissionHandover = createServerFn({ method: "POST" })
  .validator((data: { handoverId: string; action: "accept" | "return"; note?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Admission handover updates require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: existing, error: loadErr } = await client
        .from("admission_handovers")
        .select("*")
        .eq("id", data.handoverId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Handover not found.", 404);
      await assertStudentVisibleDb(client, session, existing.student_id);
      if (existing.status !== "submitted") {
        throw new AuthError("Only submitted handovers can be accepted or returned.", 400);
      }

      const nextStatus = data.action === "accept" ? "accepted" : "returned";
      const note = data.note?.trim();
      const { data: row, error } = await client
        .from("admission_handovers")
        .update({
          status: nextStatus,
          to_owner_id:
            data.action === "accept"
              ? (session.userId ?? existing.to_owner_id)
              : existing.to_owner_id,
          missing_information:
            data.action === "return" && note ? note : existing.missing_information,
        })
        .eq("id", data.handoverId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      if (data.action === "accept") {
        const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
        const { data: student } = await client
          .from("students")
          .select("journey_stage")
          .eq("id", row.student_id)
          .maybeSingle();
        const next = nextJourneyStageIfAdvanced(student?.journey_stage, "university_shortlisting");
        if (next) {
          await client.from("students").update({ journey_stage: next }).eq("id", row.student_id);
        }
      }

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `student.admission_handover_${data.action}`,
        entity_type: "admission_handovers",
        entity_id: row.id,
        student_id: row.student_id,
        metadata: { status: nextStatus },
      });

      return {
        ok: true as const,
        handover: {
          id: row.id,
          studentId: row.student_id,
          status: row.status,
          summary: row.summary,
          handedOverAt: row.handed_over_at,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * After Auth sign-up / sign-in: link CRM student row to this profile by trusted email.
 * Never accepts a client student id. Uses SECURITY DEFINER RPC claim_own_student_record.
 */
export const portalClaimOwnStudentRecord = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["student"]);
    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    if (!usesSupabaseDataPlane(session)) {
      return { ok: true as const, linked: true as const, mode: "demo" as const };
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client.rpc("claim_own_student_record");
    if (error) {
      const msg = error.message || "Unable to link student registration.";
      if (/no matching student/i.test(msg)) {
        throw new AuthError(
          "No Front Desk registration matches this account email. Ask staff to register you first, or use the same email.",
          404,
        );
      }
      throw new AuthError(msg, 400);
    }
    const { mapStudentRow } = await import("@/lib/ao-mappers");
    return {
      ok: true as const,
      linked: true as const,
      mode: "claimed" as const,
      student: mapStudentRow(data),
    };
  } catch (error) {
    toError(error);
  }
});
