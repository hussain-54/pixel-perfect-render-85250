/**
 * Admin employee/account management — server-only Auth Admin API.
 * Never expose the service-role key to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  requireAdminSupabase,
  isAdminSupabaseConfigured,
  adminConfigErrorMessage,
} from "@/server/supabase-admin";
import {
  ACCOUNT_PROVISIONING_OPTIONS,
  appRoleForBusinessRole,
  assertRolePair,
  getProvisioningOption,
  isValidPersonName,
  isValidWorkEmail,
  normalizeWorkEmail,
  validateAccountRoleUpdate,
  type AccountListItem,
} from "@/lib/account-provisioning";
import {
  authBanDurationForRemoveAccess,
  validateAccountAccessAction,
  type AccountLinkCounts,
} from "@/lib/account-access-rules";
import { passwordRecoveryRedirectUrl, resolveAuthAppOrigin } from "@/lib/auth-redirects";
import { validatePasswordConfirmation } from "@/lib/password-policy";
import type { BusinessRole } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Account operation failed.");
}

function resolveAppOrigin(): string {
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
  return resolveAuthAppOrigin({
    envOrigin: fromEnv,
    requestOrigin,
    isProduction,
  });
}

function recoveryRedirectTo(): string {
  return passwordRecoveryRedirectUrl(resolveAppOrigin());
}

/** Only real Supabase admin sessions may manage accounts — never demo. */
async function requireAdminAccountManager(): Promise<TrustedSession> {
  const session = await requireTrustedSession();
  requireRoles(session, ["admin", "super_admin"]);
  if (session.source !== "supabase" || !session.userId) {
    throw new AuthError("Account management requires a live admin session.", 403);
  }
  if (!rolesAtLeastAdmin(session.role)) {
    throw new AuthError("Only an authorized admin may manage accounts.", 403);
  }
  if (!isAdminSupabaseConfigured()) {
    // Missing server env (typical: Vercel Production var not set or not redeployed).
    throw new AuthError(adminConfigErrorMessage(), 503);
  }
  return session;
}

export type CreateAccountInput = {
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  businessRole: BusinessRole;
  temporaryPassword: string;
  confirmPassword: string;
};

export type SetTemporaryPasswordInput = {
  userId: string;
  temporaryPassword: string;
  confirmPassword: string;
};

export type UpdateAccountBusinessRoleInput = {
  userId: string;
  businessRole: BusinessRole;
};

export const portalListAccountOptions = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireAdminAccountManager();
    return {
      ok: true as const,
      options: ACCOUNT_PROVISIONING_OPTIONS.map((o) => ({
        id: o.id,
        label: o.label,
        appRole: o.appRole,
        businessRole: o.businessRole,
        needsConsultantDesk: o.needsConsultantDesk,
        departmentSuggested: o.departmentSuggested ?? "",
      })),
      configured: isAdminSupabaseConfigured(),
    };
  } catch (error) {
    toError(error);
  }
});

export const portalListAccounts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireAdminAccountManager();
    const admin = requireAdminSupabase();

    const { data: profiles, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, full_name, phone, role, business_role, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (profileErr) throw new Error(profileErr.message);

    const { data: desks, error: deskErr } = await admin
      .from("consultants")
      .select("id, department, status, job_title");
    if (deskErr) throw new Error(deskErr.message);
    const deskById = new Map((desks ?? []).map((d) => [d.id, d]));

    // Auth metadata (last sign-in) — paginate lightly; never return tokens.
    const authById = new Map<
      string,
      { lastSignInAt: string | null; invited: boolean; banned: boolean }
    >();
    try {
      const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (!authErr && authData?.users) {
        for (const u of authData.users) {
          authById.set(u.id, {
            lastSignInAt: u.last_sign_in_at ?? null,
            invited: !u.last_sign_in_at && Boolean(u.invited_at || u.confirmation_sent_at),
            banned: Boolean((u as { banned_until?: string | null }).banned_until),
          });
        }
      }
    } catch {
      /* Auth admin list optional for display */
    }

    const accounts: AccountListItem[] = (profiles ?? []).map((p) => {
      const desk = deskById.get(p.id);
      const authMeta = authById.get(p.id);
      const appRole = (p.role as AppRole) || "student";
      let deskStatus: AccountListItem["deskStatus"] = "n/a";
      if (desk) {
        deskStatus = desk.status === "inactive" ? "inactive" : "active";
      } else if (appRole === "consultant") {
        deskStatus = "inactive";
      }
      if (authMeta?.banned) deskStatus = "inactive";

      return {
        id: p.id,
        email: (p.email ?? "").toLowerCase(),
        fullName: p.full_name || "",
        phone: p.phone,
        appRole,
        businessRole: p.business_role,
        department: desk?.department ?? null,
        deskStatus,
        createdAt: p.created_at ?? null,
        lastSignInAt: authMeta?.lastSignInAt ?? null,
        invited: authMeta?.invited ?? false,
      };
    });

    return {
      ok: true as const,
      accounts,
      configured: true,
      viewerEmail: session.email,
      viewerUserId: session.userId,
    };
  } catch (error) {
    toError(error);
  }
});

export const portalCreateAccount = createServerFn({ method: "POST" })
  .validator((data: CreateAccountInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      const fullName = data.fullName.trim();
      const email = normalizeWorkEmail(data.email);
      const phone = data.phone?.trim() || "";
      const department = data.department?.trim() || "";
      const businessRole = data.businessRole;

      if (!isValidPersonName(fullName)) {
        throw new AuthError("Enter the person's full name.", 400);
      }
      if (!isValidWorkEmail(email)) {
        throw new AuthError("Enter a valid work email address.", 400);
      }

      const passwordCheck = validatePasswordConfirmation(
        data.temporaryPassword,
        data.confirmPassword,
      );
      if (!passwordCheck.ok) throw new AuthError(passwordCheck.error, 400);

      const option = getProvisioningOption(businessRole);
      if (!option) throw new AuthError("Unsupported business role.", 400);
      const appRole = appRoleForBusinessRole(businessRole);
      assertRolePair(appRole, businessRole);

      // Never allow routine creation of super_admin; prevent self-service escalation tricks.
      if (appRole === "super_admin") {
        throw new AuthError("super_admin cannot be assigned through this form.", 403);
      }

      const admin = requireAdminSupabase();

      // Direct Auth Admin create — no invitation email / invite link.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: data.temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          ...(phone ? { phone } : {}),
        },
        app_metadata: {
          role: appRole,
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

      // Role / business_role / desk writes must use the admin's JWT so
      // profiles_role_guard and admin_set_user_role see auth.uid() as admin.
      // Service-role UPDATEs that change profiles.role fail the guard (auth.uid() null).
      const { requireAoSupabaseClient } = await import("@/server/ao-data");
      const userClient = requireAoSupabaseClient();
      const { adminSetUserRole, writeAudit } = await import("@/services/db");

      // Ensure profile exists (handle_new_user usually inserts student default).
      const { data: existingProfile, error: existingErr } = await admin
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);

      if (!existingProfile) {
        const { error: insertErr } = await admin.from("profiles").insert({
          id: userId,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "student",
          business_role: null,
        });
        if (insertErr) {
          throw new AuthError(`User created but profile insert failed: ${insertErr.message}.`, 500);
        }
      }

      if (appRole !== "student") {
        try {
          await adminSetUserRole(userClient, userId, appRole);
        } catch (roleErr) {
          const message = roleErr instanceof Error ? roleErr.message : "Role assignment failed.";
          throw new AuthError(`User created but role assignment failed: ${message}`, 500);
        }
      }

      const { error: profileErr } = await userClient
        .from("profiles")
        .update({
          email,
          full_name: fullName,
          phone: phone || null,
          business_role: businessRole,
        })
        .eq("id", userId);
      if (profileErr) {
        throw new AuthError(`User created but profile update failed: ${profileErr.message}.`, 500);
      }

      if (option.needsConsultantDesk) {
        const { error: deskErr } = await userClient.from("consultants").upsert(
          {
            id: userId,
            status: "active",
            department: department || option.departmentSuggested || null,
            job_title: option.label,
          },
          { onConflict: "id" },
        );
        if (deskErr) {
          throw new AuthError(`User created but consultant desk failed: ${deskErr.message}.`, 500);
        }
      }

      try {
        await writeAudit(userClient, {
          action: "account.created",
          entity_type: "profiles",
          entity_id: userId,
          metadata: {
            email,
            appRole,
            businessRole,
            createdBy: session.userId,
          },
        });
      } catch {
        /* audit failure should not hide create success */
      }

      return {
        ok: true as const,
        account: {
          id: userId,
          email,
          fullName,
          appRole,
          businessRole,
          invited: false,
        },
        message:
          "Account created. Share the temporary password through your secure channel. The employee can sign in immediately and may change their password from the portal when they choose.",
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * Reassign business role (+ derived app role) on an existing profile.
 * Does not create Auth users or duplicate profiles.
 */
export const portalUpdateAccountBusinessRole = createServerFn({ method: "POST" })
  .validator((data: UpdateAccountBusinessRoleInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      const userId = data.userId?.trim();
      if (!userId) throw new AuthError("Account id is required.", 400);

      const admin = requireAdminSupabase();
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, email, role, business_role")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new AuthError("Account not found.", 404);

      const { count, error: countErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["admin", "super_admin"]);
      if (countErr) throw new Error(countErr.message);

      const validated = validateAccountRoleUpdate({
        targetAppRole: profile.role || "student",
        nextBusinessRole: data.businessRole,
        isSelf: userId === session.userId,
        protectedAdminCount: count ?? 0,
      });
      if (!validated.ok) throw new AuthError(validated.error, validated.status);

      const { appRole, businessRole, needsConsultantDesk, option } = validated;

      // No-op when already on this pair — avoid duplicate desk/role writes.
      if (profile.role === appRole && profile.business_role === businessRole) {
        return {
          ok: true as const,
          account: {
            id: profile.id,
            email: profile.email,
            appRole,
            businessRole,
          },
          message: "Account already has this business role.",
        };
      }

      const { requireAoSupabaseClient } = await import("@/server/ao-data");
      const userClient = requireAoSupabaseClient();
      const { adminSetUserRole, writeAudit } = await import("@/services/db");

      if (profile.role !== appRole) {
        try {
          await adminSetUserRole(userClient, userId, appRole);
        } catch (roleErr) {
          const message = roleErr instanceof Error ? roleErr.message : "Role assignment failed.";
          throw new AuthError(`Role update failed: ${message}`, 500);
        }
      }

      const { error: bizErr } = await userClient
        .from("profiles")
        .update({ business_role: businessRole })
        .eq("id", userId);
      if (bizErr) {
        throw new AuthError(`Business role update failed: ${bizErr.message}`, 500);
      }

      if (needsConsultantDesk) {
        const { error: deskErr } = await userClient.from("consultants").upsert(
          {
            id: userId,
            status: "active",
            job_title: option.label,
          },
          { onConflict: "id" },
        );
        if (deskErr) {
          throw new AuthError(`Role updated but consultant desk failed: ${deskErr.message}`, 500);
        }
      }

      try {
        await writeAudit(userClient, {
          action: "account.role_updated",
          entity_type: "profiles",
          entity_id: userId,
          metadata: {
            email: profile.email,
            previousAppRole: profile.role,
            previousBusinessRole: profile.business_role,
            appRole,
            businessRole,
            by: session.userId,
          },
        });
      } catch {
        /* audit failure should not hide success */
      }

      return {
        ok: true as const,
        account: {
          id: profile.id,
          email: profile.email,
          appRole,
          businessRole,
        },
        message: `Updated to ${option.label} (${appRole}).`,
      };
    } catch (error) {
      toError(error);
    }
  });

/** Admin provisions a new temporary password (never returns the password). */
export const portalSetTemporaryPassword = createServerFn({ method: "POST" })
  .validator((data: SetTemporaryPasswordInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      if (!data.userId?.trim()) throw new AuthError("Account id is required.", 400);

      const passwordCheck = validatePasswordConfirmation(
        data.temporaryPassword,
        data.confirmPassword,
      );
      if (!passwordCheck.ok) throw new AuthError(passwordCheck.error, 400);

      const admin = requireAdminSupabase();
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, email")
        .eq("id", data.userId.trim())
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile?.email) throw new AuthError("Account not found.", 404);

      // Auth Admin password rotation revokes existing sessions by design.
      // Employee must sign in again with the new temporary password.
      const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, {
        password: data.temporaryPassword,
      });
      if (updateErr) {
        throw new AuthError(updateErr.message || "Could not set temporary password.", 400);
      }

      try {
        await admin.auth.admin.signOut(profile.id, "global");
      } catch {
        /* best-effort revoke after temp password rotation */
      }

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "account.temporary_password_set",
          entity_type: "profiles",
          entity_id: profile.id,
          metadata: { email: profile.email, by: session.userId },
        });
      } catch {
        /* ignore audit failures */
      }

      return {
        ok: true as const,
        message:
          "Temporary password set. Share it securely with the employee; existing sessions were revoked so they must sign in again. The password is not stored or shown here.",
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalResendPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      await requireAdminAccountManager();
      if (!data.userId?.trim()) throw new AuthError("Account id is required.", 400);
      const admin = requireAdminSupabase();
      const { data: profile, error } = await admin
        .from("profiles")
        .select("id, email")
        .eq("id", data.userId.trim())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!profile?.email) throw new AuthError("Account not found.", 404);

      const redirectTo = recoveryRedirectTo();
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(profile.email, {
        redirectTo,
      });
      if (resetErr) throw new AuthError(resetErr.message, 400);

      return {
        ok: true as const,
        message: "Password reset email sent. The link opens the production reset page.",
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSetConsultantDeskStatus = createServerFn({ method: "POST" })
  .validator((data: { userId: string; status: "active" | "inactive" }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      if (!data.userId?.trim()) throw new AuthError("Account id is required.", 400);
      if (data.status !== "active" && data.status !== "inactive") {
        throw new AuthError("Invalid desk status.", 400);
      }

      // Prevent self-lockout of admin desk management via this path.
      if (data.userId === session.userId && data.status === "inactive") {
        throw new AuthError("You cannot deactivate your own account.", 403);
      }

      const admin = requireAdminSupabase();
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, role, email")
        .eq("id", data.userId.trim())
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new AuthError("Account not found.", 404);

      if (profile.role === "student") {
        throw new AuthError(
          "Student accounts have no consultant desk status. Use password reset or revoke sessions for student access changes.",
          400,
        );
      }

      // Last protected technical admin cannot be deactivated (ban path).
      if (
        data.status === "inactive" &&
        (profile.role === "admin" || profile.role === "super_admin")
      ) {
        const { wouldRemoveLastProtectedAdmin } = await import("@/lib/business-permissions");
        const { count, error: countErr } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["admin", "super_admin"]);
        if (countErr) throw new Error(countErr.message);
        const guard = wouldRemoveLastProtectedAdmin({
          protectedAdminCount: count ?? 0,
          targetIsProtectedAdmin: true,
          nextIsProtectedAdmin: false,
        });
        if (!guard.ok) throw new AuthError(guard.error, 403);
      }

      const { error: deskErr } = await admin.from("consultants").upsert(
        {
          id: profile.id,
          status: data.status,
        },
        { onConflict: "id" },
      );
      if (deskErr) throw new Error(deskErr.message);

      // Ban / unban Auth user so deactivated staff cannot keep using an existing JWT.
      const { error: banErr } = await admin.auth.admin.updateUserById(profile.id, {
        ban_duration: data.status === "inactive" ? "876600h" : "none",
      });
      if (banErr) {
        throw new AuthError(
          `Desk updated but Auth ban failed: ${banErr.message}. Fix Auth access in Dashboard.`,
          500,
        );
      }

      if (data.status === "inactive") {
        try {
          await admin.auth.admin.signOut(profile.id, "global");
        } catch {
          /* sign-out best-effort after ban */
        }
      }

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: data.status === "active" ? "account.reactivated" : "account.deactivated",
          entity_type: "consultants",
          entity_id: profile.id,
          metadata: { email: profile.email, by: session.userId },
        });
      } catch {
        /* ignore */
      }

      return {
        ok: true as const,
        status: data.status,
        message:
          data.status === "active"
            ? "Account reactivated (desk + Auth access)."
            : "Account deactivated and sessions revoked.",
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalRevokeAccountSessions = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      if (!data.userId?.trim()) throw new AuthError("Account id is required.", 400);
      if (data.userId.trim() === session.userId) {
        throw new AuthError("You cannot revoke your own sessions from this screen.", 403);
      }

      const admin = requireAdminSupabase();
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, email")
        .eq("id", data.userId.trim())
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new AuthError("Account not found.", 404);

      const { error } = await admin.auth.admin.signOut(profile.id, "global");
      if (error) throw new AuthError(error.message || "Could not revoke sessions.", 400);

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "account.sessions_revoked",
          entity_type: "profiles",
          entity_id: profile.id,
          metadata: { email: profile.email, by: session.userId },
        });
      } catch {
        /* ignore */
      }

      return { ok: true as const, message: "Active sessions revoked for this account." };
    } catch (error) {
      toError(error);
    }
  });

async function countProtectedAdmins(
  admin: ReturnType<typeof requireAdminSupabase>,
): Promise<number> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "super_admin"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadAccountLinkCounts(
  admin: ReturnType<typeof requireAdminSupabase>,
  userId: string,
): Promise<AccountLinkCounts> {
  // Use only columns present in Database typings (avoid untyped migration-only fields).
  const [linkedStudent, assigned, apps, docs, audits] = await Promise.all([
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("assigned_consultant_id", userId),
    admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("owned_by_consultant_id", userId),
    admin
      .from("document_versions")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", userId),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", userId),
  ]);
  for (const r of [linkedStudent, assigned, apps, docs, audits]) {
    if (r.error) {
      // Table may be absent in partial envs — fail closed for delete decisions.
      throw new Error(r.error.message);
    }
  }
  return {
    linkedStudentProfiles: linkedStudent.count ?? 0,
    assignedStudents: assigned.count ?? 0,
    applicationsOwned: apps.count ?? 0,
    documentVersionsUploaded: docs.count ?? 0,
    auditEventsAsActor: audits.count ?? 0,
  };
}

function requireActorUserId(session: TrustedSession): string {
  const id = session.userId?.trim();
  if (!id) throw new AuthError("Administrator session is required.", 403);
  return id;
}

/**
 * Remove Access — ban Auth identity, revoke sessions, deactivate consultant desk.
 * Preserves profiles and all business/audit rows. Distinct from desk-only Deactivate.
 */
export const portalRemoveAccountAccess = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      const targetId = data.userId?.trim() ?? "";
      const admin = requireAdminSupabase();

      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, role, email, full_name")
        .eq("id", targetId)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new AuthError("Account not found.", 404);

      const actorUserId = requireActorUserId(session);
      const protectedAdminCount = await countProtectedAdmins(admin);
      const guard = validateAccountAccessAction({
        action: "remove_access",
        actorUserId,
        targetUserId: profile.id,
        targetAppRole: profile.role ?? "student",
        protectedAdminCount,
      });
      if (!guard.ok) throw new AuthError(guard.error, guard.status);

      // Desk inactive when a consultants row exists or target is staff/admin (upsert).
      if (profile.role !== "student") {
        const { error: deskErr } = await admin.from("consultants").upsert(
          {
            id: profile.id,
            status: "inactive",
          },
          { onConflict: "id" },
        );
        if (deskErr) throw new Error(deskErr.message);
      }

      const { error: banErr } = await admin.auth.admin.updateUserById(profile.id, {
        ban_duration: authBanDurationForRemoveAccess(),
      });
      if (banErr) {
        throw new AuthError(
          `Could not ban Auth access: ${banErr.message}. Desk may already be inactive — fix Auth in Dashboard.`,
          500,
        );
      }

      let sessionsRevoked = true;
      try {
        const { error: signOutErr } = await admin.auth.admin.signOut(profile.id, "global");
        if (signOutErr) sessionsRevoked = false;
      } catch {
        sessionsRevoked = false;
      }

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "account.access_removed",
          entity_type: "profiles",
          entity_id: profile.id,
          metadata: {
            email: profile.email,
            fullName: profile.full_name,
            targetRole: profile.role,
            sessionsRevoked,
            by: actorUserId,
          },
        });
      } catch {
        /* audit best-effort */
      }

      return {
        ok: true as const,
        state: "access_removed" as const,
        sessionsRevoked,
        message: sessionsRevoked
          ? "Access removed: Auth banned, sessions revoked, and desk deactivated. Business records preserved."
          : "Access removed: Auth banned and desk deactivated. Session revoke was best-effort — ask the user to sign out if needed.",
      };
    } catch (error) {
      toError(error);
    }
  });

/**
 * Delete User — Auth Admin deleteUser after FK-safe preflight.
 * Blocks self, last admin, and logins linked to student CRM.
 * Never exposes service-role to the browser.
 */
export const portalDeleteAccount = createServerFn({ method: "POST" })
  .validator((data: { userId: string; confirmEmail: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminAccountManager();
      const targetId = data.userId?.trim() ?? "";
      const confirmEmail = (data.confirmEmail ?? "").trim().toLowerCase();
      const admin = requireAdminSupabase();

      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, role, email, full_name")
        .eq("id", targetId)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new AuthError("Account not found.", 404);

      if (!confirmEmail || confirmEmail !== (profile.email ?? "").toLowerCase()) {
        throw new AuthError(
          "Confirmation email does not match this account. Type the exact email to delete.",
          400,
        );
      }

      const actorUserId = requireActorUserId(session);
      const protectedAdminCount = await countProtectedAdmins(admin);
      let links: AccountLinkCounts;
      try {
        links = await loadAccountLinkCounts(admin, profile.id);
      } catch (e) {
        throw new AuthError(
          e instanceof Error
            ? `Could not inspect linked business data: ${e.message}`
            : "Could not inspect linked business data.",
          500,
        );
      }

      const guard = validateAccountAccessAction({
        action: "delete_user",
        actorUserId,
        targetUserId: profile.id,
        targetAppRole: profile.role ?? "student",
        protectedAdminCount,
        links,
      });
      if (!guard.ok) throw new AuthError(guard.error, guard.status);

      // Audit BEFORE Auth delete so actor/profile still exist for RLS write paths.
      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "account.delete_attempted",
          entity_type: "profiles",
          entity_id: profile.id,
          metadata: {
            email: profile.email,
            fullName: profile.full_name,
            targetRole: profile.role,
            links,
            by: actorUserId,
            strategy: guard.strategy,
          },
        });
      } catch {
        /* continue — deletion still allowed; outcome audit may also fail */
      }

      // Ban + revoke first so partial failure still locks the account.
      let banned = false;
      let sessionsRevoked = false;
      try {
        const { error: banErr } = await admin.auth.admin.updateUserById(profile.id, {
          ban_duration: authBanDurationForRemoveAccess(),
        });
        banned = !banErr;
      } catch {
        banned = false;
      }
      try {
        const { error: signOutErr } = await admin.auth.admin.signOut(profile.id, "global");
        sessionsRevoked = !signOutErr;
      } catch {
        sessionsRevoked = false;
      }
      if (profile.role !== "student") {
        try {
          await admin.from("consultants").upsert(
            { id: profile.id, status: "inactive" },
            { onConflict: "id" },
          );
        } catch {
          /* best-effort */
        }
      }

      const { error: deleteErr } = await admin.auth.admin.deleteUser(profile.id);
      if (deleteErr) {
        try {
          const { requireAoSupabaseClient } = await import("@/server/ao-data");
          const userClient = requireAoSupabaseClient();
          const { writeAudit } = await import("@/services/db");
          await writeAudit(userClient, {
            action: "account.delete_failed",
            entity_type: "profiles",
            entity_id: profile.id,
            metadata: {
              email: profile.email,
              by: actorUserId,
              banned,
              sessionsRevoked,
              error: deleteErr.message,
            },
          });
        } catch {
          /* ignore */
        }
        throw new AuthError(
          banned
            ? `Auth delete failed after access was removed (${deleteErr.message}). Account state: access revoked (banned); profile still exists.`
            : `Could not delete Auth user: ${deleteErr.message}`,
          500,
        );
      }

      try {
        const { requireAoSupabaseClient } = await import("@/server/ao-data");
        const userClient = requireAoSupabaseClient();
        const { writeAudit } = await import("@/services/db");
        await writeAudit(userClient, {
          action: "account.deleted",
          entity_type: "profiles",
          entity_id: profile.id,
          metadata: {
            email: profile.email,
            fullName: profile.full_name,
            by: actorUserId,
            links,
            note: "Auth identity and profile removed; student/business rows preserved via SET NULL FKs.",
          },
        });
      } catch {
        /* profile may already be gone — audit via admin JWT may fail; attempt already logged */
      }

      return {
        ok: true as const,
        state: "deleted" as const,
        message: `Deleted Auth identity for ${profile.email}. Profile removed; student CRM, applications, fees, documents, and audit history were not cascade-deleted.`,
        links,
      };
    } catch (error) {
      toError(error);
    }
  });
