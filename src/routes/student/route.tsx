import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Calendar, FileText, GraduationCap, User, Bell } from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";
import { workspaceDocumentTitle } from "@/lib/workspace-branding";
import { useStudentPortalRealtime } from "@/lib/use-student-portal-realtime";
import type { PublicSession } from "@/server/portal-data";

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
  head: ({ match }) => {
    const auth = (match.context as { auth?: PublicSession }).auth;
    return pageHead({
      path: "/student",
      title: workspaceDocumentTitle({
        portal: "student",
        businessRole: auth?.businessRole ?? "student_portal",
        appRole: auth?.role,
      }),
      description: "Authenticated student workspace.",
      indexable: false,
    });
  },
  component: StudentPortalLayout,
});

function StudentPortalLayout() {
  const { auth } = Route.useRouteContext() as { auth: PublicSession };
  // Shell-level subscription: dashboard/apps/docs/notifications invalidate on reconnect.
  useStudentPortalRealtime(true);
  return <PortalShell role="student" nav={studentNav} session={auth} />;
}
