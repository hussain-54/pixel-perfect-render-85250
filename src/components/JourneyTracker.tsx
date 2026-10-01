import { Check, ArrowRight } from "lucide-react";
import { getStages, stageIndex } from "@/services";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/types";

/** The student's 12-stage journey: completed / current / upcoming. */
export function JourneyTracker({ stage, compact = false }: { stage: StageKey; compact?: boolean }) {
  const stages = getStages();
  const current = stageIndex(stage);
  const cur = stages[Math.max(current, 0)]!;
  const pct = Math.round((current / (stages.length - 1)) * 100);

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_1.4fr]">
        <div className="bg-navy p-6 text-navy-foreground md:p-8">
          <p className="eyebrow">Your Global Education Journey</p>
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-navy-foreground/60">Current step</p>
            <p className="mt-1 font-display text-2xl font-semibold md:text-3xl">{cur.label}</p>
          </div>
          <div className="mt-6 rounded-lg border border-navy-foreground/15 bg-navy-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-bright">Next action</p>
            <p className="mt-1 text-sm leading-relaxed">{cur.nextAction}</p>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-xs text-navy-foreground/70">
              <span>Step {current + 1} of {stages.length}</span><span>{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-navy-soft">
              <div className="h-full rounded-full bg-bright" style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          </div>
        </div>
        <ol className={cn("grid gap-1 p-4 md:p-6", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
          {stages.map((s, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  state === "current" && "bg-accent ring-1 ring-royal",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold",
                    state === "done" && "bg-success text-navy-foreground",
                    state === "current" && "bg-royal text-navy-foreground",
                    state === "todo" && "border border-border text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "current" ? <ArrowRight className="h-3.5 w-3.5" /> : String(i + 1).padStart(2, "0")}
                </span>
                <span className={cn(state === "todo" ? "text-muted-foreground" : "font-semibold text-navy")}>{s.label}</span>
                {state === "current" && <span className="ml-auto text-[0.65rem] font-bold uppercase tracking-wider text-royal">Now</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
