import { useMemo } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "organization", label: "Organization" },
  { id: "notifications", label: "Notifications" },
  { id: "system", label: "System Preferences" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: unknown): TabId {
  const value = typeof raw === "string" ? raw : "";
  return (TABS.find((t) => t.id === value)?.id ?? "organization") as TabId;
}

export const Route = createFileRoute("/admin/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseTab(search["tab"]),
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const navigate = useNavigate();
  const tab = useRouterState({
    select: (s) => parseTab((s.location.search as { tab?: string }).tab),
  });

  const subnav = useMemo(
    () =>
      TABS.map((t) => ({
        to: "/admin/settings",
        label: t.label,
        tab: t.id,
      })),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Organization profile, notification preferences, and system options. User accounts and the permission matrix live under Users & Roles."
      />
      <AdminModuleSubnav items={subnav} />

      <Tabs
        value={tab}
        onValueChange={(next) => {
          void navigate({
            href: `/admin/settings?tab=${encodeURIComponent(parseTab(next))}`,
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

        <TabsContent value="organization">
          <form
            className="grid max-w-2xl gap-6"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Panel title="Organization">
              <p className="mb-4 text-xs text-muted-foreground">
                Preview only — not saved to Supabase yet.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org-name">Consultancy name</Label>
                  <Input id="org-name" defaultValue="Global Roots Consultants" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="support-email">Support email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    defaultValue="support@globalroots.pk"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="footer">Portal footer note</Label>
                  <Textarea
                    id="footer"
                    defaultValue="Global Roots Consultants — secure client portal."
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
              </div>
            </Panel>
            <Button type="submit" className="w-fit" disabled>
              Save organization settings (coming soon)
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="notifications">
          <Panel title="Notifications">
            <p className="mb-3 text-xs text-muted-foreground">
              Preview toggles — not persisted. Live notification delivery remains on the dedicated
              notifications tools where implemented.
            </p>
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-semibold text-navy">Email admins on new leads</p>
                <p className="text-xs text-muted-foreground">Preview toggle</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-4 border-t py-2">
              <div>
                <p className="text-sm font-semibold text-navy">Student document alerts</p>
                <p className="text-xs text-muted-foreground">
                  Notify consultants when uploads arrive
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              For the full notifications workspace, open{" "}
              <Link
                to="/admin/notifications"
                className="font-medium text-bright underline-offset-2 hover:underline"
              >
                Notifications
              </Link>
              .
            </p>
          </Panel>
        </TabsContent>

        <TabsContent value="system">
          <Panel title="System Preferences">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Import / export and operational utilities remain available without cluttering the
                main sidebar.
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <Link
                    to="/admin/import-export"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Import / Export
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/audit-logs"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Audit Logs
                  </Link>{" "}
                  (existing route — not duplicated)
                </li>
                <li>
                  <Link
                    to="/change-password"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Change password
                  </Link>
                </li>
              </ul>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
