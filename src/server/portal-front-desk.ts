/**
 * Front Desk portal APIs — intake summaries, counsellor picker, dashboard stats.
 * Uses security-definer RPCs + trusted business_role; never trusts client ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { assertFrontDeskOrAdmin, businessRoleFromSession } from "@/server/staff-access";
import { canListCounsellorDesksForSession } from "@/lib/staff-business-access";
import { validatePasswordConfirmation } from "@/lib/password-policy";

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

export type ProvisionStudentPortalInput = {
  studentId: string;
  temporaryPassword: string;
  confirmPassword: string;
};

/**
 * Create a student Auth login (staff-style password create) and link it to an owned intake row.
 * No invite or recovery email — avoids localhost redirect targets.
 * Never returns the password. Does not set portal_activated_at.
 */
export const portalProvisionStudentPortalAccount = createServerFn({ method: "POST" })
  .validator((data: ProvisionStudentPortalInput) => data)
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

      const passwordCheck = validatePasswordConfirmation(
        data.temporaryPassword,
        data.confirmPassword,
      );
      if (!passwordCheck.ok) throw new AuthError(passwordCheck.error, 400);

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
        throw new AuthError("This student record has no email address for a portal login.", 400);
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
      if (studentRow.profile_id) {
        throw new AuthError(
          "This student already has a linked portal account. Share credentials securely or use password reset from Admin if needed.",
          409,
        );
      }

      const { data: profileByEmail, error: profileErr } = await admin
        .from("profiles")
        .select("id, email, role")
        .ilike("email", studentEmail)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (profileByEmail) {
        throw new AuthError(
          "An account with this email already exists. Link or recovery must be handled carefully by an admin — this form only creates a new student login.",
          409,
        );
      }

      // Direct Auth Admin create — same pattern as staff accounts; no invite redirect.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: studentEmail,
        password: data.temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || studentEmail,
        },
        app_metadata: {
          role: "student",
        },
      });
      if (createErr) {
        const msg = createErr.message || "Could not create user.";
        if (/already|registered|exists/i.test(msg)) {
          throw new AuthError("An account with this email already exists.", 409);
        }
        throw new AuthError(msg, 400);
      }

      const userId = created.user?.id;
      if (!userId) {
        throw new AuthError("User creation did not return a user id.", 500);
      }

      let newlyCreatedAuthUserId: string | null = userId;

      try {
        const { data: existingProfile, error: existingErr } = await admin
          .from("profiles")
          .select("id, role, email")
          .eq("id", userId)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);

        if (!existingProfile) {
          const { error: insertErr } = await admin.from("profiles").insert({
            id: userId,
            email: studentEmail,
            full_name: fullName || studentEmail,
            role: "student",
            business_role: "student_portal",
          });
          if (insertErr) {
            throw new AuthError(`User created but profile insert failed: ${insertErr.message}.`, 500);
          }
        } else {
          if (existingProfile.role && existingProfile.role !== "student") {
            throw new AuthError(
              "That email already belongs to a staff account and cannot be used as a student login.",
              409,
            );
          }
          const { error: profileUpdateErr } = await admin
            .from("profiles")
            .update({
              email: studentEmail,
              full_name: fullName || studentEmail,
              role: "student",
              business_role: "student_portal",
            })
            .eq("id", userId);
          if (profileUpdateErr) {
            throw new AuthError(
              `User created but profile update failed: ${profileUpdateErr.message}.`,
              500,
            );
          }
        }

        const { data: account, error: accountErr } = await admin
          .from("profiles")
          .select("id, email, role")
          .eq("id", userId)
          .maybeSingle();
        if (accountErr) throw new Error(accountErr.message);
        if (!account) throw new AuthError("Profile was not created for the new login.", 500);

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
                : decision.reason === "linked_other_student" ||
                    decision.reason === "linked_other_profile"
                  ? "This record is already linked to a different account."
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

        // Link succeeded — do not delete this Auth user on later steps.
        newlyCreatedAuthUserId = null;

        const status = studentPortalAccountStatus({
          profileId: account.id,
          hasSignedIn: true,
          portalActivatedAt: studentRow.portal_activated_at,
        });

        try {
          const { writeAudit } = await import("@/services/db");
          await writeAudit(userClient, {
            action: "student.portal_account_provisioned",
            entity_type: "students",
            entity_id: studentId,
            student_id: studentId,
            metadata: { profileId: account.id, status, method: "password_create" },
          });
        } catch {
          /* audit failure must not hide a successful link */
        }

        const message =
          status === "active"
            ? "Student portal account created and already active."
            : "Student portal account created and linked. Share the password securely. The student can sign in, but CRM access stays closed until Accounts verifies the signup fee.";

        return { ok: true as const, status, message };
      } catch (inner) {
        // Narrow cleanup: only a brand-new Auth user that never linked to any student.
        if (newlyCreatedAuthUserId) {
          try {
            const { data: linkedAny } = await admin
              .from("students")
              .select("id")
              .eq("profile_id", newlyCreatedAuthUserId)
              .maybeSingle();
            if (!linkedAny) {
              await admin.auth.admin.deleteUser(newlyCreatedAuthUserId);
            }
          } catch {
            /* leave orphan for admin review rather than risk deleting a linked account */
          }
        }
        throw inner;
      }
    } catch (error) {
      toError(error);
    }
  });
