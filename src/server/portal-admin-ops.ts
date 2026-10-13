/**
 * Admin overall tracking — authorized aggregates from live tables.
 * Sensitive document/finance detail fields are gated by business permissions.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import {
  buildAdminOpsMetrics,
  canViewAdminDocumentDetails,
  canViewAdminFinanceDetails,
  canViewAdminOpsOverview,
  type AdminOpsOverviewMetrics,
} from "@/lib/admin-ops-overview";

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

export type AdminOpsStudentLink = {
  id: string;
  name: string;
  caseId: string;
  journeyStage: string;
  updatedAt: string;
};

export type AdminOpsOverviewPayload = {
  metrics: AdminOpsOverviewMetrics;
  searchableStudents: AdminOpsStudentLink[];
  includeDocumentDetails: boolean;
  includeFinanceDetails: boolean;
  /** Super Admin retains technical distinction from Admin for privileged ops. */
  isSuperAdmin: boolean;
};

export const portalGetAdminOpsOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminOpsOverviewPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);

      if (!canViewAdminOpsOverview({ appRole: session.role, businessRole })) {
        throw new AuthError("You do not have permission to view operations overview.", 403);
      }

      const includeDocs = canViewAdminDocumentDetails({
        appRole: session.role,
        businessRole,
      });
      const includeFinance = canViewAdminFinanceDetails({
        appRole: session.role,
        businessRole,
      });

      const { usesSupabaseDataPlane, requireAoSupabaseClient, listVisibleStudentsDb } =
        await import("@/server/ao-data");

      if (!usesSupabaseDataPlane(session)) {
        return {
          metrics: buildAdminOpsMetrics({
            students: [],
            pendingSignupFees: 0,
            submittedHandovers: 0,
            docsPendingReview: 0,
            appsRequiringAction: 0,
            offersRequiringAction: 0,
            outstandingUniversityFees: 0,
            visaAttention: 0,
            overdueTasks: 0,
            counsellingAppointmentsPending: 0,
          }),
          searchableStudents: [],
          includeDocumentDetails: includeDocs,
          includeFinanceDetails: includeFinance,
          isSuperAdmin: session.role === "super_admin",
        };
      }

      const client = requireAoSupabaseClient();
      const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
      const studentIds = students.map((s) => s.id);

      const nowIso = new Date().toISOString();

      const [
        signupClaimed,
        handovers,
        docsPending,
        appsAction,
        offersAction,
        uniFees,
        visas,
        overdueTasks,
        apptsPending,
        journeyRows,
      ] = await Promise.all([
        client
          .from("signup_fee_payments")
          .select("id", { count: "exact", head: true })
          .in("status", ["claimed", "unpaid"]),
        client
          .from("admission_handovers")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
        includeDocs
          ? client
              .from("student_documents")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending_review")
          : Promise.resolve({ count: 0, error: null }),
        client
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("stage", ["docs_pending", "under_review", "ready_to_submit"]),
        client
          .from("offers")
          .select("id", { count: "exact", head: true })
          .in("status", ["awaiting_student", "conditions_pending"]),
        includeFinance
          ? client
              .from("university_fee_obligations")
              .select("id", { count: "exact", head: true })
              .in("status", ["due", "claimed"])
          : Promise.resolve({ count: 0, error: null }),
        client
          .from("visa_milestones")
          .select("id", { count: "exact", head: true })
          .eq("decision", "pending"),
        client
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"])
          .lt("due_at", nowIso),
        client
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("status", ["requested", "confirmed"]),
        rolesAtLeastAdmin(session.role) || studentIds.length === 0
          ? client
              .from("students")
              .select("id, full_name, case_id, journey_stage, archived_at, updated_at")
              .is("archived_at", null)
              .order("updated_at", { ascending: false })
              .limit(40)
          : client
              .from("students")
              .select("id, full_name, case_id, journey_stage, archived_at, updated_at")
              .in("id", studentIds)
              .order("updated_at", { ascending: false })
              .limit(40),
      ]);

      for (const res of [
        signupClaimed,
        handovers,
        docsPending,
        appsAction,
        offersAction,
        uniFees,
        visas,
        overdueTasks,
        apptsPending,
        journeyRows,
      ]) {
        if ("error" in res && res.error) throw new Error(res.error.message);
      }

      const stageStudents =
        journeyRows.data?.map((r) => ({
          id: r.id,
          name: r.full_name,
          caseId: r.case_id,
          journeyStage: r.journey_stage,
          archived: Boolean(r.archived_at),
          updatedAt: r.updated_at,
        })) ??
        students.map((s) => ({
          id: s.id,
          name: s.name,
          caseId: s.caseId,
          journeyStage: s.stage,
          archived: Boolean(s.archived),
          updatedAt: s.lastActivity,
        }));

      // Prefer full journey_stage counts for admin: re-query all non-archived when admin.
      let allForStages = stageStudents;
      if (rolesAtLeastAdmin(session.role)) {
        const { data: allStudents, error: allErr } = await client
          .from("students")
          .select("id, full_name, case_id, journey_stage, archived_at, updated_at")
          .is("archived_at", null);
        if (allErr) throw new Error(allErr.message);
        allForStages =
          allStudents?.map((r) => ({
            id: r.id,
            name: r.full_name,
            caseId: r.case_id,
            journeyStage: r.journey_stage,
            archived: Boolean(r.archived_at),
            updatedAt: r.updated_at,
          })) ?? stageStudents;
      }

      const metrics = buildAdminOpsMetrics({
        students: allForStages,
        pendingSignupFees: signupClaimed.count ?? 0,
        submittedHandovers: handovers.count ?? 0,
        docsPendingReview: includeDocs ? (docsPending.count ?? 0) : 0,
        appsRequiringAction: appsAction.count ?? 0,
        offersRequiringAction: offersAction.count ?? 0,
        outstandingUniversityFees: includeFinance ? (uniFees.count ?? 0) : 0,
        visaAttention: visas.count ?? 0,
        overdueTasks: overdueTasks.count ?? 0,
        counsellingAppointmentsPending: apptsPending.count ?? 0,
      });

      return {
        metrics,
        searchableStudents: stageStudents.slice(0, 40).map((s) => ({
          id: s.id,
          name: s.name,
          caseId: s.caseId,
          journeyStage: s.journeyStage,
          updatedAt: s.updatedAt,
        })),
        includeDocumentDetails: includeDocs,
        includeFinanceDetails: includeFinance,
        isSuperAdmin: session.role === "super_admin",
      };
    } catch (error) {
      toError(error);
    }
  },
);
