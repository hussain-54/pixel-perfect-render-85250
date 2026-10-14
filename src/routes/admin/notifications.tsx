import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  EmptyState,
  ErrorState,
  LoadingRows,
  portalErrorMessage,
} from "@/components/common";
import { useData } from "@/lib/useData";
import { shouldOfferMarkAsRead } from "@/lib/notification-rules";
import { getNotifications, markNotificationRead } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

function AdminNotifications() {
  const queryClient = useQueryClient();
  const notifQ = useData(["notifications", "admin"], () => getNotifications("admin"));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const markM = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      setMsg("Notification marked as read.");
      setErr(null);
      setBusyId(null);
      await queryClient.invalidateQueries({ queryKey: ["notifications", "admin"] });
    },
    onError: (e) => {
      setMsg(null);
      setBusyId(null);
      setErr(portalErrorMessage(e, "Could not mark notification as read."));
    },
  });

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alerts for your admin account." />
      {msg ? (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}
      {notifQ.isLoading ? (
        <LoadingRows />
      ) : notifQ.isError ? (
        <ErrorState body={portalErrorMessage(notifQ.error)} />
      ) : !notifQ.data?.length ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="space-y-3">
          {notifQ.data.map((n) => (
            <li key={n.id}>
              <Panel className={cn(!n.read && "ring-2 ring-royal/30")}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.time}</span>
                </div>
                {shouldOfferMarkAsRead(n) ? (
                  <button
                    type="button"
                    className="mt-3 inline-block rounded-full bg-royal/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-royal disabled:opacity-60"
                    disabled={markM.isPending && busyId === n.id}
                    aria-label={`Mark ${n.title} as read`}
                    onClick={() => {
                      setBusyId(n.id);
                      setErr(null);
                      markM.mutate(n.id);
                    }}
                  >
                    {markM.isPending && busyId === n.id ? "Saving…" : "Unread · Mark read"}
                  </button>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
