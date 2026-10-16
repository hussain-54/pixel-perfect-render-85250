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
import { validateProgramWrite } from "@/lib/catalog-rules";
import type { CatalogProgramView } from "@/lib/catalog-mappers";
import {
  deleteProgram,
  getCatalogUniversities,
  listCatalogProgramsAdmin,
  upsertProgram,
} from "@/services";

export const Route = createFileRoute("/admin/programs")({
  component: AdminPrograms,
});

const emptyForm = {
  id: "",
  universityId: "",
  name: "",
  level: "",
  duration: "",
  tuitionFee: "",
};

function AdminPrograms() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const listQ = useQuery({
    queryKey: ["admin", "catalog-programs", q, level, universityId, page],
    queryFn: () => {
      const filters: CatalogListFilters = { page, pageSize: 25 };
      if (q.trim()) filters.q = q.trim();
      if (level.trim()) filters.level = level.trim();
      if (universityId.trim()) filters.universityId = universityId.trim();
      return listCatalogProgramsAdmin(filters);
    },
    staleTime: 15_000,
  });

  const unisQ = useQuery({
    queryKey: ["admin", "catalog-universities", "options"],
    queryFn: getCatalogUniversities,
    staleTime: 60_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "catalog-programs"] });

  const saveM = useMutation({
    mutationFn: () => {
      const parsed = validateProgramWrite({
        universityId: form.universityId,
        name: form.name,
        level: form.level || null,
        duration: form.duration || null,
        tuitionFee: form.tuitionFee || null,
      });
      if (!parsed.ok) throw new Error(parsed.error);
      const payload: Parameters<typeof upsertProgram>[0] = {
        universityId: form.universityId,
        name: form.name,
        level: form.level || null,
        duration: form.duration || null,
        tuitionFee: form.tuitionFee || null,
      };
      if (form.id.trim()) payload.id = form.id.trim();
      return upsertProgram(payload);
    },
    onSuccess: async () => {
      setMsg("Program saved.");
      setForm(emptyForm);
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Save failed.")),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteProgram(id),
    onSuccess: async () => {
      setMsg("Program deleted.");
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
  if (!data) return <ErrorState body="Program catalog unavailable." />;
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const uniOptions = unisQ.data ?? [];

  const loadIntoForm = (p: CatalogProgramView) => {
    setForm({
      id: p.id,
      universityId: p.universityId,
      name: p.name,
      level: p.level === "—" ? "" : p.level,
      duration: p.duration === "—" ? "" : p.duration,
      tuitionFee: p.tuitionFee === "—" ? "" : p.tuitionFee,
    });
    setMsg(null);
  };

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle="Live programs linked to universities in Supabase (admissions module)."
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
        <Panel title={data.canMutate ? "Create / update program" : "Program form (view only)"}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 sm:col-span-2"
              value={form.universityId}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, universityId: e.target.value }))}
            >
              <option value="">University *</option>
              {uniOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Program name *"
              value={form.name}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Level"
              value={form.level}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            />
            <Input
              placeholder="Duration"
              value={form.duration}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Tuition fee note"
              value={form.tuitionFee}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, tuitionFee: e.target.value }))}
            />
            {data.canMutate ? (
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  size="sm"
                  variant="navy"
                  disabled={
                    !form.universityId || !form.name.trim() || saveM.isPending
                  }
                  onClick={() => {
                    setMsg(null);
                    saveM.mutate();
                  }}
                >
                  Save program
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
              placeholder="Search program or university…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <Input
              placeholder="Filter level (exact)"
              value={level}
              onChange={(e) => {
                setPage(1);
                setLevel(e.target.value);
              }}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={universityId}
              onChange={(e) => {
                setPage(1);
                setUniversityId(e.target.value);
              }}
            >
              <option value="">All universities</option>
              {uniOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {data.total} record{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
            </p>
          </div>
        </Panel>
      </div>

      {!data.rows.length ? (
        <EmptyState
          title="No programs"
          body={
            data.source === "unavailable"
              ? "Live catalog unavailable for this session."
              : "No rows match these filters. Create a program or clear filters."
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.rows.map((p) => (
              <article key={p.id} className="rounded-md border border-border p-3 text-sm">
                <h3 className="font-medium text-navy">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.universityName}</p>
                <p className="mt-1 text-xs">
                  {p.level} · {p.duration} · {p.tuitionFee}
                </p>
                {data.canMutate ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadIntoForm(p)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteM.isPending}
                      onClick={() => {
                        if (!window.confirm(`Delete program “${p.name}”?`)) return;
                        deleteM.mutate(p.id);
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
                  <th>Program</th>
                  <th>University</th>
                  <th>Level</th>
                  <th>Duration</th>
                  <th>Tuition</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium text-navy">{p.name}</td>
                    <td>{p.universityName}</td>
                    <td>{p.level}</td>
                    <td>{p.duration}</td>
                    <td>{p.tuitionFee}</td>
                    <td>
                      {data.canMutate ? (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => loadIntoForm(p)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteM.isPending}
                            onClick={() => {
                              if (!window.confirm(`Delete program “${p.name}”?`)) return;
                              deleteM.mutate(p.id);
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
