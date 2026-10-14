import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
import { AdminAccountManagement } from "@/components/portal/AdminAccountManagement";
import { AdminPermissionMatrix } from "@/components/portal/AdminPermissionMatrix";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Settings"
        subtitle="Role permissions persist to Supabase. User & Account Management uses live Auth. Organization and notification fields below are a configuration preview only."
      />

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
        <Panel title="Notifications">
          <p className="mb-3 text-xs text-muted-foreground">
            Preview only — toggles are not persisted.
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
        </Panel>
        <Button type="submit" className="w-fit" disabled>
          Save organization settings (coming soon)
        </Button>
      </form>

      <div className="border-t border-border pt-8">
        <AdminPermissionMatrix />
      </div>

      <div className="border-t border-border pt-8">
        <AdminAccountManagement />
      </div>
    </div>
  );
}
