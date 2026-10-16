import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Calendar,
  GraduationCap,
  FileText,
  ClipboardCheck,
  ListTodo,
  BarChart3,
  UserPlus,
  Activity,
  UserRoundPlus,
  ClipboardList,
  IdCard,
  Megaphone,
  Wallet,
  Landmark,
  Package,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";
import {
  isFrontDeskBusinessRole,
  isFrontDeskDeniedPath,
  staffHomeForBusinessRole,
} from "@/lib/staff-business-access";
import {
  specialtyNavForBusinessRole,
  specialtyOnlyPathAllowed,
  shouldIncludeCounsellorCrmNav,
  staffLandingPathForBusinessRole,
  type SpecialtyStaffPath,
} from "@/lib/specialty-desk-access";
import type { BusinessRole } from "@/lib/business-permissions";
import { workspaceDocumentTitle } from "@/lib/workspace-branding";
import type { PublicSession } from "@/server/portal-data";
import type { LucideIcon } from "lucide-react";

const consultantNav: PortalNavItem[] = [
  { to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/students", label: "Students", icon: Users },
  { to: "/staff/appointments", label: "Appointments", icon: Calendar },
  { to: "/staff/applications", label: "Applications", icon: GraduationCap },
  { to: "/staff/documents", label: "Documents", icon: FileText },
  { to: "/staff/offers", label: "Offers & Visa", icon: ClipboardCheck },
  { to: "/staff/tasks", label: "Tasks", icon: ListTodo },
  { to: "/staff/leads", label: "Leads", icon: UserPlus },
  { to: "/staff/reports", label: "Reports", icon: BarChart3 },
  { to: "/staff/activity", label: "Activity", icon: Activity },
];

const frontDeskNav: PortalNavItem[] = [
  { to: "/staff/front-desk", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/register", label: "Register Student", icon: UserRoundPlus },
  { to: "/staff/intake", label: "My Registrations", icon: ClipboardList },
];

const SPECIALTY_ICONS: Record<SpecialtyStaffPath, LucideIcon> = {
  "/staff/finance": Wallet,
  "/staff/banking": Landmark,
  "/staff/hr": IdCard,
  "/staff/marketing": Megaphone,
  "/staff/operations": Package,
  "/staff/reports": BarChart3,
};

function buildStaffNav(businessRole: BusinessRole | null | undefined): PortalNavItem[] {
  if (isFrontDeskBusinessRole(businessRole)) return frontDeskNav;

  const specialtyItems: PortalNavItem[] = specialtyNavForBusinessRole(businessRole).map((item) => ({
    to: item.to,
    label: item.label,
    icon: SPECIALTY_ICONS[item.to],
    section: "Modules",
  }));

  if (shouldIncludeCounsellorCrmNav(businessRole)) {
    // Manager: CRM + specialty modules (dedupe reports if present in both).
    const crm = [...consultantNav];
    const crmTos = new Set(crm.map((i) => i.to));
    for (const item of specialtyItems) {
      if (!crmTos.has(item.to)) crm.push(item);
    }
    return crm;
  }

  // Specialty-only desks: module nav only (no counsellor CRM).
  if (!specialtyItems.length) {
    return [
      {
        to: staffLandingPathForBusinessRole("consultant", businessRole) as PortalNavItem["to"],
        label: "Home",
        icon: LayoutDashboard,
      },
    ];
  }
  return specialtyItems;
}

export const Route = createFileRoute("/staff")({
  beforeLoad: async (ctx) => {
    const result = await requirePortalAccess("staff")();
    const auth = result.auth as PublicSession;
    const businessRole = auth.businessRole;
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : (ctx.location?.pathname ?? "");

    if (isFrontDeskBusinessRole(businessRole) && isFrontDeskDeniedPath(pathname)) {
      throw redirect({ to: "/staff/front-desk" });
    }

    if (!specialtyOnlyPathAllowed(businessRole, pathname)) {
      throw redirect({
        href: staffHomeForBusinessRole(auth.role ?? "consultant", businessRole),
      });
    }

    return result;
  },
  head: ({ match }) => {
    const auth = (match.context as { auth?: PublicSession }).auth;
    return pageHead({
      path: "/staff",
      title: workspaceDocumentTitle({
        portal: "staff",
        businessRole: auth?.businessRole,
        appRole: auth?.role,
      }),
      description: "Authenticated staff workspace.",
      indexable: false,
    });
  },
  component: StaffPortalLayout,
});

function StaffPortalLayout() {
  const { auth } = Route.useRouteContext() as {
    auth: PublicSession;
  };
  const nav = buildStaffNav(auth?.businessRole);
  return <PortalShell role="staff" nav={nav} session={auth} />;
}
