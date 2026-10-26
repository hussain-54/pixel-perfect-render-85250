import type { ReactNode } from "react";
import { Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/types";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold text-navy sm:text-2xl md:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Keep page title visible during loading / error so layout does not jump. */
export function PageLoadState({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} {...(subtitle ? { subtitle } : {})} />
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  icon?: ReactNode;
  /** Optional long-form definition (native tooltip). Prefer short `hint` for on-card copy. */
  title?: string | undefined;
}) {
  return (
    <div
      className="flex h-full min-h-[5.75rem] flex-col border-b border-border pb-3.5 pt-1"
      title={title}
    >
      <div className="flex items-start justify-between gap-2 text-navy/70">
        <span className="text-xs font-semibold leading-snug tracking-wide">{label}</span>
        {icon && <span className="shrink-0 text-royal [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-1.5 font-display text-xl font-semibold leading-none text-navy sm:text-[1.375rem]">
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-sm leading-snug text-navy/65">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-sans text-sm font-semibold tracking-normal text-navy">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-semibold text-navy">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  body = "Something went wrong loading this data.",
  onRetry,
}: {
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg bg-danger-soft p-4 text-sm text-danger sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{body}</span>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-danger/30 bg-white px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Shared success / error banner for mutation feedback. */
export function InlineFeedback({
  kind,
  children,
}: {
  kind: "ok" | "err" | "warn";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        kind === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        kind === "err" && "border-destructive/30 bg-destructive/10 text-destructive",
        kind === "warn" && "border-amber-200 bg-amber-50 text-amber-950",
      )}
    >
      {children}
    </p>
  );
}

/** Parse `status:message` errors thrown by portal server functions. */
export function portalErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (!(error instanceof Error)) return fallback;
  const m = error.message.match(/^(\d{3}):([\s\S]+)$/);
  if (m?.[1] === "403") return m[2]?.trim() || "You do not have permission to view this data.";
  if (m?.[1] === "401") return m[2]?.trim() || "Please sign in to continue.";
  return m?.[2]?.trim() || error.message || fallback;
}

export function PermissionDenied({
  body = "You do not have permission to view this data.",
}: {
  body?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-navy">
      <AlertTriangle className="h-4 w-4 text-warning" /> {body}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

/** Horizontal scroll container for tables on small screens — scroll inside, do not clip cells globally. */
export function TableWrap({
  children,
  compact = false,
}: {
  children: ReactNode;
  /** Narrower min-width for simpler tables on phones. */
  compact?: boolean;
}) {
  return (
    <div className="panel overflow-hidden">
      <div
        className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        role="region"
        aria-label="Scrollable table"
        tabIndex={0}
      >
        <table
          className={cn(
            "w-full text-left text-sm",
            compact ? "min-w-[480px]" : "min-w-[640px] sm:min-w-[720px]",
            "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-transparent [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground sm:[&_th]:px-4",
            "[&_td]:border-t [&_td]:border-border/70 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle sm:[&_td]:px-4 sm:[&_td]:py-3",
            "[&_a]:rounded-sm [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-royal/40",
            "[&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-royal/40",
            "[&_select]:focus-visible:outline-none [&_select]:focus-visible:ring-2 [&_select]:focus-visible:ring-royal/40",
          )}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export const fmtDate = (d: string) =>
  d && d !== "—"
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export function Timeline({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="relative ml-2 border-l border-border">
      {items.map((it, i) => (
        <li key={i} className="mb-5 ml-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-royal" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date(it.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </p>
          <p className="text-sm font-semibold text-navy">{it.title}</p>
          {it.by && <p className="text-xs text-muted-foreground">by {it.by}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const ini = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-royal",
        className,
      )}
    >
      {ini}
    </span>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-h-10 rounded-md border border-input bg-white px-3 text-sm text-navy focus-visible:border-royal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
