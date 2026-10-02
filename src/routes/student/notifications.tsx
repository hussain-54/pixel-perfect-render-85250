import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, EmptyState, ErrorState, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getNotifications } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/notifications")({
  component: StudentNotifications,
});

function StudentNotifications() {
  const notifQ = useData(["notifications", "student"], () => getNotifications("student"));

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Demo inbox for student alerts." />
      {notifQ.isLoading ? (
        <LoadingRows />
      ) : notifQ.isError ? (
        <ErrorState />
      ) : !notifQ.data?.length ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="space-y-3">
          {notifQ.data.map((n) => (
            <li key={n.id}>
              <Panel className={cn(!n.read && "ring-2 ring-royal/30")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.time}</span>
                </div>
                {!n.read && (
                  <span className="mt-3 inline-block rounded-full bg-royal/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-royal">
                    Unread
                  </span>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
