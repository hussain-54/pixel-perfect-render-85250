import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, LogOut, Menu, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isDemoAuthEnabled } from "@/lib/demo-auth";
import { getAuthSession, signOut } from "@/lib/auth";
import { shouldShowDemoSessionIndicator } from "@/lib/portal-data-plane";
import { searchAuthorizedStudents } from "@/services";
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
    | "/staff/front-desk"
    | "/staff/register"
    | "/staff/intake"
    | "/staff/students"
    | "/staff/students/$studentId"
    | "/staff/appointments"
    | "/staff/applications"
    | "/staff/documents"
    | "/staff/offers"
    | "/staff/tasks"
    | "/staff/reports"
    | "/staff/leads"
    | "/staff/activity"
    | "/admin/dashboard"
    | "/admin/leads"
    | "/admin/students"
    | "/admin/appointments"
    | "/admin/finance"
    | "/admin/hr"
    | "/admin/marketing"
    | "/admin/operations"
    | "/admin/applications"
    | "/admin/documents"
    | "/admin/universities"
    | "/admin/programs"
    | "/admin/scholarships"
    | "/admin/consultants"
    | "/admin/accounts"
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

/** Shared portal chrome: sidebar, top bar, logout; demo role switcher only when demo auth is enabled. */
export function PortalShell({ role, nav, children, barTitle }: PortalShellProps) {
  const meta = roleMeta[role];
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const showDemoSwitcher = isDemoAuthEnabled();
  const showGlobalSearch = role === "staff";

  const sessionQ = useQuery({
    queryKey: ["portal", "auth-session"],
    queryFn: () => getAuthSession(),
    staleTime: 30_000,
  });
  const showDemoSessionBadge = shouldShowDemoSessionIndicator(sessionQ.data?.source);

  const searchQTrim = searchQ.trim();
  const searchResults = useQuery({
    queryKey: ["officer", "global-search", searchQTrim],
    queryFn: () => searchAuthorizedStudents(searchQTrim),
    enabled: showGlobalSearch && searchQTrim.length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (searchQTrim.length < 2) setSearchOpen(false);
    else setSearchOpen(true);
  }, [searchQTrim]);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      await navigate({ to: "/sign-in", search: {} });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-svh bg-surface">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo light to={meta.home} />
          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-bright">
            {showDemoSwitcher ? "Demo portal" : "Secure portal"}
          </p>
        </div>
        <SidebarNav items={nav} />
        <div className="mt-auto space-y-3 border-t border-sidebar-border p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => void navigate({ to: "/change-password" })}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            Change password
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
          <p className="text-xs text-sidebar-foreground/60">
            {showDemoSwitcher ? "Mock data — demo auth enabled." : "Authorized access only."}
          </p>
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
          <div className="space-y-2 border-t border-sidebar-border p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                setMobileOpen(false);
                void navigate({ to: "/change-password" });
              }}
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              Change password
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onSignOut}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
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
            {showDemoSessionBadge ? (
              <span
                role="status"
                aria-label="Demo session"
                className="shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-900"
              >
                Demo session
              </span>
            ) : null}
            {showGlobalSearch ? (
              <div className="relative ml-auto hidden min-w-0 max-w-md flex-1 md:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onFocus={() => searchQTrim.length >= 2 && setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Search student, ID, phone..."
                  aria-label="Search students"
                  className="h-9 pl-8"
                />
                {searchOpen && searchQTrim.length >= 2 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-md border border-border bg-white shadow-md">
                    {searchResults.isLoading ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                    ) : searchResults.isError ? (
                      <p className="px-3 py-2 text-xs text-danger">Search unavailable</p>
                    ) : !searchResults.data?.length ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        No authorized matches
                      </p>
                    ) : (
                      <ul className="max-h-64 overflow-auto py-1">
                        {searchResults.data.map((hit) => (
                          <li key={hit.id}>
                            <Link
                              to="/staff/students/$studentId"
                              params={{ studentId: hit.id }}
                              search={{ tab: "assessment" }}
                              className="block px-3 py-2 text-sm hover:bg-accent"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSearchQ("");
                                setSearchOpen(false);
                              }}
                            >
                              <span className="font-semibold text-navy">{hit.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {hit.caseId} · {hit.phone}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="hidden shrink-0 lg:block">
            <Logo to={meta.home} />
          </div>
          {showDemoSwitcher ? <RoleSwitcher current={meta.switcherLabel} /> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={onSignOut}
            disabled={signingOut}
          >
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-7">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
