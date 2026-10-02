import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { MegaCta, MegaColumn, MegaMenuId, NavLink } from "@/data/navigation";
import { megaMenus } from "@/data/navigation";
import { cn } from "@/lib/utils";

function MenuLink({
  link,
  onNavigate,
  dense = false,
}: {
  link: NavLink;
  onNavigate: () => void;
  dense?: boolean;
}) {
  return (
    <Link
      to={link.to}
      {...(link.search ? { search: link.search } : {})}
      {...(link.hash ? { hash: link.hash } : {})}
      onClick={onNavigate}
      className={cn(
        "group block rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        dense ? "px-2.5 py-2 hover:bg-accent/70" : "px-2 py-1.5 hover:bg-accent/60",
      )}
    >
      <span className="block text-[0.9rem] text-navy group-hover:text-royal">{link.label}</span>
      {link.description && (
        <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted-foreground">
          {link.description}
        </span>
      )}
    </Link>
  );
}

function Column({
  column,
  onNavigate,
  dense = false,
}: {
  column: MegaColumn;
  onNavigate: () => void;
  dense?: boolean;
}) {
  return (
    <div>
      <p className="mb-2.5 px-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-royal">
        {column.heading}
      </p>
      <div className="mb-2.5 h-px bg-border" aria-hidden />
      <ul className={cn(dense && "grid gap-0.5 sm:grid-cols-2")}>
        {column.links.map((link) => (
          <li key={`${column.heading}-${link.label}`}>
            <MenuLink link={link} onNavigate={onNavigate} dense={dense} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CtaBlock({ cta, onNavigate }: { cta: MegaCta; onNavigate: () => void }) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-semibold text-navy">{cta.title}</p>
        {cta.body && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cta.body}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to={cta.primary.to}
          {...(cta.primary.search ? { search: cta.primary.search } : {})}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cta.primary.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {cta.secondary && (
          <Link
            to={cta.secondary.to}
            {...(cta.secondary.search ? { search: cta.secondary.search } : {})}
            onClick={onNavigate}
            className="text-sm font-medium text-muted-foreground hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cta.secondary.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

export function MegaMenuPanel({ id, onNavigate }: { id: MegaMenuId; onNavigate: () => void }) {
  const menu = megaMenus[id];
  const isDestinations = id === "destinations";
  const colCount = menu.columns.length;

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-white shadow-soft"
      role="region"
      aria-label={`${id} menu`}
    >
      <div className="h-0.5 bg-royal" aria-hidden />
      <div className="p-5 md:p-6 lg:p-7">
        <p className="mb-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-navy/70">
          {id === "programs"
            ? "Programs"
            : id === "universities"
              ? "Universities"
              : id === "scholarships"
                ? "Scholarships"
                : id === "destinations"
                  ? "Study Destinations"
                  : id === "services"
                    ? "Services"
                    : "Resources"}
        </p>

        <div
          className={cn(
            "grid gap-8",
            colCount === 1 && "grid-cols-1",
            colCount === 2 && "md:grid-cols-2",
            colCount >= 3 && "md:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {menu.columns.map((column) => (
            <Column
              key={column.heading}
              column={column}
              onNavigate={onNavigate}
              dense={
                isDestinations || (id === "universities" && column.heading === "Study by Country")
              }
            />
          ))}
        </div>

        <CtaBlock cta={menu.cta} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
