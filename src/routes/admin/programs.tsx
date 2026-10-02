import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common";
import { programCategories } from "@/data/site";

export const Route = createFileRoute("/admin/programs")({
  component: AdminPrograms,
});

function AdminPrograms() {
  return (
    <div>
      <PageHeader title="Programs" subtitle="Category catalog from site content (demo counts)." />
      <div className="grid gap-4 md:grid-cols-2">
        {programCategories.map((cat) => (
          <Panel key={cat.name} title={cat.name}>
            <p className="font-display text-2xl font-semibold text-navy">
              {cat.count.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Listed programs (marketing estimate)
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{cat.examples}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
