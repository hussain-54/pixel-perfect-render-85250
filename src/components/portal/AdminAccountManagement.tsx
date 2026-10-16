import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  PermissionDenied,
  TableWrap,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCOUNT_PROVISIONING_OPTIONS, type AccountListItem } from "@/lib/account-provisioning";
import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import {
  createPortalAccount,
  listPortalAccountOptions,
  listPortalAccounts,
  resendPortalPasswordReset,
  revokePortalAccountSessions,
  setPortalConsultantDeskStatus,
  setPortalTemporaryPassword,
  updatePortalAccountBusinessRole,
} from "@/services";

const CREATABLE_APP_ROLES: Exclude<AppRole, "super_admin">[] = ["student", "consultant", "admin"];
const DEFAULT_BUSINESS_ROLE: BusinessRole = "counsellor_consultant";
const DEFAULT_APP_ROLE: Exclude<AppRole, "super_admin"> = "consultant";

export type AccountManagementFocus = "all" | "directory" | "create" | "actions";

function optionsForAppRole(appRole: AppRole) {
  return ACCOUNT_PROVISIONING_OPTIONS.filter((o) => o.appRole === appRole);
}

/**
 * Live Supabase Auth Admin account management — used inside Admin → Users & Roles.
 * Does not persist Organization/Notification preview fields.
 */
export function AdminAccountManagement({ focus = "all" }: { focus?: AccountManagementFocus }) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    appRole: DEFAULT_APP_ROLE as Exclude<AppRole, "super_admin">,
    businessRole: DEFAULT_BUSINESS_ROLE as BusinessRole,
    temporaryPassword: "",
    confirmPassword: "",
  });
  const [tempPwTarget, setTempPwTarget] = useState<string | null>(null);
  const [tempPwForm, setTempPwForm] = useState({ temporaryPassword: "", confirmPassword: "" });
  const [roleDrafts, setRoleDrafts] = useState<Record<string, BusinessRole>>({});

  const showCreate = focus === "all" || focus === "create";
  const showDirectory = focus === "all" || focus === "directory" || focus === "actions";
  const showRoleAssign = focus === "all" || focus === "directory" || focus === "actions";

  const accountsQ = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: listPortalAccounts,
    staleTime: 15_000,
  });
  const optionsQ = useQuery({
    queryKey: ["admin", "account-options"],
    queryFn: listPortalAccountOptions,
    staleTime: 60_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "accounts"] });
  };

  const businessOptions = useMemo(() => {
    const fromServer = optionsQ.data?.options;
    const base = fromServer?.length
      ? ACCOUNT_PROVISIONING_OPTIONS.filter((o) =>
          fromServer.some((s) => s.businessRole === o.businessRole),
        )
      : ACCOUNT_PROVISIONING_OPTIONS;
    return base.filter((o) => o.appRole === form.appRole);
  }, [optionsQ.data?.options, form.appRole]);

  const selectedOption =
    businessOptions.find((o) => o.businessRole === form.businessRole) ?? businessOptions[0];

  useEffect(() => {
    if (!businessOptions.length) return;
    if (!businessOptions.some((o) => o.businessRole === form.businessRole)) {
      const next = businessOptions[0];
      if (!next) return;
      setForm((f) => ({
        ...f,
        businessRole: next.businessRole,
        appRole: next.appRole as Exclude<AppRole, "super_admin">,
      }));
    }
  }, [businessOptions, form.businessRole]);

  const setMessage = (text: string, isError = false) => {
    if (isError) {
      setErr(text);
      setMsg(null);
    } else {
      setMsg(text);
      setErr(null);
    }
  };

  const createM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof createPortalAccount>[0] = {
        fullName: form.fullName,
        email: form.email,
        businessRole: form.businessRole,
        temporaryPassword: form.temporaryPassword,
        confirmPassword: form.confirmPassword,
      };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.department.trim()) payload.department = form.department.trim();
      return createPortalAccount(payload);
    },
    onSuccess: async (result) => {
      setMessage(result.message);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        department: "",
        appRole: DEFAULT_APP_ROLE,
        businessRole: DEFAULT_BUSINESS_ROLE,
        temporaryPassword: "",
        confirmPassword: "",
      });
      await invalidate();
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not create account."), true),
  });

  const setTempPasswordM = useMutation({
    mutationFn: (input: { userId: string; temporaryPassword: string; confirmPassword: string }) =>
      setPortalTemporaryPassword(input),
    onSuccess: async (result) => {
      setMessage(result.message);
      setTempPwTarget(null);
      setTempPwForm({ temporaryPassword: "", confirmPassword: "" });
      await invalidate();
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not set temporary password."), true),
  });

  const resetPasswordM = useMutation({
    mutationFn: (userId: string) => resendPortalPasswordReset({ userId }),
    onSuccess: async (result) => {
      setMessage(result.message);
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not send password reset."), true),
  });

  const deskStatusM = useMutation({
    mutationFn: (input: { userId: string; status: "active" | "inactive" }) =>
      setPortalConsultantDeskStatus(input),
    onSuccess: async (result) => {
      setMessage(result.message);
      await invalidate();
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not update account status."), true),
  });

  const revokeM = useMutation({
    mutationFn: (userId: string) => revokePortalAccountSessions({ userId }),
    onSuccess: async (result) => {
      setMessage(result.message);
      await invalidate();
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not revoke sessions."), true),
  });

  const updateRoleM = useMutation({
    mutationFn: (input: { userId: string; businessRole: BusinessRole }) =>
      updatePortalAccountBusinessRole(input),
    onSuccess: async (result) => {
      setMessage(result.message);
      setRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[result.account.id];
        return next;
      });
      await invalidate();
    },
    onError: (e) => setMessage(portalErrorMessage(e, "Could not update business role."), true),
  });

  const accounts = useMemo(() => accountsQ.data?.accounts ?? [], [accountsQ.data?.accounts]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.businessRole ?? "").toLowerCase().includes(q) ||
        a.appRole.toLowerCase().includes(q) ||
        (a.department ?? "").toLowerCase().includes(q),
    );
  }, [accounts, filter]);

  const actionBusy =
    setTempPasswordM.isPending ||
    resetPasswordM.isPending ||
    deskStatusM.isPending ||
    revokeM.isPending ||
    updateRoleM.isPending;

  // Keep section chrome visible on loading/error so Users & Roles never looks empty
  // when the API is unavailable.
  let body: ReactNode;
  if (accountsQ.isLoading) {
    body = <LoadingRows rows={6} />;
  } else if (accountsQ.isError) {
    const text = portalErrorMessage(accountsQ.error);
    if (
      text.includes("403") ||
      text.includes("503") ||
      text.toLowerCase().includes("permission") ||
      text.toLowerCase().includes("not configured") ||
      text.toLowerCase().includes("service_role") ||
      text.toLowerCase().includes("service-role") ||
      text.toLowerCase().includes("secret_key")
    ) {
      body = (
        <PermissionDenied
          body={
            text ||
            "Account management is unavailable. Sign in as an admin, set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in Vercel Production (never VITE_*), then Redeploy."
          }
        />
      );
    } else {
      body = <ErrorState body={text} />;
    }
  } else if (!accountsQ.data) {
    body = <ErrorState body="Account list unavailable." />;
  } else {
    body = (
      <>
        {msg ? (
          <p
            className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-navy"
            role="status"
          >
            {msg}
          </p>
        ) : null}
        {err ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        <div
          className={
            showCreate && showDirectory
              ? "grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
              : "grid gap-4"
          }
        >
          {showCreate ? (
            <Panel title="Create account" className="scroll-mt-6">
              <form
                className="grid gap-3 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  setErr(null);
                  setMsg(null);
                  if (!selectedOption) {
                    setMessage("Select a valid app role and business role pair.", true);
                    return;
                  }
                  const pw = validatePasswordConfirmation(
                    form.temporaryPassword,
                    form.confirmPassword,
                  );
                  if (!pw.ok) {
                    setMessage(pw.error, true);
                    return;
                  }
                  createM.mutate();
                }}
              >
                <div>
                  <Label htmlFor="settings-acct-name">Full name</Label>
                  <Input
                    id="settings-acct-name"
                    className="mt-1.5"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Full name"
                    required
                    disabled={createM.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="settings-acct-email">Work email</Label>
                  <Input
                    id="settings-acct-email"
                    type="email"
                    className="mt-1.5"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="name@company.com"
                    required
                    disabled={createM.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="settings-acct-phone">Phone (optional)</Label>
                  <Input
                    id="settings-acct-phone"
                    className="mt-1.5"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    disabled={createM.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="settings-acct-app-role">App role</Label>
                  <select
                    id="settings-acct-app-role"
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2"
                    value={form.appRole}
                    disabled={createM.isPending}
                    onChange={(e) => {
                      const appRole = e.target.value as Exclude<AppRole, "super_admin">;
                      const nextBiz =
                        optionsForAppRole(appRole)[0]?.businessRole ?? form.businessRole;
                      const opt = ACCOUNT_PROVISIONING_OPTIONS.find(
                        (o) => o.businessRole === nextBiz,
                      );
                      setForm((f) => ({
                        ...f,
                        appRole,
                        businessRole: nextBiz,
                        department: f.department.trim() || opt?.departmentSuggested || f.department,
                      }));
                    }}
                  >
                    {CREATABLE_APP_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="settings-acct-biz-role">Business role</Label>
                  <select
                    id="settings-acct-biz-role"
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2"
                    value={form.businessRole}
                    disabled={createM.isPending || businessOptions.length === 0}
                    onChange={(e) => {
                      const businessRole = e.target.value as BusinessRole;
                      const opt = ACCOUNT_PROVISIONING_OPTIONS.find(
                        (o) => o.businessRole === businessRole,
                      );
                      setForm((f) => ({
                        ...f,
                        businessRole,
                        appRole: (opt?.appRole as Exclude<AppRole, "super_admin">) ?? f.appRole,
                        department: f.department.trim() || opt?.departmentSuggested || f.department,
                      }));
                    }}
                  >
                    {businessOptions.map((o) => (
                      <option key={o.businessRole} value={o.businessRole}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {selectedOption?.needsConsultantDesk
                      ? "Creates an active consultant desk (assignment-scoped — not org-wide student access)."
                      : "No consultant desk (admin/student)."}{" "}
                    <span className="font-medium text-navy">super_admin</span> is never offered
                    here.
                  </p>
                </div>
                {selectedOption?.needsConsultantDesk ? (
                  <div>
                    <Label htmlFor="settings-acct-dept">Department / designation</Label>
                    <Input
                      id="settings-acct-dept"
                      className="mt-1.5"
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      placeholder={selectedOption.departmentSuggested || "Department"}
                      disabled={createM.isPending}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="settings-acct-temp-pw">Temporary password</Label>
                  <Input
                    id="settings-acct-temp-pw"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1.5"
                    value={form.temporaryPassword}
                    onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
                    placeholder={`Min ${PASSWORD_MIN_LENGTH} chars, letter + number`}
                    required
                    disabled={createM.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="settings-acct-confirm-pw">Confirm temporary password</Label>
                  <Input
                    id="settings-acct-confirm-pw"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1.5"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Confirm password"
                    required
                    disabled={createM.isPending}
                  />
                </div>
                <Button type="submit" disabled={createM.isPending} className="w-fit">
                  {createM.isPending ? "Creating account…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Creates the Auth user directly (no invitation email). Share the temporary password
                  through your secure channel. The employee can sign in immediately; password change
                  is optional from the portal. Duplicate emails are rejected. Passwords are never
                  stored in application tables.
                </p>
              </form>
            </Panel>
          ) : null}

          {showDirectory ? (
            <Panel
              title={focus === "actions" ? "Account actions" : "Directory"}
              className="scroll-mt-6"
            >
              <div className="mb-3">
                <Input
                  placeholder="Search by name, email, role, department…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Search accounts"
                />
              </div>
              {filtered.length === 0 ? (
                <EmptyState title="No accounts" body="Create an account or adjust the search." />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>App role</th>
                      <th>Business role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((account) => {
                      const draftRole =
                        roleDrafts[account.id] ??
                        (account.businessRole &&
                        ACCOUNT_PROVISIONING_OPTIONS.some(
                          (o) => o.businessRole === account.businessRole,
                        )
                          ? (account.businessRole as BusinessRole)
                          : DEFAULT_BUSINESS_ROLE);
                      return (
                        <AccountRow
                          key={account.id}
                          account={account}
                          busy={actionBusy}
                          showRoleAssign={showRoleAssign}
                          draftBusinessRole={draftRole}
                          onDraftBusinessRoleChange={(businessRole) =>
                            setRoleDrafts((prev) => ({ ...prev, [account.id]: businessRole }))
                          }
                          onSaveBusinessRole={() =>
                            updateRoleM.mutate({
                              userId: account.id,
                              businessRole: draftRole,
                            })
                          }
                          roleSavePending={
                            updateRoleM.isPending && updateRoleM.variables?.userId === account.id
                          }
                          tempPwOpen={tempPwTarget === account.id}
                          tempPwForm={tempPwForm}
                          onTempPwFormChange={setTempPwForm}
                          onToggleTempPw={() => {
                            setTempPwTarget((id) => (id === account.id ? null : account.id));
                            setTempPwForm({ temporaryPassword: "", confirmPassword: "" });
                          }}
                          onSubmitTempPw={() => {
                            const pw = validatePasswordConfirmation(
                              tempPwForm.temporaryPassword,
                              tempPwForm.confirmPassword,
                            );
                            if (!pw.ok) {
                              setMessage(pw.error, true);
                              return;
                            }
                            setTempPasswordM.mutate({
                              userId: account.id,
                              temporaryPassword: tempPwForm.temporaryPassword,
                              confirmPassword: tempPwForm.confirmPassword,
                            });
                          }}
                          tempPwPending={setTempPasswordM.isPending}
                          onPasswordReset={() => resetPasswordM.mutate(account.id)}
                          onSetDeskStatus={(status) =>
                            deskStatusM.mutate({ userId: account.id, status })
                          }
                          onRevokeSessions={() => revokeM.mutate(account.id)}
                        />
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}
            </Panel>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div id="accounts" className="scroll-mt-6 space-y-4">
      {focus === "all" ? (
        <div>
          <h3 className="font-display text-lg font-semibold text-navy">
            User &amp; Account Management
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create staff and student accounts with a temporary password (no invitation email).
            Passwords are never stored in application tables or returned from the directory.
            Requires a live admin session and server-only{" "}
            <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> (or{" "}
            <code className="text-xs">SUPABASE_SECRET_KEY</code>) on Vercel Production, then
            Redeploy.
          </p>
        </div>
      ) : null}
      {body}
    </div>
  );
}

function AccountRow({
  account,
  busy,
  showRoleAssign,
  draftBusinessRole,
  onDraftBusinessRoleChange,
  onSaveBusinessRole,
  roleSavePending,
  tempPwOpen,
  tempPwForm,
  onTempPwFormChange,
  onToggleTempPw,
  onSubmitTempPw,
  tempPwPending,
  onPasswordReset,
  onSetDeskStatus,
  onRevokeSessions,
}: {
  account: AccountListItem;
  busy: boolean;
  showRoleAssign: boolean;
  draftBusinessRole: BusinessRole;
  onDraftBusinessRoleChange: (role: BusinessRole) => void;
  onSaveBusinessRole: () => void;
  roleSavePending: boolean;
  tempPwOpen: boolean;
  tempPwForm: { temporaryPassword: string; confirmPassword: string };
  onTempPwFormChange: (next: { temporaryPassword: string; confirmPassword: string }) => void;
  onToggleTempPw: () => void;
  onSubmitTempPw: () => void;
  tempPwPending: boolean;
  onPasswordReset: () => void;
  onSetDeskStatus: (status: "active" | "inactive") => void;
  onRevokeSessions: () => void;
}) {
  const businessLabel =
    account.businessRole && account.businessRole in BUSINESS_ROLE_LABELS
      ? BUSINESS_ROLE_LABELS[account.businessRole as BusinessRole]
      : account.businessRole || "—";
  const roleDirty = account.businessRole !== draftBusinessRole;
  const canEditRole = showRoleAssign && account.appRole !== "super_admin";
  const canToggleDesk = account.appRole === "consultant" || account.deskStatus !== "n/a";

  return (
    <tr>
      <td className="font-medium text-navy">{account.fullName || "—"}</td>
      <td>{account.email}</td>
      <td>{account.appRole}</td>
      <td>
        {canEditRole ? (
          <div className="flex min-w-[12rem] flex-col gap-1.5">
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={draftBusinessRole}
              disabled={busy}
              aria-label={`Business role for ${account.fullName || account.email}`}
              onChange={(e) => onDraftBusinessRoleChange(e.target.value as BusinessRole)}
            >
              {ACCOUNT_PROVISIONING_OPTIONS.map((o) => (
                <option key={o.businessRole} value={o.businessRole}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={busy || !roleDirty}
              onClick={onSaveBusinessRole}
            >
              {roleSavePending ? "Saving…" : "Update role"}
            </Button>
          </div>
        ) : (
          businessLabel
        )}
      </td>
      <td>
        {account.invited && !account.lastSignInAt ? (
          <StatusBadge status="Pending" />
        ) : (
          <StatusBadge
            status={
              account.deskStatus === "inactive"
                ? "Inactive"
                : account.deskStatus === "active"
                  ? "Active"
                  : "n/a"
            }
          />
        )}
      </td>
      <td>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onToggleTempPw}
            >
              {tempPwOpen ? "Cancel temp password" : "Set temp password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onPasswordReset}
            >
              Email reset link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onRevokeSessions}
            >
              Revoke sessions
            </Button>
            {canToggleDesk ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onSetDeskStatus(account.deskStatus === "inactive" ? "active" : "inactive")
                }
              >
                {account.deskStatus === "inactive" ? "Reactivate" : "Deactivate"}
              </Button>
            ) : null}
          </div>
          {tempPwOpen ? (
            <div className="grid max-w-sm gap-2 rounded-md border border-border bg-muted/30 p-2">
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={`Temporary password (min ${PASSWORD_MIN_LENGTH})`}
                value={tempPwForm.temporaryPassword}
                onChange={(e) =>
                  onTempPwFormChange({ ...tempPwForm, temporaryPassword: e.target.value })
                }
                disabled={tempPwPending}
                aria-label="Temporary password"
              />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm temporary password"
                value={tempPwForm.confirmPassword}
                onChange={(e) =>
                  onTempPwFormChange({ ...tempPwForm, confirmPassword: e.target.value })
                }
                disabled={tempPwPending}
                aria-label="Confirm temporary password"
              />
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={tempPwPending}
                onClick={onSubmitTempPw}
              >
                {tempPwPending ? "Saving…" : "Save temporary password"}
              </Button>
              <p className="text-[0.7rem] text-muted-foreground">
                Share out-of-band. Existing sessions are revoked; employee signs in with the new
                password. Never shown after save.
              </p>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
