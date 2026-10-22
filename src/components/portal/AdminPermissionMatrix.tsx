import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingRows, PermissionDenied, portalErrorMessage } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  BUSINESS_MODULE_LABELS,
  BUSINESS_ROLE_LABELS,
  PERMISSION_LEVEL_LABELS,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
} from "@/lib/business-permissions";
import { cn } from "@/lib/utils";
import {
  ADMIN_PERMISSION_MATRIX_QUERY_KEY,
  STAFF_EFFECTIVE_ACCESS_QUERY_KEY,
} from "@/lib/permission-matrix-realtime-rules";
import { getPermissionMatrix, updatePermissionMatrixCell } from "@/services";

const LEVELS: PermissionLevel[] = [0, 1, 2, 3];

function levelPillClass(level: PermissionLevel): string {
  switch (level) {
    case 0:
      return "border-white/15 bg-white/10 text-white/70";
    case 1:
      return "border-sky-400/40 bg-sky-500/20 text-sky-100";
    case 2:
      return "border-amber-400/40 bg-amber-500/20 text-amber-50";
    case 3:
      return "border-emerald-400/40 bg-emerald-500/25 text-emerald-50";
    default:
      return "border-white/15 bg-white/10 text-white/70";
  }
}

function shortLevelLabel(level: PermissionLevel): string {
  switch (level) {
    case 0:
      return "No Access";
    case 1:
      return "View";
    case 2:
      return "Edit";
    case 3:
      return "Full / Approve";
    default:
      return PERMISSION_LEVEL_LABELS[level];
  }
}

/**
 * Compact Admin RBAC matrix — dark navy surface, editable permission pills.
 * Persistence via portal permission server functions (admin app_role only).
 */
export function AdminPermissionMatrix() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<BusinessRole | null>(null);
  const [editing, setEditing] = useState<{ role: BusinessRole; module: BusinessModule } | null>(
    null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const matrixQ = useQuery({
    queryKey: [...ADMIN_PERMISSION_MATRIX_QUERY_KEY],
    queryFn: getPermissionMatrix,
    staleTime: 15_000,
  });

  const saveM = useMutation({
    mutationFn: (input: {
      businessRole: BusinessRole;
      module: BusinessModule;
      level: PermissionLevel;
    }) => updatePermissionMatrixCell(input),
    onSuccess: async (result) => {
      // Only show success after the server confirmed persistence (mutation resolved).
      setErr(null);
      const pending =
        "refreshPending" in result && result.refreshPending
          ? " Staff access refresh is pending on open staff tabs."
          : "";
      setMsg(`${result.message}${pending}`);
      setEditing(null);
      // Refresh Admin matrix UI and staff shells that subscribe to effective-access.
      // Immediate local refresh; other staff sessions rely on Realtime + refetch.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ADMIN_PERMISSION_MATRIX_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [...STAFF_EFFECTIVE_ACCESS_QUERY_KEY] }),
        queryClient.refetchQueries({ queryKey: [...ADMIN_PERMISSION_MATRIX_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["portal", "auth-session"] }),
      ]);
    },
    onError: (e) => {
      setMsg(null);
      // Keep editing open so the Admin can retry with unsaved selection still visible.
      setErr(portalErrorMessage(e, "Could not save permission. Changes were not persisted."));
    },
  });

  const roles = matrixQ.data?.roles ?? [];
  const modules = matrixQ.data?.modules ?? [];
  const matrix = matrixQ.data?.matrix;
  const canEdit = Boolean(matrixQ.data?.canEdit);

  const legend = useMemo(
    () =>
      LEVELS.map((level) => (
        <span
          key={level}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
            levelPillClass(level),
          )}
        >
          {shortLevelLabel(level)}
        </span>
      )),
    [],
  );

  if (matrixQ.isLoading) {
    return (
      <section id="permissions" className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-navy">Role permissions</h2>
          <p className="text-xs text-muted-foreground">Loading permission matrix…</p>
        </header>
        <LoadingRows rows={4} />
      </section>
    );
  }

  if (matrixQ.isError) {
    const message = portalErrorMessage(matrixQ.error, "Could not load permissions.");
    if (/403|permission|not have permission/i.test(message)) {
      return <PermissionDenied body={message} />;
    }
    return (
      <section id="permissions" className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-navy">Role permissions</h2>
        </header>
        <ErrorState body={message} />
      </section>
    );
  }

  if (!matrix) {
    return (
      <section id="permissions" className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-navy">Role permissions</h2>
        </header>
        <ErrorState body="Permission matrix unavailable." />
      </section>
    );
  }

  return (
    <section id="permissions" className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Role permissions</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Business-role access by module. Admin always shows Full on every module. Only technical
            administrators can change permissions; changes save to Supabase.
            {matrixQ.data?.source === "defaults" ? (
              <span className="ml-1 text-amber-700">
                Showing defaults
                {canEdit
                  ? " until the matrix table is available."
                  : " (read-only in this session)."}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">{legend}</div>
      </header>

      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[oklch(0.22_0.075_258)] shadow-sm">
        <table className="min-w-[1100px] w-full border-collapse text-left text-[11px] text-white/90">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              <th className="sticky left-0 z-10 bg-[oklch(0.2_0.07_258)] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Role
              </th>
              {modules.map((module) => (
                <th
                  key={module}
                  className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/70"
                >
                  <span className="inline-block max-w-[5.5rem] leading-tight">
                    {BUSINESS_MODULE_LABELS[module]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const selected = selectedRole === role;
              const isAdminRow = role === "admin";
              return (
                <tr
                  key={role}
                  className={cn(
                    "border-b border-white/5 transition-colors",
                    selected ? "bg-white/10" : "hover:bg-white/[0.04]",
                  )}
                  onClick={() => setSelectedRole(role)}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 px-3 py-1.5 text-left text-[11px] font-semibold",
                      selected
                        ? "bg-[oklch(0.28_0.08_258)] text-white"
                        : "bg-[oklch(0.22_0.075_258)] text-white/95",
                    )}
                  >
                    {BUSINESS_ROLE_LABELS[role]}
                    {isAdminRow ? (
                      <span className="mt-0.5 block text-[9px] font-normal text-white/50">
                        Always Full
                      </span>
                    ) : null}
                  </th>
                  {modules.map((module, moduleIndex) => {
                    const level = matrix[role][moduleIndex] ?? 0;
                    const isEditing =
                      editing?.role === role &&
                      editing?.module === module &&
                      canEdit &&
                      !isAdminRow;
                    return (
                      <td key={module} className="px-1.5 py-1.5 text-center align-middle">
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-1">
                            <select
                              className="h-7 w-[7.5rem] rounded-md border border-white/20 bg-[oklch(0.18_0.06_258)] px-1 text-[10px] text-white"
                              value={level}
                              disabled={saveM.isPending}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const next = Number(e.target.value) as PermissionLevel;
                                setMsg(null);
                                setErr(null);
                                saveM.mutate({
                                  businessRole: role,
                                  module,
                                  level: next,
                                });
                              }}
                            >
                              {LEVELS.map((l) => (
                                <option key={l} value={l}>
                                  {shortLevelLabel(l)}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-white/70 hover:bg-white/10 hover:text-white"
                              disabled={saveM.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canEdit || isAdminRow || saveM.isPending}
                            title={
                              isAdminRow
                                ? "Admin role is always Full / Approve"
                                : canEdit
                                  ? `Change ${BUSINESS_MODULE_LABELS[module]} for ${BUSINESS_ROLE_LABELS[role]}`
                                  : "Read only"
                            }
                            className={cn(
                              "inline-flex min-w-[4.75rem] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition",
                              levelPillClass(level),
                              canEdit && !isAdminRow
                                ? "cursor-pointer hover:brightness-110"
                                : "cursor-default opacity-95",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canEdit || isAdminRow) return;
                              setSelectedRole(role);
                              setEditing({ role, module });
                              setMsg(null);
                              setErr(null);
                            }}
                          >
                            {shortLevelLabel(level)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRole ? (
        <p className="text-[11px] text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-navy">{BUSINESS_ROLE_LABELS[selectedRole]}</span>
          {canEdit && selectedRole !== "admin"
            ? " — click a permission pill to change and save."
            : selectedRole === "admin"
              ? " — Admin display permissions are locked to Full."
              : null}
        </p>
      ) : null}
    </section>
  );
}
