/**
 * Pure staff sidebar builder — uses effective permission matrix for specialty modules.
 */
import type { PortalNavItem } from "@/components/portal/PortalShell";
import {
  cloneDefaultPermissionMatrix,
  type BusinessRole,
  type PermissionMatrix,
} from "@/lib/business-permissions";
import { specialtyNavFromEffectiveMatrix } from "@/lib/effective-staff-access";
import {
  shouldIncludeCounsellorCrmNav,
  staffLandingPathForBusinessRole,
  type SpecialtyStaffPath,
} from "@/lib/specialty-desk-access";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import type { LucideIcon } from "lucide-react";
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

function specialtyItemsFromMatrix(
  businessRole: BusinessRole | null | undefined,
  matrix: PermissionMatrix,
): PortalNavItem[] {
  return specialtyNavFromEffectiveMatrix(businessRole, matrix).map((item) => ({
    to: item.to,
    label: item.label,
    icon: SPECIALTY_ICONS[item.to],
    section: "Modules",
  }));
}

/** Build staff sidebar from business role + effective (persisted) permission matrix. */
export function buildStaffNav(
  businessRole: BusinessRole | null | undefined,
  matrix: PermissionMatrix = cloneDefaultPermissionMatrix(),
): PortalNavItem[] {
  const specialtyItems = specialtyItemsFromMatrix(businessRole, matrix);

  if (isFrontDeskBusinessRole(businessRole)) {
    const seen = new Set(frontDeskNav.map((i) => i.to));
    const merged = [...frontDeskNav];
    for (const item of specialtyItems) {
      if (!seen.has(item.to)) {
        merged.push(item);
        seen.add(item.to);
      }
    }
    return merged;
  }

  if (shouldIncludeCounsellorCrmNav(businessRole)) {
    const crm = [...consultantNav];
    const crmTos = new Set(crm.map((i) => i.to));
    for (const item of specialtyItems) {
      if (!crmTos.has(item.to)) crm.push(item);
    }
    return crm;
  }

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
