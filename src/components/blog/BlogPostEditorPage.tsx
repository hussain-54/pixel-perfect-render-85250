import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArticleEditor } from "@/components/blog/ArticleEditor";
import {
  ErrorState,
  InlineFeedback,
  PageLoadState,
  Panel,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getBlogPost, listBlogTaxonomy, saveBlogPost, uploadBlogMedia } from "@/services";
import {
  buildEditorialChecklist,
  estimateReadingTimeMinutes,
  slugifyBlogTitle,
} from "@/lib/blog-rules";
import type {
  BlogContentJson,
  BlogPostDetail,
  BlogPostStatus,
  BlogPostWriteInput,
} from "@/lib/blog-types";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "failed";

type FormState = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  contentJson: BlogContentJson;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  categoryId: string | null;
  authorId: string | null;
  tagIds: string[];
  status: BlogPostStatus;
  scheduledFor: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  canonicalPath: string;
  robotsIndex: boolean;
  draftVersion: number;
  slugTouched: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  slug: "untitled",
  excerpt: "",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  featuredImageUrl: null,
  featuredImageAlt: "",
  categoryId: null,
  authorId: null,
  tagIds: [],
  status: "draft",
  scheduledFor: "",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
  focusKeyword: "",
  ogTitle: "",
  ogDescription: "",
  ogImageUrl: null,
  canonicalPath: "",
  robotsIndex: true,
  draftVersion: 1,
  slugTouched: false,
});

function toLocalInput(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function BlogPostEditorPage({ postId }: { postId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  dirtyRef.current = dirty;

  const postQ = useQuery({
    queryKey: ["admin", "blog-post", postId],
    queryFn: () => getBlogPost(postId!),
    enabled: Boolean(postId),
  });

  const taxQ = useQuery({
    queryKey: ["admin", "blog-taxonomy"],
    queryFn: () => listBlogTaxonomy(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!postQ.data) return;
    const p = postQ.data as BlogPostDetail;
    setForm({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      contentJson: p.contentJson,
      contentHtml: p.contentHtml,
      featuredImageUrl: p.featuredImageUrl,
      featuredImageAlt: p.featuredImageAlt,
      categoryId: p.categoryId,
      authorId: p.authorId,
      tagIds: p.tagIds,
      status: p.status,
      scheduledFor: toLocalInput(p.scheduledFor ?? ""),
      isFeatured: p.isFeatured,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      focusKeyword: p.focusKeyword,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
      ogImageUrl: p.ogImageUrl,
      canonicalPath: p.canonicalPath ?? `/blog/${p.slug}`,
      robotsIndex: p.robotsIndex,
      draftVersion: p.draftVersion,
      slugTouched: true,
    });
    setDirty(false);
    setSaveState("idle");
  }, [postQ.data]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const patch = useCallback((partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setDirty(true);
    setSaveState("idle");
  }, []);

  const buildPayload = useCallback((status: BlogPostStatus): BlogPostWriteInput => {
    const f = formRef.current;
    const slug = f.slug.trim() || slugifyBlogTitle(f.title || "untitled");
    const payload: BlogPostWriteInput = {
      title: f.title,
      slug,
      excerpt: f.excerpt,
      contentJson: f.contentJson,
      contentHtml: f.contentHtml,
      featuredImageUrl: f.featuredImageUrl,
      featuredImageAlt: f.featuredImageAlt,
      categoryId: f.categoryId,
      authorId: f.authorId,
      tagIds: f.tagIds,
      status,
      scheduledFor:
        status === "scheduled" && f.scheduledFor ? new Date(f.scheduledFor).toISOString() : null,
      isFeatured: f.isFeatured,
      readingTimeMinutes: estimateReadingTimeMinutes(f.contentHtml),
      seoTitle: f.seoTitle,
      seoDescription: f.seoDescription,
      focusKeyword: f.focusKeyword,
      ogTitle: f.ogTitle,
      ogDescription: f.ogDescription,
      ogImageUrl: f.ogImageUrl,
      canonicalPath: f.canonicalPath || `/blog/${slug}`,
      robotsIndex: f.robotsIndex,
    };
    if (f.id) payload.id = f.id;
    if (status === "published") payload.publishedAt = new Date().toISOString();
    if (f.id) payload.expectedDraftVersion = f.draftVersion;
    return payload;
  }, []);

  const saveMut = useMutation({
    mutationFn: (status: BlogPostStatus) => saveBlogPost(buildPayload(status)),
    onMutate: () => {
      savingRef.current = true;
      setSaveState("saving");
      setSaveError(null);
    },
    onSuccess: (res, status) => {
      savingRef.current = false;
      setSaveState("saved");
      setDirty(false);
      setForm((prev) => ({
        ...prev,
        id: res.id,
        draftVersion: res.draftVersion,
        slug: res.slug,
        status,
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "blog-post", res.id] });
      if (!postId && res.id) {
        void navigate({ to: "/admin/blog/edit", search: { id: res.id } });
      }
    },
    onError: (err) => {
      savingRef.current = false;
      setSaveState("failed");
      setSaveError(portalErrorMessage(err));
    },
  });

  // Autosave drafts only — never auto-publish.
  useEffect(() => {
    if (!dirty || form.status === "published") return;
    const t = window.setTimeout(() => {
      if (savingRef.current || !dirtyRef.current) return;
      const f = formRef.current;
      if (!f.title.trim() && !(f.contentHtml ?? "").replace(/<[^>]+>/g, "").trim()) return;
      saveMut.mutate("draft");
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, form.title, form.contentHtml, form.excerpt, form.slug]);

  const checklist = useMemo(
    () =>
      buildEditorialChecklist({
        title: form.title,
        excerpt: form.excerpt,
        contentHtml: form.contentHtml,
        featuredImageUrl: form.featuredImageUrl,
        featuredImageAlt: form.featuredImageAlt,
        categoryId: form.categoryId,
        authorId: form.authorId,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        slug: form.slug,
      }),
    [form],
  );

  const uploadImage = useCallback(async (): Promise<string | null> => {
    setUploadMsg(null);
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          setUploadMsg(`Uploading ${file.name}…`);
          const base64 = await fileToBase64(file);
          const res = await uploadBlogMedia({
            fileName: file.name,
            mimeType: file.type,
            base64,
          });
          setUploadMsg("Image uploaded.");
          resolve(res.url);
        } catch (err) {
          setUploadMsg(portalErrorMessage(err));
          resolve(null);
        }
      };
      input.click();
    });
  }, []);

  const uploadFeatured = async () => {
    const url = await uploadImage();
    if (url) patch({ featuredImageUrl: url, ogImageUrl: form.ogImageUrl || url });
  };

  if (postId && postQ.isLoading) {
    return (
      <PageLoadState title="Edit article" subtitle="Loading…">
        <p className="text-sm text-muted-foreground">Loading article…</p>
      </PageLoadState>
    );
  }
  if (postId && postQ.isError) {
    return <ErrorState body={portalErrorMessage(postQ.error)} />;
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "failed"
          ? "Save failed"
          : dirty
            ? "Unsaved changes"
            : "All changes saved";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            <Link to="/admin/blog" className="hover:text-royal">
              Blog
            </Link>{" "}
            / Editor
          </p>
          <h1 className="font-display text-2xl font-semibold text-navy">
            {form.id ? "Edit article" : "New article"}
          </h1>
          <p
            className={cn(
              "mt-1 text-xs",
              saveState === "failed"
                ? "text-destructive"
                : saveState === "saved"
                  ? "text-emerald-700"
                  : "text-muted-foreground",
            )}
          >
            {saveLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate("draft")}
          >
            Save draft
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saveMut.isPending || !form.scheduledFor}
            onClick={() => saveMut.mutate("scheduled")}
          >
            Schedule
          </Button>
          <Button
            type="button"
            size="sm"
            variant="navy"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate("published")}
          >
            Publish
          </Button>
        </div>
      </div>

      {saveError ? <InlineFeedback kind="err">{saveError}</InlineFeedback> : null}
      {uploadMsg ? <InlineFeedback kind="ok">{uploadMsg}</InlineFeedback> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blog-title">Title</Label>
            <Input
              id="blog-title"
              value={form.title}
              placeholder="Article title"
              className="h-11 text-lg font-semibold"
              onChange={(e) => {
                const title = e.target.value;
                if (!form.slugTouched) {
                  patch({ title, slug: slugifyBlogTitle(title || "untitled") });
                } else {
                  patch({ title });
                }
              }}
            />
          </div>
          <ArticleEditor
            key={form.id ?? "new"}
            initialJson={form.contentJson}
            onChange={({ json, html }) => patch({ contentJson: json, contentHtml: html })}
            onUploadImage={uploadImage}
          />
        </div>

        <aside className="space-y-3">
          <Panel compact title={`Checklist ${checklist.completed}/${checklist.total}`}>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-royal transition-all"
                style={{ width: `${(checklist.completed / checklist.total) * 100}%` }}
              />
            </div>
            <ul className="space-y-1 text-xs">
              {checklist.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2",
                    item.done ? "text-emerald-700" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      item.done ? "bg-emerald-600" : "bg-border",
                    )}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Checklist guides quality — drafts can still be saved.
            </p>
          </Panel>

          <Panel
            compact
            title="Article settings"
            action={
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-navy"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                {settingsOpen ? "Hide" : "Show"}
              </button>
            }
          >
            {settingsOpen ? (
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <Label htmlFor="blog-slug">URL slug</Label>
                  <Input
                    id="blog-slug"
                    value={form.slug}
                    onChange={(e) =>
                      patch({ slug: e.target.value.toLowerCase(), slugTouched: true })
                    }
                  />
                  <p className="text-[0.65rem] text-muted-foreground">/blog/{form.slug || "…"}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="blog-excerpt">Excerpt</Label>
                  <Textarea
                    id="blog-excerpt"
                    rows={3}
                    value={form.excerpt}
                    onChange={(e) => patch({ excerpt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Featured image</Label>
                  {form.featuredImageUrl ? (
                    <img
                      src={form.featuredImageUrl}
                      alt={form.featuredImageAlt || ""}
                      className="mb-2 max-h-32 w-full rounded-md object-cover"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void uploadFeatured()}
                    >
                      Upload
                    </Button>
                    {form.featuredImageUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => patch({ featuredImageUrl: null })}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    className="mt-1"
                    placeholder="Alt text"
                    value={form.featuredImageAlt}
                    onChange={(e) => patch({ featuredImageAlt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="blog-category">Category</Label>
                  <select
                    id="blog-category"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.categoryId ?? ""}
                    onChange={(e) => patch({ categoryId: e.target.value || null })}
                  >
                    <option value="">Select…</option>
                    {(taxQ.data?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="blog-author">Author</Label>
                  <select
                    id="blog-author"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.authorId ?? ""}
                    onChange={(e) => patch({ authorId: e.target.value || null })}
                  >
                    <option value="">Select…</option>
                    {(taxQ.data?.authors ?? [])
                      .filter((a) => a.active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Tags</Label>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {(taxQ.data?.tags ?? []).map((t) => {
                      const on = form.tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs",
                            on
                              ? "border-navy bg-navy text-white"
                              : "border-border bg-background text-muted-foreground",
                          )}
                          onClick={() =>
                            patch({
                              tagIds: on
                                ? form.tagIds.filter((id) => id !== t.id)
                                : [...form.tagIds, t.id],
                            })
                          }
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="blog-featured">Featured article</Label>
                  <Switch
                    id="blog-featured"
                    checked={form.isFeatured}
                    onCheckedChange={(v) => patch({ isFeatured: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="blog-schedule">Schedule for</Label>
                  <Input
                    id="blog-schedule"
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(e) => patch({ scheduledFor: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate("archived")}
                  >
                    Archive
                  </Button>
                  {form.status === "archived" || form.status === "published" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saveMut.isPending}
                      onClick={() => saveMut.mutate("draft")}
                    >
                      {form.status === "archived" ? "Restore to draft" : "Unpublish"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel
            compact
            title="SEO"
            action={
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-navy"
                onClick={() => setSeoOpen((v) => !v)}
              >
                {seoOpen ? "Hide" : "Show"}
              </button>
            }
          >
            {seoOpen ? (
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <Label htmlFor="seo-title">SEO title</Label>
                  <Input
                    id="seo-title"
                    value={form.seoTitle}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-desc">Meta description</Label>
                  <Textarea
                    id="seo-desc"
                    rows={3}
                    value={form.seoDescription}
                    onChange={(e) => patch({ seoDescription: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-kw">Focus keyword</Label>
                  <Input
                    id="seo-kw"
                    value={form.focusKeyword}
                    onChange={(e) => patch({ focusKeyword: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-og-title">OG title</Label>
                  <Input
                    id="seo-og-title"
                    value={form.ogTitle}
                    onChange={(e) => patch({ ogTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-og-desc">OG description</Label>
                  <Textarea
                    id="seo-og-desc"
                    rows={2}
                    value={form.ogDescription}
                    onChange={(e) => patch({ ogDescription: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-canonical">Canonical path</Label>
                  <Input
                    id="seo-canonical"
                    value={form.canonicalPath}
                    placeholder={`/blog/${form.slug}`}
                    onChange={(e) => patch({ canonicalPath: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-index">Allow indexing</Label>
                  <Switch
                    id="seo-index"
                    checked={form.robotsIndex}
                    onCheckedChange={(v) => patch({ robotsIndex: v })}
                  />
                </div>
              </div>
            ) : null}
          </Panel>
        </aside>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white px-4 py-3">
              <p className="text-sm font-semibold text-navy">Article preview</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
            <article className="px-6 py-8">
              <h1 className="font-display text-3xl font-semibold text-navy">
                {form.title || "Untitled"}
              </h1>
              {form.excerpt ? <p className="mt-3 text-muted-foreground">{form.excerpt}</p> : null}
              {form.featuredImageUrl ? (
                <img
                  src={form.featuredImageUrl}
                  alt={form.featuredImageAlt || ""}
                  className="mt-6 max-h-[360px] w-full rounded-md object-cover"
                />
              ) : null}
              <div
                className="prose prose-navy mt-8 max-w-none prose-img:max-w-full"
                dangerouslySetInnerHTML={{ __html: form.contentHtml }}
              />
            </article>
          </div>
        </div>
      ) : null}
    </div>
  );
}
