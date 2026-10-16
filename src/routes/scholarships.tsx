import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { ScholarshipCard, CtaBand } from "@/components/site/blocks";
import { FilterSelect, EmptyState, LoadingRows, ErrorState, portalErrorMessage } from "@/components/common";
import type { ScholarshipListFilters } from "@/lib/scholarship-rules";
import { listPublishedScholarships } from "@/services";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/scholarships")({
  head: () =>
    pageHead({
      path: "/scholarships",
      title: "Scholarships — Global Roots Consultants",
      description:
        "Browse published scholarships by country, degree level, funding type and field.",
    }),
  component: Page,
});

function Page() {
  const [f, setF] = useState({ country: "", level: "", funding: "", field: "" });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["scholarships", "published", f.country, f.level, f.funding],
    queryFn: () => {
      const filters: ScholarshipListFilters = { pageSize: 100 };
      if (f.country) filters.country = f.country;
      if (f.level) filters.level = f.level;
      if (f.funding) filters.funding = f.funding;
      return listPublishedScholarships(filters);
    },
    staleTime: 60_000,
  });

  const all = data?.rows ?? [];
  const list = all.filter((s) => !f.field || s.field === f.field);
  const uniq = (xs: string[]) => [...new Set(xs.filter((x) => x && x !== "—"))].sort();
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Scholarships"
        title="Scholarships and funding"
        body="Published awards and funding opportunities. Confirm eligibility and deadlines with a Global Roots consultant before applying."
      />
      <section className="container-page section-y">
        {data?.source === "unavailable" ? (
          <p
            role="note"
            className="mb-6 border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground"
          >
            The live scholarship catalog is not available yet. Check back after listings are
            published, or contact a consultant for current opportunities.
          </p>
        ) : null}
        <div className="mb-8 flex flex-wrap gap-2.5 border-b border-border pb-5">
          <FilterSelect
            label="Country"
            value={f.country}
            onChange={set("country")}
            options={uniq(all.map((s) => s.country))}
          />
          <FilterSelect
            label="Degree"
            value={f.level}
            onChange={set("level")}
            options={uniq(all.map((s) => s.level))}
          />
          <FilterSelect
            label="Funding"
            value={f.funding}
            onChange={set("funding")}
            options={["Fully Funded", "Partial Funding", "Tuition Waiver"]}
          />
          <FilterSelect
            label="Field"
            value={f.field}
            onChange={set("field")}
            options={uniq(all.map((s) => s.field))}
          />
        </div>
        {isLoading ? (
          <LoadingRows rows={6} />
        ) : isError ? (
          <ErrorState body={portalErrorMessage(error)} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No published scholarships"
            body={
              f.country || f.level || f.funding || f.field
                ? "No published scholarships match these filters. Try clearing a filter."
                : "There are no published scholarships right now. Speak with a consultant about current funding options."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <ScholarshipCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
