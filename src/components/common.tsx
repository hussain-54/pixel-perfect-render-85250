import type { ReactNode } from "react";
import { Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/types";

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Denser operational workspaces (staff desks). */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between",
        compact ? "mb-4" : "mb-5 sm:mb-6",
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "font-display font-semibold text-navy",
            compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl md:text-[1.75rem]",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              "mt-0.5 max-w-3xl leading-snug text-navy/70",
              compact ? "text-xs sm:text-sm" : "text-sm leading-relaxed text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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

/** Soft KPI tints — optional; omit/`neutral` keeps legacy white card for Finance/Student/Admin. */
export type StatCardTone =
  | "neutral"
  | "slate"
  | "blue"
  | "purple"
  | "amber"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "indigo"
  | "red";

const STAT_CARD_TONE: Record<
  StatCardTone,
  { shell: string; icon: string; selected: string; hover: string }
> = {
  neutral: {
    shell: "border-border bg-card",
    icon: "text-royal",
    selected: "border-royal/50 bg-navy/[0.04] ring-1 ring-royal/30",
    hover: "hover:border-navy/25 hover:bg-navy/[0.03]",
  },
  slate: {
    shell: "border-slate-200/90 bg-slate-50/90",
    icon: "text-slate-600",
    selected: "border-slate-400 bg-slate-100 ring-1 ring-slate-300/70",
    hover: "hover:border-slate-300 hover:bg-slate-100/90",
  },
  blue: {
    shell: "border-sky-200/90 bg-sky-50/80",
    icon: "text-sky-600",
    selected: "border-sky-400 bg-sky-100 ring-1 ring-sky-300/60",
    hover: "hover:border-sky-300 hover:bg-sky-100/80",
  },
  purple: {
    shell: "border-violet-200/90 bg-violet-50/80",
    icon: "text-violet-600",
    selected: "border-violet-400 bg-violet-100 ring-1 ring-violet-300/60",
    hover: "hover:border-violet-300 hover:bg-violet-100/80",
  },
  amber: {
    shell: "border-amber-200/90 bg-amber-50/80",
    icon: "text-amber-600",
    selected: "border-amber-400 bg-amber-100 ring-1 ring-amber-300/60",
    hover: "hover:border-amber-300 hover:bg-amber-100/80",
  },
  orange: {
    shell: "border-orange-200/90 bg-orange-50/80",
    icon: "text-orange-600",
    selected: "border-orange-400 bg-orange-100 ring-1 ring-orange-300/60",
    hover: "hover:border-orange-300 hover:bg-orange-100/80",
  },
  yellow: {
    shell: "border-yellow-200/90 bg-yellow-50/80",
    icon: "text-yellow-700",
    selected: "border-yellow-400 bg-yellow-100 ring-1 ring-yellow-300/60",
    hover: "hover:border-yellow-300 hover:bg-yellow-100/80",
  },
  green: {
    shell: "border-emerald-200/90 bg-emerald-50/80",
    icon: "text-emerald-600",
    selected: "border-emerald-400 bg-emerald-100 ring-1 ring-emerald-300/60",
    hover: "hover:border-emerald-300 hover:bg-emerald-100/80",
  },
  teal: {
    shell: "border-teal-200/90 bg-teal-50/80",
    icon: "text-teal-600",
    selected: "border-teal-400 bg-teal-100 ring-1 ring-teal-300/60",
    hover: "hover:border-teal-300 hover:bg-teal-100/80",
  },
  cyan: {
    shell: "border-cyan-200/90 bg-cyan-50/80",
    icon: "text-cyan-600",
    selected: "border-cyan-400 bg-cyan-100 ring-1 ring-cyan-300/60",
    hover: "hover:border-cyan-300 hover:bg-cyan-100/80",
  },
  indigo: {
    shell: "border-indigo-200/90 bg-indigo-50/80",
    icon: "text-indigo-600",
    selected: "border-indigo-400 bg-indigo-100 ring-1 ring-indigo-300/60",
    hover: "hover:border-indigo-300 hover:bg-indigo-100/80",
  },
  red: {
    shell: "border-rose-200/90 bg-rose-50/80",
    icon: "text-rose-600",
    selected: "border-rose-400 bg-rose-100 ring-1 ring-rose-300/60",
    hover: "hover:border-rose-300 hover:bg-rose-100/80",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  title,
  onClick,
  selected = false,
  /** White bordered KPI card (default). Use `bare` for denser inline metrics. */
  variant = "card",
  /** Soft tint. Defaults to neutral so shared screens stay unchanged. */
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  icon?: ReactNode;
  /** Optional long-form definition (native tooltip). Prefer short `hint` for on-card copy. */
  title?: string | undefined;
  /** When set, card is a filter/control button (keyboard accessible). */
  onClick?: () => void;
  selected?: boolean;
  variant?: "card" | "bare";
  tone?: StatCardTone;
}) {
  const tint = STAT_CARD_TONE[tone] ?? STAT_CARD_TONE.neutral;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 text-navy/70">
        <span className="text-xs font-semibold leading-snug tracking-wide">{label}</span>
        {icon ? (
          <span className={cn("shrink-0 [&_svg]:size-4", tint.icon)}>{icon}</span>
        ) : null}
      </div>
      <div className="mt-1.5 font-display text-xl font-semibold leading-none tabular-nums text-navy sm:text-[1.375rem]">
        {value}
      </div>
      {hint ? <p className="mt-1 text-[0.7rem] leading-snug text-navy/60">{hint}</p> : null}
    </>
  );
  const shellClass = cn(
    "flex h-full min-h-[5rem] flex-col text-left",
    variant === "card"
      ? cn("rounded-lg border p-3 shadow-soft", tint.shell)
      : "border-b border-border pb-3 pt-1",
    onClick &&
      cn(
        "w-full cursor-pointer transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40",
        tint.hover,
        "hover:shadow-sm",
      ),
    selected &&
      (variant === "card" ? tint.selected : "border-b-royal bg-navy/[0.04]"),
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={shellClass}
        title={title}
        onClick={onClick}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={shellClass} title={title}>
      {body}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  compact = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("panel", className)}>
      {title ? (
        <header
          className={cn(
            "flex items-center justify-between border-b border-border",
            compact ? "px-4 py-2.5" : "px-5 py-3.5",
          )}
        >
          <h2 className="font-sans text-sm font-semibold tracking-normal text-navy">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn(compact ? "p-4" : "p-5")}>{children}</div>
    </section>
  );
}

/** Connection state chip for Realtime-backed workspaces (reflects subscription health only). */
export function LiveBadge({
  status,
  lastSync,
}: {
  status: "live" | "reconnecting" | "offline" | "connecting";
  lastSync?: string | null;
}) {
  const label =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "reconnecting"
          ? "Reconnecting"
          : lastSync
            ? `Last updated ${lastSync}`
            : "Offline";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        status === "live"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : status === "offline"
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-800",
      )}
      title={
        lastSync
          ? `Data synced ${lastSync}. Badge reflects subscription health, not payload trust.`
          : "Reflects Realtime subscription health"
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "live"
            ? "bg-emerald-600"
            : status === "offline"
              ? "bg-slate-400"
              : "bg-amber-500",
        )}
        aria-hidden
      />
      {label}
      {lastSync && status === "live" ? (
        <span className="font-normal normal-case tracking-normal text-emerald-700/80">
          · {lastSync}
        </span>
      ) : null}
    </span>
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
