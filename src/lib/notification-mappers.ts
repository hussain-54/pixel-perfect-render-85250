/**
 * Map persisted notifications rows to the portal Notification view model.
 * Audience is derived from the trusted session role, never from client body.
 */
import type { Notification } from "@/types";
import type { AppRole } from "@/lib/roles";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  link_path?: string | null;
  student_id?: string | null;
};

export function audienceForAppRole(role: AppRole): Notification["audience"] | null {
  if (role === "student") return "student";
  if (role === "consultant") return "staff";
  if (role === "admin" || role === "super_admin") return "admin";
  return null;
}

export function formatNotificationTime(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.round((t - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 14) return rtf.format(diffDay, "day");
  return new Date(t).toISOString().slice(0, 10);
}

export function mapNotificationRow(
  row: NotificationRow,
  audience: Notification["audience"],
  nowMs = Date.now(),
): Notification {
  return {
    id: row.id,
    audience,
    title: row.title,
    body: row.body?.trim() || "",
    time: formatNotificationTime(row.created_at, nowMs),
    read: Boolean(row.read_at),
    createdAt: row.created_at,
    linkPath: row.link_path ?? null,
    studentId: row.student_id ?? null,
  };
}
