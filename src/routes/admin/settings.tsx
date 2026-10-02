import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
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
    <div>
      <PageHeader title="Settings" subtitle="Configuration preview — changes are not persisted." />
      <form
        className="grid max-w-2xl gap-6"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Panel title="Organization">
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
                defaultValue="Mock data only — connect Supabase or your API to go live."
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
        </Panel>
        <Panel title="Notifications">
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <p className="text-sm font-semibold text-navy">Email admins on new leads</p>
              <p className="text-xs text-muted-foreground">Demo toggle only</p>
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
          Save settings (demo)
        </Button>
      </form>
    </div>
  );
}
