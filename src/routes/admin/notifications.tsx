import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, EmptyState, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getNotifications } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

function AdminNotifications() {
  const notifQ = useData(["notifications", "admin"], () => getNotifications("admin"));

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Admin alerts (demo inbox)." />
      {notifQ.isLoading ? (
        <LoadingRows />
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
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
