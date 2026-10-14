import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import { canEditModule, canViewModule, type BusinessRole } from "@/lib/business-permissions";

export type MarketingCampaignStatus = "draft" | "active" | "paused" | "completed";

const STATUS_TRANSITIONS: Record<MarketingCampaignStatus, MarketingCampaignStatus[]> = {
  draft: ["active", "paused", "completed"],
  active: ["paused", "completed"],
  paused: ["active", "completed"],
  completed: [], // reopen only via explicit unarchive of lifecycle not status
};

export function canViewMarketing(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  // Matrix-only: Digital Marketing module (FD View=1, counsellor=0, etc.).
  return canViewModule(input.businessRole, "digital_marketing");
}

export function canMutateMarketing(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "digital_manager" || input.businessRole === "manager") return true;
  return canEditModule(input.businessRole, "digital_marketing");
}

/** Super Admin may reopen completed campaigns; Admin may not invent extra privileges beyond matrix. */
export function canReopenCompletedCampaign(appRole: AppRole): boolean {
  return appRole === "super_admin";
}

export function isValidCampaignStatusTransition(input: {
  from: MarketingCampaignStatus;
  to: MarketingCampaignStatus;
  appRole: AppRole;
}): boolean {
  if (input.from === input.to) return true;
  if (input.from === "completed") {
    return canReopenCompletedCampaign(input.appRole) && input.to === "active";
  }
  return STATUS_TRANSITIONS[input.from].includes(input.to);
}

export function validateCampaignCreate(input: {
  name: string;
  channel?: string;
  startsOn?: string | null;
  endsOn?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!input.name.trim() || input.name.trim().length < 2) {
    return { ok: false, error: "Campaign name is required." };
  }
  const start = input.startsOn?.trim() || null;
  const end = input.endsOn?.trim() || null;
  if (start && end && end < start) {
    return { ok: false, error: "End date must be on or after start date." };
  }
  return { ok: true };
}

export function validateCampaignId(id: string | null | undefined):
  | {
      ok: true;
      id: string | null;
    }
  | { ok: false; error: string } {
  if (id === null || id === undefined || id === "") return { ok: true, id: null };
  const trimmed = id.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { ok: false, error: "Invalid campaign ID." };
  }
  return { ok: true, id: trimmed };
}

/** Metrics derived only from persisted inquiry rows linked to a campaign. */
export function campaignInquiryMetrics(
  rows: Array<{ campaignId: string | null; status: string }>,
  campaignId: string,
): { inquiries: number; newCount: number; assignedCount: number } {
  const linked = rows.filter((r) => r.campaignId === campaignId);
  return {
    inquiries: linked.length,
    newCount: linked.filter((r) => r.status === "new").length,
    assignedCount: linked.filter((r) => r.status !== "new").length,
  };
}

/**
 * Conversion counts from reliable email match inquiry → student.
 * Does not invent rates when student match data is unavailable (pass null).
 */
export function campaignConversionMetrics(input: {
  inquiryEmails: string[];
  studentEmails: string[] | null;
}): {
  registeredStudents: number | null;
  unavailableReason: string | null;
} {
  if (input.studentEmails === null) {
    return {
      registeredStudents: null,
      unavailableReason: "Student match data unavailable on this plane",
    };
  }
  const studentSet = new Set(
    input.studentEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const matched = new Set(
    input.inquiryEmails.map((e) => e.trim().toLowerCase()).filter((e) => e && studentSet.has(e)),
  );
  return { registeredStudents: matched.size, unavailableReason: null };
}

export function formatMetricValue(value: number | null): string {
  if (value === null) return "N/A";
  return String(value);
}
