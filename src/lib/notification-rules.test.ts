import { describe, expect, it } from "vitest";
import {
  applyNotificationListLimit,
  assertNotificationAudience,
  canMarkOwnNotification,
  decideMarkNotificationRead,
  NOTIFICATION_LIST_LIMIT,
  shouldOfferMarkAsRead,
  shouldServeMockNotifications,
  sortNotificationRowsByCreatedDesc,
} from "./notification-rules";
import { mapNotificationRow } from "./notification-mappers";
import { crmListOrEmpty } from "./portal-data-plane";

describe("notification rules (Phase 4 unit — not RLS/JWT proof)", () => {
  it("rejects audience mismatch and unknown roles", () => {
    expect(assertNotificationAudience("student", "student").ok).toBe(true);
    expect(assertNotificationAudience("student", "admin").ok).toBe(false);
    expect(assertNotificationAudience("consultant", "staff").ok).toBe(true);
    expect(assertNotificationAudience("admin", "admin").ok).toBe(true);
  });

  it("denies cross-user mark-as-read ownership", () => {
    expect(canMarkOwnNotification({ sessionUserId: "user-a", rowUserId: "user-b" })).toBe(false);
    expect(canMarkOwnNotification({ sessionUserId: "user-a", rowUserId: "user-a" })).toBe(true);
    expect(canMarkOwnNotification({ sessionUserId: null, rowUserId: "user-a" })).toBe(false);
    expect(canMarkOwnNotification({ sessionUserId: "user-a", rowUserId: null })).toBe(false);
  });

  it("mark-read decision: missing/unauthorized → 404; already read → noop; else update", () => {
    expect(decideMarkNotificationRead({ sessionUserId: "u1", row: null })).toEqual({
      action: "reject",
      status: 404,
      message: "Notification not found.",
    });

    expect(
      decideMarkNotificationRead({
        sessionUserId: "u1",
        row: { user_id: "u2", read_at: null },
      }),
    ).toEqual({ action: "reject", status: 404, message: "Notification not found." });

    expect(
      decideMarkNotificationRead({
        sessionUserId: "u1",
        row: { user_id: "u1", read_at: "2026-10-14T00:00:00.000Z" },
      }),
    ).toEqual({ action: "noop", reason: "already_read" });

    expect(
      decideMarkNotificationRead({
        sessionUserId: "u1",
        row: { user_id: "u1", read_at: null },
      }),
    ).toEqual({ action: "update" });

    expect(
      decideMarkNotificationRead({ sessionUserId: null, row: { user_id: "u1", read_at: null } }),
    ).toEqual({ action: "reject", status: 403, message: "Authenticated user id is required." });
  });

  it("demo-only mock plane; supabase never gets fixtures", () => {
    expect(shouldServeMockNotifications("demo")).toBe(true);
    expect(shouldServeMockNotifications("supabase")).toBe(false);
    expect(crmListOrEmpty("supabase", [{ id: "fixture" }])).toEqual([]);
    expect(crmListOrEmpty("demo", [{ id: "fixture" }])).toEqual([{ id: "fixture" }]);
  });

  it("orders newest first and applies list limit", () => {
    const sorted = sortNotificationRowsByCreatedDesc([
      { id: "a", created_at: "2026-10-01T00:00:00.000Z" },
      { id: "c", created_at: "2026-10-14T00:00:00.000Z" },
      { id: "b", created_at: "2026-10-10T00:00:00.000Z" },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);

    const now = Date.parse("2026-10-14T12:00:00.000Z");
    const mapped = sorted.map((r) =>
      mapNotificationRow(
        { id: r.id, title: r.id, body: null, read_at: null, created_at: r.created_at },
        "student",
        now,
      ),
    );
    expect(mapped[0]?.id).toBe("c");
    expect(applyNotificationListLimit(mapped, 2)).toHaveLength(2);
    expect(NOTIFICATION_LIST_LIMIT).toBe(100);
  });

  it("UI mark-read offer + ownership/idempotency decisions for inbox actions", () => {
    expect(shouldOfferMarkAsRead({ read: false })).toBe(true);
    expect(shouldOfferMarkAsRead({ read: true })).toBe(false);

    // Successful mark path: owned + unread → update
    expect(
      decideMarkNotificationRead({
        sessionUserId: "me",
        row: { user_id: "me", read_at: null },
      }),
    ).toEqual({ action: "update" });

    // Already-read is idempotent noop (server still returns ok)
    expect(
      decideMarkNotificationRead({
        sessionUserId: "me",
        row: { user_id: "me", read_at: "2026-10-14T00:00:00.000Z" },
      }),
    ).toEqual({ action: "noop", reason: "already_read" });

    // Cross-user / missing fail closed as not found
    expect(
      decideMarkNotificationRead({
        sessionUserId: "me",
        row: { user_id: "other", read_at: null },
      }),
    ).toEqual({ action: "reject", status: 404, message: "Notification not found." });
    expect(decideMarkNotificationRead({ sessionUserId: "me", row: null })).toEqual({
      action: "reject",
      status: 404,
      message: "Notification not found.",
    });
  });
});
