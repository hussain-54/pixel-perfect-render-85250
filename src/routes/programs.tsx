import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand, CatalogueSampleNotice } from "@/components/site/blocks";
import {
  FilterSelect,
  EmptyState,
  LoadingRows,
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import type { CatalogListFilters } from "@/lib/catalog-rules";
import { listPublishedPrograms } from "@/services";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/programs")({
  head: () =>
    pageHead({
      path: "/programs",
      title: "Programs — Global Roots Consultants",
      description:
        "Browse live partner programs by university, study level and field — then speak with a consultant.",
    }),
  component: Page,
});

function Page() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["programs", "public", q, level, page],
    queryFn: () => {
      const filters: CatalogListFilters = { page, pageSize: 24 };
      if (q.trim()) filters.q = q.trim();
      if (level) filters.level = level;
      return listPublishedPrograms(filters);
    },
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 24)));

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Programs"
        title="Programs and fields of study"
        body="Browse partner programs from our live catalog. Confirm fit, intake and fees with a Global Roots consultant."
      />
      <section className="container-page section-y">
        {data?.source === "demo" ? <CatalogueSampleNotice kind="universities" /> : null}
        {data?.source === "unavailable" ? (
          <p
            role="note"
            className="mb-6 border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground"
          >
            The live program catalog is not available right now. Contact a consultant for current
            options.
          </p>
        ) : null}

        <div className="mb-8 flex flex-wrap gap-2.5 border-b border-border pb-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <label className="sr-only" htmlFor="prog-search">
              Search programs
            </label>
            <input
              id="prog-search"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search programs or universities"
              className="h-11 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm text-navy focus:border-royal/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
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
        ) : rows.length === 0 ? (
          <EmptyState
            title="No programs"
            body={
              q || level
                ? "No programs match these filters. Try clearing a filter."
                : "There are no programs listed yet. Speak with a consultant about current options."
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p) => (
                <article key={p.id} className="panel flex flex-col p-5">
                  <h2 className="font-sans text-[0.95rem] font-semibold text-navy">{p.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{p.universityName}</p>
                  <p className="mt-3 text-sm text-foreground/80">
                    {p.level}
                    {p.duration !== "—" ? ` · ${p.duration}` : ""}
                  </p>
                  {p.tuitionFee !== "—" ? (
                    <p className="mt-1 text-xs text-muted-foreground">Tuition: {p.tuitionFee}</p>
                  ) : null}
                  <Link
                    to="/contact"
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-royal hover:text-navy"
                  >
                    Enquire <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
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
