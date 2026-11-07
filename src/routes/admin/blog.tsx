import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ErrorState,
  InlineFeedback,
  PageHeader,
  PageLoadState,
  Panel,
  StatCard,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteBlogPost,
  getBlogDashboard,
  listBlogPosts,
  listBlogTaxonomy,
  saveBlogAuthor,
  saveBlogCategory,
  saveBlogTag,
} from "@/services";
import type { BlogPostStatus } from "@/lib/blog-types";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "all", label: "All Articles" },
  { id: "drafts", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
  { id: "categories", label: "Categories" },
  { id: "tags", label: "Tags" },
  { id: "authors", label: "Authors" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: unknown): TabId {
  const value = typeof raw === "string" ? raw : "";
  return (TABS.find((t) => t.id === value)?.id ?? "dashboard") as TabId;
}

const STATUS_FOR_TAB: Partial<Record<TabId, BlogPostStatus | "all">> = {
  all: "all",
  drafts: "draft",
  scheduled: "scheduled",
  published: "published",
  archived: "archived",
};

export const Route = createFileRoute("/admin/blog")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseTab(search["tab"]),
    q: typeof search["q"] === "string" ? search["q"] : "",
    page: Math.max(1, Number(search["page"]) || 1),
  }),
  component: AdminBlogPage,
});

function AdminBlogPage() {
  const { tab, q, page } = Route.useSearch();
  const dashQ = useQuery({
    queryKey: ["admin", "blog", "dashboard"],
    queryFn: () => getBlogDashboard(),
    staleTime: 10_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Blog" subtitle="Write, schedule and publish articles." />
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="/blog" target="_blank" rel="noreferrer">
              Open public blog
            </a>
          </Button>
          <Button asChild size="sm" variant="navy">
            <Link to="/admin/blog/edit">Create article</Link>
          </Button>
        </div>
      </div>

      <AdminModuleSubnav
        items={TABS.map((t) => ({
          to: "/admin/blog",
          label: t.label,
          tab: t.id,
        }))}
      />

      {dashQ.isLoading ? (
        <PageLoadState title="Blog" subtitle="Loading…">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </PageLoadState>
      ) : null}
      {dashQ.isError ? <ErrorState body={portalErrorMessage(dashQ.error)} /> : null}

      {dashQ.data && !dashQ.data.schemaReady ? (
        <Panel compact title="Setup required">
          <p className="text-sm text-muted-foreground">
            {dashQ.data.note || "Apply the blog platform migration before managing articles."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <code>20261108140000_blog_platform_foundation.sql</code>
          </p>
        </Panel>
      ) : null}

      {tab === "dashboard" && dashQ.data ? <DashboardTab data={dashQ.data} /> : null}
      {tab in STATUS_FOR_TAB ? (
        <ArticlesTab
          status={STATUS_FOR_TAB[tab as keyof typeof STATUS_FOR_TAB]!}
          search={q}
          page={page}
          enabled={Boolean(dashQ.data?.schemaReady)}
        />
      ) : null}
      {tab === "categories" ? <CategoriesTab enabled={Boolean(dashQ.data?.schemaReady)} /> : null}
      {tab === "tags" ? <TagsTab enabled={Boolean(dashQ.data?.schemaReady)} /> : null}
      {tab === "authors" ? <AuthorsTab enabled={Boolean(dashQ.data?.schemaReady)} /> : null}
    </div>
  );
}

function DashboardTab({ data }: { data: Awaited<ReturnType<typeof getBlogDashboard>> }) {
  const recentQ = useQuery({
    queryKey: ["admin", "blog", "recent"],
    queryFn: () => listBlogPosts({ page: 1, pageSize: 8 }),
    enabled: data.schemaReady,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total articles" value={String(data.total)} />
        <StatCard label="Published" value={String(data.published)} />
        <StatCard label="Drafts" value={String(data.drafts)} />
        <StatCard label="Scheduled" value={String(data.scheduled)} />
        <StatCard label="Archived" value={String(data.archived)} />
      </div>
      <Panel compact title="Recently updated">
        {recentQ.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {recentQ.data?.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No articles yet. Create your first article.
          </p>
        ) : (
          <ul className="divide-y border-y border-border text-sm">
            {(recentQ.data?.rows ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-navy">{row.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status} · updated {fmtDate(row.updatedAt)}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin/blog/edit" search={{ id: row.id }}>
                    Edit
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ArticlesTab({
  status,
  search,
  page,
  enabled,
}: {
  status: BlogPostStatus | "all";
  search: string;
  page: number;
  enabled: boolean;
}) {
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [localQ, setLocalQ] = useState(search);
  const listQ = useQuery({
    queryKey: ["admin", "blog", "list", status, search, page],
    queryFn: () => {
      const data: {
        status?: string;
        search?: string;
        page?: number;
        pageSize?: number;
      } = { page, pageSize: 20 };
      if (status !== "all") data.status = status;
      if (search) data.search = search;
      return listBlogPosts(data);
    },
    enabled,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBlogPost(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
  });

  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / 20));

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({
            search: (prev: { tab: TabId; q: string; page: number }) => ({
              ...prev,
              q: localQ,
              page: 1,
            }),
          });
        }}
      >
        <Input
          value={localQ}
          placeholder="Search title, slug or excerpt…"
          className="max-w-sm"
          onChange={(e) => setLocalQ(e.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>

      {listQ.isLoading ? (
        <PageLoadState title="Articles" subtitle="Loading…">
          <p className="text-sm text-muted-foreground">Loading articles…</p>
        </PageLoadState>
      ) : null}
      {listQ.isError ? <ErrorState body={portalErrorMessage(listQ.error)} /> : null}

      {listQ.data ? (
        <Panel compact title={`${listQ.data.total} article${listQ.data.total === 1 ? "" : "s"}`}>
          {listQ.data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles in this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Updated</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listQ.data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-navy">{row.title || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">/{row.slug}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.categoryName ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {fmtDate(row.updatedAt)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                            <Link to="/admin/blog/edit" search={{ id: row.id }}>
                              Edit
                            </Link>
                          </Button>
                          {row.status === "published" ? (
                            <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                              <a href={`/blog/${row.slug}`} target="_blank" rel="noreferrer">
                                View
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive"
                            disabled={deleteMut.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete “${row.title || row.slug}”? This cannot be undone.`,
                                )
                              ) {
                                deleteMut.mutate(row.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() =>
                  void navigate({
                    search: (prev: { tab: TabId; q: string; page: number }) => ({
                      ...prev,
                      page: Math.max(1, page - 1),
                    }),
                  })
                }
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  void navigate({
                    search: (prev: { tab: TabId; q: string; page: number }) => ({
                      ...prev,
                      page: Math.min(totalPages, page + 1),
                    }),
                  })
                }
              >
                Next
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {deleteMut.isError ? (
        <InlineFeedback kind="err">{portalErrorMessage(deleteMut.error)}</InlineFeedback>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
        status === "published" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        status === "draft" && "border-border bg-muted/60 text-muted-foreground",
        status === "scheduled" && "border-amber-200 bg-amber-50 text-amber-900",
        status === "archived" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function CategoriesTab({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const taxQ = useQuery({
    queryKey: ["admin", "blog-taxonomy"],
    queryFn: () => listBlogTaxonomy(),
    enabled,
  });
  const saveMut = useMutation({
    mutationFn: () => saveBlogCategory({ name }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog-taxonomy"] });
    },
  });

  return (
    <TaxonomyShell
      title="Categories"
      enabled={enabled}
      loading={taxQ.isLoading}
      error={taxQ.error}
      items={(taxQ.data?.categories ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        meta: c.slug,
      }))}
      form={
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) saveMut.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" size="sm" variant="navy" disabled={saveMut.isPending}>
            Add category
          </Button>
        </form>
      }
      saveError={saveMut.error}
    />
  );
}

function TagsTab({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const taxQ = useQuery({
    queryKey: ["admin", "blog-taxonomy"],
    queryFn: () => listBlogTaxonomy(),
    enabled,
  });
  const saveMut = useMutation({
    mutationFn: () => saveBlogTag({ name }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog-taxonomy"] });
    },
  });

  return (
    <TaxonomyShell
      title="Tags"
      enabled={enabled}
      loading={taxQ.isLoading}
      error={taxQ.error}
      items={(taxQ.data?.tags ?? []).map((t) => ({ id: t.id, label: t.name, meta: t.slug }))}
      form={
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) saveMut.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" size="sm" variant="navy" disabled={saveMut.isPending}>
            Add tag
          </Button>
        </form>
      }
      saveError={saveMut.error}
    />
  );
}

function AuthorsTab({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const taxQ = useQuery({
    queryKey: ["admin", "blog-taxonomy"],
    queryFn: () => listBlogTaxonomy(),
    enabled,
  });
  const saveMut = useMutation({
    mutationFn: () => saveBlogAuthor({ displayName, bio }),
    onSuccess: () => {
      setDisplayName("");
      setBio("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog-taxonomy"] });
    },
  });

  return (
    <TaxonomyShell
      title="Authors"
      enabled={enabled}
      loading={taxQ.isLoading}
      error={taxQ.error}
      items={(taxQ.data?.authors ?? []).map((a) => ({
        id: a.id,
        label: a.displayName,
        meta: a.active ? "Active" : "Inactive",
      }))}
      form={
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (displayName.trim()) saveMut.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="author-name">Display name</Label>
            <Input
              id="author-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="author-bio">Bio</Label>
            <Input id="author-bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <Button type="submit" size="sm" variant="navy" disabled={saveMut.isPending}>
            Add author
          </Button>
        </form>
      }
      saveError={saveMut.error}
    />
  );
}

function TaxonomyShell({
  title,
  enabled,
  loading,
  error,
  items,
  form,
  saveError,
}: {
  title: string;
  enabled: boolean;
  loading: boolean;
  error: unknown;
  items: { id: string; label: string; meta: string }[];
  form: ReactNode;
  saveError: unknown;
}) {
  const note = useMemo(() => {
    if (!enabled) return "Apply the blog migration to manage taxonomy.";
    return null;
  }, [enabled]);

  return (
    <div className="space-y-3">
      {note ? <InlineFeedback kind="warn">{note}</InlineFeedback> : null}
      <Panel compact title={`Add ${title.toLowerCase().replace(/s$/, "")}`}>
        {form}
        {saveError ? (
          <div className="mt-2">
            <InlineFeedback kind="err">{portalErrorMessage(saveError)}</InlineFeedback>
          </div>
        ) : null}
      </Panel>
      <Panel compact title={title}>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <InlineFeedback kind="err">{portalErrorMessage(error)}</InlineFeedback> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y border-y border-border text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-medium text-navy">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
