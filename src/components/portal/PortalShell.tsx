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
import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@/lib/business-permissions";
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
    title: string;
    switcherLabel: string;
    home: "/student/dashboard" | "/staff/dashboard" | "/admin/dashboard";
    fallbackRoleLabel: string;
  }
> = {
  student: {
    title: "Student Portal",
    switcherLabel: "Student",
    home: "/student/dashboard",
    fallbackRoleLabel: "Student",
  },
  staff: {
    title: "Consultant Portal",
    switcherLabel: "Consultant",
    home: "/staff/dashboard",
    fallbackRoleLabel: "Staff",
  },
  admin: {
    title: "Admin Panel",
    switcherLabel: "Admin",
    home: "/admin/dashboard",
    fallbackRoleLabel: "Admin",
  },
};

function SidebarNav({ items, onNavigate }: { items: PortalNavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
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
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors duration-150",
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

  const businessRole = sessionQ.data?.businessRole as BusinessRole | null | undefined;
  const roleLabel =
    businessRole && businessRole in BUSINESS_ROLE_LABELS
      ? BUSINESS_ROLE_LABELS[businessRole]
      : meta.fallbackRoleLabel;
  const identityEmail = sessionQ.data?.email?.trim() || null;

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

  const brandBlock = (
    <div className="border-b border-white/10 px-4 py-4">
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
    <div className={cn("mt-auto space-y-1.5 border-t border-white/10 p-3", compact && "p-3")}>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
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
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        onClick={onSignOut}
        disabled={signingOut}
      >
        <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-svh bg-surface">
      <aside className="hidden w-[15.5rem] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {brandBlock}
        <SidebarNav items={nav} />
        {footerBlock()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[17rem] border-0 bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Portal menu</SheetTitle>
          </SheetHeader>
          {brandBlock}
          <SidebarNav items={nav} onNavigate={() => setMobileOpen(false)} />
          {footerBlock(true)}
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
