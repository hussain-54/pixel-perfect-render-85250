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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy md:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  icon?: ReactNode;
}) {
  return (
    <div className="border-b border-border pb-4 pt-1">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em]">{label}</span>
        {icon && <span className="text-royal [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-navy md:text-[1.75rem]">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-semibold text-navy">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

export function ErrorState({
  body = "Something went wrong loading this data.",
}: {
  body?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-danger-soft p-4 text-sm text-danger">
      <AlertTriangle className="h-4 w-4" /> {body}
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

/** Horizontal scroll container for tables on small screens. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-transparent [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground [&_td]:border-t [&_td]:border-border/70 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">
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
      className="h-11 rounded-md border border-input bg-white px-3 text-sm text-navy focus:border-royal/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
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
