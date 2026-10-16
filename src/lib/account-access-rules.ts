/**
 * Pure guards for Remove Access / Delete User account actions.
 * Server handlers enforce these before Auth Admin / desk mutations.
 */
import {
  isProtectedTechnicalAdmin,
  wouldRemoveLastProtectedAdmin,
} from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";

export type AccountAccessAction = "remove_access" | "delete_user";

export type AccountLinkCounts = {
  /** students.profile_id = target — student CRM linked to this login */
  linkedStudentProfiles: number;
  /** Attribution / ownership counts (SET NULL on profile delete — informational) */
  assignedStudents: number;
  applicationsOwned: number;
  documentVersionsUploaded: number;
  auditEventsAsActor: number;
};

export type AccountAccessGuardInput = {
  action: AccountAccessAction;
  actorUserId: string;
  targetUserId: string;
  targetAppRole: AppRole | string;
  /** Count of profiles with role admin|super_admin (before this action). */
  protectedAdminCount: number;
  /** Required for delete_user; ignored for remove_access. */
  links?: AccountLinkCounts;
};

export type AccountAccessGuardResult =
  | { ok: true; strategy: "revoke_access" | "hard_delete_auth" }
  | { ok: false; error: string; status: number; code: string };

const BAN_DURATION_LONG = "876600h"; // ~100 years — matches desk deactivate path

export function authBanDurationForRemoveAccess(): string {
  return BAN_DURATION_LONG;
}

export function validateAccountAccessAction(
  input: AccountAccessGuardInput,
): AccountAccessGuardResult {
  const targetId = input.targetUserId?.trim() ?? "";
  const actorId = input.actorUserId?.trim() ?? "";
  if (!targetId) {
    return { ok: false, error: "Account id is required.", status: 400, code: "missing_target" };
  }
  if (!actorId) {
    return { ok: false, error: "Administrator session is required.", status: 403, code: "no_actor" };
  }

  if (targetId === actorId) {
    return {
      ok: false,
      error:
        input.action === "delete_user"
          ? "You cannot delete your own signed-in administrator account."
          : "You cannot remove access from your own signed-in account.",
      status: 403,
      code: "self_action_denied",
    };
  }

  const targetIsProtected = isProtectedTechnicalAdmin(input.targetAppRole as AppRole);
  if (targetIsProtected) {
    const guard = wouldRemoveLastProtectedAdmin({
      protectedAdminCount: input.protectedAdminCount,
      targetIsProtectedAdmin: true,
      nextIsProtectedAdmin: false,
    });
    if (!guard.ok) {
      return {
        ok: false,
        error:
          input.action === "delete_user"
            ? "Cannot delete the last protected administrator."
            : guard.error,
        status: 403,
        code: "last_admin_protected",
      };
    }
  }

  if (input.action === "remove_access") {
    return { ok: true, strategy: "revoke_access" };
  }

  // delete_user — never cascade-wipe student CRM / business history via Auth delete.
  const links = input.links ?? {
    linkedStudentProfiles: 0,
    assignedStudents: 0,
    applicationsOwned: 0,
    documentVersionsUploaded: 0,
    auditEventsAsActor: 0,
  };

  if (links.linkedStudentProfiles > 0) {
    return {
      ok: false,
      error:
        "This login is linked to a student CRM record. Deletion is blocked so student, application, fee, and document history stay intact. Use Remove Access instead.",
      status: 409,
      code: "linked_student_blocks_delete",
    };
  }

  // Auth delete → profiles CASCADE → consultants + notifications only.
  // Business FKs are ON DELETE SET NULL; audit actor_id SET NULL — safe hard-delete of Auth identity.
  return { ok: true, strategy: "hard_delete_auth" };
}

/** True when Auth ban + desk inactive should deny portal/API use (UI/status helper). */
export function accountAccessIsRevoked(input: {
  banned: boolean;
  deskStatus: "active" | "inactive" | "n/a";
}): boolean {
  return input.banned || input.deskStatus === "inactive";
}

/**
 * Documents that profile Auth deletion does not cascade-delete student/business rows.
 * Used by regression tests — mirrors foundation FK design.
 */
export const ACCOUNT_DELETE_PRESERVES = [
  "students (profile_id SET NULL)",
  "applications",
  "signup_fee_payments",
  "student_documents",
  "audit_events (actor_id SET NULL)",
] as const;

export const ACCOUNT_DELETE_CASCADES_ONLY = [
  "profiles (via auth.users)",
  "consultants desk row",
  "notifications for that user",
] as const;
