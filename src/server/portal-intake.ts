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
import {
  aggregateVerifiedSignupFeeCash,
  clampSignupFeeLedgerPage,
  expectedStatusForSignupFeeAction,
  isTerminalSignupFeeStatus,
  sanitizeSignupFeeSearchTerm,
  signupFeeStatusesForLedgerFilter,
  type SignupFeeLedgerStatusFilter,
} from "@/lib/signup-fee-ledger";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function logFeeRequestDiag(event: string, meta: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({ scope: "fee_verification_request", event, ...meta }));
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
          await requireSignupFeeRecordPermission(session);
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
      await requireSignupFeeRecordPermission(session);
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
      if (!(data.amount >= 0) || Number.isNaN(Number(data.amount))) {
        throw new AuthError("Fee amount is invalid.", 400);
      }

      const { data: existing, error: existingErr } = await client
        .from("signup_fee_payments")
        .select("id, status, amount, currency, notes")
        .eq("student_id", data.studentId)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      const existingStatus = String(existing?.status ?? "").toLowerCase();
      if (existingStatus === "verified" || existingStatus === "waived") {
        throw new AuthError(
          "This signup fee is already finalized by Finance. Front Desk cannot change a verified or waived fee.",
          409,
        );
      }

      const status = data.markClaimed ? "claimed" : "unpaid";
      if (data.markClaimed) {
        const method = data.paymentMethod?.trim();
        const reference = data.referenceReceipt?.trim();
        if (!method) throw new AuthError("Payment method is required when submitting proof.", 400);
        if (!reference) {
          throw new AuthError(
            "Transaction / receipt reference is required when submitting payment proof.",
            400,
          );
        }
        // Claimed amount must match the issued voucher — no silent overwrite.
        if (
          existing &&
          (existingStatus === "unpaid" ||
            existingStatus === "claimed" ||
            existingStatus === "rejected") &&
          Number(existing.amount) !== Number(data.amount)
        ) {
          throw new AuthError(
            `Claimed amount must match the voucher obligation (${existing.currency} ${Number(existing.amount)}). Re-issue the unpaid voucher first if the amount must change.`,
            400,
          );
        }
      }

      const {
        appendFeeProofMeta,
        parseFeeProofMeta,
        signupFeeProofStoragePath,
        stripFeeProofMeta,
      } = await import("@/lib/signup-fee-voucher-pdf");
      const { validateDocumentUpload } = await import("@/lib/document-storage");

      let notesOut = stripFeeProofMeta(data.notes).trim() || null;
      // Preserve prior proof meta when Front Desk updates notes without a new file.
      const priorProof = existing ? parseFeeProofMeta(existing.notes) : null;

      let proofMeta: ReturnType<typeof parseFeeProofMeta> = priorProof;
      if (data.markClaimed && data.proofFile) {
        const raw = data.proofFile.contentBase64?.replace(/\s/g, "") ?? "";
        let bytes: Buffer;
        try {
          bytes = Buffer.from(raw, "base64");
        } catch {
          throw new AuthError("Payment proof file could not be decoded.", 400);
        }
        const checked = validateDocumentUpload({
          mimeType: data.proofFile.mimeType,
          byteLength: bytes.byteLength,
          fileName: data.proofFile.fileName,
        });
        if (!checked.ok) throw new AuthError(checked.error, 400);
        // Fee id is stable on student_id upsert; use existing id or a provisional path key.
        const feeKey = existing?.id ?? data.studentId;
        const storagePath = signupFeeProofStoragePath(data.studentId, feeKey, checked.fileName);
        const { STUDENT_DOCUMENTS_BUCKET } = await import("@/lib/document-storage");
        let uploaded = false;
        try {
          const { createAdminSupabase } = await import("@/server/supabase-admin");
          const admin = createAdminSupabase();
          const { error: upErr } = await admin.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .upload(storagePath, bytes, {
              contentType: data.proofFile.mimeType,
              upsert: true,
            });
          if (upErr) throw new Error(upErr.message);
          uploaded = true;
        } catch (storageErr) {
          try {
            const { writePrivateDocumentBlob } = await import("@/server/document-blob-store");
            await writePrivateDocumentBlob(storagePath, bytes);
            uploaded = true;
          } catch {
            throw new AuthError(
              storageErr instanceof Error
                ? `Could not store payment proof: ${storageErr.message}`
                : "Could not store payment proof.",
              503,
            );
          }
        }
        if (!uploaded) throw new AuthError("Could not store payment proof.", 503);
        proofMeta = {
          path: storagePath,
          fileName: checked.fileName,
          mimeType: data.proofFile.mimeType,
          byteLength: bytes.byteLength,
          uploadedAt: new Date().toISOString(),
        };
      }

      if (proofMeta && data.markClaimed) {
        notesOut = appendFeeProofMeta(notesOut, proofMeta);
      } else if (!data.markClaimed) {
        // Re-issuing unpaid voucher clears claim notes path to proof meta.
        notesOut = stripFeeProofMeta(data.notes).trim() || null;
      }

      const { data: row, error } = await client
        .from("signup_fee_payments")
        .upsert(
          {
            student_id: data.studentId,
            amount: data.amount,
            currency: data.currency?.trim() || "PKR",
            payment_method: data.paymentMethod?.trim() || null,
            reference_receipt: data.referenceReceipt?.trim() || null,
            notes: notesOut,
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

      // If proof was uploaded before fee id existed, rewrite meta path under real fee id (best-effort).
      if (
        data.markClaimed &&
        proofMeta &&
        existing?.id !== row.id &&
        proofMeta.path.includes(data.studentId)
      ) {
        try {
          const { STUDENT_DOCUMENTS_BUCKET } = await import("@/lib/document-storage");
          const nextPath = signupFeeProofStoragePath(data.studentId, row.id, proofMeta.fileName);
          if (nextPath !== proofMeta.path) {
            const { createAdminSupabase } = await import("@/server/supabase-admin");
            const admin = createAdminSupabase();
            await admin.storage.from(STUDENT_DOCUMENTS_BUCKET).move(proofMeta.path, nextPath);
            proofMeta = { ...proofMeta, path: nextPath };
            const patched = appendFeeProofMeta(stripFeeProofMeta(row.notes), proofMeta);
            await client.from("signup_fee_payments").update({ notes: patched }).eq("id", row.id);
            row.notes = patched;
          }
        } catch {
          /* keep provisional path — still readable via meta */
        }
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: data.markClaimed ? "signup_fee.proof_submitted" : "signup_fee.voucher_issued",
          entity_type: "signup_fee_payments",
          entity_id: row.id,
          student_id: row.student_id,
          metadata: {
            status: row.status,
            amount: row.amount,
            currency: row.currency,
            hasProofFile: Boolean(proofMeta && data.markClaimed),
          },
        });
      } catch {
        /* best-effort */
      }

      // Notify Finance once when proof is claimed (not on unpaid voucher issue).
      if (data.markClaimed) {
        try {
          const { data: financeProfiles } = await client
            .from("profiles")
            .select("id")
            .eq("business_role", "accounts_banking_finance")
            .limit(40);
          const { data: stu } = await client
            .from("students")
            .select("full_name, case_id")
            .eq("id", row.student_id)
            .maybeSingle();
          const title = "Signup fee proof submitted";
          const body = `${stu?.full_name || "Student"} (${stu?.case_id || row.student_id}) — claim awaiting verification.`;
          const recipients = [...new Set((financeProfiles ?? []).map((p) => p.id).filter(Boolean))];
          const linkPath = `/staff/finance?feeId=${encodeURIComponent(row.id)}`;
          if (recipients.length) {
            await client.from("notifications").insert(
              recipients.map((user_id) => ({
                user_id,
                title,
                body,
                link_path: linkPath,
                student_id: row.student_id,
              })),
            );
          }
        } catch {
          /* best-effort */
        }
      }

      // Never auto-activate on claim.
      return {
        ok: true as const,
        fee: {
          studentId: row.student_id,
          feeId: row.id,
          status: row.status,
          amount: Number(row.amount),
          currency: row.currency,
          paymentMethod: row.payment_method,
          referenceReceipt: row.reference_receipt,
          notes: row.notes,
          verifiedAt: row.verified_at,
          portalActivatedAt: null as string | null,
          recordedBy: row.recorded_by,
          updatedAt: row.updated_at,
        } satisfies SignupFeeView,
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * Generate a real A4 PDF voucher from the authoritative fee row.
 * Re-download never creates a new fee record or changes amount/status.
 */
export const portalDownloadSignupFeeVoucher = createServerFn({ method: "POST" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      session.businessRole = await resolveSessionBusinessRole(session);
      await requireSignupFeeRecordPermission(session);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee voucher download requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const studentId = data.studentId?.trim();
      if (!studentId) throw new AuthError("Student id is required.", 400);

      if (isFrontDeskBusinessRole(session.businessRole)) {
        const { data: owned, error: ownedErr } = await client.rpc("is_intake_registrar", {
          p_student_id: studentId,
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
          throw new AuthError("You can only download vouchers for students you registered.", 403);
        }
      } else {
        await assertStudentVisibleDb(client, session, studentId);
      }

      const { data: feeRow, error: feeErr } = await client
        .from("signup_fee_payments")
        .select("id, status, amount, currency, created_at")
        .eq("student_id", studentId)
        .maybeSingle();
      if (feeErr) throw new Error(feeErr.message);
      if (!feeRow?.id) {
        throw new AuthError("Issue an unpaid voucher before downloading the PDF.", 404);
      }

      const { data: stu, error: stuErr } = await client
        .from("students")
        .select("full_name, case_id")
        .eq("id", studentId)
        .maybeSingle();
      if (stuErr) throw new Error(stuErr.message);

      const { encodeSignupFeeVoucherPdf } = await import("@/lib/signup-fee-voucher-pdf");
      const pdf = encodeSignupFeeVoucherPdf({
        feeId: feeRow.id,
        caseId: stu?.case_id || studentId,
        studentName: stu?.full_name || "Student",
        amount: Number(feeRow.amount),
        currency: feeRow.currency || "PKR",
        status: feeRow.status,
        issuedAt: feeRow.created_at,
      });

      return {
        ok: true as const,
        filename: pdf.filename,
        mimeType: pdf.mimeType,
        contentBase64: pdf.contentBase64,
        voucherNumber: pdf.voucherNumber,
        feeId: feeRow.id,
        status: feeRow.status,
        amount: Number(feeRow.amount),
        currency: feeRow.currency || "PKR",
      };
    } catch (error) {
      toError(error);
    }
  });

/** Finance-only signed URL (or base64 fallback) for uploaded payment proof. */
export const portalGetSignupFeeProofUrl = createServerFn({ method: "POST" })
  .validator((data: { feeId: string; studentId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["admin", "super_admin", "consultant"]);
      session.businessRole = await resolveSessionBusinessRole(session);
      denyFrontDeskConsultantWorkflows(session, "signup fee proof preview");
      requireSignupFeeVerifyPermission(session);
      const canVerify =
        rolesAtLeastAdmin(session.role) ||
        canFullyApproveModule(session.businessRole, "fees_payments") ||
        session.businessRole === "accounts_banking_finance" ||
        session.businessRole === "manager";
      if (!canVerify) {
        throw new AuthError("Only Accounts/Finance or Admin may open payment proof.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Proof preview requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const feeId = data.feeId?.trim();
      const studentId = data.studentId?.trim();
      if (!feeId || !studentId) throw new AuthError("Fee and student ids are required.", 400);

      const { data: feeRow, error } = await client
        .from("signup_fee_payments")
        .select("id, student_id, notes")
        .eq("id", feeId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!feeRow) throw new AuthError("Signup fee record not found.", 404);

      const { parseFeeProofMeta } = await import("@/lib/signup-fee-voucher-pdf");
      const meta = parseFeeProofMeta(feeRow.notes);
      if (!meta?.path) {
        throw new AuthError("No uploaded payment proof is attached to this fee claim.", 404);
      }

      const { STUDENT_DOCUMENTS_BUCKET, DOCUMENT_PREVIEW_TTL_SEC } =
        await import("@/lib/document-storage");

      try {
        const { createAdminSupabase } = await import("@/server/supabase-admin");
        const admin = createAdminSupabase();
        const { data: signed, error: signErr } = await admin.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .createSignedUrl(meta.path, DOCUMENT_PREVIEW_TTL_SEC);
        if (signErr || !signed?.signedUrl) throw new Error(signErr?.message || "sign failed");
        return {
          ok: true as const,
          mode: "signed_url" as const,
          url: signed.signedUrl,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
          expiresInSec: DOCUMENT_PREVIEW_TTL_SEC,
        };
      } catch {
        const { readPrivateDocumentBlob } = await import("@/server/document-blob-store");
        const bytes = await readPrivateDocumentBlob(meta.path);
        if (!bytes) {
          throw new AuthError("Payment proof file is missing from storage.", 404);
        }
        return {
          ok: true as const,
          mode: "base64" as const,
          contentBase64: bytes.toString("base64"),
          fileName: meta.fileName,
          mimeType: meta.mimeType,
          expiresInSec: DOCUMENT_PREVIEW_TTL_SEC,
        };
      }
    } catch (error) {
      toError(error);
    }
  });

export type SignupFeeQueueStatusFilter = SignupFeeLedgerStatusFilter;

export type SignupFeeQueueInput = {
  status?: SignupFeeQueueStatusFilter;
  search?: string;
  limit?: number;
  offset?: number;
};

export type SignupFeeQueueRow = {
  feeId: string;
  voucherNumber: string;
  studentId: string;
  studentName: string | null;
  caseId: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  referenceReceipt: string | null;
  notes: string | null;
  /** Display notes without embedded proof JSON. */
  notesDisplay: string | null;
  hasProofFile: boolean;
  proofFileName: string | null;
  proofMimeType: string | null;
  proofUploadedAt: string | null;
  recordedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  openRequestId: string | null;
  openRequestStatus: string | null;
  openRequestSummary: string | null;
};

/** Accounts/Finance ledger: signup/intake fees (separate from university_fee_obligations). */
export const portalListSignupFeeQueue = createServerFn({ method: "GET" })
  .validator((data?: SignupFeeQueueInput) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["admin", "super_admin", "consultant"]);
      session.businessRole = await resolveSessionBusinessRole(session);
      denyFrontDeskConsultantWorkflows(session, "signup fee verification queue");
      requireSignupFeeVerifyPermission(session);
      const canVerify =
        rolesAtLeastAdmin(session.role) ||
        canFullyApproveModule(session.businessRole, "fees_payments") ||
        session.businessRole === "accounts_banking_finance" ||
        session.businessRole === "manager";
      if (!canVerify) {
        throw new AuthError("Only Accounts/Finance or Admin may view the signup fee queue.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Signup fee queue requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const statusFilter = (data?.status ?? "claimed") as SignupFeeQueueStatusFilter;
      const statuses = signupFeeStatusesForLedgerFilter(statusFilter);
      const { signupFeeVoucherNumber } = await import("@/lib/signup-fee-voucher");
      const pageInput: { limit?: number; offset?: number } = {};
      if (typeof data?.limit === "number") pageInput.limit = data.limit;
      if (typeof data?.offset === "number") pageInput.offset = data.offset;
      const { limit, offset } = clampSignupFeeLedgerPage(pageInput);
      const search = sanitizeSignupFeeSearchTerm(data?.search ?? "");

      // Overview counts across the ledger (authorized fee-verifier SELECT).
      const countFor = async (
        statusList: NonNullable<ReturnType<typeof signupFeeStatusesForLedgerFilter>>,
      ) => {
        const { count, error: cErr } = await client
          .from("signup_fee_payments")
          .select("id", { count: "exact", head: true })
          .in("status", statusList);
        if (cErr) throw new Error(cErr.message);
        return count ?? 0;
      };

      let pendingCount = 0;
      let claimedCount = 0;
      let unpaidCount = 0;
      let verifiedCount = 0;
      let rejectedCount = 0;
      let waivedCount = 0;
      let verifiedByCurrency: { currency: string; total: number }[] = [];
      let verifiedTodayByCurrency: { currency: string; total: number }[] = [];
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [p, claimed, unpaid, v, r, w, verifiedSnaps] = await Promise.all([
          countFor(["unpaid", "claimed"]),
          countFor(["claimed"]),
          countFor(["unpaid"]),
          countFor(["verified"]),
          countFor(["rejected"]),
          countFor(["waived"]),
          client
            .from("signup_fee_payments")
            .select("status, amount, currency, verified_at")
            .eq("status", "verified")
            .limit(5000),
        ]);
        pendingCount = p;
        claimedCount = claimed;
        unpaidCount = unpaid;
        verifiedCount = v;
        rejectedCount = r;
        waivedCount = w;
        if (verifiedSnaps.error) throw new Error(verifiedSnaps.error.message);
        const cash = aggregateVerifiedSignupFeeCash(
          (verifiedSnaps.data ?? []).map((row) => ({
            status: row.status,
            amount: Number(row.amount),
            currency: row.currency ?? "PKR",
            verifiedAt: row.verified_at,
          })),
          { todayStartIso: todayStart.toISOString() },
        );
        verifiedByCurrency = cash.verifiedByCurrency;
        verifiedTodayByCurrency = cash.verifiedTodayByCurrency;
      } catch (countErr) {
        if (
          countErr instanceof Error &&
          /does not exist|relation|PGRST205|42P01/i.test(countErr.message)
        ) {
          throw new AuthError("Signup fee table unavailable. Apply signup-fee migrations.", 503);
        }
        throw countErr;
      }

      // Search before pagination: resolve matching student IDs, then filter fees.
      let searchStudentIds: string[] | null = null;
      if (search) {
        const [{ data: byName }, { data: byCase }] = await Promise.all([
          client.from("students").select("id").ilike("full_name", `%${search}%`).limit(300),
          client.from("students").select("id").ilike("case_id", `%${search}%`).limit(300),
        ]);
        searchStudentIds = [
          ...new Set([...(byName ?? []), ...(byCase ?? [])].map((s) => s.id).filter(Boolean)),
        ];
      }

      let query = client
        .from("signup_fee_payments")
        .select(
          "id, student_id, status, amount, currency, payment_method, reference_receipt, notes, recorded_by, verified_at, created_at, updated_at",
          { count: "exact" },
        )
        .order("updated_at", { ascending: false });
      if (statuses) {
        query = query.in("status", statuses);
      }
      if (search) {
        const parts: string[] = [
          `reference_receipt.ilike.%${search}%`,
          `payment_method.ilike.%${search}%`,
        ];
        if (searchStudentIds && searchStudentIds.length) {
          parts.unshift(`student_id.in.(${searchStudentIds.join(",")})`);
        }
        // Also allow exact student UUID paste.
        if (/^[0-9a-f-]{36}$/i.test(search)) {
          parts.push(`student_id.eq.${search}`);
        }
        query = query.or(parts.join(","));
      }
      query = query.range(offset, offset + limit - 1);

      const { data: fees, error, count: matchedCount } = await query;
      if (error) {
        if (/does not exist|relation|PGRST205|42P01/i.test(error.message)) {
          throw new AuthError("Signup fee table unavailable. Apply signup-fee migrations.", 503);
        }
        throw new Error(error.message);
      }

      const studentIds = [...new Set((fees ?? []).map((f) => f.student_id))];
      const nameById = new Map<string, { full_name: string; case_id: string }>();
      if (studentIds.length) {
        const { data: students, error: stuErr } = await client
          .from("students")
          .select("id, full_name, case_id")
          .in("id", studentIds);
        if (stuErr) throw new Error(stuErr.message);
        for (const s of students ?? []) {
          nameById.set(s.id, { full_name: s.full_name, case_id: s.case_id });
        }
      }

      const requestByStudent = new Map<string, { id: string; status: string; summary: string }>();
      if (studentIds.length) {
        const { data: reqs, error: reqErr } = await client
          .from("counselling_fee_verification_requests")
          .select("id, student_id, status, summary")
          .in("student_id", studentIds)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false });
        if (reqErr) {
          if (!/does not exist|relation|PGRST205|42P01/i.test(reqErr.message)) {
            throw new Error(reqErr.message);
          }
        } else {
          for (const r of reqs ?? []) {
            if (!requestByStudent.has(r.student_id)) {
              requestByStudent.set(r.student_id, {
                id: r.id,
                status: r.status,
                summary: r.summary,
              });
            }
          }
        }
      }

      const { parseFeeProofMeta, stripFeeProofMeta } = await import("@/lib/signup-fee-voucher-pdf");
      const rows: SignupFeeQueueRow[] = (fees ?? []).map((f) => {
        const stu = nameById.get(f.student_id);
        const req = requestByStudent.get(f.student_id);
        const proof = parseFeeProofMeta(f.notes);
        const notesDisplay = stripFeeProofMeta(f.notes).trim() || null;
        return {
          feeId: f.id,
          voucherNumber: signupFeeVoucherNumber(f.id),
          studentId: f.student_id,
          studentName: stu?.full_name ?? null,
          caseId: stu?.case_id ?? null,
          status: f.status,
          amount: Number(f.amount),
          currency: f.currency,
          paymentMethod: f.payment_method,
          referenceReceipt: f.reference_receipt,
          notes: f.notes,
          notesDisplay,
          hasProofFile: Boolean(proof?.path),
          proofFileName: proof?.fileName ?? null,
          proofMimeType: proof?.mimeType ?? null,
          proofUploadedAt: proof?.uploadedAt ?? null,
          recordedBy: f.recorded_by ?? null,
          verifiedAt: f.verified_at,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
          openRequestId: req?.id ?? null,
          openRequestStatus: req?.status ?? null,
          openRequestSummary: req?.summary ?? null,
        };
      });

      console.info(
        JSON.stringify({
          scope: "signup_fee_queue",
          event: "list_ok",
          userId: session.userId ?? null,
          rowCount: rows.length,
          statusFilter,
          offset,
          limit,
          search: Boolean(search),
        }),
      );

      return {
        ok: true as const,
        rows,
        pendingCount,
        claimedCount,
        unpaidCount,
        verifiedCount,
        rejectedCount,
        waivedCount,
        verifiedByCurrency,
        verifiedTodayByCurrency,
        matchedCount: matchedCount ?? rows.length,
        limit,
        offset,
        statusFilter,
        fetchedAt: new Date().toISOString(),
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

      // Concurrent / stale UI: do not re-process terminal fees via a second decision.
      if (isTerminalSignupFeeStatus(existingFee.status)) {
        const expected = expectedStatusForSignupFeeAction(data.action);
        if (existingFee.status === expected) {
          const { data: stu } = await client
            .from("students")
            .select("portal_activated_at")
            .eq("id", data.studentId)
            .maybeSingle();
          return {
            ok: true as const,
            unchanged: true as const,
            fee: {
              studentId: existingFee.student_id,
              feeId: existingFee.id,
              status: existingFee.status,
              amount: Number(existingFee.amount),
              currency: existingFee.currency,
              paymentMethod: existingFee.payment_method,
              referenceReceipt: existingFee.reference_receipt,
              verifiedAt: existingFee.verified_at,
              portalActivatedAt: stu?.portal_activated_at ?? null,
            } satisfies SignupFeeView,
            requestsResolved: 0,
            requestSyncWarning: null,
            message: `This fee is already ${existingFee.status}. Refresh the ledger if the row still looks pending.`,
          };
        }
        throw new AuthError(
          `This signup fee was already marked ${existingFee.status}. Refresh the ledger — another officer may have acted first.`,
          409,
        );
      }

      if (
        (data.action === "reject" || data.action === "waive") &&
        (data.notes?.trim().length ?? 0) < 3
      ) {
        throw new AuthError(
          data.action === "reject"
            ? "Add a short rejection reason (at least 3 characters)."
            : "Add a short waiver reason (at least 3 characters).",
          400,
        );
      }

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

      // Prefer in-RPC resolve (migration 20261020180000). Idempotent reconcile closes leftovers.
      // Never swallow resolve errors as success — surface requestSyncWarning when fee already committed.
      let requestsResolved: number | null = null;
      let requestSyncWarning: string | null = null;
      {
        const { data: reconcileRows, error: reconcileErr } = await client.rpc(
          "reconcile_counselling_fee_request_from_fee",
          { p_student_id: data.studentId },
        );
        if (reconcileErr) {
          if (/does not exist|function|PGRST202/i.test(reconcileErr.message)) {
            const { error: resolveErr, count } = await client
              .from("counselling_fee_verification_requests")
              .update(
                {
                  status: "resolved",
                  resolved_at: new Date().toISOString(),
                  resolved_by: session.userId ?? null,
                },
                { count: "exact" },
              )
              .eq("student_id", data.studentId)
              .in("status", ["open", "in_progress"]);
            if (resolveErr) {
              if (/does not exist|relation|PGRST205|42P01/i.test(resolveErr.message)) {
                requestSyncWarning =
                  "Fee decision saved. Coordination requests unavailable — apply migrations 20261020150000–20261020180000.";
              } else {
                requestSyncWarning = `Fee decision saved (${String(rpcRow.status)}), but the Front Desk request may still show pending. Use Sync from fee on Front Desk.`;
              }
            } else {
              requestsResolved = count ?? 0;
            }
          } else {
            requestSyncWarning = `Fee decision saved (${String(rpcRow.status)}), but request sync failed. Use Sync from fee on Front Desk after applying migration 20261020180000.`;
          }
        } else {
          const row = Array.isArray(reconcileRows) ? reconcileRows[0] : reconcileRows;
          requestsResolved =
            row && typeof row === "object" && "requests_resolved" in row
              ? Number((row as { requests_resolved: number }).requests_resolved ?? 0)
              : 0;
        }
      }

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
          requestsResolved,
          requestSyncWarning: requestSyncWarning ? true : null,
        },
      });

      // Notify Front Desk registrar + assigned counsellor + linked student (durable).
      try {
        const { data: stu } = await client
          .from("students")
          .select("registered_by, assigned_consultant_id, full_name, case_id, profile_id")
          .eq("id", data.studentId)
          .maybeSingle();
        const outcome = String(rpcRow.status ?? data.action);
        const body = `Signup fee ${outcome} for ${stu?.full_name || "student"} (${stu?.case_id || data.studentId}).`;
        const recipients = new Set<string>();
        if (stu?.registered_by) recipients.add(stu.registered_by);
        if (stu?.assigned_consultant_id) recipients.add(stu.assigned_consultant_id);
        if (recipients.size) {
          await client.from("notifications").insert(
            [...recipients].map((userId) => ({
              user_id: userId,
              title: `Signup fee ${outcome}`,
              body,
              link_path: userId === stu?.registered_by ? "/staff/front-desk" : "/staff/students",
              student_id: data.studentId,
            })),
          );
        }
        const { notifyLinkedStudent } = await import("@/lib/notify-linked-student");
        const studentSafe =
          outcome === "verified" || outcome === "waived"
            ? "Your signup fee has been verified. Portal access should now be available."
            : outcome === "rejected"
              ? "Your signup fee needs correction. Please contact Front Desk with updated payment evidence."
              : `Your signup fee status was updated to ${outcome}.`;
        await notifyLinkedStudent(client, data.studentId, {
          title: `Signup fee ${outcome}`,
          body: studentSafe,
          linkPath: "/student/dashboard",
        });
      } catch {
        /* best-effort */
      }

      return {
        ok: true as const,
        fee: {
          studentId: fee.student_id,
          feeId: fee.id,
          status: fee.status,
          amount: Number(fee.amount),
          currency: fee.currency,
          paymentMethod: fee.payment_method,
          referenceReceipt: fee.reference_receipt,
          verifiedAt: fee.verified_at,
          portalActivatedAt,
        } satisfies SignupFeeView,
        requestsResolved,
        requestSyncWarning,
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
        try {
          const { notifyLinkedStudent } = await import("@/lib/notify-linked-student");
          await notifyLinkedStudent(client, data.studentId, {
            title: "Counsellor assigned",
            body: "A counsellor has been assigned to your case. You can request an appointment when ready.",
            linkPath: "/student/appointments",
          });
        } catch {
          /* best-effort */
        }
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
      try {
        const { notifyLinkedStudent } = await import("@/lib/notify-linked-student");
        await notifyLinkedStudent(client, data.studentId, {
          title: "Counsellor assigned",
          body: "A counsellor has been assigned to your case. You can request an appointment when ready.",
          linkPath: "/student/appointments",
        });
      } catch {
        /* best-effort */
      }
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

      const { DEFAULT_ADMISSION_HANDOVER_SUMMARY, normalizeOptionalActionSummary } =
        await import("@/lib/counsellor-lifecycle-next");
      const summary = normalizeOptionalActionSummary(
        data.summary,
        DEFAULT_ADMISSION_HANDOVER_SUMMARY,
      );
      if (summary.length > 2000) {
        throw new AuthError("Keep the handover note under 2000 characters.", 400);
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

      // Authoritative fee gate — claimed/unpaid/rejected cannot proceed to Admission.
      const { data: feeRow } = await client
        .from("signup_fee_payments")
        .select("status")
        .eq("student_id", data.studentId)
        .maybeSingle();
      const { feeStatusAllowsAdmissionHandover, admissionHandoverBlockedByFeeMessage } =
        await import("@/lib/fee-verification-workflow");
      if (!feeStatusAllowsAdmissionHandover(feeRow?.status)) {
        throw new AuthError(admissionHandoverBlockedByFeeMessage(), 400);
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

      // Notify Admission Team desks (and optional to_owner) — best-effort.
      try {
        const body = `Counsellor handed over ${student.name || "a student"} (${student.caseId || data.studentId}) for admissions review.`;
        const recipientIds = new Set<string>();
        if (handover.to_owner_id) recipientIds.add(handover.to_owner_id);
        const { data: admissionProfiles } = await client
          .from("profiles")
          .select("id")
          .eq("business_role", "admission_team")
          .limit(25);
        for (const p of admissionProfiles ?? []) {
          if (p.id) recipientIds.add(p.id);
        }
        if (recipientIds.size) {
          await client.from("notifications").insert(
            [...recipientIds].map((userId) => ({
              user_id: userId,
              title: "Admission handover submitted",
              body,
              link_path: "/staff/applications",
              student_id: data.studentId,
            })),
          );
        }
      } catch {
        /* notification best-effort */
      }

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
          lifecycle: {
            hasConsent: false,
            feeRequest: null,
            handover: null,
          },
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

      const [{ data: agreement }, { data: feeReq }, { data: handover }] = await Promise.all([
        client
          .from("counselling_agreements")
          .select("id, consented")
          .eq("student_id", studentId)
          .eq("consented", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("counselling_fee_verification_requests")
          .select("id, status, summary, updated_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("admission_handovers")
          .select("id, status, handed_over_at")
          .eq("student_id", studentId)
          .order("handed_over_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const lifecycle = {
        hasConsent: Boolean(agreement?.consented),
        feeRequest: feeReq
          ? {
              id: feeReq.id as string,
              status: String(feeReq.status),
              summary: String(feeReq.summary ?? ""),
              updatedAt: (feeReq.updated_at as string | null) ?? null,
            }
          : null,
        handover: handover
          ? {
              id: handover.id as string,
              status: String(handover.status),
              handedOverAt: (handover.handed_over_at as string | null) ?? null,
            }
          : null,
      };

      const isStudentViewer = session.role === "student";
      // Students receive status + activation only — no amount / receipt / method.
      const redactStudentFee = (view: SignupFeeView): SignupFeeView =>
        isStudentViewer
          ? {
              ...view,
              amount: 0,
              currency: view.currency || "PKR",
              paymentMethod: null,
              referenceReceipt: null,
            }
          : view;

      if (!fee) {
        return {
          ok: true as const,
          fee: redactStudentFee({
            studentId,
            feeId: null,
            status: "unpaid" as const,
            amount: 0,
            currency: "PKR",
            paymentMethod: null,
            referenceReceipt: null,
            verifiedAt: null,
            portalActivatedAt: stu?.portal_activated_at ?? null,
          }),
          lifecycle: isStudentViewer
            ? {
                hasConsent: lifecycle.hasConsent,
                feeRequest: null,
                handover: lifecycle.handover
                  ? {
                      id: lifecycle.handover.id,
                      status: lifecycle.handover.status,
                      handedOverAt: lifecycle.handover.handedOverAt,
                    }
                  : null,
              }
            : lifecycle,
        };
      }

      return {
        ok: true as const,
        fee: redactStudentFee({
          studentId: fee.student_id,
          feeId: fee.id,
          status: fee.status,
          amount: Number(fee.amount),
          currency: fee.currency,
          paymentMethod: fee.payment_method,
          referenceReceipt: fee.reference_receipt,
          verifiedAt: fee.verified_at,
          portalActivatedAt: stu?.portal_activated_at ?? null,
        }),
        feeVerified: isSignupFeeVerified(fee.status),
        lifecycle: isStudentViewer
          ? {
              hasConsent: lifecycle.hasConsent,
              feeRequest: null,
              handover: lifecycle.handover
                ? {
                    id: lifecycle.handover.id,
                    status: lifecycle.handover.status,
                    handedOverAt: lifecycle.handover.handedOverAt,
                  }
                : null,
            }
          : lifecycle,
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
      const { HANDOVER_QUEUE_MODULE, HANDOVER_QUEUE_VIEW_MINIMUM } =
        await import("@/lib/counsellor-handover-rules");
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
      const { HANDOVER_QUEUE_MODULE, HANDOVER_QUEUE_MUTATE_MINIMUM } =
        await import("@/lib/counsellor-handover-rules");
      await requireModulePermission(
        session,
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_MUTATE_MINIMUM,
        "admission handover queue",
      );
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
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
      // Visibility: RLS admission_handovers_select (submitted queue for Admission Team /
      // can_access_student after migration 20261023120000). Do not require prior assignment.
      if (existing.status !== "submitted") {
        throw new AuthError("Only submitted handovers can be accepted or returned.", 400);
      }
      if (data.action === "return") {
        const reason = data.note?.trim() ?? "";
        if (reason.length < 5) {
          throw new AuthError("Provide a return note for the counsellor (min 5 characters).", 400);
        }
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
        const { data: student, error: studentLoadErr } = await client
          .from("students")
          .select("journey_stage")
          .eq("id", row.student_id)
          .maybeSingle();
        if (studentLoadErr) {
          throw new AuthError(
            `Handover accepted, but student record is not visible yet (${studentLoadErr.message}). Apply admission SELECT/mutate migration if needed.`,
            409,
          );
        }
        const next = nextJourneyStageIfAdvanced(student?.journey_stage, "university_shortlisting");
        if (next) {
          const { error: stageErr } = await client
            .from("students")
            .update({ journey_stage: next })
            .eq("id", row.student_id);
          if (stageErr) {
            throw new AuthError(
              `Handover accepted, but journey stage could not be updated (${stageErr.message}).`,
              409,
            );
          }
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

      // Notify originating counsellor — best-effort.
      try {
        const counsellorId = existing.from_consultant_id;
        if (counsellorId) {
          const { data: stu } = await client
            .from("students")
            .select("full_name, case_id")
            .eq("id", row.student_id)
            .maybeSingle();
          const outcome = data.action === "accept" ? "accepted" : "returned";
          await client.from("notifications").insert({
            user_id: counsellorId,
            title: `Admission handover ${outcome}`,
            body:
              data.action === "accept"
                ? `Admission accepted ${stu?.full_name || "student"} (${stu?.case_id || row.student_id}).`
                : `Admission returned ${stu?.full_name || "student"} (${stu?.case_id || row.student_id})${
                    note ? `: ${note}` : "."
                  }`,
            link_path: "/staff/students",
            student_id: row.student_id,
          });
        }
      } catch {
        /* best-effort */
      }

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

/** Counsellor returns case to Front Desk for signup-fee verification (not Admission handover). */
export const portalRequestFeeVerification = createServerFn({ method: "POST" })
  .validator((data: { studentId: string; summary: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      session.businessRole = await resolveSessionBusinessRole(session);
      denyFrontDeskConsultantWorkflows(session, "fee verification request");
      const { HANDOVER_INITIATE_MINIMUM, HANDOVER_INITIATE_MODULE } =
        await import("@/lib/counsellor-handover-rules");
      await requireModulePermission(
        session,
        HANDOVER_INITIATE_MODULE,
        HANDOVER_INITIATE_MINIMUM,
        "fee verification request",
      );

      const { validateFeeVerificationRequestSummary } =
        await import("@/lib/fee-verification-workflow");
      const summaryCheck = validateFeeVerificationRequestSummary(data.summary ?? "");
      if (!summaryCheck.ok) throw new AuthError(summaryCheck.message, 400);
      const { DEFAULT_FEE_VERIFICATION_SUMMARY, normalizeOptionalActionSummary } =
        await import("@/lib/counsellor-lifecycle-next");
      const summary = normalizeOptionalActionSummary(
        data.summary,
        DEFAULT_FEE_VERIFICATION_SUMMARY,
      );

      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee verification request requires the live data plane.", 400);
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
        throw new AuthError("You may only request verification for your assigned students.", 403);
      }

      const { data: row, error } = await client.rpc("request_counselling_fee_verification", {
        p_student_id: data.studentId,
        p_summary: summary,
      });
      if (error) {
        if (/does not exist|function|PGRST202/i.test(error.message)) {
          throw new AuthError(
            "Fee verification requests unavailable. Apply migration 20261020150000_counselling_fee_verification_requests.sql.",
            503,
          );
        }
        throw new AuthError(error.message, 400);
      }
      const created = Array.isArray(row) ? row[0] : row;
      if (!created?.id) throw new AuthError("Request was not created.", 500);

      // Durable notifications: registrar when known; otherwise Front Desk desks (unowned intake).
      try {
        const registrarId = (created.registrar_id as string | null) ?? null;
        const body = `Counsellor requested signup-fee verification for ${student.name || "a student"} (${student.caseId || data.studentId}).`;
        const recipientIds = new Set<string>();
        if (registrarId) recipientIds.add(registrarId);
        if (!registrarId) {
          const { data: fdProfiles } = await client
            .from("profiles")
            .select("id")
            .eq("business_role", "front_desk_student_affairs")
            .limit(25);
          for (const p of fdProfiles ?? []) {
            if (p.id) recipientIds.add(p.id);
          }
        }
        if (recipientIds.size) {
          await client.from("notifications").insert(
            [...recipientIds].map((userId) => ({
              user_id: userId,
              title: "Fee verification requested",
              body,
              link_path: "/staff/front-desk",
              student_id: data.studentId,
            })),
          );
        }
      } catch {
        /* notification best-effort — request row is already persisted */
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "student.fee_verification_requested",
          entity_type: "counselling_fee_verification_requests",
          entity_id: created.id,
          student_id: data.studentId,
          metadata: { status: created.status },
        });
      } catch {
        /* audit best-effort */
      }

      logFeeRequestDiag("request_persisted", {
        userId: session.userId ?? null,
        requestId: created.id as string,
        studentId: data.studentId,
        status: String(created.status ?? "open"),
        hasRegistrar: Boolean(created.registrar_id),
      });

      return {
        ok: true as const,
        requestId: created.id as string,
        status: String(created.status ?? "open"),
        message:
          "Case returned to Front Desk for fee verification. Accounts must verify or waive before Admission handover.",
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
