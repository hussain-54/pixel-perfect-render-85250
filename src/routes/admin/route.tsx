import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  GraduationCap,
  FileText,
  Wallet,
  Landmark,
  IdCard,
  Megaphone,
  Package,
  BarChart3,
  UserCog,
  Settings,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";

/**
 * Admin sidebar — exactly one entry per approved module (+ Dashboard).
 * Sub-features live inside module pages via local tabs / links.
 */
const adminNav: PortalNavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/appointments", label: "Counselling", icon: MessagesSquare },
  { to: "/admin/applications", label: "Admissions", icon: GraduationCap },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/finance", label: "Fees & Payments", icon: Wallet },
  { to: "/admin/banking", label: "Banking & Finance", icon: Landmark },
  { to: "/admin/hr", label: "HR & Attendance", icon: IdCard },
  { to: "/admin/marketing", label: "Digital Marketing", icon: Megaphone },
  { to: "/admin/operations", label: "Orders / Sales / Purchase", icon: Package },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/users-roles", label: "Users & Roles", icon: UserCog },
  { to: "/admin/settings", label: "Settings", icon: Settings },
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
