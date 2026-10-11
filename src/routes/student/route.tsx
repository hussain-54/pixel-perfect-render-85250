import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Calendar, FileText, GraduationCap, User, Bell } from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";

const studentNav: PortalNavItem[] = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/appointments", label: "Appointments", icon: Calendar },
  { to: "/student/documents", label: "Documents", icon: FileText },
  { to: "/student/applications", label: "Applications", icon: GraduationCap },
  { to: "/student/profile", label: "Profile", icon: User },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
];

export const Route = createFileRoute("/student")({
  beforeLoad: requirePortalAccess("student"),
  head: () =>
    pageHead({
      path: "/student",
      title: "Student Portal — Global Roots Consultants",
      description: "Authenticated student workspace.",
      indexable: false,
    }),
  component: StudentPortalLayout,
});

function StudentPortalLayout() {
  return <PortalShell role="student" nav={studentNav} />;
}