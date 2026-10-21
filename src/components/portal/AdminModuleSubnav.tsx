import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AdminModuleSubnavItem = {
  to: string;
  label: string;
  /** Optional `?tab=` value for in-page sections. */
  tab?: string;
};

/** Local sub-navigation inside a module landing page (not the main sidebar). */
export function AdminModuleSubnav({ items }: { items: AdminModuleSubnavItem[] }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchTab = useRouterState({
    select: (s) => {
      const raw: unknown = s.location.search;
      if (typeof raw === "string") {
        const q = raw.startsWith("?") ? raw.slice(1) : raw;
        return new URLSearchParams(q).get("tab") ?? "";
      }
      if (raw && typeof raw === "object" && "tab" in (raw as object)) {
        const tab = (raw as { tab?: unknown }).tab;
        return typeof tab === "string" ? tab : "";
      }
      return "";
    },
  });

  return (
    <nav
      aria-label="Module sections"
      className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3"
    >
      {items.map((item) => {
        const search = item.tab ? `?tab=${encodeURIComponent(item.tab)}` : "";
        const href = `${item.to}${search}`;
        const active = item.tab
          ? pathname === item.to && searchTab === item.tab
          : pathname === item.to;
        return (
          <a
            key={`${item.to}${search}${item.label}`}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40",
              active
                ? "bg-navy text-white"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={(e) => {
              e.preventDefault();
              void navigate({ href });
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
