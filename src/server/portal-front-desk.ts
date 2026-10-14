/**
 * Front Desk portal APIs — intake summaries, counsellor picker, dashboard stats.
 * Uses security-definer RPCs + trusted business_role; never trusts client ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { assertFrontDeskOrAdmin, businessRoleFromSession } from "@/server/staff-access";
import { canListCounsellorDesksForSession } from "@/lib/staff-business-access";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type FrontDeskIntakeRow = {
  id: string;
  caseId: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  destination: string | null;
  program: string | null;
  studyLevel: string | null;
  inquirySource: string | null;
  inquiryChannel: string | null;
  intakeDate: string | null;
  registrationNotes: string | null;
  assignedConsultantId: string | null;
  counsellorName: string | null;
  registeredBy: string | null;
  journeyStage: string;
  portalActivatedAt: string | null;
  createdAt: string;
  signupFeeStatus: string | null;
  assignmentStatus: "pending" | "assigned";
};

export type FrontDeskDashboardPayload = {
  greetingName: string;
  myRegistrations: number;
  awaitingAssignment: number;
  recentAssigned: FrontDeskIntakeRow[];
  recentRegistrations: FrontDeskIntakeRow[];
};

export type CounsellorDeskOption = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

function mapIntakeRow(row: Record<string, unknown>): FrontDeskIntakeRow {
  const assigned = strOrNull(row["assigned_consultant_id"]);
  return {
    id: str(row["id"]),
    caseId: str(row["case_id"]),
    fullName: str(row["full_name"]),
    email: str(row["email"]),
    phone: strOrNull(row["phone"]),
    whatsapp: strOrNull(row["whatsapp"]),
    city: strOrNull(row["city"]),
    destination: strOrNull(row["destination"]),
    program: strOrNull(row["program"]),
    studyLevel: strOrNull(row["study_level"]),
    inquirySource: strOrNull(row["inquiry_source"]),
    inquiryChannel: strOrNull(row["inquiry_channel"]),
    intakeDate: strOrNull(row["intake_date"]),
    registrationNotes: strOrNull(row["registration_notes"]),
    assignedConsultantId: assigned,
    counsellorName: strOrNull(row["counsellor_name"]),
    registeredBy: strOrNull(row["registered_by"]),
    journeyStage: str(row["journey_stage"]),
    portalActivatedAt: strOrNull(row["portal_activated_at"]),
    createdAt: str(row["created_at"]),
    signupFeeStatus: strOrNull(row["signup_fee_status"]),
    assignmentStatus: assigned ? "assigned" : "pending",
  };
}

export const portalGetFrontDeskDashboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    assertFrontDeskOrAdmin(session);

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    if (!usesSupabaseDataPlane(session)) {
      throw new AuthError("Front Desk dashboard requires the live data plane.", 400);
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client.rpc("list_front_desk_intake_summaries");
    if (error) {
      if (/does not exist|function/i.test(error.message)) {
        throw new AuthError(
          "Front Desk intake RPC unavailable. Apply migration 20261014020000_front_desk_intake_ownership.sql.",
          503,
        );
      }
      throw new Error(error.message);
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map(mapIntakeRow);
    const awaiting = rows.filter((r) => r.assignmentStatus === "pending");
    const assigned = rows.filter((r) => r.assignmentStatus === "assigned");

    let greetingName = session.email.split("@")[0] || "Front Desk";
    if (session.userId) {
      const { data: profile } = await client
        .from("profiles")
        .select("full_name")
        .eq("id", session.userId)
        .maybeSingle();
      if (profile?.full_name?.trim()) greetingName = profile.full_name.trim();
    }

    return {
      greetingName,
      myRegistrations: rows.length,
      awaitingAssignment: awaiting.length,
      recentAssigned: assigned.slice(0, 8),
      recentRegistrations: rows.slice(0, 12),
    } satisfies FrontDeskDashboardPayload;
  } catch (error) {
    toError(error);
  }
});

export const portalListFrontDeskIntake = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    assertFrontDeskOrAdmin(session);

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    if (!usesSupabaseDataPlane(session)) {
      throw new AuthError("Intake list requires the live data plane.", 400);
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client.rpc("list_front_desk_intake_summaries");
    if (error) {
      if (/does not exist|function/i.test(error.message)) {
        throw new AuthError(
          "Front Desk intake RPC unavailable. Apply migration 20261014020000_front_desk_intake_ownership.sql.",
          503,
        );
      }
      throw new Error(error.message);
    }
    return {
      rows: ((data ?? []) as Record<string, unknown>[]).map(mapIntakeRow),
    };
  } catch (error) {
    toError(error);
  }
});

export const portalListCounsellorDesks = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    const br = businessRoleFromSession(session);
    if (
      !canListCounsellorDesksForSession({
        appRole: session.role,
        businessRole: br,
      })
    ) {
      throw new AuthError("You do not have permission to list counsellor desks.", 403);
    }

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    if (!usesSupabaseDataPlane(session)) {
      throw new AuthError("Counsellor list requires the live data plane.", 400);
    }
    const client = requireAoSupabaseClient();
    const { data, error } = await client.rpc("list_active_counsellor_desks");
    if (error) {
      if (/does not exist|function/i.test(error.message)) {
        throw new AuthError(
          "Counsellor desk RPC unavailable. Apply migration 20261014020000_front_desk_intake_ownership.sql.",
          503,
        );
      }
      throw new Error(error.message);
    }
    const options: CounsellorDeskOption[] = ((data ?? []) as Record<string, unknown>[]).map(
      (row) => ({
        id: str(row["id"]),
        fullName: str(row["full_name"]),
        email: str(row["email"]),
        department: strOrNull(row["department"]),
        jobTitle: strOrNull(row["job_title"]),
      }),
    );
    return { options };
  } catch (error) {
    toError(error);
  }
});
