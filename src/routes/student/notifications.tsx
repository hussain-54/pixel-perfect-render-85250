import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  PageLoadState,
  EmptyState,
  ErrorState,
  LoadingRows,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/useData";
import { shouldOfferMarkAsRead } from "@/lib/notification-rules";
import { resolveStudentNotificationHref } from "@/lib/student-portal-workspace";
import { getNotifications, markNotificationRead } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/notifications")({
  component: StudentNotifications,
});

function StudentNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notifQ = useData(["notifications", "student"], () => getNotifications("student"));
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const markM = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      setErr(null);
      setBusyId(null);
      await queryClient.invalidateQueries({ queryKey: ["notifications", "student"] });
    },
    onError: (e) => {
      setBusyId(null);
      setErr(portalErrorMessage(e, "Could not mark notification as read."));
    },
  });

  const unread = (notifQ.data ?? []).filter((n) => !n.read).length;

  async function openNotification(n: { id: string; read: boolean; linkPath?: string | null }) {
    const href = resolveStudentNotificationHref({ linkPath: n.linkPath });
    if (shouldOfferMarkAsRead(n) && !n.read) {
      try {
        setBusyId(n.id);
        await markM.mutateAsync(n.id);
      } catch {
        // Best-effort mark-read; still navigate.
      } finally {
        setBusyId(null);
      }
    }
    void router.navigate({ to: href });
  }

  if (notifQ.isLoading) {
    return (
      <PageLoadState
        title="Notifications"
        subtitle="Updates about fees, documents, and applications"
      >
        <LoadingRows rows={5} />
      </PageLoadState>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title="Notifications"
        subtitle={
          unread > 0
            ? `${unread} unread · Updates about fees, documents, and applications`
            : "Updates about fees, documents, and applications"
        }
      />
      {err ? <ErrorState body={err} onRetry={() => setErr(null)} /> : null}
      {notifQ.isError ? (
        <ErrorState body={portalErrorMessage(notifQ.error)} onRetry={() => void notifQ.refetch()} />
      ) : !notifQ.data?.length ? (
        <EmptyState
          title="No notifications"
          body="When staff verify fees, review documents, or update applications, alerts appear here."
        />
      ) : (
        <ul className="space-y-2">
          {notifQ.data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-md border border-border px-3 py-3 text-left transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring",
                  !n.read && "border-navy/25 bg-navy/[0.03]",
                )}
                onClick={() => void openNotification(n)}
                aria-label={`${n.title}${n.read ? "" : ", unread"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-navy">{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
                </div>
                {n.body ? (
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {n.read ? "Read" : "Unread"}
                  </span>
                  {n.linkPath?.startsWith("/student/") ? (
                    <span className="text-[11px] text-royal">Open related page</span>
                  ) : null}
                  {shouldOfferMarkAsRead(n) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      disabled={markM.isPending && busyId === n.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBusyId(n.id);
                        setErr(null);
                        markM.mutate(n.id);
                      }}
                    >
                      {markM.isPending && busyId === n.id ? "Saving…" : "Mark read"}
                    </Button>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
