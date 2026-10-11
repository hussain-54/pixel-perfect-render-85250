/**
 * Server-process scheduler for task automation.
 * Not a browser timer — starts once in the Node/Nitro server entry.
 * Production deployments should also wire an external cron to portalRunTaskAutomation.
 */
import { runTaskAutomationSweep } from "@/server/task-automation";

const INTERVAL_MS = 5 * 60 * 1000;

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastError: string | null = null;

export function isTaskAutomationSchedulerActive(): boolean {
  return started && timer !== null;
}

export function getTaskAutomationSchedulerError(): string | null {
  return lastError;
}

export function startTaskAutomationScheduler(): void {
  if (started) return;
  if (typeof setInterval !== "function") return;
  started = true;

  const tick = () => {
    try {
      runTaskAutomationSweep();
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("[task-automation]", lastError);
    }
  };

  // Initial sweep shortly after boot (avoid blocking cold start).
  setTimeout(tick, 2_000);
  timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer === "object" && timer && "unref" in timer) {
    try {
      (timer as NodeJS.Timeout).unref();
    } catch {
      /* ignore */
    }
  }
}