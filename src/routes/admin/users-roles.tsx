import { useMemo } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
import { AdminAccountManagement } from "@/components/portal/AdminAccountManagement";
import { AdminPermissionMatrix } from "@/components/portal/AdminPermissionMatrix";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";

const TABS = [
  { id: "users", label: "User Management" },
  { id: "create", label: "Create User Account" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "actions", label: "Account Actions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: unknown): TabId {
  const value = typeof raw === "string" ? raw : "";
  return (TABS.find((t) => t.id === value)?.id ?? "users") as TabId;
}

export const Route = createFileRoute("/admin/users-roles")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseTab(search["tab"]),
  }),
  component: AdminUsersRoles,
});

function AdminUsersRoles() {
  const tab = useRouterState({
    select: (s) => parseTab((s.location.search as { tab?: string }).tab),
  });

  const subnav = useMemo(
    () =>
      TABS.map((t) => ({
        to: "/admin/users-roles",
        label: t.label,
        tab: t.id,
      })),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage portal accounts, business-role permissions, and account actions."
      />
      <AdminModuleSubnav items={subnav} />

      {tab === "users" ? (
        <Panel title="User Management">
          <p className="mb-4 text-sm text-muted-foreground">
            Search and update existing portal accounts and business roles.
          </p>
          <AdminAccountManagement focus="directory" />
        </Panel>
      ) : null}

      {tab === "create" ? (
        <Panel title="Create User Account">
          <p className="mb-4 text-sm text-muted-foreground">
            Provision a new Auth user with an app role and business role. Existing emails are
            rejected.
          </p>
          <AdminAccountManagement focus="create" />
        </Panel>
      ) : null}

      {tab === "roles" ? (
        <Panel title="Roles & Permissions">
          <p className="mb-4 text-sm text-muted-foreground">
            Approved business-role matrix. Edits persist when the live permissions table is
            available.
          </p>
          <AdminPermissionMatrix />
        </Panel>
      ) : null}

      {tab === "actions" ? (
        <Panel title="Account Actions">
          <p className="mb-4 text-sm text-muted-foreground">
            Reset passwords, revoke sessions, update consultant desk status, and reassign roles.
          </p>
          <AdminAccountManagement focus="actions" />
        </Panel>
      ) : null}
    </div>
  );
}
