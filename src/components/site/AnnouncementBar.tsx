import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { CmsPublicAnnouncement } from "@/lib/cms-types";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "gr-cms-announcement-dismissed";

function styleClasses(token: string) {
  switch (token) {
    case "royal":
      return "bg-royal text-white";
    case "bright":
      return "bg-bright text-navy";
    case "muted":
      return "bg-muted text-foreground";
    case "danger":
      return "bg-danger text-white";
    default:
      return "bg-navy text-navy-foreground";
  }
}

export function AnnouncementBar({
  announcements,
}: {
  announcements: CmsPublicAnnouncement[];
}) {
  const active = useMemo(
    () => [...announcements].sort((a, b) => a.sortOrder - b.sortOrder),
    [announcements],
  );
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw) as Record<string, true>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (active.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % active.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [active.length]);

  const visible = active.filter((a) => !dismissed[a.id]);
  useEffect(() => {
    if (!visible.length) return;
    if (index >= visible.length) setIndex(0);
  }, [visible.length, index]);

  if (!visible.length) return null;
  const current = visible[Math.min(index, visible.length - 1)] ?? visible[0]!;

  const dismiss = () => {
    if (!current.dismissible) return;
    const next = { ...dismissed, [current.id]: true as const };
    setDismissed(next);
    setIndex(0);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("relative z-[60] px-4 py-2 text-center text-sm", styleClasses(current.styleToken))}>
      <p className="mx-auto max-w-4xl pr-8">
        <span>{current.body}</span>
        {current.ctaLabel && current.ctaHref ? (
          <>
            {" "}
            <a
              href={current.ctaHref}
              className="font-semibold underline underline-offset-2"
              target={current.ctaHref.startsWith("http") ? "_blank" : undefined}
              rel={current.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {current.ctaLabel}
            </a>
          </>
        ) : null}
      </p>
      {current.dismissible ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 opacity-80 hover:opacity-100"
          aria-label="Dismiss announcement"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
