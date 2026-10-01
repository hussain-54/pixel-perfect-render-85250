import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "navy";

const toneMap: Record<string, Tone> = {
  Approved: "success", Completed: "success", Confirmed: "success", "Offer Received": "success", Converted: "success", Active: "success", "Fully Funded": "success",
  "Pending Review": "warning", Requested: "warning", Rescheduled: "warning", "Under Review": "warning", "Needs Correction": "warning", Contacted: "warning", "Partial Funding": "warning",
  Rejected: "danger", Cancelled: "danger", "No Show": "danger", Lost: "danger", Withdrawn: "danger",
  Submitted: "info", Ready: "info", New: "info", "Consultation Booked": "info", Qualified: "navy", "Tuition Waiver": "info",
  Draft: "neutral", Inactive: "neutral",
};

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-royal",
  navy: "bg-navy text-navy-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneMap[status] ?? "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
