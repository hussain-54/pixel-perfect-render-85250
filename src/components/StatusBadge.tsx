import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "navy";

const toneMap: Record<string, Tone> = {
  Approved: "success",
  Completed: "success",
  Confirmed: "success",
  "Offer Received": "success",
  Converted: "success",
  Active: "success",
  "Fully Funded": "success",
  Pending: "warning",
  "Pending Review": "warning",
  Requested: "warning",
  Rescheduled: "warning",
  "Under Review": "warning",
  "Needs Correction": "warning",
  "Re-uploaded": "info",
  Contacted: "warning",
  "Partial Funding": "warning",
  "In Progress": "info",
  Upcoming: "info",
  Current: "navy",
  Rejected: "danger",
  Cancelled: "danger",
  "No Show": "danger",
  Lost: "danger",
  Withdrawn: "danger",
  Submitted: "info",
  "Ready to Submit": "info",
  "Docs Pending": "warning",
  Ready: "info",
  New: "info",
  "Consultation Booked": "info",
  Qualified: "navy",
  "Tuition Waiver": "info",
  Draft: "neutral",
  "Awaiting Student Reply": "warning",
  "Awaiting Docs": "warning",
  "Docs In Progress": "info",
  Accepted: "success",
  Declined: "danger",
  Due: "warning",
  Paid: "success",
  Overdue: "danger",
  Waived: "neutral",
  Issued: "success",
  "Document Preparation": "info",
  "Visa Filed": "info",
  Biometrics: "info",
  "Final Decision": "navy",
  Refused: "danger",
  Inactive: "neutral",
  Scholarships: "success",
  // Fee / request statuses (persisted DB values — keep distinct: claimed ≠ verified)
  unpaid: "neutral",
  Unpaid: "neutral",
  claimed: "warning",
  Claimed: "warning",
  verified: "success",
  Verified: "success",
  waived: "neutral",
  rejected: "danger",
  due: "warning",
  open: "info",
  Open: "info",
  in_progress: "warning",
  resolved: "success",
  Resolved: "success",
  cancelled: "neutral",
  pending: "warning",
};

const toneClass: Record<Tone, string> = {
  success: "status-success",
  warning: "status-warning",
  danger: "status-danger",
  info: "status-info",
  navy: "border-transparent bg-navy/90 text-navy-foreground",
  neutral: "status-neutral",
};

/** Humanize snake_case / lowercase API statuses without altering Title Case labels. */
export function formatStatusLabel(status: string): string {
  const t = (status ?? "").trim();
  if (!t) return t;
  if (t.includes("_") || t === t.toLowerCase()) {
    return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneMap[status] ?? "neutral";
  const label = formatStatusLabel(status);
  return (
    <span className={cn("status-pill max-w-full", toneClass[tone], className)} title={label}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
