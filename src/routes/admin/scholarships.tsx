import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  LoadingRows,
  EmptyState,
  ErrorState,
  Panel,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScholarshipListFilters } from "@/lib/scholarship-rules";
import { validateScholarshipWrite } from "@/lib/scholarship-rules";
import {
  listScholarshipsAdmin,
  setScholarshipStatus,
  upsertScholarship,
} from "@/services";
import type { FundingType, Scholarship, ScholarshipStatus } from "@/types";

export const Route = createFileRoute("/admin/scholarships")({
  component: AdminScholarships,
});

const emptyForm = {
  id: "",
  title: "",
  description: "",
  provider: "",
  country: "",
  studyLevel: "",
  fieldOfStudy: "",
  funding: "Partial Funding" as FundingType,
  fundingDescription: "",
  eligibility: "",
  opensOn: "",
  closesOn: "",
  applicationUrl: "",
  status: "draft" as ScholarshipStatus,
};

function AdminScholarships() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const listQ = useQuery({
    queryKey: ["admin", "scholarships", q, status, includeArchived, page],
    queryFn: () => {
      const filters: ScholarshipListFilters = {
        includeArchived,
        page,
        pageSize: 25,
      };
      const needle = q.trim();
      if (needle) filters.q = needle;
      if (status) filters.status = status;
      return listScholarshipsAdmin(filters);
    },
    staleTime: 15_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "scholarships"] });

  const saveM = useMutation({
    mutationFn: () => {
      const parsed = validateScholarshipWrite({
        title: form.title,
        description: form.description,
        provider: form.provider,
        country: form.country,
        studyLevel: form.studyLevel,
        fieldOfStudy: form.fieldOfStudy,
        funding: form.funding,
        fundingDescription: form.fundingDescription,
        eligibility: form.eligibility,
        opensOn: form.opensOn || null,
        closesOn: form.closesOn || null,
        applicationUrl: form.applicationUrl || null,
        status: form.status,
      });
      if (!parsed.ok) throw new Error(parsed.error);
      const payload: Parameters<typeof upsertScholarship>[0] = {
        title: form.title,
        description: form.description,
        provider: form.provider,
        country: form.country,
        studyLevel: form.studyLevel,
        fieldOfStudy: form.fieldOfStudy,
        funding: form.funding,
        fundingDescription: form.fundingDescription,
        eligibility: form.eligibility,
        opensOn: form.opensOn || null,
        closesOn: form.closesOn || null,
        applicationUrl: form.applicationUrl || null,
        status: form.status,
      };
      if (form.id.trim()) payload.id = form.id.trim();
      return upsertScholarship(payload);
    },
    onSuccess: async () => {
      setMsg("Scholarship saved.");
      setForm(emptyForm);
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Save failed.")),
  });

  const statusM = useMutation({
    mutationFn: (input: { id: string; status: ScholarshipStatus }) =>
      setScholarshipStatus(input),
    onSuccess: async (_res, vars) => {
      setMsg(`Scholarship marked ${vars.status}.`);
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Status change failed.")),
  });

  if (listQ.isLoading) return <LoadingRows rows={6} />;
  if (listQ.isError) {
    const text = portalErrorMessage(listQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const data = listQ.data;
  if (!data) return <ErrorState body="Scholarship catalog unavailable." />;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const loadIntoForm = (s: Scholarship) => {
    setForm({
      id: s.id,
      title: s.name,
      description: s.description ?? "",
      provider: s.provider ?? "",
      country: s.country === "—" ? "" : s.country,
      studyLevel: s.level === "—" ? "" : s.level,
      fieldOfStudy: s.field === "—" ? "" : s.field,
      funding: s.funding,
      fundingDescription: s.fundingDescription ?? "",
      eligibility: s.eligibility === "—" ? "" : s.eligibility,
      opensOn: s.opensOn ?? "",
      closesOn: s.deadline === "—" ? "" : s.deadline,
      applicationUrl: s.applicationUrl ?? "",
      status: s.status ?? "draft",
    });
    setMsg(null);
  };

  return (
    <div>
      <PageHeader
        title="Scholarships"
        subtitle="Live admissions scholarship catalog (Supabase). Publish to show on the public site."
      />
      <AdminModuleSubnav
        items={[
          { to: "/admin/applications", label: "Applications" },
          { to: "/admin/universities", label: "Universities" },
          { to: "/admin/programs", label: "Programs" },
          { to: "/admin/scholarships", label: "Scholarships" },
        ]}
      />
      {data.source === "unavailable" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Live catalog unavailable for this session (sign in with a Supabase JWT and admissions
          access). No demo fixture fallback.
        </p>
      ) : null}
      {msg ? (
        <p className="mb-3 text-sm text-navy" role="status">
          {msg}
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={data.canMutate ? "Create / update scholarship" : "Scholarship form (view only)"}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Input
              className="sm:col-span-2"
              placeholder="Title *"
              value={form.title}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Provider / organization"
              value={form.provider}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            />
            <Input
              placeholder="Country"
              value={form.country}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
            <Input
              placeholder="Study level (e.g. Master's)"
              value={form.studyLevel}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, studyLevel: e.target.value }))}
            />
            <Input
              placeholder="Field of study"
              value={form.fieldOfStudy}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, fieldOfStudy: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={form.funding}
              disabled={!data.canMutate}
              onChange={(e) =>
                setForm((f) => ({ ...f, funding: e.target.value as FundingType }))
              }
            >
              <option value="Fully Funded">Fully Funded</option>
              <option value="Partial Funding">Partial Funding</option>
              <option value="Tuition Waiver">Tuition Waiver</option>
            </select>
            <Input
              placeholder="Funding description"
              value={form.fundingDescription}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, fundingDescription: e.target.value }))}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Eligibility"
              value={form.eligibility}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value }))}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Description"
              value={form.description}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Input
              type="date"
              value={form.opensOn}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, opensOn: e.target.value }))}
              aria-label="Opens on"
            />
            <Input
              type="date"
              value={form.closesOn}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, closesOn: e.target.value }))}
              aria-label="Closes on"
            />
            <Input
              className="sm:col-span-2"
              placeholder="Application URL (https://…)"
              value={form.applicationUrl}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, applicationUrl: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={form.status}
              disabled={!data.canMutate}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ScholarshipStatus }))
              }
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            {form.id ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">Editing {form.id}</p>
            ) : null}
            {data.canMutate ? (
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  size="sm"
                  variant="navy"
                  disabled={!form.title.trim() || saveM.isPending}
                  onClick={() => {
                    setMsg(null);
                    saveM.mutate();
                  }}
                >
                  Save scholarship
                </Button>
                {form.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm(emptyForm)}
                  >
                    Clear form
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Filters">
          <div className="grid gap-2 text-sm">
            <Input
              placeholder="Search title, provider, country…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => {
                  setPage(1);
                  setIncludeArchived(e.target.checked);
                }}
              />
              Include archived
            </label>
            <p className="text-xs text-muted-foreground">
              {data.total} record{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
            </p>
          </div>
        </Panel>
      </div>

      {!data.rows.length ? (
        <EmptyState
          title="No scholarships"
          body={
            data.source === "unavailable"
              ? "Live catalog unavailable for this session. Sign in with Supabase and admissions access."
              : "No rows match these filters. Create a draft or clear filters."
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.rows.map((s) => (
              <article
                key={s.id}
                className={`rounded-md border border-border bg-background p-3 text-sm ${
                  s.status === "archived" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-navy">{s.name}</h3>
                  <StatusBadge status={s.funding} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.country} · {s.level} · {s.status ?? "—"}
                </p>
                <p className="mt-1 text-xs">Deadline {fmtDate(s.deadline)}</p>
                {data.canMutate ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadIntoForm(s)}>
                      Edit
                    </Button>
                    {s.status !== "published" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusM.isPending}
                        onClick={() => {
                          if (!window.confirm(`Publish “${s.name}” to the public site?`)) return;
                          statusM.mutate({ id: s.id, status: "published" });
                        }}
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusM.isPending}
                        onClick={() => statusM.mutate({ id: s.id, status: "draft" })}
                      >
                        Unpublish
                      </Button>
                    )}
                    {s.status !== "archived" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={statusM.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Archive “${s.name}”? It will leave the public site.`,
                            )
                          ) {
                            return;
                          }
                          statusM.mutate({ id: s.id, status: "archived" });
                        }}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusM.isPending}
                        onClick={() => statusM.mutate({ id: s.id, status: "draft" })}
                      >
                        Restore draft
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">View only</p>
                )}
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <TableWrap>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Country</th>
                  <th>Level</th>
                  <th>Funding</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((s) => (
                  <tr key={s.id} className={s.status === "archived" ? "opacity-60" : undefined}>
                    <td className="font-medium text-navy">{s.name}</td>
                    <td>{s.country}</td>
                    <td>{s.level}</td>
                    <td>
                      <StatusBadge status={s.funding} />
                    </td>
                    <td>{s.status ?? "—"}</td>
                    <td>{fmtDate(s.deadline)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {data.canMutate ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => loadIntoForm(s)}>
                              Edit
                            </Button>
                            {s.status !== "published" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={statusM.isPending}
                                onClick={() => {
                                  if (!window.confirm(`Publish “${s.name}” to the public site?`)) {
                                    return;
                                  }
                                  statusM.mutate({ id: s.id, status: "published" });
                                }}
                              >
                                Publish
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={statusM.isPending}
                                onClick={() => statusM.mutate({ id: s.id, status: "draft" })}
                              >
                                Unpublish
                              </Button>
                            )}
                            {s.status !== "archived" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={statusM.isPending}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Archive “${s.name}”? It will leave the public site.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  statusM.mutate({ id: s.id, status: "archived" });
                                }}
                              >
                                Archive
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={statusM.isPending}
                                onClick={() => statusM.mutate({ id: s.id, status: "draft" })}
                              >
                                Restore draft
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
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
    </div>
  );
}
