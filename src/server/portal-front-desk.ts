/**
 * Front Desk portal APIs — intake summaries, counsellor picker, dashboard stats.
 * Uses security-definer RPCs + trusted business_role; never trusts client ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { assertFrontDeskOrAdmin, businessRoleFromSession } from "@/server/staff-access";
import { canListCounsellorDesksForSession } from "@/lib/staff-business-access";
import { passwordRecoveryRedirectUrl, resolveAuthAppOrigin } from "@/lib/auth-redirects";

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
  profileId: string | null;
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
    profileId: strOrNull(row["profile_id"]),
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

function recoveryRedirect(): string {
  const fromEnv =
    process.env["APP_ORIGIN"]?.trim() ||
    process.env["SITE_URL"]?.trim() ||
    process.env["VITE_APP_ORIGIN"]?.trim() ||
    "";
  const origin = getRequestHeader("origin");
  const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") || "http";
  const requestOrigin = origin || (host ? `${proto}://${host}` : "");
  const isProduction =
    process.env["VERCEL_ENV"] === "production" || process.env["NODE_ENV"] === "production";
  return passwordRecoveryRedirectUrl(
    resolveAuthAppOrigin({ envOrigin: fromEnv, requestOrigin, isProduction }),
  );
}

/**
 * Create or reuse a student Auth user for an intake row this Front Desk user registered.
 * Sends Supabase's setup or recovery email. Never returns a password or link.
 * Does not set portal_activated_at.
 */
export const portalProvisionStudentPortalAccount = createServerFn({ method: "POST" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrAdmin(session);
      if (session.source !== "supabase" || !session.userId) {
        throw new AuthError("Student portal provisioning requires a live staff session.", 403);
      }
      const studentId = data.studentId?.trim();
      if (!studentId) throw new AuthError("Student id is required.", 400);

      const { isAdminSupabaseConfigured, requireAdminSupabase, adminConfigErrorMessage } =
        await import("@/server/supabase-admin");
      if (!isAdminSupabaseConfigured()) {
        throw new AuthError(adminConfigErrorMessage(), 503);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Student portal provisioning requires the live data plane.", 400);
      }
      const userClient = requireAoSupabaseClient();
      const { data: owned, error: ownedErr } = await userClient.rpc("list_front_desk_intake_summaries");
      if (ownedErr) throw new Error(ownedErr.message);
      const row = ((owned ?? []) as Record<string, unknown>[]).find((r) => str(r["id"]) === studentId);
      if (!row) throw new AuthError("Student record not found.", 404);

      const studentEmail = str(row["email"]).trim().toLowerCase();
      const fullName = str(row["full_name"]).trim();
      if (!studentEmail || !studentEmail.includes("@")) {
        throw new AuthError("This student record has no email address to send a setup link.", 400);
      }

      const admin = requireAdminSupabase();
      const { data: studentRow, error: studentErr } = await admin
        .from("students")
        .select("id, email, profile_id, portal_activated_at")
        .eq("id", studentId)
        .maybeSingle();
      if (studentErr) throw new Error(studentErr.message);
      if (!studentRow) throw new AuthError("Student record not found.", 404);
      if (studentRow.email.trim().toLowerCase() !== studentEmail) {
        throw new AuthError("Student email could not be confirmed.", 409);
      }

      const { data: profileByEmail, error: profileErr } = await admin
        .from("profiles")
        .select("id, email, role")
        .ilike("email", studentEmail)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);

      let account = profileByEmail;
      let invitedNow = false;
      if (!account) {
        const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(studentEmail, {
          redirectTo: recoveryRedirect(),
          data: { full_name: fullName || studentEmail },
        });
        if (inviteErr && !/already|registered|exists/i.test(inviteErr.message)) {
          const { inviteEmailFailureMessage } = await import("@/lib/student-portal-account");
          throw new AuthError(inviteEmailFailureMessage(inviteErr.message), 400);
        }
        invitedNow = !inviteErr;
        const { data: createdProfile, error: createdErr } = await admin
          .from("profiles")
          .select("id, email, role")
          .ilike("email", studentEmail)
          .maybeSingle();
        if (createdErr) throw new Error(createdErr.message);
        if (!createdProfile) {
          throw new AuthError(
            "The setup email was requested, but the account profile is not ready yet. Try again in a moment.",
            503,
          );
        }
        account = createdProfile;
      }

      const { data: linkedElsewhere, error: linkedErr } = await admin
        .from("students")
        .select("id")
        .eq("profile_id", account.id)
        .neq("id", studentId)
        .maybeSingle();
      if (linkedErr) throw new Error(linkedErr.message);

      const { decideStudentPortalLink, studentPortalAccountStatus } = await import(
        "@/lib/student-portal-account"
      );
      const decision = decideStudentPortalLink({
        studentId,
        studentEmail,
        studentProfileId: studentRow.profile_id,
        accountUserId: account.id,
        accountEmail: account.email,
        accountRole: account.role || "student",
        accountLinkedStudentId: linkedElsewhere?.id ?? null,
      });
      if (!decision.ok) {
        const message =
          decision.reason === "email_mismatch"
            ? "The existing account email does not match this student record."
            : decision.reason === "not_student_role"
              ? "That email already belongs to a staff account and cannot be used as a student login."
              : decision.reason === "linked_other_student" || decision.reason === "linked_other_profile"
                ? "This record is already linked to a different account. Use account recovery instead of creating another login."
                : "This student record has no email address.";
        throw new AuthError(message, 409);
      }

      const { error: linkErr } = await userClient.rpc("front_desk_link_student_portal_profile", {
        p_student_id: studentId,
        p_profile_id: account.id,
      });
      if (linkErr) {
        const { mapStudentPortalLinkRpcError } = await import("@/lib/student-portal-account");
        const mapped = mapStudentPortalLinkRpcError(linkErr.message);
        throw new AuthError(mapped.message, mapped.status);
      }

      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(account.id);
      if (authErr) throw new AuthError(authErr.message, 400);
      const hasSignedIn = Boolean(authUser.user?.last_sign_in_at);
      const status = studentPortalAccountStatus({
        profileId: account.id,
        hasSignedIn,
        portalActivatedAt: studentRow.portal_activated_at,
      });

      if (status === "pending_setup" && !invitedNow) {
        const { error: resetErr } = await admin.auth.resetPasswordForEmail(studentEmail, {
          redirectTo: recoveryRedirect(),
        });
        if (resetErr) {
          const { inviteEmailFailureMessage } = await import("@/lib/student-portal-account");
          throw new AuthError(inviteEmailFailureMessage(resetErr.message), 400);
        }
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "student.portal_account_provisioned",
          entity_type: "students",
          entity_id: studentId,
          student_id: studentId,
          metadata: { profileId: account.id, status, invitedNow },
        });
      } catch {
        /* audit failure must not hide a successful link */
      }

      const message =
        status === "active"
          ? "This student portal account is already active."
          : status === "pending_activation"
            ? "The login is linked. The portal stays closed until Accounts verifies the signup fee."
            : invitedNow
              ? "Setup email sent. The student sets a password from that link. The portal still opens only after signup-fee verification."
              : "Setup email sent again. The portal still opens only after signup-fee verification.";

      return { ok: true as const, status, message };
    } catch (error) {
      toError(error);
    }
  });
