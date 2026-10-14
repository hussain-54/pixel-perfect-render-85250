/**
 * Pure notification authorization / plane-selection rules (Phase 4).
 * Server handlers remain authoritative; these helpers keep unit tests honest
 * without claiming Supabase RLS or JWT proof.
 */
import type { AppRole } from "@/lib/roles";
import { audienceForAppRole } from "@/lib/notification-mappers";
import type { Notification } from "@/types";
import type { SessionSource } from "@/lib/portal-data-plane";
import { isMockCrmAllowed } from "@/lib/portal-data-plane";

/** Soft cap aligned with other portal queues (fees, activity). */
export const NOTIFICATION_LIST_LIMIT = 100;

export function assertNotificationAudience(
  role: AppRole,
  requested: Notification["audience"],
): { ok: true; audience: Notification["audience"] } | { ok: false; error: string } {
  const expected = audienceForAppRole(role);
  if (!expected) {
    return { ok: false, error: "Unsupported role for notifications." };
  }
  if (expected !== requested) {
    return { ok: false, error: "Notification audience does not match your session role." };
  }
  return { ok: true, audience: expected };
}

/** Ownership check — never trust a client-supplied user id as the row owner. */
export function canMarkOwnNotification(input: {
  sessionUserId: string | null | undefined;
  rowUserId: string | null | undefined;
}): boolean {
  if (!input.sessionUserId || !input.rowUserId) return false;
  return input.sessionUserId === input.rowUserId;
}

export type MarkReadDecision =
  | { action: "reject"; status: 400 | 403 | 404; message: string }
  | { action: "noop"; reason: "already_read" }
  | { action: "update" };

/**
 * Decide mark-as-read before mutation. Missing/unauthorized rows fail closed
 * with the same 404 message (do not leak cross-user existence).
 */
export function decideMarkNotificationRead(input: {
  sessionUserId: string | null | undefined;
  row: { user_id: string; read_at: string | null } | null;
}): MarkReadDecision {
  if (!input.sessionUserId) {
    return { action: "reject", status: 403, message: "Authenticated user id is required." };
  }
  if (!input.row) {
    return { action: "reject", status: 404, message: "Notification not found." };
  }
  if (
    !canMarkOwnNotification({ sessionUserId: input.sessionUserId, rowUserId: input.row.user_id })
  ) {
    return { action: "reject", status: 404, message: "Notification not found." };
  }
  if (input.row.read_at) {
    return { action: "noop", reason: "already_read" };
  }
  return { action: "update" };
}

/** Live plane never serves fixtures; demo plane may. */
export function shouldServeMockNotifications(source: SessionSource): boolean {
  return isMockCrmAllowed(source);
}

export function sortNotificationRowsByCreatedDesc<T extends { created_at: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function applyNotificationListLimit<T>(rows: T[], limit = NOTIFICATION_LIST_LIMIT): T[] {
  if (limit <= 0) return [];
  return rows.length <= limit ? rows : rows.slice(0, limit);
}

/** UI offers mark-read only for unread items in the current user's inbox. */
export function shouldOfferMarkAsRead(notification: { read: boolean }): boolean {
  return !notification.read;
}
