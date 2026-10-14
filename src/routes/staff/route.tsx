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
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import type { BusinessRole } from "@/lib/business-permissions";

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

export const Route = createFileRoute("/staff")({
  beforeLoad: async (ctx) => {
    const result = await requirePortalAccess("staff")();
    const businessRole = (result.auth as { businessRole?: BusinessRole | null }).businessRole;
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : (ctx.location?.pathname ?? "");

    if (isFrontDeskBusinessRole(businessRole)) {
      const denied =
        pathname.startsWith("/staff/applications") ||
        pathname.startsWith("/staff/documents") ||
        pathname.startsWith("/staff/offers") ||
        pathname.startsWith("/staff/tasks") ||
        pathname.startsWith("/staff/leads") ||
        pathname.startsWith("/staff/reports") ||
        pathname.startsWith("/staff/activity") ||
        pathname.startsWith("/staff/students/") ||
        pathname === "/staff/students" ||
        pathname === "/staff/appointments" ||
        pathname === "/staff/dashboard";
      if (denied) {
        throw redirect({ to: "/staff/front-desk" });
      }
    }

    return result;
  },
  head: () =>
    pageHead({
      path: "/staff",
      title: "Staff Portal — Global Roots Consultants",
      description: "Authenticated staff workspace.",
      indexable: false,
    }),
  component: StaffPortalLayout,
});

function StaffPortalLayout() {
  const { auth } = Route.useRouteContext() as {
    auth: { businessRole?: BusinessRole | null };
  };
  const nav = isFrontDeskBusinessRole(auth?.businessRole) ? frontDeskNav : consultantNav;
  return <PortalShell role="staff" nav={nav} />;
}
