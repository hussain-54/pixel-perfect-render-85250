import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  LoadingRows,
  ErrorState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  organizationSettingsAreDirty,
  validateOrganizationSettingsWrite,
  type NormalizedOrganizationSettings,
} from "@/lib/admin-settings-rules";
import { getOrganizationSettings, updateOrganizationSettings } from "@/services";

const TABS = [
  { id: "organization", label: "Organization" },
  { id: "notifications", label: "Notifications" },
  { id: "system", label: "System Preferences" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: unknown): TabId {
  const value = typeof raw === "string" ? raw : "";
  return (TABS.find((t) => t.id === value)?.id ?? "organization") as TabId;
}

export const Route = createFileRoute("/admin/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseTab(search["tab"]),
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tab = useRouterState({
    select: (s) => parseTab((s.location.search as { tab?: string }).tab),
  });

  const [draft, setDraft] = useState<NormalizedOrganizationSettings>({
    ...DEFAULT_ORGANIZATION_SETTINGS,
  });
  const [saved, setSaved] = useState<NormalizedOrganizationSettings>({
    ...DEFAULT_ORGANIZATION_SETTINGS,
  });
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["admin", "organization-settings"],
    queryFn: () => getOrganizationSettings(),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!settingsQ.data) return;
    setDraft(settingsQ.data.settings);
    setSaved(settingsQ.data.settings);
  }, [settingsQ.data]);

  const dirty = organizationSettingsAreDirty(draft, saved);
  const canMutate = Boolean(settingsQ.data?.canMutate && settingsQ.data?.schemaReady);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveM = useMutation({
    mutationFn: () => {
      const parsed = validateOrganizationSettingsWrite(draft);
      if (!parsed.ok) {
        setFieldError(parsed.error);
        throw new Error(parsed.error);
      }
      setFieldError(null);
      return updateOrganizationSettings(parsed.normalized);
    },
    onSuccess: async (payload) => {
      setDraft(payload.settings);
      setSaved(payload.settings);
      setFeedback({ kind: "ok", text: "Settings saved." });
      await queryClient.invalidateQueries({ queryKey: ["admin", "organization-settings"] });
    },
    onError: (e) => {
      setFeedback({
        kind: "err",
        text: portalErrorMessage(e, "Could not save settings."),
      });
    },
  });

  const subnav = useMemo(
    () =>
      TABS.map((t) => ({
        to: "/admin/settings",
        label: t.label,
        tab: t.id,
      })),
    [],
  );

  if (settingsQ.isLoading) return <LoadingRows rows={6} />;
  if (settingsQ.isError) {
    const text = portalErrorMessage(settingsQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const payload = settingsQ.data;
  const readOnlyHint = !canMutate
    ? payload?.schemaReady === false
      ? payload.note ??
        "Settings storage is not ready. An administrator must apply the organization_settings migration."
      : "You can view these settings but do not have permission to change them."
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Organization profile and notification preferences. User accounts and the permission matrix live under Users & Roles."
      />
      <AdminModuleSubnav items={subnav} />

      {payload?.note ? (
        <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {payload.note}
          {payload.source === "live" && payload.updatedAt
            ? ` Last updated ${new Date(payload.updatedAt).toLocaleString()}.`
            : null}
        </p>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      {dirty ? (
        <p className="text-xs font-medium text-amber-800" role="status">
          You have unsaved changes.
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          void navigate({
            href: `/admin/settings?tab=${encodeURIComponent(parseTab(next))}`,
          });
        }}
      >
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-1 sm:flex-none">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="organization">
          <form
            className="grid max-w-2xl gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canMutate || saveM.isPending) return;
              setFeedback(null);
              saveM.mutate();
            }}
          >
            <Panel title="Organization">
              {readOnlyHint ? (
                <p className="mb-4 text-xs text-muted-foreground">{readOnlyHint}</p>
              ) : (
                <p className="mb-4 text-xs text-muted-foreground">
                  Saved to Supabase organization settings for all staff who can view Settings.
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org-name">Consultancy name</Label>
                  <Input
                    id="org-name"
                    value={draft.consultancyName}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, consultancyName: e.target.value }))
                    }
                    className="mt-1.5"
                    disabled={!canMutate || saveM.isPending}
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <Label htmlFor="support-email">Support email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={draft.supportEmail}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, supportEmail: e.target.value }))
                    }
                    className="mt-1.5"
                    disabled={!canMutate || saveM.isPending}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="footer">Portal footer note</Label>
                  <Textarea
                    id="footer"
                    value={draft.portalFooterNote}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, portalFooterNote: e.target.value }))
                    }
                    className="mt-1.5"
                    rows={3}
                    disabled={!canMutate || saveM.isPending}
                  />
                </div>
              </div>
              {fieldError ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {fieldError}
                </p>
              ) : null}
            </Panel>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="w-full sm:w-fit"
                disabled={!canMutate || !dirty || saveM.isPending}
              >
                {saveM.isPending ? "Saving…" : "Save organization settings"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                disabled={!dirty || saveM.isPending}
                onClick={() => {
                  setDraft(saved);
                  setFieldError(null);
                  setFeedback(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="notifications">
          <form
            className="grid max-w-2xl gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canMutate || saveM.isPending) return;
              setFeedback(null);
              saveM.mutate();
            }}
          >
            <Panel title="Notifications">
              <p className="mb-3 text-xs text-muted-foreground">
                Preference flags are persisted with organization settings. Live delivery still uses
                the dedicated Notifications tools where implemented.
              </p>
              {readOnlyHint ? (
                <p className="mb-3 text-xs text-muted-foreground">{readOnlyHint}</p>
              ) : null}
              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-navy">Email admins on new leads</p>
                  <p className="text-xs text-muted-foreground">
                    Organization preference (delivery not wired from this toggle alone)
                  </p>
                </div>
                <Switch
                  checked={draft.emailAdminsOnNewLeads}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, emailAdminsOnNewLeads: checked }))
                  }
                  disabled={!canMutate || saveM.isPending}
                  aria-label="Email admins on new leads"
                />
              </div>
              <div className="flex items-center justify-between gap-4 border-t py-2">
                <div>
                  <p className="text-sm font-semibold text-navy">Student document alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Prefer notifying consultants when uploads arrive
                  </p>
                </div>
                <Switch
                  checked={draft.studentDocumentAlerts}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, studentDocumentAlerts: checked }))
                  }
                  disabled={!canMutate || saveM.isPending}
                  aria-label="Student document alerts"
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                For the full notifications workspace, open{" "}
                <Link
                  to="/admin/notifications"
                  className="font-medium text-bright underline-offset-2 hover:underline"
                >
                  Notifications
                </Link>
                .
              </p>
            </Panel>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="w-full sm:w-fit"
                disabled={!canMutate || !dirty || saveM.isPending}
              >
                {saveM.isPending ? "Saving…" : "Save notification preferences"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                disabled={!dirty || saveM.isPending}
                onClick={() => {
                  setDraft(saved);
                  setFieldError(null);
                  setFeedback(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="system">
          <Panel title="System Preferences">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Import / export and operational utilities remain available without cluttering the
                main sidebar. These links are navigation only — not stored as settings rows.
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <Link
                    to="/admin/import-export"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Import / Export
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/audit-logs"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Audit Logs
                  </Link>{" "}
                  (existing route — not duplicated)
                </li>
                <li>
                  <Link
                    to="/change-password"
                    className="font-medium text-bright underline-offset-2 hover:underline"
                  >
                    Change password
                  </Link>
                </li>
              </ul>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
