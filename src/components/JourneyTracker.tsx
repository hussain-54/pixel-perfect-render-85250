import { Check, ArrowRight } from "lucide-react";
import { getStages, stageIndex } from "@/services";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/components/common";
import type { StageKey } from "@/types";
import type { JourneyTimelineItem } from "@/types/journey-timeline";

function statusTone(status: JourneyTimelineItem["status"]) {
  switch (status) {
    case "completed":
      return "text-success";
    case "rejected":
    case "returned":
      return "text-destructive";
    case "overdue":
      return "text-warning";
    case "claimed":
      return "text-royal";
    case "current":
      return "text-royal";
    default:
      return "text-muted-foreground";
  }
}

/** The student's 12-stage journey: completed / current / upcoming + optional live timeline. */
export function JourneyTracker({
  stage,
  compact = false,
  timelineItems,
  pendingActions,
}: {
  stage: StageKey;
  compact?: boolean;
  /** Chronological events from persisted records (live). Omitted/empty = stage checklist only. */
  timelineItems?: JourneyTimelineItem[];
  pendingActions?: JourneyTimelineItem[];
}) {
  const stages = getStages();
  const current = stageIndex(stage);
  const cur = stages[Math.max(current, 0)]!;
  const pct = Math.round((current / (stages.length - 1)) * 100);
  const nextFromRecords = pendingActions?.[0]?.pendingAction ?? pendingActions?.[0]?.title;
  const nextAction = nextFromRecords || cur.nextAction;

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_1.2fr]">
        <div className="bg-navy p-6 text-navy-foreground md:p-7">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Your education journey
          </p>
          <div className="mt-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-navy-foreground/55">
              Current stage
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-navy-foreground md:text-[1.75rem]">
              {cur.label}
            </p>
          </div>
          <div className="mt-5 border border-navy-foreground/12 bg-navy-soft/80 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-bright">
              Next action
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-foreground/90">{nextAction}</p>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-navy-foreground/65">
              <span>
                Step {current + 1} of {stages.length}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-navy-soft">
              <div
                className="h-full rounded-full bg-bright transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        </div>
        <ol
          className={cn("grid gap-0.5 p-3 md:p-5", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}
        >
          {stages.map((s, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                  state === "current" && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
                    state === "done" && "bg-success text-white",
                    state === "current" && "bg-royal text-white",
                    state === "todo" && "border border-border text-muted-foreground",
                  )}
                  aria-label={
                    state === "done" ? "Completed" : state === "current" ? "Current" : "Upcoming"
                  }
                >
                  {state === "done" ? (
                    <Check className="h-3 w-3" />
                  ) : state === "current" ? (
                    <ArrowRight className="h-3 w-3" />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate",
                    state === "todo" ? "text-muted-foreground" : "font-medium text-navy",
                    state === "current" && "font-semibold",
                  )}
                >
                  {s.label}
                </span>
                {state === "current" && (
                  <span className="ml-auto shrink-0 text-[0.625rem] font-bold uppercase tracking-wider text-royal">
                    Now
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {timelineItems && timelineItems.length > 0 ? (
        <div className="border-t border-border px-4 py-4 md:px-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Timeline (from your case records)
          </p>
          <ol className="mt-3 space-y-3">
            {timelineItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 border-t border-border/70 pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  ) : null}
                  {item.responsibleTeam ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Team: {item.responsibleTeam}
                    </p>
                  ) : null}
                  {item.pendingAction ? (
                    <p className="mt-1 text-xs font-medium text-royal">{item.pendingAction}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      statusTone(item.status),
                    )}
                  >
                    {item.status}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.at ? fmtDate(item.at) : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
