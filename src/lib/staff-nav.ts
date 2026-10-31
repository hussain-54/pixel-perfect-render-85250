/**
 * Pure staff sidebar builder — uses effective permission matrix for specialty modules.
 */
import type { PortalNavItem } from "@/components/portal/PortalShell";
import {
  canViewModuleInMatrix,
  cloneDefaultPermissionMatrix,
  type BusinessModule,
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

/** Matrix module required to show a CRM nav item (null = always for CRM desks). */
const CRM_NAV_MODULE: Partial<Record<PortalNavItem["to"], BusinessModule | null>> = {
  "/staff/dashboard": null,
  "/staff/students": "students",
  "/staff/appointments": "counselling",
  "/staff/applications": "admissions",
  "/staff/documents": "documents",
  "/staff/offers": "admissions",
  "/staff/tasks": "counselling",
  "/staff/leads": "digital_marketing",
  "/staff/reports": "reports",
  "/staff/activity": "students",
};

function filterCrmNavByMatrix(
  items: PortalNavItem[],
  businessRole: BusinessRole | null | undefined,
  matrix: PermissionMatrix,
): PortalNavItem[] {
  return items.filter((item) => {
    const mod = CRM_NAV_MODULE[item.to];
    if (mod === undefined || mod === null) return true;
    return canViewModuleInMatrix(matrix, businessRole, mod);
  });
}

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
  // Only the first specialty item carries the section label — avoids repeating "Modules".
  return specialtyNavFromEffectiveMatrix(businessRole, matrix).map((item, index) => ({
    to: item.to,
    label: item.label,
    icon: SPECIALTY_ICONS[item.to],
    ...(index === 0 ? { section: "Modules" as const } : {}),
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
    // Admission Team: CRM shell without counsellor-only Leads; Workspace label on first item.
    const crmBase =
      businessRole === "admission_team"
        ? consultantNav.filter((i) => i.to !== "/staff/leads")
        : consultantNav;
    const crm = filterCrmNavByMatrix(crmBase, businessRole, matrix).map((item, index) =>
      businessRole === "admission_team" && index === 0
        ? { ...item, section: "Workspace" as const }
        : item,
    );
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
