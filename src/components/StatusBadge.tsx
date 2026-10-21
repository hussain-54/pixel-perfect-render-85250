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
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-royal",
  navy: "bg-navy/90 text-navy-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** Humanize snake_case / lowercase API statuses without altering Title Case labels. */
export function formatStatusLabel(status: string): string {
  const t = (status ?? "").trim();
  if (!t) return t;
  if (t.includes("_") || t === t.toLowerCase()) {
    return t
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneMap[status] ?? "neutral";
  const label = formatStatusLabel(status);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide",
        toneClass[tone],
        className,
      )}
      title={label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
