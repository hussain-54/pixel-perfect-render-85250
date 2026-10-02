import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Search } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { UniversityCard, CtaBand } from "@/components/site/blocks";
import { FilterSelect, EmptyState, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getUniversities } from "@/services";

export const Route = createFileRoute("/universities")({
  validateSearch: z.object({ q: z.string().optional(), country: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Universities — Global Roots Consultants" },
      {
        name: "description",
        content: "Search partner universities by country, study level and program.",
      },
      { property: "og:title", content: "Universities — Global Roots Consultants" },
      { property: "og:description", content: "Discover 1,500+ partner universities worldwide." },
    ],
  }),
  component: Page,
});

function Page() {
  const sp = Route.useSearch();
  const { data, isLoading } = useData(["universities"], getUniversities);
  const [q, setQ] = useState(sp.q ?? "");
  const [country, setCountry] = useState(sp.country ?? "");
  const [level, setLevel] = useState("");
  const [program, setProgram] = useState("");
  const all = data ?? [];
  const list = all.filter(
    (u) =>
      (!q || u.name.toLowerCase().includes(q.toLowerCase())) &&
      (!country || u.country === country) &&
      (!level || u.levels.includes(level)) &&
      (!program || u.programs.includes(program)),
  );
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Universities"
        title="Find your university"
        body="Search our partner institutions and filter by what matters to you."
      />
      <section className="container-page section-y">
        <div className="mb-8 flex flex-wrap gap-2.5 border-b border-border pb-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <label className="sr-only" htmlFor="uni-search">
              Search universities
            </label>
            <input
              id="uni-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search universities"
              className="h-11 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm text-navy focus:border-royal/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <FilterSelect
            label="Country"
            value={country}
            onChange={setCountry}
            options={uniq(all.map((u) => u.country))}
          />
          <FilterSelect
            label="Level"
            value={level}
            onChange={setLevel}
            options={uniq(all.flatMap((u) => u.levels))}
          />
          <FilterSelect
            label="Program"
            value={program}
            onChange={setProgram}
            options={uniq(all.flatMap((u) => u.programs))}
          />
        </div>
        {isLoading ? (
          <LoadingRows rows={6} />
        ) : list.length === 0 ? (
          <EmptyState title="No universities match" body="Try clearing a filter." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {list.map((u) => (
              <UniversityCard key={u.id} u={u} />
            ))}
          </div>
        )}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
