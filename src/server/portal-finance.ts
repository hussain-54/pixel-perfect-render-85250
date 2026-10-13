/**
 * Milestone 2 — University fee obligations (separate from signup_fee_payments).
 * Claimed ≠ verified. Verification restricted to Accounts/Admin/Manager.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import { canVerifyUniversityFeePayment } from "@/lib/university-fee-auth";
import { nextJourneyStageIfAdvanced } from "@/lib/journey-stage";
import type { JourneyStage, UniversityFeeKindDb, UniversityFeeStatusDb } from "@/types/database";

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
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

export type UniversityFeeView = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentCaseId: string | null;
  applicationId: string | null;
  offerId: string | null;
  kind: UniversityFeeKindDb;
  label: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  status: UniversityFeeStatusDb;
  paymentMethod: string | null;
  referenceReceipt: string | null;
  evidenceNotes: string | null;
  verifiedAt: string | null;
};

function mapFee(row: {
  id: string;
  student_id: string;
  application_id: string | null;
  offer_id: string | null;
  kind: UniversityFeeKindDb;
  label: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: UniversityFeeStatusDb;
  payment_method: string | null;
  reference_receipt: string | null;
  evidence_notes?: string | null;
  verified_at: string | null;
  students?: { full_name?: string | null; case_id?: string | null } | null;
}): UniversityFeeView {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.students?.full_name ?? null,
    studentCaseId: row.students?.case_id ?? null,
    applicationId: row.application_id,
    offerId: row.offer_id,
    kind: row.kind,
    label: row.label,
    amount: Number(row.amount),
    currency: row.currency,
    dueDate: row.due_date,
    status: row.status,
    paymentMethod: row.payment_method,
    referenceReceipt: row.reference_receipt,
    evidenceNotes: row.evidence_notes ?? null,
    verifiedAt: row.verified_at,
  };
}

async function advanceStudentJourney(
  client: Awaited<ReturnType<typeof import("@/server/ao-data").requireAoSupabaseClient>>,
  studentId: string,
  target: JourneyStage,
) {
  const { data: student } = await client
    .from("students")
    .select("journey_stage")
    .eq("id", studentId)
    .maybeSingle();
  const next = nextJourneyStageIfAdvanced(student?.journey_stage, target);
  if (!next) return;
  await client.from("students").update({ journey_stage: next }).eq("id", studentId);
}

export const portalCreateUniversityFeeObligation = createServerFn({ method: "POST" })
  .validator(
    (data: {
      studentId: string;
      amount: number;
      kind?: UniversityFeeKindDb;
      label?: string;
      currency?: string;
      dueDate?: string;
      applicationId?: string;
      offerId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("University fees require the live data plane.", 400);
      }
      if (data.amount < 0) throw new AuthError("Invalid amount.", 400);
      const client = requireAoSupabaseClient();
      await assertStudentVisibleDb(client, session, data.studentId);

      const { data: row, error } = await client
        .from("university_fee_obligations")
        .insert({
          student_id: data.studentId,
          amount: data.amount,
          kind: data.kind ?? "other",
          label: data.label?.trim() || data.kind || "University fee",
          currency: data.currency?.trim() || "PKR",
          due_date: data.dueDate?.trim() || null,
          application_id: data.applicationId?.trim() || null,
          offer_id: data.offerId?.trim() || null,
          status: "due",
          recorded_by: session.userId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "university_fee.create",
        entity_type: "university_fee_obligations",
        entity_id: row.id,
        student_id: data.studentId,
        metadata: { kind: row.kind, amount: row.amount, status: row.status },
      });

      return { ok: true as const, fee: mapFee(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalClaimUniversityFeePayment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      obligationId: string;
      paymentMethod?: string;
      referenceReceipt?: string;
      evidenceNotes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee claims require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: existing, error: loadErr } = await client
        .from("university_fee_obligations")
        .select("*")
        .eq("id", data.obligationId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Fee obligation not found.", 404);
      await assertStudentVisibleDb(client, session, existing.student_id);
      if (existing.status === "verified" || existing.status === "waived") {
        throw new AuthError("This fee is already finalized.", 400);
      }

      const { data: row, error } = await client
        .from("university_fee_obligations")
        .update({
          status: "claimed",
          payment_method: data.paymentMethod?.trim() || existing.payment_method,
          reference_receipt: data.referenceReceipt?.trim() || existing.reference_receipt,
          evidence_notes: data.evidenceNotes?.trim() || existing.evidence_notes,
          verified_by: null,
          verified_at: null,
        })
        .eq("id", data.obligationId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "university_fee.claim",
        entity_type: "university_fee_obligations",
        entity_id: row.id,
        student_id: row.student_id,
        metadata: { status: "claimed" },
      });

      return { ok: true as const, fee: mapFee(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalVerifyUniversityFeePayment = createServerFn({ method: "POST" })
  .validator(
    (data: { obligationId: string; action: "verify" | "waive" | "reject"; notes?: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      if (!canVerifyUniversityFeePayment({ appRole: session.role, businessRole })) {
        throw new AuthError("Only Accounts/Finance or Admin may verify university fees.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee verification requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: existing, error: loadErr } = await client
        .from("university_fee_obligations")
        .select("*")
        .eq("id", data.obligationId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Fee obligation not found.", 404);
      await assertStudentVisibleDb(client, session, existing.student_id);

      const next: UniversityFeeStatusDb =
        data.action === "verify" ? "verified" : data.action === "waive" ? "waived" : "rejected";

      const { data: row, error } = await client
        .from("university_fee_obligations")
        .update({
          status: next,
          verified_by: session.userId ?? null,
          verified_at: new Date().toISOString(),
          evidence_notes: data.notes?.trim() || existing.evidence_notes,
        })
        .eq("id", data.obligationId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: `university_fee.${data.action}`,
        entity_type: "university_fee_obligations",
        entity_id: row.id,
        student_id: row.student_id,
        metadata: { status: next, kind: row.kind },
      });

      // Verified university fees never mutate signup_fee_payments; only advance journey when relevant.
      if (next === "verified" || next === "waived") {
        if (row.kind === "application_fee") {
          await advanceStudentJourney(client, row.student_id, "application_submitted");
        } else if (row.kind === "offer_deposit" || row.kind === "tuition") {
          await advanceStudentJourney(client, row.student_id, "offer_received");
        } else if (row.kind === "visa_fee") {
          await advanceStudentJourney(client, row.student_id, "visa_preparation");
        }
      }

      return { ok: true as const, fee: mapFee(row) };
    } catch (error) {
      toError(error);
    }
  });

export const portalListUniversityFeeQueue = createServerFn({ method: "GET" })
  .validator(
    (data: { status?: UniversityFeeStatusDb; studentId?: string } | undefined) => data ?? {},
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const { usesSupabaseDataPlane, requireAoSupabaseClient, assertStudentVisibleDb } =
        await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return { ok: true as const, fees: [] as UniversityFeeView[] };
      }
      const client = requireAoSupabaseClient();
      if (data.studentId?.trim()) {
        await assertStudentVisibleDb(client, session, data.studentId.trim());
      }

      let q = client
        .from("university_fee_obligations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data.status) q = q.eq("status", data.status);
      if (data.studentId?.trim()) q = q.eq("student_id", data.studentId.trim());
      // Finance queue default: pending verification
      if (!data.status && !data.studentId) q = q.in("status", ["claimed", "due"]);

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
      return {
        ok: true as const,
        fees: (rows ?? []).map((row) =>
          mapFee({
            ...row,
            students: nameById.get(row.student_id) ?? null,
          }),
        ),
      };
    } catch (error) {
      toError(error);
    }
  });
