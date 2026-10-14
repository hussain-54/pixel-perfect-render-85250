/**
 * Map consultation_requests (live CRM leads) onto the portal Lead view model.
 * Does not invent ROI or marketing metrics — enquiry fields only.
 */
import type { AppRole } from "@/lib/roles";
import { rolesAtLeastAdmin } from "@/lib/roles";
import type { BusinessRole } from "@/lib/business-permissions";
import type { Lead, LeadStatus } from "@/types";

export type ConsultationRequestRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  destination: string | null;
  study_level: string | null;
  program: string | null;
  status: string;
  assigned_consultant_id: string | null;
  attribution_source?: string | null;
  original_attribution_source?: string | null;
  created_at: string;
};

/** Canonical UI statuses — persisted as snake_case text (no DB enum). */
export const LEAD_STATUSES: readonly LeadStatus[] = [
  "New",
  "Contacted",
  "Consultation Booked",
  "Qualified",
  "Converted",
  "Lost",
] as const;

const STATUS_MAP: Record<string, LeadStatus> = {
  new: "New",
  contacted: "Contacted",
  consultation_booked: "Consultation Booked",
  "consultation booked": "Consultation Booked",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

export function mapLeadStatus(raw: string | null | undefined): LeadStatus {
  const key = (raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const underscored = key.replace(/\s+/g, "_");
  return STATUS_MAP[underscored] ?? STATUS_MAP[key] ?? "New";
}

/** Accept only known LeadStatus values — reject arbitrary client strings. */
export function parseLeadStatusInput(raw: string | null | undefined): LeadStatus | null {
  if (!raw?.trim()) return null;
  const mapped = mapLeadStatus(raw);
  // mapLeadStatus defaults unknown → New; distinguish by exact allow-list match.
  const normalized = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const underscored = normalized.replace(/\s+/g, "_");
  if (STATUS_MAP[underscored] || STATUS_MAP[normalized]) return mapped;
  if ((LEAD_STATUSES as readonly string[]).includes(raw.trim())) return raw.trim() as LeadStatus;
  return null;
}

export function leadStatusToDbValue(status: LeadStatus): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

/** Admin / Manager may assign. Ordinary consultants may not reassign. */
export function canAssignConsultationLead(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  return input.businessRole === "manager";
}

/**
 * Status updates: admin any row; desk consultants only when assigned to them.
 * Unassigned leads are not mutable by ordinary desks.
 */
export function canUpdateConsultationLeadStatus(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
  deskId: string | null;
  assignedConsultantId: string | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole) || input.businessRole === "manager") return true;
  if (!input.deskId || !input.assignedConsultantId) return false;
  return input.deskId === input.assignedConsultantId;
}

export function isEligibleLeadAssigneeStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "active";
}

export function mapLeadSource(row: ConsultationRequestRow): string {
  const primary = row.attribution_source?.trim();
  if (primary) return primary;
  const original = row.original_attribution_source?.trim();
  if (original) return original;
  return "Website";
}

export function mapConsultationRequestToLead(row: ConsultationRequestRow): Lead {
  const program = row.program?.trim() || row.study_level?.trim() || "—";
  const country = row.destination?.trim() || "—";
  return {
    id: row.id,
    name: row.full_name.trim() || "—",
    email: row.email.trim() || "—",
    phone: row.phone.trim() || "—",
    country,
    program,
    source: mapLeadSource(row),
    consultantId: row.assigned_consultant_id,
    status: mapLeadStatus(row.status),
    created: row.created_at.includes("T")
      ? row.created_at.slice(0, 10)
      : row.created_at.slice(0, 10),
  };
}

/**
 * Desk consultants only see assigned enquiries.
 * Admin / Manager see all (including unassigned) so they can assign.
 */
export function filterLeadsForDeskScope<T extends { assigned_consultant_id: string | null }>(
  rows: T[],
  input: { isAdmin: boolean; isManager?: boolean; deskId: string | null },
): T[] {
  if (input.isAdmin || input.isManager) return rows;
  if (!input.deskId) return [];
  return rows.filter((r) => r.assigned_consultant_id === input.deskId);
}
