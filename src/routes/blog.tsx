import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { fmtDate, PageLoadState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPublishedBlogCategories, listPublishedBlogPosts } from "@/services";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search["category"] === "string" ? search["category"] : "",
    q: typeof search["q"] === "string" ? search["q"] : "",
    page: Math.max(1, Number(search["page"]) || 1),
  }),
  head: () =>
    pageHead({
      path: "/blog",
      title: "Blog — Global Roots Consultants",
      description:
        "Insights on studying abroad, visas, scholarships and applications from Global Roots Consultants.",
    }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { category, q, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchDraft, setSearchDraft] = useState(q);

  const postsQ = useQuery({
    queryKey: ["public", "blog", category, q, page],
    queryFn: () =>
      listPublishedBlogPosts({
        page,
        pageSize: 9,
        category: category || undefined,
        search: q || undefined,
      }),
  });

  const catsQ = useQuery({
    queryKey: ["public", "blog-categories"],
    queryFn: () => listPublishedBlogCategories(),
    staleTime: 60_000,
  });

  const featured = useMemo(
    () => postsQ.data?.rows.find((r) => r.isFeatured) ?? postsQ.data?.rows[0] ?? null,
    [postsQ.data],
  );
  const rest = useMemo(() => {
    const rows = postsQ.data?.rows ?? [];
    if (!featured) return rows;
    return rows.filter((r) => r.id !== featured.id);
  }, [postsQ.data, featured]);

  const totalPages = Math.max(1, Math.ceil((postsQ.data?.total ?? 0) / 9));

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Blog"
        title="Insights for your study abroad journey"
        body="Practical guidance from consultants who support students from first conversation to campus arrival."
      />

      <section className="container-page section-y space-y-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/" className="hover:text-royal">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-navy">Blog</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={!category}
              label="All"
              onClick={() =>
                void navigate({
                  search: (s: { category: string; q: string; page: number }) => ({
                    ...s,
                    category: "",
                    page: 1,
                  }),
                })
              }
            />
            {(catsQ.data ?? []).map((c) => (
              <FilterChip
                key={c.slug}
                active={category === c.slug}
                label={c.name}
                onClick={() =>
                  void navigate({
                    search: (s: { category: string; q: string; page: number }) => ({
                      ...s,
                      category: c.slug,
                      page: 1,
                    }),
                  })
                }
              />
            ))}
          </div>
          <form
            className="flex w-full max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void navigate({
                search: (s: { category: string; q: string; page: number }) => ({
                  ...s,
                  q: searchDraft,
                  page: 1,
                }),
              });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search articles…"
                className="pl-9"
                aria-label="Search articles"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Search
            </Button>
          </form>
        </div>

        {postsQ.isLoading ? (
          <PageLoadState title="Blog" subtitle="Loading articles…">
            <p className="text-sm text-muted-foreground">Loading articles…</p>
          </PageLoadState>
        ) : null}

        {!postsQ.isLoading && (postsQ.data?.rows.length ?? 0) === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <h2 className="font-display text-2xl font-semibold text-navy">No articles yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Published articles will appear here. Check back soon, or explore our resources.
            </p>
            <Button asChild className="mt-6" variant="navy">
              <Link to="/resources">Browse resources</Link>
            </Button>
          </div>
        ) : null}

        {featured && page === 1 && !q ? (
          <Link
            to="/blog/$slug"
            params={{ slug: featured.slug }}
            className="group grid gap-6 border-y border-border py-8 lg:grid-cols-2 lg:gap-10"
          >
            {featured.featuredImageUrl ? (
              <img
                src={featured.featuredImageUrl}
                alt={featured.featuredImageAlt || featured.title}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="aspect-[16/10] w-full bg-muted" />
            )}
            <div className="flex flex-col justify-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                Featured
                {featured.categoryName ? ` · ${featured.categoryName}` : ""}
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-navy transition-colors group-hover:text-royal md:text-4xl">
                {featured.title}
              </h2>
              {featured.excerpt ? (
                <p className="mt-3 text-muted-foreground leading-relaxed">{featured.excerpt}</p>
              ) : null}
              <p className="mt-4 text-xs text-muted-foreground">
                {featured.authorName ? `${featured.authorName} · ` : ""}
                {fmtDate(featured.publishedAt)} · {featured.readingTimeMinutes} min read
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-royal">
                Read article <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ) : null}

        {rest.length > 0 ? (
          <div>
            <h2 className="font-display text-xl font-semibold text-navy">Latest articles</h2>
            <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.id}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group block h-full"
                  >
                    {post.featuredImageUrl ? (
                      <img
                        src={post.featuredImageUrl}
                        alt={post.featuredImageAlt || post.title}
                        className="aspect-[16/10] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-muted" />
                    )}
                    <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                      {post.categoryName || "Article"}
                    </p>
                    <h3 className="mt-1 font-sans text-[1.05rem] font-semibold text-navy transition-colors group-hover:text-royal">
                      {post.title}
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {post.excerpt}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {fmtDate(post.publishedAt)} · {post.readingTimeMinutes} min read
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() =>
                void navigate({
                  search: (s: { category: string; q: string; page: number }) => ({
                    ...s,
                    page: Math.max(1, page - 1),
                  }),
                })
              }
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() =>
                void navigate({
                  search: (s: { category: string; q: string; page: number }) => ({
                    ...s,
                    page: Math.min(totalPages, page + 1),
                  }),
                })
              }
            >
              Next
            </Button>
          </div>
        ) : null}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-border bg-white text-muted-foreground hover:border-royal/40 hover:text-navy",
      )}
    >
      {label}
    </button>
  );
}
