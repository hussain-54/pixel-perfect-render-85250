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
import { isSignupFeeVerified } from "@/lib/signup-fee-gate";
import {
  canEditModule,
  canFullyApproveModule,
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import {
  assertNoClientOwnershipEscalation,
  isFrontDeskBusinessRole,
} from "@/lib/staff-business-access";
import {
  businessRoleFromSession,
  denyFrontDeskConsultantWorkflows,
  requireModulePermission,
  requireSignupFeeRecordPermission,
  requireSignupFeeVerifyPermission,
} from "@/server/staff-access";
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
  const fromSession = businessRoleFromSession(session);
  if (fromSession) return fromSession;
  if (!session.userId || session.source !== "supabase") {
    // Fail closed for live staff: do not invent Front Desk/Counsellor from app_role alone.
    return session.source === "demo" ? resolveBusinessRoleFromTrustedAppRole(session.role) : null;
  }
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
    /* fall through */
  }
  return null;
}

function requireIntakeEdit(businessRole: BusinessRole | null, session: TrustedSession) {
  if (rolesAtLeastAdmin(session.role)) return;
  if (!businessRole) {
    throw new AuthError(
      "Your business role is not configured. Contact an administrator before registering students.",
      403,
    );
  }
  if (canEditModule(businessRole, "students")) return;
  // Counsellors may still register when counselling Edit/Full and students view+ — matrix has students Edit for counsellor.
  if (canEditModule(businessRole, "counselling") && canEditModule(businessRole, "students")) {
    return;
  }
  throw new AuthError("You do not have permission to register students.", 403);
}

export const portalIntakeRegisterStudent = createServerFn({ method: "POST" })
  .validator((data: IntakeRegisterInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      // Sync session for helpers that read session.businessRole
      session.businessRole = businessRole;
      requireIntakeEdit(businessRole, session);

      const clientOwned = (data as { registeredBy?: string }).registeredBy;
      const ownership = assertNoClientOwnershipEscalation({
        clientRegisteredBy: clientOwned ?? null,
        sessionUserId: session.userId,
      });
      if (!ownership.ok && session.source === "supabase") {
        throw new AuthError(ownership.error, 403);
      }

      const name = data.fullName.trim();
      const email = data.email.trim().toLowerCase();
      if (!name || !email) throw new AuthError("Name and email are required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient, resolveConsultantDeskId } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        // Demo plane: persist into mock store (same shape as portalRegisterStudent).
        const db = await import("@/data/mock");
        const cid =
          data.assignedConsultantId?.trim() ||
          (session.role === "consultant" ? (session.consultantId ?? null) : null) ||
          db.consultants.find((c) => c.status === "Active")?.id ||
          null;
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
          consultantId: cid ?? "pending",
          lastActivity: new Date().toISOString().slice(0, 10),
          qualification: "-",
          institution: "-",
          grade: "-",
          englishTest: "-",
          registeredBy: session.userId ?? "demo-fd",
        };
        db.students.push(row);
        return {
          ok: true as const,
          student: {
            id: row.id,
            caseId: row.caseId,
            name: row.name,
            email: row.email,
            consultantId: cid,
            stage: row.stage,
            portalActivated: true,
            signupFeeStatus: "waived" as const,
            assignmentStatus: cid ? ("assigned" as const) : ("pending" as const),
            registeredBy: row.registeredBy,
          },
        };
      }

      if (!session.userId) {
        throw new AuthError("Authenticated user required for intake ownership.", 403);
      }

      const { listConsultants, writeAudit } = await import("@/services/db");
      const client = requireAoSupabaseClient();

      // Duplicate email is enforced inside intake_register_student (SECURITY DEFINER).
      // App-side SELECT may miss peers under registrar RLS; do not rely on it for uniqueness.

      let assignedConsultantId = data.assignedConsultantId?.trim() || null;

      if (assignedConsultantId) {
        // Validate counsellor desk when assigning at intake.
        const { data: desk, error: deskErr } = await client
          .from("consultants")
          .select("id, status")
          .eq("id", assignedConsultantId)
          .maybeSingle();
        if (deskErr) throw new Error(deskErr.message);
        const { data: deskProfile } = await client
          .from("profiles")
          .select("business_role")
          .eq("id", assignedConsultantId)
          .maybeSingle();
        if (
          !desk ||
          desk.status !== "active" ||
          deskProfile?.business_role !== "counsellor_consultant"
        ) {
          if (
            !isFrontDeskBusinessRole(businessRole) &&
            assignedConsultantId === session.userId &&
            desk?.status === "active"
          ) {
            // Counsellor self-assignment to own desk remains allowed.
          } else if (isFrontDeskBusinessRole(businessRole) || rolesAtLeastAdmin(session.role)) {
            throw new AuthError(
              "Select an active Counsellor / Consultant. Front Desk and inactive desks are not valid assignees.",
              400,
            );
          }
        }
      }

      if (!assignedConsultantId && !isFrontDeskBusinessRole(businessRole)) {
        assignedConsultantId = (await resolveConsultantDeskId(client, session)) || null;
      }
      if (!assignedConsultantId && rolesAtLeastAdmin(session.role)) {
        const consultants = await listConsultants(client);
        assignedConsultantId = consultants.find((c) => c.status === "active")?.id ?? null;
      }
      // Front Desk may save with pending assignment; other desks still need a desk id.
      if (!assignedConsultantId && !isFrontDeskBusinessRole(businessRole)) {
        throw new AuthError("Assign a counsellor before completing registration.", 400);
      }

      if (
        session.role === "consultant" &&
        session.userId &&
        assignedConsultantId &&
        assignedConsultantId !== session.userId
      ) {
        if (!rolesAtLeastAdmin(session.role) && !isFrontDeskBusinessRole(businessRole)) {
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

      const { mapIntakeRegisterRpcError } = await import("@/lib/intake-register-rules");
      const { mapInquiryChannelForLegacyDb } = await import("@/lib/intake-form-options");
      const { mapWriteAuditPermissionError } = await import("@/lib/write-audit-grants-rules");
      const caseId = `GR-${Date.now().toString(36).toUpperCase()}`;
      // p_profile_id retained for RPC signature compatibility; …14070000 ignores it and
      // resolves profile_id by matching profiles.email to p_email inside the DEFINER body.
      const rpcPayload = {
        p_case_id: caseId,
        p_full_name: name,
        p_email: email,
        p_phone: data.phone.trim() || null,
        p_whatsapp: data.whatsapp?.trim() || data.phone.trim() || null,
        p_city: data.city?.trim() || null,
        p_destination: data.destination.trim() || null,
        p_program: data.program.trim() || null,
        p_study_level: data.studyLevel?.trim() || null,
        p_assigned_consultant_id: assignedConsultantId,
        p_inquiry_source: data.inquirySource?.trim() || null,
        p_inquiry_channel: data.inquiryChannel ?? null,
        p_intake_date: data.intakeDate?.trim() || null,
        p_registration_notes: data.registrationNotes?.trim() || null,
        p_profile_id: link.profileId,
      };

      let { data: rpcRows, error: rpcErr } = await client.rpc(
        "intake_register_student",
        rpcPayload,
      );
      // If extended inquiry_channel enum not applied yet, retry with legacy physical|online.
      if (
        rpcErr &&
        data.inquiryChannel &&
        /invalid input value for enum inquiry_channel/i.test(rpcErr.message)
      ) {
        const legacy = mapInquiryChannelForLegacyDb(data.inquiryChannel);
        const channelNote = `Inquiry channel: ${data.inquiryChannel}`;
        const notes = [rpcPayload.p_registration_notes, channelNote].filter(Boolean).join("\n");
        ({ data: rpcRows, error: rpcErr } = await client.rpc("intake_register_student", {
          ...rpcPayload,
          p_inquiry_channel: legacy,
          p_registration_notes: notes || null,
        }));
      }
      if (rpcErr) {
        const mapped = mapIntakeRegisterRpcError(rpcErr.message);
        throw new AuthError(mapped.message, mapped.status);
      }
      const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!created?.id) {
        throw new AuthError("Registration returned no student record.", 500);
      }

      let feeStatus: SignupFeeView["status"] = "unpaid";
      let feeWarning: string | null = null;
      if (data.signupFee && data.signupFee.amount >= 0) {
        try {
          requireSignupFeeRecordPermission(session);
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
        } catch (feeError) {
          feeWarning =
            feeError instanceof Error
              ? feeError.message
              : "Student registered but signup fee could not be saved.";
          feeStatus = "unpaid";
        }
      }

      // Audit after create — must not look like a total failure if student already exists.
      let auditWarning: string | null = null;
      try {
        await writeAudit(client, {
          action: "student.intake_register",
          entity_type: "students",
          entity_id: created.id,
          student_id: created.id,
          metadata: {
            assignedConsultantId,
            registeredBy: created.registered_by ?? session.userId,
            feeStatus,
            feeWarning,
            inquiryChannel: data.inquiryChannel ?? null,
            via: "intake_register_student",
          },
        });
      } catch (auditErr) {
        const raw = auditErr instanceof Error ? auditErr.message : String(auditErr);
        auditWarning = mapWriteAuditPermissionError(raw).staffMessage;
      }

      const warning = [feeWarning, auditWarning].filter(Boolean).join(" ") || null;

      // Narrow RPC payload — do not map through full StudentRow (avoids inventing dob etc.).
      return {
        ok: true as const,
        student: {
          id: created.id,
          caseId: created.case_id,
          name: created.full_name,
          email: created.email,
          consultantId: created.assigned_consultant_id ?? "",
          stage: created.journey_stage,
          portalActivated: false,
          signupFeeStatus: feeStatus,
          assignmentStatus: created.assigned_consultant_id
            ? ("assigned" as const)
            : ("pending" as const),
          registeredBy: created.registered_by ?? session.userId,
        },
        ...(warning ? { warning } : {}),
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
      session.businessRole = await resolveSessionBusinessRole(session);
      requireSignupFeeRecordPermission(session);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Signup fee recording requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      // Front Desk ownership via is_intake_registrar RPC (boolean only — not full-row SELECT).
      if (isFrontDeskBusinessRole(session.businessRole)) {
        const { data: owned, error: ownedErr } = await client.rpc("is_intake_registrar", {
          p_student_id: data.studentId,
        });
        if (ownedErr) {
          if (/does not exist|function/i.test(ownedErr.message)) {
            throw new AuthError(
              "Intake registrar RPC unavailable. Apply migration 20261014030000_front_desk_fee_and_business_role_guard.sql.",
              503,
            );
          }
          throw new Error(ownedErr.message);
        }
        if (!owned) {
          throw new AuthError("You can only record fees for students you registered.", 403);
        }
      } else {
        await assertStudentVisibleDb(client, session, data.studentId);
      }
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
      session.businessRole = businessRole;
      denyFrontDeskConsultantWorkflows(session, "signup fee verification");
      requireSignupFeeVerifyPermission(session);
      const canVerify =
        rolesAtLeastAdmin(session.role) ||
        canFullyApproveModule(businessRole, "fees_payments") ||
        businessRole === "accounts_banking_finance" ||
        businessRole === "manager";
      if (!canVerify) {
        throw new AuthError("Only Accounts/Finance or Admin may verify signup fees.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee verification requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      // Resolve fee id for the RPC. Verifier SELECT is org-wide (can_verify_signup_fee);
      // do not require can_access_student — that would block unassigned Accounts.
      const { data: existingFee, error: loadFeeErr } = await client
        .from("signup_fee_payments")
        .select(
          "id, student_id, status, amount, currency, payment_method, reference_receipt, verified_at",
        )
        .eq("student_id", data.studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (loadFeeErr) throw new Error(loadFeeErr.message);
      if (!existingFee) throw new AuthError("Signup fee record not found.", 404);

      const { mapVerifySignupFeeRpcError } = await import("@/lib/signup-fee-gate");
      const { data: rpcRows, error: rpcErr } = await client.rpc("verify_signup_fee_and_activate", {
        p_fee_id: existingFee.id,
        p_student_id: data.studentId,
        p_action: data.action,
        p_notes: data.notes?.trim() || null,
        p_activate_portal: data.activatePortal !== false,
      });
      if (rpcErr) {
        const mapped = mapVerifySignupFeeRpcError(rpcErr.message);
        throw new AuthError(mapped.message, mapped.status);
      }

      const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!rpcRow?.fee_id) {
        throw new AuthError("Fee verification returned no result.", 500);
      }

      // Display fields: prefer post-RPC row; fall back to pre-load (RPC returns a narrow set).
      const { data: feeAfter, error: feeAfterErr } = await client
        .from("signup_fee_payments")
        .select(
          "id, student_id, status, amount, currency, payment_method, reference_receipt, verified_at",
        )
        .eq("id", rpcRow.fee_id)
        .maybeSingle();
      if (feeAfterErr) throw new Error(feeAfterErr.message);
      const fee = feeAfter ?? existingFee;
      const portalActivatedAt = rpcRow.portal_activated_at ?? null;

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `signup_fee.${data.action}`,
        entity_type: "signup_fee_payments",
        entity_id: rpcRow.fee_id,
        student_id: data.studentId,
        metadata: {
          status: rpcRow.status,
          portalActivated: Boolean(portalActivatedAt),
          via: "verify_signup_fee_and_activate",
        },
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
      session.businessRole = businessRole;
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Counsellor assignment requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      // Front Desk assigns via security-definer RPC (registrar ownership + active counsellor).
      if (isFrontDeskBusinessRole(businessRole) || rolesAtLeastAdmin(session.role)) {
        const { data: rows, error } = await client.rpc("front_desk_assign_counsellor", {
          p_student_id: data.studentId,
          p_consultant_id: data.consultantId,
        });
        if (error) {
          if (/does not exist|function/i.test(error.message)) {
            throw new AuthError(
              "Counsellor assignment RPC is unavailable. Apply migrations through 20261014080000_front_desk_assign_counsellor_narrow_return.sql.",
              503,
            );
          }
          throw new AuthError(error.message || "Could not assign counsellor.", 400);
        }
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row?.id) {
          throw new AuthError("Student not found or not owned by registrar.", 404);
        }
        const { mapStudentRow } = await import("@/lib/ao-mappers");
        // Narrow RPC omits DOB/activation/archive — map with safe empties for UI shape.
        return {
          ok: true as const,
          student: mapStudentRow({
            ...row,
            dob: null,
            archived_at: null,
            last_activity_at: null,
            portal_activated_at: null,
            inquiry_source: null,
            inquiry_channel: null,
            intake_date: null,
            registration_notes: null,
            profile_id: null,
            created_at: row.updated_at,
          }),
        };
      }

      await assertStudentVisibleDb(client, session, data.studentId);

      if (
        session.role === "consultant" &&
        !rolesAtLeastAdmin(session.role) &&
        businessRole !== "manager"
      ) {
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
      session.businessRole = await resolveSessionBusinessRole(session);
      denyFrontDeskConsultantWorkflows(session, "counselling agreements");
      await requireModulePermission(session, "counselling", 2, "counselling agreements");
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
      session.businessRole = await resolveSessionBusinessRole(session);
      denyFrontDeskConsultantWorkflows(session, "admission handover");
      // Handover is a counselling action (counsellor has counselling Edit/Full; admissions is View-only).
      const {
        HANDOVER_INITIATE_MINIMUM,
        HANDOVER_INITIATE_MODULE,
        assessmentSatisfiesHandover,
        handoverDuplicateMessage,
      } = await import("@/lib/counsellor-handover-rules");
      await requireModulePermission(
        session,
        HANDOVER_INITIATE_MODULE,
        HANDOVER_INITIATE_MINIMUM,
        "admission handover",
      );
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
        throw new AuthError("Add a short handover summary (at least 10 characters).", 400);
      }

      const { data: existingSubmitted } = await client
        .from("admission_handovers")
        .select("id,status,summary,handed_over_at,student_id")
        .eq("student_id", data.studentId)
        .eq("status", "submitted")
        .order("handed_over_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingSubmitted) {
        return {
          ok: true as const,
          alreadySubmitted: true as const,
          message: handoverDuplicateMessage(),
          handover: {
            id: existingSubmitted.id,
            studentId: existingSubmitted.student_id,
            status: existingSubmitted.status,
            summary: existingSubmitted.summary,
            handedOverAt: existingSubmitted.handed_over_at,
          },
        };
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
        throw new AuthError("Record counselling consent before handing this student over.", 400);
      }

      const { data: assessment } = await client
        .from("student_assessments")
        .select("id,summary")
        .eq("student_id", data.studentId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const assessmentGate = assessmentSatisfiesHandover({
        hasAssessmentRow: Boolean(assessment?.id),
        eligibilitySummary: assessment?.summary,
      });
      if (!assessmentGate.ok) {
        throw new AuthError(assessmentGate.message, 400);
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
        alreadySubmitted: false as const,
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
      session.businessRole = await resolveSessionBusinessRole(session);
      const { HANDOVER_QUEUE_MODULE, HANDOVER_QUEUE_VIEW_MINIMUM } = await import(
        "@/lib/counsellor-handover-rules"
      );
      await requireModulePermission(
        session,
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_VIEW_MINIMUM,
        "admission handover queue",
      );
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
      session.businessRole = await resolveSessionBusinessRole(session);
      const { HANDOVER_QUEUE_MODULE, HANDOVER_QUEUE_MUTATE_MINIMUM } = await import(
        "@/lib/counsellor-handover-rules"
      );
      await requireModulePermission(
        session,
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_MUTATE_MINIMUM,
        "admission handover queue",
      );
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
