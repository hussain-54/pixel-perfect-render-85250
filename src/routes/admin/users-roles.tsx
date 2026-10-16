import { useMemo } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
import { AdminAccountManagement } from "@/components/portal/AdminAccountManagement";
import { AdminPermissionMatrix } from "@/components/portal/AdminPermissionMatrix";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const navigate = useNavigate();
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

  const accountFocus =
    tab === "create"
      ? "create"
      : tab === "actions"
        ? "actions"
        : tab === "users"
          ? "directory"
          : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage portal accounts, business-role permissions, and account actions. Technical admin access is required for changes."
      />
      <AdminModuleSubnav items={subnav} />

      <Tabs
        value={tab}
        onValueChange={(next) => {
          void navigate({
            href: `/admin/users-roles?tab=${encodeURIComponent(parseTab(next))}`,
          });
        }}
      >
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Panel title="User Management">
            <p className="mb-4 text-sm text-muted-foreground">
              Search, filter, review existing portal accounts, and update business roles without
              creating duplicates.
            </p>
            {accountFocus === "directory" ? <AdminAccountManagement focus="directory" /> : null}
          </Panel>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Panel title="Create User Account">
            <p className="mb-4 text-sm text-muted-foreground">
              Provision a new Auth user with an app role and business role. Existing emails are
              rejected.
            </p>
            {accountFocus === "create" ? <AdminAccountManagement focus="create" /> : null}
          </Panel>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Panel title="Roles & Permissions">
            <p className="mb-4 text-sm text-muted-foreground">
              Approved 10×12 business-role matrix. Edits persist to{" "}
              <code className="text-xs">business_module_permissions</code> when the live table is
              available.
            </p>
            <AdminPermissionMatrix />
          </Panel>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Panel title="Account Actions">
            <p className="mb-4 text-sm text-muted-foreground">
              Reset passwords, revoke sessions, update consultant desk status, and reassign business
              roles from the account list.
            </p>
            {accountFocus === "actions" ? <AdminAccountManagement focus="actions" /> : null}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
