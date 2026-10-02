import { createFileRoute } from "@tanstack/react-router";
import { Upload, Download } from "lucide-react";
import { PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/import-export")({
  component: AdminImportExport,
});

function AdminImportExport() {
  return (
    <div>
      <PageHeader
        title="Import / Export"
        subtitle="UI placeholder — CSV operations are not wired to a backend."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Import students">
          <p className="text-sm text-muted-foreground">
            Upload a CSV with columns: name, email, destination, program. Processing will be enabled
            when API integration is added.
          </p>
          <Button type="button" className="mt-4" variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" /> Choose CSV file
          </Button>
        </Panel>
        <Panel title="Export data">
          <p className="text-sm text-muted-foreground">
            Download demo snapshots for students, leads, or applications.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled>
              <Download className="mr-2 h-4 w-4" /> Students
            </Button>
            <Button type="button" variant="secondary" disabled>
              <Download className="mr-2 h-4 w-4" /> Leads
            </Button>
            <Button type="button" variant="secondary" disabled>
              <Download className="mr-2 h-4 w-4" /> Applications
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
