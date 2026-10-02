import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Calendar,
  GraduationCap,
  FileText,
  UserPlus,
  Activity,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";

const staffNav: PortalNavItem[] = [
  { to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/students", label: "Students", icon: Users },
  { to: "/staff/appointments", label: "Appointments", icon: Calendar },
  { to: "/staff/applications", label: "Applications", icon: GraduationCap },
  { to: "/staff/documents", label: "Documents", icon: FileText },
  { to: "/staff/leads", label: "Leads", icon: UserPlus },
  { to: "/staff/activity", label: "Activity", icon: Activity },
];

export const Route = createFileRoute("/staff")({
  component: StaffPortalLayout,
});

function StaffPortalLayout() {
  return <PortalShell role="staff" nav={staffNav} />;
}
