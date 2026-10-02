import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Calendar,
  GraduationCap,
  FileText,
  Building2,
  Layers,
  Award,
  UserCog,
  Trophy,
  BarChart3,
  ArrowUpDown,
  Bell,
  ScrollText,
  Settings,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";

const adminNav: PortalNavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/leads", label: "Leads", icon: UserPlus },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/appointments", label: "Appointments", icon: Calendar },
  { to: "/admin/applications", label: "Applications", icon: GraduationCap },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/universities", label: "Universities", icon: Building2 },
  { to: "/admin/programs", label: "Programs", icon: Layers },
  { to: "/admin/scholarships", label: "Scholarships", icon: Award },
  { to: "/admin/consultants", label: "Consultants", icon: UserCog },
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/import-export", label: "Import / Export", icon: ArrowUpDown },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export const Route = createFileRoute("/admin")({
  component: AdminPortalLayout,
});

function AdminPortalLayout() {
  return <PortalShell role="admin" nav={adminNav} />;
}
