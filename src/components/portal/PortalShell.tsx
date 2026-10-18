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
import {
  workspaceIdentityLabelForSession,
  workspaceTitleForSession,
} from "@/lib/workspace-branding";
import type { PublicSession } from "@/server/portal-data";
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
    | "/staff/hr"
    | "/staff/marketing"
    | "/staff/finance"
    | "/staff/banking"
    | "/staff/operations"
    | "/admin/dashboard"
    | "/admin/leads"
    | "/admin/students"
    | "/admin/appointments"
    | "/admin/finance"
    | "/admin/banking"
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
    | "/admin/users-roles"
    | "/admin/leaderboard"
    | "/admin/reports"
    | "/admin/import-export"
    | "/admin/notifications"
    | "/admin/audit-logs"
    | "/admin/settings";
  label: string;
  icon: LucideIcon;
  /** Optional access hint shown like the RBAC preview (View / Edit / Full). */
  badge?: string;
  /** Soft-divider group label rendered above this item. */
  section?: string;
};

const roleMeta: Record<
  PortalRole,
  {
    switcherLabel: string;
    home: "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";
  }
> = {
  student: {
    switcherLabel: "Student",
    home: "/student/dashboard",
  },
  staff: {
    switcherLabel: "Consultant",
    home: "/staff/dashboard",
  },
  admin: {
    switcherLabel: "Admin",
    home: "/admin/dashboard",
  },
};

function SidebarNav({
  items,
  onNavigate,
  id,
}: {
  items: PortalNavItem[];
  onNavigate?: () => void;
  id?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      id={id}
      className="portal-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 py-3"
    >
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <div key={item.to}>
            {item.section ? (
              <p className="mb-1.5 mt-3 px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/35 first:mt-0">
                {item.section}
              </p>
            ) : null}
            <Link
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                active
                  ? "bg-bright text-white shadow-sm shadow-black/15"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  active
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/75 group-hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[0.62rem] font-semibold tracking-wide",
                    active ? "bg-white/20 text-white" : "bg-white/10 text-white/50",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </div>
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
  /**
   * Session from route beforeLoad (requirePortalAccess). When provided, skips a
   * duplicate establishSession round-trip used only for chrome branding.
   */
  session?: PublicSession | null;
};

/** Shared portal chrome: sidebar, top bar, logout; demo role switcher only when demo auth is enabled. */
export function PortalShell({ role, nav, children, barTitle, session }: PortalShellProps) {
  const meta = roleMeta[role];
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const showDemoSwitcher = isDemoAuthEnabled();
  const showGlobalSearch = role === "staff";

  // Prefer route-context session; only refetch when the layout did not supply one.
  const sessionQ = useQuery({
    queryKey: ["portal", "auth-session"],
    queryFn: () => getAuthSession(),
    staleTime: 60_000,
    enabled: !session,
    initialData: session ?? undefined,
  });
  const resolvedSession = session ?? sessionQ.data ?? null;
  const showDemoSessionBadge = shouldShowDemoSessionIndicator(resolvedSession?.source);

  const brand = {
    title: workspaceTitleForSession({
      portal: role,
      businessRole: resolvedSession?.businessRole,
      appRole: resolvedSession?.role,
    }),
    identityLabel: workspaceIdentityLabelForSession({
      portal: role,
      businessRole: resolvedSession?.businessRole,
      appRole: resolvedSession?.role,
    }),
  };
  const roleLabel = brand.identityLabel;
  const identityEmail = resolvedSession?.email?.trim() || null;

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

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

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

  const brandBlock = (
    <div className="shrink-0 border-b border-white/10 px-4 py-4">
      <Logo light to={meta.home} className="[&_img]:h-8 [&_img]:sm:h-9" />
      <div className="mt-3 space-y-0.5 text-[0.68rem] leading-snug text-white/55">
        {identityEmail ? (
          <p className="truncate font-medium text-white/90" title={identityEmail}>
            {identityEmail}
          </p>
        ) : null}
        <p>
          Logged in as: <span className="font-medium text-white/85">{roleLabel}</span>
        </p>
      </div>
    </div>
  );

  const footerBlock = (compact = false) => (
    <div className={cn("mt-auto shrink-0 space-y-1.5 border-t border-white/10 p-3", compact && "p-3")}>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        onClick={() => {
          setMobileOpen(false);
          void navigate({ to: "/change-password" });
        }}
      >
        <KeyRound className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        Change password
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-50"
        onClick={onSignOut}
        disabled={signingOut}
      >
        <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  const searchPanel =
    searchQTrim.length >= 2 && searchOpen ? (
      <div className="rounded-md border border-border bg-white shadow-md">
        {searchResults.isLoading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
        ) : searchResults.isError ? (
          <p className="px-3 py-2 text-xs text-danger">Search unavailable</p>
        ) : !searchResults.data?.length ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No authorized matches</p>
        ) : (
          <ul className="max-h-64 overflow-auto py-1">
            {searchResults.data.map((hit) => (
              <li key={hit.id}>
                <Link
                  to="/staff/students/$studentId"
                  params={{ studentId: hit.id }}
                  search={{ tab: "assessment" }}
                  className="block px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchQ("");
                    setSearchOpen(false);
                    setMobileSearchOpen(false);
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
    ) : null;

  return (
    <div className="flex h-svh max-h-svh min-h-0 overflow-hidden bg-surface">
      <aside className="hidden h-svh min-h-0 w-[15.5rem] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex">
        {brandBlock}
        <SidebarNav items={nav} />
        {footerBlock()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex h-full w-[min(17rem,calc(100vw-2.5rem))] max-w-[17rem] flex-col gap-0 overflow-hidden border-0 bg-sidebar p-0 text-sidebar-foreground motion-reduce:animate-none motion-reduce:duration-0 [&>button]:rounded-md [&>button]:bg-white/10 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100 [&>button]:ring-offset-transparent [&>button]:focus:ring-white/80"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace menu</SheetTitle>
          </SheetHeader>
          <div className="shrink-0 pr-10">{brandBlock}</div>
          <SidebarNav id="portal-mobile-nav" items={nav} onNavigate={() => setMobileOpen(false)} />
          {footerBlock(true)}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-white px-3 sm:gap-3 sm:px-4 md:h-14 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="portal-mobile-nav"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="truncate font-display text-base font-semibold text-navy md:text-lg">
              {barTitle ?? brand.title}
            </span>
            {showDemoSessionBadge ? (
              <span
                role="status"
                aria-label="Demo session"
                className="hidden shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-900 sm:inline"
              >
                Demo session
              </span>
            ) : null}
            {showGlobalSearch ? (
              <div className="relative ml-auto hidden min-w-0 max-w-md flex-1 lg:block">
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
                {searchPanel ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40">{searchPanel}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          {showGlobalSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={mobileSearchOpen ? "Close search" : "Search students"}
              aria-expanded={mobileSearchOpen}
              onClick={() => setMobileSearchOpen((open) => !open)}
            >
              <Search className="h-5 w-5" />
            </Button>
          ) : null}
          <div className="hidden shrink-0 xl:block">
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
        {showGlobalSearch && mobileSearchOpen ? (
          <div className="shrink-0 border-b border-border bg-white px-3 py-2 lg:hidden">
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => searchQTrim.length >= 2 && setSearchOpen(true)}
              placeholder="Search student, ID, phone..."
              aria-label="Search students"
              className="h-10"
              autoFocus
            />
            {searchPanel ? <div className="mt-2">{searchPanel}</div> : null}
          </div>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain p-4 md:p-6 lg:p-7">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
