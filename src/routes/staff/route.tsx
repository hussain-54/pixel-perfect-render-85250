import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";

const staffNav: PortalNavItem[] = [
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

export const Route = createFileRoute("/staff")({
  beforeLoad: requirePortalAccess("staff"),
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
  return <PortalShell role="staff" nav={staffNav} />;
}