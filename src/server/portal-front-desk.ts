/**
 * Front Desk portal APIs — intake summaries, counsellor picker, dashboard stats.
 * Uses security-definer RPCs + trusted business_role; never trusts client ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import {
  assertFrontDeskOrAdmin,
  assertFrontDeskOrFeeVerifierOrAdmin,
  businessRoleFromSession,
} from "@/server/staff-access";
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
  nextFollowUpAt: string | null;
  assignedConsultantId: string | null;
  counsellorName: string | null;
  registrarName: string | null;
  registeredBy: string | null;
  journeyStage: string;
  portalActivatedAt: string | null;
  profileId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  signupFeeStatus: string | null;
  signupFeeAmount: number | null;
  signupFeeCurrency: string | null;
  signupFeeMethod: string | null;
  signupFeeReference: string | null;
  assignmentStatus: "pending" | "assigned";
};

export type FrontDeskDashboardPayload = {
  greetingName: string;
  myRegistrations: number;
  awaitingAssignment: number;
  assignedStudents: number;
  /** Signup fees still unpaid or claimed (not yet verified/waived/rejected). */
  feesAwaitingFinance: number;
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
  const amountRaw = row["signup_fee_amount"];
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
    nextFollowUpAt: strOrNull(row["next_follow_up_at"]),
    assignedConsultantId: assigned,
    counsellorName: strOrNull(row["counsellor_name"]),
    registrarName: strOrNull(row["registrar_name"]),
    registeredBy: strOrNull(row["registered_by"]),
    journeyStage: str(row["journey_stage"]),
    portalActivatedAt: strOrNull(row["portal_activated_at"]),
    profileId: strOrNull(row["profile_id"]),
    archivedAt: strOrNull(row["archived_at"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
    signupFeeStatus: strOrNull(row["signup_fee_status"]),
    signupFeeAmount:
      typeof amountRaw === "number"
        ? amountRaw
        : amountRaw != null && amountRaw !== ""
          ? Number(amountRaw)
          : null,
    signupFeeCurrency: strOrNull(row["signup_fee_currency"]),
    signupFeeMethod: strOrNull(row["signup_fee_method"]),
    signupFeeReference: strOrNull(row["signup_fee_reference"]),
    assignmentStatus: assigned ? "assigned" : "pending",
  };
}

async function listFrontDeskIntakeRows(
  // AoDb RPC returns a thenable builder; keep loose for migration drift.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  includeArchived = false,
) {
  const { data, error } = await client.rpc("list_front_desk_intake_summaries", {
    p_include_archived: includeArchived,
  });
  if (error) {
    // Backward-compatible call if older zero-arg RPC is still deployed.
    if (/p_include_archived|function.*does not exist|Could not find/i.test(error.message)) {
      const legacy = await client.rpc("list_front_desk_intake_summaries");
      if (legacy.error) {
        if (/does not exist|function/i.test(legacy.error.message)) {
          throw new AuthError(
            "Front Desk intake RPC unavailable. Apply migration 20261020130000_front_desk_intake_manage.sql.",
            503,
          );
        }
        throw new Error(legacy.error.message);
      }
      return ((legacy.data ?? []) as Record<string, unknown>[]).map(mapIntakeRow);
    }
    if (/does not exist|function/i.test(error.message)) {
      throw new AuthError(
        "Front Desk intake RPC unavailable. Apply migration 20261020130000_front_desk_intake_manage.sql.",
        503,
      );
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapIntakeRow);
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
    const rows = await listFrontDeskIntakeRows(client, false);
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

    const feesAwaitingFinance = rows.filter((r) => {
      const s = (r.signupFeeStatus ?? "").toLowerCase();
      return s === "unpaid" || s === "claimed";
    }).length;

    return {
      greetingName,
      myRegistrations: rows.length,
      awaitingAssignment: awaiting.length,
      assignedStudents: assigned.length,
      feesAwaitingFinance,
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
    return {
      rows: await listFrontDeskIntakeRows(client, false),
      includeArchived: false as const,
    };
  } catch (error) {
    toError(error);
  }
});

/** Admin-only archived intake review. */
export const portalListFrontDeskArchivedIntake = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["admin", "super_admin"]);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Archived intake list requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      return {
        rows: await listFrontDeskIntakeRows(client, true),
        includeArchived: true as const,
      };
    } catch (error) {
      toError(error);
    }
  },
);

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

      const {
        buildServiceRoleStudentProfilePatch,
        canReuseExistingStudentProfileForLink,
        provisionPartialFailureMessage,
        STUDENT_PORTAL_BUSINESS_ROLE,
      } = await import("@/lib/student-portal-provision-rules");

      // Idempotent path: reuse an existing unlinked student login for this email.
      const { data: profileByEmail, error: profileErr } = await admin
        .from("profiles")
        .select("id, email, role, business_role")
        .ilike("email", studentEmail)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);

      let userId: string | null = null;
      let newlyCreatedAuthUserId: string | null = null;
      let reusedExistingAuth = false;

      if (profileByEmail) {
        const { data: linkedTo } = await admin
          .from("students")
          .select("id")
          .eq("profile_id", profileByEmail.id)
          .maybeSingle();
        const reuse = canReuseExistingStudentProfileForLink({
          role: profileByEmail.role,
          businessRole: profileByEmail.business_role,
          profileLinkedStudentId: linkedTo?.id ?? null,
          targetStudentId: studentId,
        });
        if (!reuse.ok) {
          throw new AuthError(
            reuse.reason === "staff_role" || reuse.reason === "staff_business_role"
              ? "That email already belongs to a staff account and cannot be used as a student login."
              : "An account with this email is already linked to another student.",
            409,
          );
        }
        userId = profileByEmail.id;
        reusedExistingAuth = true;
        // Best-effort password sync for retry after a prior partial create.
        const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
          password: data.temporaryPassword,
        });
        if (pwErr) {
          throw new AuthError(
            `${provisionPartialFailureMessage("profile")} Could not refresh the password for the existing login.`,
            409,
          );
        }
      } else {
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
            throw new AuthError(
              "An account with this email already exists. Retry after confirming the CRM email, or ask an admin to review the login.",
              409,
            );
          }
          throw new AuthError(`${provisionPartialFailureMessage("auth")} ${msg}`, 400);
        }
        userId = created.user?.id ?? null;
        if (!userId) {
          throw new AuthError("User creation did not return a user id.", 500);
        }
        newlyCreatedAuthUserId = userId;
      }

      try {
        const { data: existingProfile, error: existingErr } = await admin
          .from("profiles")
          .select("id, role, email, business_role")
          .eq("id", userId)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);

        const safePatch = buildServiceRoleStudentProfilePatch({
          email: studentEmail,
          fullName: fullName || studentEmail,
        });

        if (!existingProfile) {
          // INSERT is not subject to enforce_profile_role_guard (UPDATE-only).
          const { error: insertErr } = await admin.from("profiles").insert({
            id: userId,
            email: safePatch.email,
            full_name: safePatch.full_name,
            role: "student",
            business_role: STUDENT_PORTAL_BUSINESS_ROLE,
          });
          if (insertErr) {
            throw new AuthError(
              `${provisionPartialFailureMessage("profile")} ${insertErr.message}`,
              500,
            );
          }
        } else {
          if (existingProfile.role && existingProfile.role !== "student") {
            throw new AuthError(
              "That email already belongs to a staff account and cannot be used as a student login.",
              409,
            );
          }
          // Never UPDATE role/business_role via service role — auth.uid() is null and
          // enforce_profile_role_guard (…14030000) rejects business_role changes.
          // handle_new_user / INSERT initialize student + student_portal; staff use admin JWT.
          const { error: profileUpdateErr } = await admin
            .from("profiles")
            .update(safePatch)
            .eq("id", userId);
          if (profileUpdateErr) {
            throw new AuthError(
              `${provisionPartialFailureMessage("profile")} ${profileUpdateErr.message}`,
              500,
            );
          }
        }

        const { data: account, error: accountErr } = await admin
          .from("profiles")
          .select("id, email, role, business_role")
          .eq("id", userId)
          .maybeSingle();
        if (accountErr) throw new Error(accountErr.message);
        if (!account) {
          throw new AuthError(
            `${provisionPartialFailureMessage("profile")} Profile was not created for the new login.`,
            500,
          );
        }
        if (account.role && account.role !== "student") {
          throw new AuthError(
            "That email already belongs to a staff account and cannot be used as a student login.",
            409,
          );
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
          throw new AuthError(
            `${provisionPartialFailureMessage("link")} ${mapped.message}`,
            mapped.status,
          );
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
            metadata: {
              profileId: account.id,
              status,
              method: "password_create",
              reusedExistingAuth,
              businessRole: account.business_role ?? STUDENT_PORTAL_BUSINESS_ROLE,
            },
          });
        } catch {
          /* audit failure must not hide a successful link */
        }

        const message =
          status === "active"
            ? "Student portal account created and already active."
            : reusedExistingAuth
              ? "Existing student login was linked to this CRM record. Share the password securely. CRM access stays closed until Accounts verifies the signup fee."
              : "Student portal account created and linked. Share the password securely. The student can sign in, but CRM access stays closed until Accounts verifies the signup fee.";

        return { ok: true as const, status, message };
      } catch (inner) {
        // Narrow cleanup: only a brand-new Auth user from THIS attempt that never linked.
        // Do not delete reused accounts or profiles created by handle_new_user on prior retries.
        if (newlyCreatedAuthUserId && !reusedExistingAuth) {
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

export type UpdateFrontDeskIntakeInput = {
  studentId: string;
  expectedUpdatedAt: string;
  fullName: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  destination?: string;
  program?: string;
  studyLevel?: string;
  inquirySource?: string;
  inquiryChannel?: string | null;
  intakeDate?: string | null;
  registrationNotes?: string;
  nextFollowUpAt?: string | null;
};

export const portalUpdateFrontDeskIntake = createServerFn({ method: "POST" })
  .validator((data: UpdateFrontDeskIntakeInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrAdmin(session);

      const studentId = data.studentId?.trim();
      if (!studentId) throw new AuthError("Student id is required.", 400);
      if (!data.expectedUpdatedAt?.trim()) {
        throw new AuthError("expectedUpdatedAt is required for concurrency control.", 400);
      }

      const {
        emailChangeAllowedForIntake,
        mapFrontDeskIntakeManageRpcError,
        diffIntakeRegistrationFields,
      } = await import("@/lib/front-desk-intake-manage");
      const { isValidIntakeEmail, isValidIntakePhone } = await import("@/lib/intake-form-options");

      const fullName = data.fullName?.trim() ?? "";
      const email = data.email?.trim().toLowerCase() ?? "";
      if (!fullName) throw new AuthError("Full name is required.", 400);
      if (!isValidIntakeEmail(email)) throw new AuthError("A valid email is required.", 400);
      if (data.phone?.trim() && !isValidIntakePhone(data.phone)) {
        throw new AuthError("Enter a valid phone number.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Intake update requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const owned = await listFrontDeskIntakeRows(client, false);
      const before = owned.find((r) => r.id === studentId);
      if (!before) throw new AuthError("Student record not found.", 404);

      const emailOk = emailChangeAllowedForIntake({
        profileId: before.profileId,
        previousEmail: before.email,
        nextEmail: email,
      });
      if (!emailOk.ok) throw new AuthError(emailOk.error, 400);

      const { data: rpcRows, error: rpcErr } = await client.rpc(
        "front_desk_update_intake_registration",
        {
          p_student_id: studentId,
          p_expected_updated_at: data.expectedUpdatedAt,
          p_full_name: fullName,
          p_email: email,
          p_phone: data.phone?.trim() || null,
          p_whatsapp: data.whatsapp?.trim() || null,
          p_city: data.city?.trim() || null,
          p_destination: data.destination?.trim() || null,
          p_program: data.program?.trim() || null,
          p_study_level: data.studyLevel?.trim() || null,
          p_inquiry_source: data.inquirySource?.trim() || null,
          p_inquiry_channel: (data.inquiryChannel?.trim() || null) as never,
          p_intake_date: data.intakeDate?.trim() || null,
          p_registration_notes: data.registrationNotes?.trim() || null,
          p_next_follow_up_at: data.nextFollowUpAt?.trim() || null,
        },
      );
      if (rpcErr) {
        const mapped = mapFrontDeskIntakeManageRpcError(rpcErr.message);
        throw new AuthError(mapped.message, mapped.status);
      }
      const updated = (rpcRows as { id: string; case_id: string; updated_at: string }[] | null)?.[0];
      if (!updated) throw new AuthError("Update did not return a row.", 500);

      const afterSnapshot = {
        full_name: fullName,
        email,
        phone: data.phone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        city: data.city?.trim() || null,
        destination: data.destination?.trim() || null,
        program: data.program?.trim() || null,
        study_level: data.studyLevel?.trim() || null,
        inquiry_source: data.inquirySource?.trim() || null,
        inquiry_channel: data.inquiryChannel?.trim() || null,
        intake_date: data.intakeDate?.trim() || null,
        registration_notes: data.registrationNotes?.trim() || null,
        next_follow_up_at: data.nextFollowUpAt?.trim() || null,
      };
      const beforeSnapshot = {
        full_name: before.fullName,
        email: before.email,
        phone: before.phone,
        whatsapp: before.whatsapp,
        city: before.city,
        destination: before.destination,
        program: before.program,
        study_level: before.studyLevel,
        inquiry_source: before.inquirySource,
        inquiry_channel: before.inquiryChannel,
        intake_date: before.intakeDate,
        registration_notes: before.registrationNotes,
        next_follow_up_at: before.nextFollowUpAt,
      };
      const changes = diffIntakeRegistrationFields(beforeSnapshot, afterSnapshot);

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "student.intake_registration_updated",
          entity_type: "students",
          entity_id: studentId,
          student_id: studentId,
          metadata: { changes, caseId: before.caseId },
        });
      } catch {
        /* audit best-effort */
      }

      return {
        ok: true as const,
        studentId: updated.id,
        caseId: updated.case_id,
        updatedAt: updated.updated_at,
        message: changes.length
          ? `Registration updated (${changes.length} field${changes.length === 1 ? "" : "s"}).`
          : "Registration saved (no field changes).",
      };
    } catch (error) {
      toError(error);
    }
  });

export type ArchiveFrontDeskIntakeInput = {
  studentId: string;
  archive: boolean;
  reason?: string;
};

export const portalArchiveFrontDeskIntake = createServerFn({ method: "POST" })
  .validator((data: ArchiveFrontDeskIntakeInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrAdmin(session);

      const studentId = data.studentId?.trim();
      if (!studentId) throw new AuthError("Student id is required.", 400);

      const { validateArchiveReason, mapFrontDeskIntakeManageRpcError, canRestoreArchivedRegistration } =
        await import("@/lib/front-desk-intake-manage");
      const { rolesAtLeastAdmin } = await import("@/lib/roles");

      if (data.archive) {
        const reasonCheck = validateArchiveReason(data.reason ?? "");
        if (!reasonCheck.ok) throw new AuthError(reasonCheck.error, 400);
      } else if (
        !canRestoreArchivedRegistration({ isAdmin: rolesAtLeastAdmin(session.role) })
      ) {
        throw new AuthError("Only an administrator can restore an archived registration.", 403);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Archive requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: rpcRows, error: rpcErr } = await client.rpc("front_desk_archive_registration", {
        p_student_id: studentId,
        p_archive: Boolean(data.archive),
        p_reason: data.reason?.trim() || null,
      });
      if (rpcErr) {
        const mapped = mapFrontDeskIntakeManageRpcError(rpcErr.message);
        throw new AuthError(mapped.message, mapped.status);
      }
      const row = (rpcRows as { id: string; case_id: string; archived_at: string | null }[] | null)?.[0];
      if (!row) throw new AuthError("Archive action did not return a row.", 500);

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: data.archive ? "student.intake_registration_archived" : "student.intake_registration_restored",
          entity_type: "students",
          entity_id: studentId,
          student_id: studentId,
          metadata: {
            caseId: row.case_id,
            reason: data.archive ? data.reason?.trim() : undefined,
            archivedAt: row.archived_at,
          },
        });
      } catch {
        /* audit best-effort */
      }

      return {
        ok: true as const,
        studentId: row.id,
        caseId: row.case_id,
        archivedAt: row.archived_at,
        message: data.archive
          ? "Registration archived. Linked documents, fees, and portal accounts are retained."
          : "Registration restored to the active intake list.",
      };
    } catch (error) {
      toError(error);
    }
  });

export type FeeVerificationRequestRow = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  counsellorName: string | null;
  summary: string;
  status: string;
  signupFeeStatus: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  feePaymentMethod: string | null;
  feeReferenceReceipt: string | null;
  feeVerifiedAt: string | null;
  requestedBy: string | null;
  registrarId: string | null;
  coordinatorNote: string | null;
  forwardedAt: string | null;
  forwardedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeeVerificationQueuePayload = {
  rows: FeeVerificationRequestRow[];
  openCount: number;
  awaitingFinanceCount: number;
  needsCorrectionCount: number;
  completedCount: number;
  schemaReady: boolean;
  fetchedAt: string;
  includeResolved: boolean;
};

function mapFeeVerificationRow(r: Record<string, unknown>): FeeVerificationRequestRow {
  const amountRaw = r["fee_amount"];
  const feeAmount =
    typeof amountRaw === "number"
      ? amountRaw
      : amountRaw != null && amountRaw !== ""
        ? Number(amountRaw)
        : null;
  return {
    id: str(r["id"]),
    studentId: str(r["student_id"]),
    caseId: str(r["case_id"]),
    fullName: str(r["full_name"]),
    counsellorName: strOrNull(r["counsellor_name"]),
    summary: str(r["summary"]),
    status: str(r["status"]),
    signupFeeStatus: strOrNull(r["signup_fee_status"]),
    feeAmount: feeAmount != null && !Number.isNaN(feeAmount) ? feeAmount : null,
    feeCurrency: strOrNull(r["fee_currency"]),
    feePaymentMethod: strOrNull(r["fee_payment_method"]),
    feeReferenceReceipt: strOrNull(r["fee_reference_receipt"]),
    feeVerifiedAt: strOrNull(r["fee_verified_at"]),
    requestedBy: strOrNull(r["requested_by"]),
    registrarId: strOrNull(r["registrar_id"]),
    coordinatorNote: strOrNull(r["coordinator_note"]),
    forwardedAt: strOrNull(r["forwarded_at"]),
    forwardedBy: strOrNull(r["forwarded_by"]),
    resolvedAt: strOrNull(r["resolved_at"]),
    resolvedBy: strOrNull(r["resolved_by"]),
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
  };
}

function logFeeQueueDiag(event: string, meta: Record<string, string | number | boolean | null>) {
  // Structured, non-sensitive diagnostics for production triage.
  console.info(JSON.stringify({ scope: "fee_verification_queue", event, ...meta }));
}

/** Front Desk / Accounts / Admin queue of counsellor fee-verification requests. */
export const portalListFeeVerificationRequests = createServerFn({ method: "GET" })
  .validator((data?: { includeResolved?: boolean }) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      // Front Desk coordinates; Accounts may list (SQL can_verify_signup_fee) to act on forwards.
      assertFrontDeskOrFeeVerifierOrAdmin(session);

      const includeResolved = Boolean(data?.includeResolved);
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Fee verification queue requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      // Schema probe — never treat missing table as an empty queue.
      const probe = await client
        .from("counselling_fee_verification_requests")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (probe.error) {
        if (/does not exist|relation|PGRST205|42P01/i.test(probe.error.message)) {
          logFeeQueueDiag("schema_missing", {
            userId: session.userId ?? null,
            message: "table_missing",
          });
          throw new AuthError(
            "Fee verification requests are not installed on this database. Apply migrations 20261020150000, 20261020160000, and 20261020170000.",
            503,
          );
        }
        logFeeQueueDiag("probe_error", {
          userId: session.userId ?? null,
          code: "probe_failed",
        });
        throw new Error(probe.error.message);
      }

      const { data: rpcData, error } = await client.rpc("list_counselling_fee_verification_requests", {
        p_include_resolved: includeResolved,
      });
      if (error) {
        if (/does not exist|function|PGRST202/i.test(error.message)) {
          logFeeQueueDiag("rpc_missing", {
            userId: session.userId ?? null,
            message: "list_rpc_missing",
          });
          throw new AuthError(
            "Fee verification list RPC unavailable. Apply migration 20261020170000_fee_verification_fd_org_queue.sql.",
            503,
          );
        }
        logFeeQueueDiag("rpc_error", { userId: session.userId ?? null, message: "list_rpc_failed" });
        throw new Error(error.message);
      }

      const { normalizeRpcRowList } = await import("@/lib/fee-verification-workflow");
      const rows = normalizeRpcRowList(rpcData).map(mapFeeVerificationRow);
      const openCount = rows.filter((r) => r.status === "open").length;
      const awaitingFinanceCount = rows.filter((r) => r.status === "in_progress").length;
      const needsCorrectionCount = rows.filter((r) => r.status === "cancelled").length;
      const completedCount = rows.filter((r) => r.status === "resolved").length;

      logFeeQueueDiag("list_ok", {
        userId: session.userId ?? null,
        rowCount: rows.length,
        openCount,
        awaitingFinanceCount,
        includeResolved,
        probeCount: probe.count ?? 0,
      });

      // Detect filter/visibility skew: table has open rows but list returned none.
      if (!includeResolved && rows.length === 0 && (probe.count ?? 0) > 0) {
        logFeeQueueDiag("visibility_skew", {
          userId: session.userId ?? null,
          probeCount: probe.count ?? 0,
          rowCount: 0,
        });
      }

      return {
        rows,
        openCount,
        awaitingFinanceCount,
        needsCorrectionCount,
        completedCount,
        schemaReady: true,
        fetchedAt: new Date().toISOString(),
        includeResolved,
      } satisfies FeeVerificationQueuePayload;
    } catch (error) {
      toError(error);
    }
  });

export const portalForwardFeeVerificationRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; note?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrAdmin(session);

      const requestId = data.requestId?.trim();
      if (!requestId) throw new AuthError("Request id is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Forwarding requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client.rpc("forward_counselling_fee_verification", {
        p_request_id: requestId,
        p_note: data.note?.trim() || null,
      });
      if (error) {
        if (/does not exist|function|PGRST202/i.test(error.message)) {
          throw new AuthError(
            "Forward action unavailable. Apply migration 20261020170000_fee_verification_fd_org_queue.sql.",
            503,
          );
        }
        throw new AuthError(error.message, 400);
      }
      const created = Array.isArray(row) ? row[0] : row;
      if (!created?.id) throw new AuthError("Forward failed.", 500);

      // Notify Accounts / Finance desks (durable).
      try {
        const { data: financeProfiles } = await client
          .from("profiles")
          .select("id")
          .eq("business_role", "accounts_banking_finance")
          .limit(25);
        const studentId = created.student_id as string;
        const body = "Front Desk forwarded a signup-fee verification request for Accounts review.";
        if (financeProfiles?.length) {
          await client.from("notifications").insert(
            financeProfiles.map((p) => ({
              user_id: p.id,
              title: "Fee verification forwarded",
              body,
              link_path: "/staff/finance",
              student_id: studentId,
            })),
          );
        }
      } catch {
        /* best-effort */
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "student.fee_verification_forwarded",
          entity_type: "counselling_fee_verification_requests",
          entity_id: created.id,
          student_id: created.student_id,
          metadata: { status: created.status },
        });
      } catch {
        /* best-effort */
      }

      logFeeQueueDiag("forward_ok", {
        userId: session.userId ?? null,
        requestId: created.id,
      });

      return {
        ok: true as const,
        requestId: created.id as string,
        status: String(created.status),
        forwardedAt: (created.forwarded_at as string | null) ?? null,
        message: "Request forwarded to Accounts / Finance.",
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * Close stuck open/in_progress counselling requests when signup fee is already
 * verified/waived/rejected. Never invents a fee verification.
 */
export const portalReconcileFeeVerificationFromFee = createServerFn({ method: "POST" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrFeeVerifierOrAdmin(session);

      const studentId = data.studentId?.trim();
      if (!studentId) throw new AuthError("Student id is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Reconcile requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { mapVerifySignupFeeRpcError } = await import("@/lib/signup-fee-gate");

      const { data: rpcRows, error } = await client.rpc(
        "reconcile_counselling_fee_request_from_fee",
        { p_student_id: studentId },
      );
      if (error) {
        if (/does not exist|function|PGRST202/i.test(error.message)) {
          throw new AuthError(
            "Reconcile unavailable. Apply migration 20261020180000_verify_signup_fee_resolve_counselling_request.sql.",
            503,
          );
        }
        const mapped = mapVerifySignupFeeRpcError(error.message);
        throw new AuthError(mapped.message, mapped.status);
      }

      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      const requestsResolved =
        row && typeof row === "object" && "requests_resolved" in row
          ? Number((row as { requests_resolved: number }).requests_resolved ?? 0)
          : 0;
      const feeStatus =
        row && typeof row === "object" && "fee_status" in row
          ? String((row as { fee_status: string }).fee_status)
          : null;

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "student.fee_verification_reconciled",
          entity_type: "counselling_fee_verification_requests",
          entity_id: studentId,
          student_id: studentId,
          metadata: { feeStatus, requestsResolved, via: "reconcile_counselling_fee_request_from_fee" },
        });
      } catch {
        /* best-effort */
      }

      logFeeQueueDiag("reconcile_ok", {
        userId: session.userId ?? null,
        studentId,
        requestsResolved,
      });

      return {
        ok: true as const,
        studentId,
        feeStatus,
        requestsResolved,
        message:
          requestsResolved > 0
            ? `Closed ${requestsResolved} request(s) from fee status ${feeStatus}.`
            : `No open requests to close. Fee status is ${feeStatus ?? "unknown"}.`,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalReturnFeeVerificationRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; reason: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertFrontDeskOrAdmin(session);

      const requestId = data.requestId?.trim();
      const reason = data.reason?.trim() ?? "";
      if (!requestId) throw new AuthError("Request id is required.", 400);
      if (reason.length < 5) throw new AuthError("A return reason is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Return action requires the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client.rpc("return_counselling_fee_verification", {
        p_request_id: requestId,
        p_reason: reason,
      });
      if (error) {
        if (/does not exist|function|PGRST202/i.test(error.message)) {
          throw new AuthError(
            "Return action unavailable. Apply migration 20261020170000_fee_verification_fd_org_queue.sql.",
            503,
          );
        }
        throw new AuthError(error.message, 400);
      }
      const updated = Array.isArray(row) ? row[0] : row;
      if (!updated?.id) throw new AuthError("Return failed.", 500);

      try {
        const counsellorId = updated.requested_by as string | null;
        if (counsellorId) {
          await client.from("notifications").insert({
            user_id: counsellorId,
            title: "Fee verification returned",
            body: `Front Desk returned a fee-verification request: ${reason.slice(0, 180)}`,
            link_path: "/staff/students",
            student_id: updated.student_id,
          });
        }
      } catch {
        /* best-effort */
      }

      logFeeQueueDiag("return_ok", {
        userId: session.userId ?? null,
        requestId: updated.id,
      });

      return {
        ok: true as const,
        requestId: updated.id as string,
        status: String(updated.status),
        message: "Request returned to the counsellor.",
      };
    } catch (error) {
      toError(error);
    }
  });
