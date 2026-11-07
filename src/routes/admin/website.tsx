import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ErrorState,
  InlineFeedback,
  PageHeader,
  PageLoadState,
  Panel,
  StatCard,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  getCmsAdminOverview,
  getCmsDocument,
  listCmsAnnouncements,
  listCmsRevisions,
  publishCmsDocument,
  restoreCmsRevision,
  saveCmsAnnouncement,
  saveCmsDraft,
} from "@/services";
import type { CmsAnnouncementInput, CmsFooterSettings, CmsHeaderSettings, CmsHomeSection, CmsNavSettings, CmsPageContent, CmsSeoSettings } from "@/lib/cms-types";
import { DEFAULT_CMS_HEADER, DEFAULT_CMS_FOOTER, DEFAULT_CMS_HOME, DEFAULT_CMS_NAV, DEFAULT_CMS_SEO_GLOBAL } from "@/lib/cms-defaults";
import { validateDocumentDraft } from "@/lib/cms-rules";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "header", label: "Header & Nav" },
  { id: "homepage", label: "Homepage" },
  { id: "footer", label: "Footer" },
  { id: "announcements", label: "Announcements" },
  { id: "seo", label: "SEO" },
  { id: "publishing", label: "Publish history" },
] as const;

const TAB_TO_DOCUMENT: Partial<Record<(typeof TABS)[number]["id"], string>> = {
  header: "site.header",
  homepage: "page.home",
  footer: "site.footer",
  seo: "seo.global",
};

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: unknown): TabId {
  const value = typeof raw === "string" ? raw : "";
  return (TABS.find((t) => t.id === value)?.id ?? "overview") as TabId;
}

export const Route = createFileRoute("/admin/website")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseTab(search["tab"]),
  }),
  component: AdminWebsiteCms,
});

function AdminWebsiteCms() {
  const tab = Route.useSearch({ select: (s) => s.tab });
  const queryClient = useQueryClient();
  const overviewQ = useQuery({
    queryKey: ["admin", "cms-overview"],
    queryFn: () => getCmsAdminOverview(),
    staleTime: 10_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Website" subtitle="Edit, save draft, then publish to the live site." />
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href="/" target="_blank" rel="noreferrer">
            Open live site
          </a>
        </Button>
      </div>
      <AdminModuleSubnav
        items={TABS.map((t) => ({
          to: "/admin/website",
          label: t.label,
          tab: t.id,
        }))}
      />

      {overviewQ.isLoading ? <PageLoadState label="Loading…" /> : null}
      {overviewQ.isError ? (
        <ErrorState
          title="Could not load Website"
          body={portalErrorMessage(overviewQ.error)}
        />
      ) : null}

      {overviewQ.data && !overviewQ.data.schemaReady ? (
        <Panel compact title="Setup required">
          <p className="text-sm text-muted-foreground">
            {overviewQ.data.note || "Apply the website CMS migration before editing."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <code>20261108120000_website_cms_foundation.sql</code>
          </p>
        </Panel>
      ) : null}

      {tab === "overview" && overviewQ.data ? <OverviewTab data={overviewQ.data} /> : null}
      {tab === "header" ? <HeaderNavTab enabled={Boolean(overviewQ.data?.schemaReady)} /> : null}
      {tab === "homepage" ? <HomepageTab enabled={Boolean(overviewQ.data?.schemaReady)} /> : null}
      {tab === "footer" ? <FooterTab enabled={Boolean(overviewQ.data?.schemaReady)} /> : null}
      {tab === "announcements" ? (
        <AnnouncementsTab enabled={Boolean(overviewQ.data?.schemaReady)} />
      ) : null}
      {tab === "seo" ? <SeoTab enabled={Boolean(overviewQ.data?.schemaReady)} /> : null}
      {tab === "publishing" ? (
        <PublishingTab
          enabled={Boolean(overviewQ.data?.schemaReady)}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ["admin", "cms-overview"] })}
        />
      ) : null}
    </div>
  );
}

function statusBadge(doc: { publishedVersion: number; hasUnpublishedChanges: boolean }) {
  if (doc.publishedVersion <= 0) {
    return (
      <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        Not published
      </span>
    );
  }
  if (doc.hasUnpublishedChanges) {
    return (
      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Draft pending
      </span>
    );
  }
  return (
    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
      Published
    </span>
  );
}

function OverviewTab({
  data,
}: {
  data: Awaited<ReturnType<typeof getCmsAdminOverview>>;
}) {
  const pending = data.documents.filter((d) => d.hasUnpublishedChanges).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Content areas" value={String(data.documents.length)} />
        <StatCard label="Drafts pending publish" value={String(pending)} />
        <StatCard label="Live announcements" value={String(data.announcementCount.published)} />
      </div>
      <Panel compact title="Status by area">
        <ul className="divide-y border-y border-border text-sm">
          {data.documents.map((doc) => {
            const tab =
              (Object.entries(TAB_TO_DOCUMENT).find(([, key]) => key === doc.documentKey)?.[0] as
                | TabId
                | undefined) ??
              (doc.documentKey === "site.nav" ? "header" : "overview");
            return (
              <li
                key={doc.documentKey}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-navy">{doc.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(doc)}
                  {tab !== "overview" ? (
                    <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs">
                      <Link to="/admin/website" search={{ tab }}>
                        Edit
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function DocumentEditorShell({
  documentKey,
  enabled,
  title,
  children,
}: {
  documentKey: string;
  enabled: boolean;
  title: string;
  children: (ctx: {
    draft: unknown;
    setDraft: (next: unknown) => void;
    saving: boolean;
    publishing: boolean;
    feedback: string | null;
    error: string | null;
    save: () => void;
    publish: () => void;
    version: number;
    dirty: boolean;
  }) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const docQ = useQuery({
    queryKey: ["admin", "cms-document", documentKey],
    queryFn: () => getCmsDocument(documentKey),
    enabled,
    staleTime: 5_000,
  });
  const [draft, setDraftState] = useState<unknown>(null);
  const [baseline, setBaseline] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = false;

  useEffect(() => {
    if (!docQ.data) return;
    setDraftState(docQ.data.draft);
    setBaseline(JSON.stringify(docQ.data.draft ?? null));
  }, [docQ.data]);

  const dirty = useMemo(() => {
    if (draft == null) return false;
    return JSON.stringify(draft) !== baseline;
  }, [draft, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const setDraft = (next: unknown) => {
    setDraftState(next);
    setFeedback(null);
  };

  const saveM = useMutation({
    mutationFn: () => {
      const check = validateDocumentDraft(documentKey, draft);
      if (!check.ok) throw new Error(check.message);
      return saveCmsDraft({
        documentKey,
        draft: check.value,
        expectedDraftVersion: docQ.data?.draftVersion,
      });
    },
    onSuccess: async (res) => {
      setFeedback("Draft saved.");
      setError(null);
      setBaseline(JSON.stringify(res.document.draft ?? draft));
      setDraftState(res.document.draft);
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-document", documentKey] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-overview"] });
    },
    onError: (e) => {
      setError(portalErrorMessage(e, "Could not save draft."));
      setFeedback(null);
    },
  });

  const publishM = useMutation({
    mutationFn: async () => {
      const check = validateDocumentDraft(documentKey, draft);
      if (!check.ok) throw new Error(check.message);
      const saved = await saveCmsDraft({
        documentKey,
        draft: check.value,
        expectedDraftVersion: docQ.data?.draftVersion,
      });
      return publishCmsDocument({
        documentKey,
        expectedDraftVersion: saved.document.draftVersion,
      });
    },
    onSuccess: async (res) => {
      setFeedback("Published to the live site.");
      setError(null);
      setBaseline(JSON.stringify(res.document.published ?? res.document.draft ?? draft));
      setDraftState(res.document.draft);
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-document", documentKey] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "cms-bundle"] });
    },
    onError: (e) => {
      setError(portalErrorMessage(e, "Could not publish."));
      setFeedback(null);
    },
  });

  const pending = saveM.isPending || publishM.isPending || busy;

  if (!enabled) {
    return (
      <Panel compact title={title}>
        <p className="text-sm text-muted-foreground">CMS schema is not ready.</p>
      </Panel>
    );
  }
  if (docQ.isLoading || draft == null) return <PageLoadState label={`Loading ${title}…`} />;
  if (docQ.isError) {
    return <ErrorState title={`Could not load ${title}`} body={portalErrorMessage(docQ.error)} />;
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-1 py-2 backdrop-blur-sm">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() => saveM.mutate()}
        >
          {saveM.isPending ? "Saving…" : "Save Draft"}
        </Button>
        <Button
          size="sm"
          variant="navy"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                dirty
                  ? "Save draft and publish this content to the live website?"
                  : "Publish the current draft to the live website?",
              )
            ) {
              return;
            }
            publishM.mutate();
          }}
        >
          {publishM.isPending ? "Publishing…" : "Publish"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href="/" target="_blank" rel="noreferrer">
            Open live site
          </a>
        </Button>
        {dirty ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
            Unsaved changes
          </span>
        ) : docQ.data?.hasUnpublishedChanges ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
            Draft pending publish
          </span>
        ) : docQ.data && docQ.data.publishedVersion > 0 ? (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
            In sync
          </span>
        ) : (
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Not published
          </span>
        )}
      </div>
      {feedback ? <InlineFeedback kind="ok">{feedback}</InlineFeedback> : null}
      {error ? <InlineFeedback kind="err">{error}</InlineFeedback> : null}
      {children({
        draft,
        setDraft,
        saving: saveM.isPending,
        publishing: publishM.isPending,
        feedback,
        error,
        save: () => saveM.mutate(),
        publish: () => publishM.mutate(),
        version: docQ.data?.draftVersion ?? 1,
        dirty,
      })}
    </div>
  );
}

function HeaderNavTab({ enabled }: { enabled: boolean }) {
  return (
    <div className="space-y-5">
      <DocumentEditorShell documentKey="site.header" enabled={enabled} title="Header">
        {({ draft, setDraft }) => {
          const header = { ...DEFAULT_CMS_HEADER, ...(draft as CmsHeaderSettings) };
          return (
            <Panel compact title="Header">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    CTA label
                  </span>
                  <Input
                    value={header.cta.label}
                    onChange={(e) =>
                      setDraft({ ...header, cta: { ...header.cta, label: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    CTA link
                  </span>
                  <Input
                    value={header.cta.href}
                    onChange={(e) =>
                      setDraft({ ...header, cta: { ...header.cta, href: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Logo height (px)
                  </span>
                  <Input
                    type="number"
                    min={24}
                    max={72}
                    value={header.logoHeightPx}
                    onChange={(e) =>
                      setDraft({ ...header, logoHeightPx: Number(e.target.value) || 40 })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Custom logo URL (optional)
                  </span>
                  <Input
                    value={header.logoUrl ?? ""}
                    placeholder="Leave blank for default brand logo"
                    onChange={(e) =>
                      setDraft({ ...header, logoUrl: e.target.value.trim() || null })
                    }
                  />
                </label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-navy">Sticky header</p>
                    <p className="text-xs text-muted-foreground">Keeps the header visible while scrolling</p>
                  </div>
                  <Switch
                    checked={header.sticky}
                    onCheckedChange={(v) => setDraft({ ...header, sticky: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-navy">Utility bar</p>
                    <p className="text-xs text-muted-foreground">Phone / email strip above the main nav</p>
                  </div>
                  <Switch
                    checked={header.showUtilityBar}
                    onCheckedChange={(v) => setDraft({ ...header, showUtilityBar: v })}
                  />
                </div>
              </div>
            </Panel>
          );
        }}
      </DocumentEditorShell>

      <DocumentEditorShell documentKey="site.nav" enabled={enabled} title="Navigation">
        {({ draft, setDraft }) => {
          const nav = { ...DEFAULT_CMS_NAV, ...(draft as CmsNavSettings) };
          const move = (index: number, dir: -1 | 1) => {
            const next = [...nav.items];
            const target = index + dir;
            if (target < 0 || target >= next.length) return;
            const tmp = next[index]!;
            next[index] = next[target]!;
            next[target] = tmp;
            setDraft({ ...nav, items: next });
          };
          return (
            <Panel compact title="Primary navigation">
              <ul className="space-y-2">
                {nav.items.map((item, index) => (
                  <li
                    key={item.id}
                    className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const items = nav.items.map((it, i) =>
                            i === index ? { ...it, label: e.target.value } : it,
                          );
                          setDraft({ ...nav, items });
                        }}
                      />
                      {item.type === "link" ? (
                        <Input
                          value={item.href ?? ""}
                          onChange={(e) => {
                            const items = nav.items.map((it, i) =>
                              i === index ? { ...it, href: e.target.value } : it,
                            );
                            setDraft({ ...nav, items });
                          }}
                        />
                      ) : (
                        <Input value={`Mega menu: ${item.megaId ?? item.id}`} disabled />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={item.visible}
                          onCheckedChange={(v) => {
                            const items = nav.items.map((it, i) =>
                              i === index ? { ...it, visible: v } : it,
                            );
                            setDraft({ ...nav, items });
                          }}
                        />
                        Visible
                      </label>
                      <Button type="button" size="sm" variant="ghost" onClick={() => move(index, -1)}>
                        Up
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => move(index, 1)}>
                        Down
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Labels, order and visibility apply on desktop and mobile. Mega-menu columns stay
                brand-verified.
              </p>
            </Panel>
          );
        }}
      </DocumentEditorShell>
    </div>
  );
}

function HomepageTab({ enabled }: { enabled: boolean }) {
  return (
    <DocumentEditorShell documentKey="page.home" enabled={enabled} title="Homepage">
      {({ draft, setDraft }) => {
        const page = {
          ...DEFAULT_CMS_HOME,
          ...(draft as CmsPageContent),
          sections: [...((draft as CmsPageContent)?.sections ?? DEFAULT_CMS_HOME.sections)].sort(
            (a, b) => a.sort - b.sort,
          ),
        };
        const updateSection = (id: string, patch: Partial<CmsHomeSection>) => {
          setDraft({
            ...page,
            sections: page.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          });
        };
        return (
          <div className="space-y-3">
            <Panel compact title="SEO">
              <div className="grid gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Title
                  </span>
                  <Input
                    value={page.seo.title}
                    onChange={(e) =>
                      setDraft({ ...page, seo: { ...page.seo, title: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Meta description
                  </span>
                  <Textarea
                    rows={2}
                    value={page.seo.description}
                    onChange={(e) =>
                      setDraft({ ...page, seo: { ...page.seo, description: e.target.value } })
                    }
                  />
                </label>
              </div>
            </Panel>
            <Panel compact title="Sections">
              <p className="mb-3 text-xs text-muted-foreground">
                Toggle visibility and edit headings. Publish to update the live homepage.
              </p>
              <ul className="space-y-2">
                {page.sections.map((section) => (
                  <li key={section.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">
                          {section.title || section.id}
                        </p>
                        <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                          {section.type}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={section.visible}
                          onCheckedChange={(v) => updateSection(section.id, { visible: v })}
                        />
                        Visible
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Eyebrow"
                        value={section.eyebrow ?? ""}
                        onChange={(e) => updateSection(section.id, { eyebrow: e.target.value })}
                      />
                      <Input
                        placeholder="Heading"
                        value={section.title ?? ""}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                      />
                      <Textarea
                        className="sm:col-span-2"
                        rows={2}
                        placeholder="Description"
                        value={section.body ?? ""}
                        onChange={(e) => updateSection(section.id, { body: e.target.value })}
                      />
                      {section.primaryCta ? (
                        <>
                          <Input
                            placeholder="CTA label"
                            value={section.primaryCta.label}
                            onChange={(e) =>
                              updateSection(section.id, {
                                primaryCta: { ...section.primaryCta!, label: e.target.value },
                              })
                            }
                          />
                          <Input
                            placeholder="CTA link"
                            value={section.primaryCta.href}
                            onChange={(e) =>
                              updateSection(section.id, {
                                primaryCta: { ...section.primaryCta!, href: e.target.value },
                              })
                            }
                          />
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        );
      }}
    </DocumentEditorShell>
  );
}

function FooterTab({ enabled }: { enabled: boolean }) {
  return (
    <DocumentEditorShell documentKey="site.footer" enabled={enabled} title="Footer">
      {({ draft, setDraft }) => {
        const footer = { ...DEFAULT_CMS_FOOTER, ...(draft as CmsFooterSettings) };
        return (
          <Panel compact title="Footer content">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <Label>Brand name</Label>
                <Input
                  className="mt-1"
                  value={footer.brandName}
                  onChange={(e) => setDraft({ ...footer, brandName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <Label>Registration line</Label>
                <Input
                  className="mt-1"
                  value={footer.registration}
                  onChange={(e) => setDraft({ ...footer, registration: e.target.value })}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={footer.description}
                  onChange={(e) => setDraft({ ...footer, description: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <Label>Phone</Label>
                <Input
                  className="mt-1"
                  value={footer.phoneDisplay}
                  onChange={(e) => setDraft({ ...footer, phoneDisplay: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  value={footer.emailDisplay}
                  onChange={(e) => setDraft({ ...footer, emailDisplay: e.target.value })}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <Label>Office address</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={footer.addressDisplay}
                  onChange={(e) => setDraft({ ...footer, addressDisplay: e.target.value })}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <Label>Copyright</Label>
                <Input
                  className="mt-1"
                  value={footer.copyright}
                  onChange={(e) => setDraft({ ...footer, copyright: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Footer columns
              </p>
              {footer.columns.map((col, colIndex) => (
                <div key={col.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Input
                      value={col.heading}
                      onChange={(e) => {
                        const columns = footer.columns.map((c, i) =>
                          i === colIndex ? { ...c, heading: e.target.value } : c,
                        );
                        setDraft({ ...footer, columns });
                      }}
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={col.visible}
                        onCheckedChange={(v) => {
                          const columns = footer.columns.map((c, i) =>
                            i === colIndex ? { ...c, visible: v } : c,
                          );
                          setDraft({ ...footer, columns });
                        }}
                      />
                      Visible
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      }}
    </DocumentEditorShell>
  );
}

function SeoTab({ enabled }: { enabled: boolean }) {
  return (
    <DocumentEditorShell documentKey="seo.global" enabled={enabled} title="SEO">
      {({ draft, setDraft }) => {
        const seo = { ...DEFAULT_CMS_SEO_GLOBAL, ...(draft as CmsSeoSettings) };
        return (
          <Panel compact title="Global SEO defaults">
            <div className="grid gap-3">
              <label className="text-sm">
                <Label>Default title</Label>
                <Input
                  className="mt-1"
                  value={seo.title}
                  onChange={(e) => setDraft({ ...seo, title: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <Label>Default meta description</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={seo.description}
                  onChange={(e) => setDraft({ ...seo, description: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <Label>Open Graph image path</Label>
                <Input
                  className="mt-1"
                  value={seo.ogImagePath ?? ""}
                  onChange={(e) => setDraft({ ...seo, ogImagePath: e.target.value })}
                />
              </label>
            </div>
          </Panel>
        );
      }}
    </DocumentEditorShell>
  );
}

function AnnouncementsTab({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const listQ = useQuery({
    queryKey: ["admin", "cms-announcements"],
    queryFn: () => listCmsAnnouncements(),
    enabled,
  });
  const blank: CmsAnnouncementInput = {
    internalTitle: "",
    body: "",
    announcementType: "general",
    styleToken: "navy",
    dismissible: true,
    status: "draft",
    sortOrder: 0,
    ctaLabel: "",
    ctaHref: "",
    startsAt: null,
    endsAt: null,
  };
  const [form, setForm] = useState<CmsAnnouncementInput>(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: () => saveCmsAnnouncement(form),
    onSuccess: async () => {
      setMsg("Announcement saved.");
      setErr(null);
      setForm(blank);
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "cms-bundle"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "cms-overview"] });
    },
    onError: (e) => {
      setErr(portalErrorMessage(e));
      setMsg(null);
    },
  });

  if (!enabled) {
    return (
      <Panel compact title="Announcements">
        <p className="text-sm text-muted-foreground">CMS schema is not ready on this environment.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel compact title={form.id ? "Edit announcement" : "New announcement"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <Label>Internal title</Label>
            <Input
              className="mt-1"
              value={form.internalTitle}
              onChange={(e) => setForm({ ...form, internalTitle: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <Label>Type</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.announcementType}
              onChange={(e) =>
                setForm({
                  ...form,
                  announcementType: e.target.value as CmsAnnouncementInput["announcementType"],
                })
              }
            >
              <option value="general">General</option>
              <option value="important">Important Update</option>
              <option value="admission_deadline">Admission Deadline</option>
              <option value="new_service">New Service</option>
              <option value="event">Event / Webinar</option>
              <option value="promotional">Promotional</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <Label>Announcement text</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <Label>CTA label (optional)</Label>
            <Input
              className="mt-1"
              value={form.ctaLabel ?? ""}
              onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <Label>CTA link (optional)</Label>
            <Input
              className="mt-1"
              value={form.ctaHref ?? ""}
              onChange={(e) => setForm({ ...form, ctaHref: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <Label>Starts</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              value={form.startsAt ? form.startsAt.slice(0, 16) : ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </label>
          <label className="text-sm">
            <Label>Ends</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              value={form.endsAt ? form.endsAt.slice(0, 16) : ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </label>
          <label className="text-sm">
            <Label>Status</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CmsAnnouncementInput["status"] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-sm">
            <Label>Style</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.styleToken}
              onChange={(e) =>
                setForm({
                  ...form,
                  styleToken: e.target.value as CmsAnnouncementInput["styleToken"],
                })
              }
            >
              <option value="navy">Navy</option>
              <option value="royal">Royal</option>
              <option value="bright">Bright</option>
              <option value="muted">Muted</option>
              <option value="danger">Alert</option>
            </select>
          </label>
          <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
            <span className="text-sm">Allow dismiss</span>
            <Switch
              checked={form.dismissible}
              onCheckedChange={(v) => setForm({ ...form, dismissible: v })}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="navy" disabled={saveM.isPending} onClick={() => saveM.mutate()}>
            {saveM.isPending ? "Saving…" : form.id ? "Update announcement" : "Save announcement"}
          </Button>
          {form.id ? (
            <Button size="sm" variant="ghost" onClick={() => setForm(blank)}>
              Cancel edit
            </Button>
          ) : null}
        </div>
        {msg ? <InlineFeedback kind="ok">{msg}</InlineFeedback> : null}
        {err ? <InlineFeedback kind="err">{err}</InlineFeedback> : null}
      </Panel>

      <Panel compact title="All announcements">
        {listQ.isLoading ? <PageLoadState label="Loading announcements…" /> : null}
        {listQ.isError ? (
          <ErrorState title="Could not load announcements" body={portalErrorMessage(listQ.error)} />
        ) : null}
        <ul className="divide-y border-y border-border text-sm">
          {(listQ.data?.rows ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="font-medium text-navy">{row.internalTitle || row.body.slice(0, 60)}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status} · {row.announcementType}
                </p>
                <p className="mt-1 text-muted-foreground">{row.body}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    id: row.id,
                    internalTitle: row.internalTitle,
                    body: row.body,
                    announcementType: row.announcementType as CmsAnnouncementInput["announcementType"],
                    ctaLabel: row.ctaLabel,
                    ctaHref: row.ctaHref,
                    styleToken: row.styleToken as CmsAnnouncementInput["styleToken"],
                    dismissible: row.dismissible,
                    status: row.status as CmsAnnouncementInput["status"],
                    startsAt: row.startsAt,
                    endsAt: row.endsAt,
                    sortOrder: row.sortOrder,
                  })
                }
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function PublishingTab({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => void;
}) {
  const [documentKey, setDocumentKey] = useState("page.home");
  const revQ = useQuery({
    queryKey: ["admin", "cms-revisions", documentKey],
    queryFn: () => listCmsRevisions(documentKey),
    enabled,
  });
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const restoreM = useMutation({
    mutationFn: (revisionId: string) => restoreCmsRevision(revisionId),
    onSuccess: () => {
      setRestoreMsg("Restored into draft. Open the editor and publish when ready.");
      setRestoreErr(null);
      void revQ.refetch();
      onChanged();
    },
    onError: (e) => {
      setRestoreErr(portalErrorMessage(e, "Could not restore revision."));
      setRestoreMsg(null);
    },
  });

  if (!enabled) {
    return (
      <Panel compact title="Publish history">
        <p className="text-sm text-muted-foreground">CMS schema is not ready.</p>
      </Panel>
    );
  }

  return (
    <Panel compact title="Revision history">
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
          Content area
        </span>
        <select
          className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
          value={documentKey}
          onChange={(e) => setDocumentKey(e.target.value)}
        >
          <option value="site.header">Header</option>
          <option value="site.nav">Navigation</option>
          <option value="site.footer">Footer</option>
          <option value="page.home">Homepage</option>
          <option value="seo.global">SEO</option>
        </select>
      </label>
      {restoreMsg ? <InlineFeedback kind="ok">{restoreMsg}</InlineFeedback> : null}
      {restoreErr ? <InlineFeedback kind="err">{restoreErr}</InlineFeedback> : null}
      {revQ.isLoading ? <PageLoadState label="Loading…" /> : null}
      <ul className="divide-y border-y border-border text-sm">
        {(revQ.data?.rows ?? []).map((row) => (
          <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <p className="font-medium text-navy">
                v{String(row.version)} · {String(row.kind) === "published" ? "Published" : "Draft"}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.created_at ? String(row.created_at).replace("T", " ").slice(0, 19) : ""}
                {row.note ? ` · ${String(row.note)}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={restoreM.isPending}
              onClick={() => {
                if (confirm("Restore this version into the draft? You still need to Publish for the live site.")) {
                  restoreM.mutate(String(row.id));
                }
              }}
            >
              Restore draft
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
