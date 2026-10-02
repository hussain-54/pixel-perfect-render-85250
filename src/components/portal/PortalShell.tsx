import type { ReactNode } from "react";
import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type PortalRole = "student" | "staff" | "admin";

export type PortalNavItem = {
  to:
    | "/student/dashboard"
    | "/student/appointments"
    | "/student/documents"
    | "/student/applications"
    | "/student/profile"
    | "/student/notifications"
    | "/staff/dashboard"
    | "/staff/students"
    | "/staff/appointments"
    | "/staff/applications"
    | "/staff/documents"
    | "/staff/leads"
    | "/staff/activity"
    | "/admin/dashboard"
    | "/admin/leads"
    | "/admin/students"
    | "/admin/appointments"
    | "/admin/applications"
    | "/admin/documents"
    | "/admin/universities"
    | "/admin/programs"
    | "/admin/scholarships"
    | "/admin/consultants"
    | "/admin/leaderboard"
    | "/admin/reports"
    | "/admin/import-export"
    | "/admin/notifications"
    | "/admin/audit-logs"
    | "/admin/settings";
  label: string;
  icon: LucideIcon;
};

const roleMeta: Record<
  PortalRole,
  {
    title: string;
    switcherLabel: string;
    home: "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";
  }
> = {
  student: { title: "Student Portal", switcherLabel: "Student", home: "/student/dashboard" },
  staff: { title: "Consultant Portal", switcherLabel: "Consultant", home: "/staff/dashboard" },
  admin: { title: "Admin Panel", switcherLabel: "Admin", home: "/admin/dashboard" },
};

function SidebarNav({ items, onNavigate }: { items: PortalNavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

type PortalShellProps = {
  role: PortalRole;
  nav: PortalNavItem[];
  children?: ReactNode;
  /** Optional override for the top bar title */
  barTitle?: string;
};

/** Shared portal chrome: sidebar, top bar, demo role switcher. */
export function PortalShell({ role, nav, children, barTitle }: PortalShellProps) {
  const meta = roleMeta[role];
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-surface">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo light to={meta.home} />
          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-bright">
            Demo portal
          </p>
        </div>
        <SidebarNav items={nav} />
        <div className="mt-auto border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          Mock data only — no live backend.
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border px-4 py-5 text-left">
            <SheetTitle className="text-sidebar-foreground">
              <Logo light to={meta.home} />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav items={nav} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-white px-4 md:h-14 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="truncate font-display text-base font-semibold text-navy md:text-lg">
              {barTitle ?? meta.title}
            </span>
          </div>
          <div className="hidden shrink-0 md:block">
            <Logo to={meta.home} />
          </div>
          <RoleSwitcher current={meta.switcherLabel} />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-7">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
