import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { UniversityCard, CtaBand, CatalogueSampleNotice } from "@/components/site/blocks";
import {
  FilterSelect,
  EmptyState,
  LoadingRows,
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import type { CatalogListFilters } from "@/lib/catalog-rules";
import { listPublishedUniversities } from "@/services";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/universities")({
  validateSearch: z.object({ q: z.string().optional(), country: z.string().optional() }),
  head: () =>
    pageHead({
      path: "/universities",
      title: "Universities — Global Roots Consultants",
      description: "Browse partner university listings by country, study level and program.",
    }),
  component: Page,
});

function Page() {
  const sp = Route.useSearch();
  const [q, setQ] = useState(sp.q ?? "");
  const [country, setCountry] = useState(sp.country ?? "");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["universities", "public", q, country, level, page],
    queryFn: () => {
      const filters: CatalogListFilters = { page, pageSize: 24 };
      if (q.trim()) filters.q = q.trim();
      if (country) filters.country = country;
      if (level) filters.level = level;
      return listPublishedUniversities(filters);
    },
    staleTime: 60_000,
  });

  const all = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 24)));

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Universities"
        title="Find your university"
        body="Search partner listings and filter by what matters to you — then confirm options with a consultant."
      />
      <section className="container-page section-y">
        {data?.source === "demo" ? <CatalogueSampleNotice kind="universities" /> : null}
        {data?.source === "unavailable" ? (
          <p
            role="note"
            className="mb-6 border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground"
          >
            The live university catalog is not available right now. Contact a consultant for current
            partner options.
          </p>
        ) : null}
        <div className="mb-8 flex flex-wrap gap-2.5 border-b border-border pb-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <label className="sr-only" htmlFor="uni-search">
              Search universities
            </label>
            <input
              id="uni-search"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search universities"
              className="h-11 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm text-navy focus:border-royal/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <FilterSelect
            label="Country"
            value={country}
            onChange={(v) => {
              setPage(1);
              setCountry(v);
            }}
            options={data?.countries ?? []}
          />
          <FilterSelect
            label="Level"
            value={level}
            onChange={(v) => {
              setPage(1);
              setLevel(v);
            }}
            options={data?.levels ?? []}
          />
        </div>
        {isLoading ? (
          <LoadingRows rows={6} />
        ) : isError ? (
          <ErrorState body={portalErrorMessage(error)} />
        ) : all.length === 0 ? (
          <EmptyState
            title="No universities"
            body={
              q || country || level
                ? "No universities match these filters. Try clearing a filter."
                : "There are no partner universities listed yet. Speak with a consultant about current options."
            }
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {all.map((u) => (
                <UniversityCard key={u.id} u={u} />
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
