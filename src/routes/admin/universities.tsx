import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  LoadingRows,
  EmptyState,
  ErrorState,
  Panel,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogListFilters } from "@/lib/catalog-rules";
import { validateUniversityWrite } from "@/lib/catalog-rules";
import {
  deleteUniversity,
  listCatalogUniversitiesAdmin,
  upsertUniversity,
} from "@/services";
import type { University } from "@/types";

export const Route = createFileRoute("/admin/universities")({
  component: AdminUniversities,
});

const emptyForm = {
  id: "",
  name: "",
  country: "",
  city: "",
  website: "",
};

function AdminUniversities() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const listQ = useQuery({
    queryKey: ["admin", "catalog-universities", q, country, page],
    queryFn: () => {
      const filters: CatalogListFilters = { page, pageSize: 25 };
      if (q.trim()) filters.q = q.trim();
      if (country.trim()) filters.country = country.trim();
      return listCatalogUniversitiesAdmin(filters);
    },
    staleTime: 15_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "catalog-universities"] });

  const saveM = useMutation({
    mutationFn: () => {
      const parsed = validateUniversityWrite({
        name: form.name,
        country: form.country,
        city: form.city || null,
        website: form.website || null,
      });
      if (!parsed.ok) throw new Error(parsed.error);
      const payload: Parameters<typeof upsertUniversity>[0] = {
        name: form.name,
        country: form.country,
        city: form.city || null,
        website: form.website || null,
      };
      if (form.id.trim()) payload.id = form.id.trim();
      return upsertUniversity(payload);
    },
    onSuccess: async () => {
      setMsg("University saved.");
      setForm(emptyForm);
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Save failed.")),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteUniversity(id),
    onSuccess: async () => {
      setMsg("University deleted (linked programs cascade).");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Delete failed.")),
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
  if (!data) return <ErrorState body="University catalog unavailable." />;
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const loadIntoForm = (u: University) => {
    setForm({
      id: u.id,
      name: u.name,
      country: u.country,
      city: u.city === "—" ? "" : u.city,
      website: u.ranking === "—" ? "" : u.ranking,
    });
    setMsg(null);
  };

  return (
    <div>
      <PageHeader
        title="Universities"
        subtitle="Live partner university catalog (Supabase). Website field only — no ranking column in schema."
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
          Live catalog unavailable for this session. Sign in with Supabase and admissions access.
        </p>
      ) : null}
      {msg ? (
        <p className="mb-3 text-sm text-navy" role="status">
          {msg}
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={data.canMutate ? "Create / update university" : "University form (view only)"}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Input
              className="sm:col-span-2"
              placeholder="Name *"
              value={form.name}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Country *"
              value={form.country}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
            <Input
              placeholder="City"
              value={form.city}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Website (https://…)"
              value={form.website}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
            {data.canMutate ? (
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  size="sm"
                  variant="navy"
                  disabled={!form.name.trim() || !form.country.trim() || saveM.isPending}
                  onClick={() => {
                    setMsg(null);
                    saveM.mutate();
                  }}
                >
                  Save university
                </Button>
                {form.id ? (
                  <Button size="sm" variant="outline" onClick={() => setForm(emptyForm)}>
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
              placeholder="Search name or country…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <Input
              placeholder="Filter country (exact)"
              value={country}
              onChange={(e) => {
                setPage(1);
                setCountry(e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {data.total} record{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
              {data.source === "demo" ? " · labelled demo session" : ""}
            </p>
          </div>
        </Panel>
      </div>

      {!data.rows.length ? (
        <EmptyState
          title="No universities"
          body={
            data.source === "unavailable"
              ? "Live catalog unavailable for this session."
              : "No rows match these filters. Create a university or clear filters."
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.rows.map((u) => (
              <article key={u.id} className="rounded-md border border-border p-3 text-sm">
                <h3 className="font-medium text-navy">{u.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.city}, {u.country}
                </p>
                <p className="mt-1 text-xs">{u.programs.length} program(s)</p>
                {data.canMutate ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadIntoForm(u)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteM.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete “${u.name}”? Linked programs will also be removed.`,
                          )
                        ) {
                          return;
                        }
                        deleteM.mutate(u.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <TableWrap>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>City</th>
                  <th>Levels</th>
                  <th>Programs</th>
                  <th>Website</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-navy">{u.name}</td>
                    <td>{u.country}</td>
                    <td>{u.city}</td>
                    <td className="text-xs">{u.levels.length ? u.levels.join(", ") : "—"}</td>
                    <td className="text-xs">{u.programs.length ? u.programs.join(", ") : "—"}</td>
                    <td className="max-w-[12rem] truncate text-xs">
                      {u.ranking !== "—" ? u.ranking : "—"}
                    </td>
                    <td>
                      {data.canMutate ? (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => loadIntoForm(u)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteM.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Delete “${u.name}”? Linked programs will also be removed.`,
                                )
                              ) {
                                return;
                              }
                              deleteM.mutate(u.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
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
