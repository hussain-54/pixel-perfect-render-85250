import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  GraduationCap,
  FileText,
  Wallet,
  IdCard,
  Megaphone,
  BarChart3,
  Settings,
  UserPlus,
  Package,
  Building2,
  Layers,
  Award,
  UserCog,
  Trophy,
  ArrowUpDown,
  Bell,
  ScrollText,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";

/**
 * Concise admin nav aligned to RBAC modules (reference sidebar),
 * with short secondary groups for workspace / catalog / system routes.
 */
const adminNav: PortalNavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/appointments", label: "Counselling", icon: MessagesSquare },
  { to: "/admin/applications", label: "Admissions", icon: GraduationCap },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/finance", label: "Fees & Payments", icon: Wallet },
  { to: "/admin/hr", label: "HR & Attendance", icon: IdCard },
  { to: "/admin/marketing", label: "Digital Marketing", icon: Megaphone },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/leads", label: "Leads", icon: UserPlus, section: "Workspace" },
  { to: "/admin/operations", label: "Office Ops", icon: Package },
  { to: "/admin/universities", label: "Universities", icon: Building2, section: "Catalog" },
  { to: "/admin/programs", label: "Programs", icon: Layers },
  { to: "/admin/scholarships", label: "Scholarships", icon: Award },
  { to: "/admin/consultants", label: "Consultants", icon: UserCog },
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/import-export", label: "Import / Export", icon: ArrowUpDown, section: "System" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
];

export const Route = createFileRoute("/admin")({
  beforeLoad: requirePortalAccess("admin"),
  head: () =>
    pageHead({
      path: "/admin",
      title: "Admin Portal — Global Roots Consultants",
      description: "Authenticated admin workspace.",
      indexable: false,
    }),
  component: AdminPortalLayout,
});

function AdminPortalLayout() {
  return <PortalShell role="admin" nav={adminNav} />;
}
