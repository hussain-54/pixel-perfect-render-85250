import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { ScholarshipCard, CtaBand } from "@/components/site/blocks";
import { FilterSelect, EmptyState, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getScholarships } from "@/services";

export const Route = createFileRoute("/scholarships")({
  head: () => ({
    meta: [
      { title: "Scholarships — Global Roots Consultants" },
      { name: "description", content: "Fully funded, partial and tuition-waiver scholarships for international students." },
      { property: "og:title", content: "Scholarships — Global Roots Consultants" },
      { property: "og:description", content: "Find scholarships by country, degree level, funding type and field." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useData(["scholarships"], getScholarships);
  const [f, setF] = useState({ country: "", level: "", funding: "", field: "" });
  const all = data ?? [];
  const list = all.filter((s) => (!f.country || s.country === f.country) && (!f.level || s.level === f.level) && (!f.funding || s.funding === f.funding) && (!f.field || s.field === f.field));
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <SiteLayout>
      <PageHero eyebrow="Scholarships" title="Funding your future" body="Explore scholarships our students have won — and learn which ones you qualify for." />
      <section className="container-page py-12">
        <div className="panel mb-8 flex flex-wrap gap-3 p-4">
          <FilterSelect label="Country" value={f.country} onChange={set("country")} options={uniq(all.map((s) => s.country))} />
          <FilterSelect label="Degree" value={f.level} onChange={set("level")} options={uniq(all.map((s) => s.level))} />
          <FilterSelect label="Funding" value={f.funding} onChange={set("funding")} options={["Fully Funded", "Partial Funding", "Tuition Waiver"]} />
          <FilterSelect label="Field" value={f.field} onChange={set("field")} options={uniq(all.map((s) => s.field))} />
        </div>
        {isLoading ? <LoadingRows rows={6} /> : list.length === 0 ? <EmptyState title="No scholarships match" body="Try clearing a filter." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((s) => <ScholarshipCard key={s.id} s={s} />)}</div>
        )}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
