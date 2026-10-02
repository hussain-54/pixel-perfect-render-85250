import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { filterSearch, type SearchHit } from "@/data/navigation";
import { cn } from "@/lib/utils";

export function SiteSearch({
  open,
  onOpenChange,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const results = useMemo(() => filterSearch(q), [q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open search"
        onClick={() => onOpenChange(true)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  const groups = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    (acc[hit.group] ??= []).push(hit);
    return acc;
  }, {});

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor={panelId}>
          Search universities, programs, scholarships, destinations, and resources
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id={panelId}
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onOpenChange(false);
            }}
            placeholder="Search…"
            className="h-9 w-44 rounded-md border border-input bg-background pl-8 pr-3 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:w-56"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={`${panelId}-results`}
          />
        </div>
        <button
          type="button"
          aria-label="Close search"
          onClick={() => onOpenChange(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        id={`${panelId}-results`}
        role="listbox"
        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-white shadow-[0_12px_40px_-20px_oklch(0.22_0.075_258_/_0.35)]"
      >
        <div className="h-0.5 bg-royal" aria-hidden />
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches found.</p>
          ) : (
            Object.entries(groups).map(([group, hits]) => (
              <div key={group} className="mb-1">
                <p className="px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-royal">
                  {group}
                </p>
                <ul>
                  {hits.map((hit) => (
                    <li key={`${hit.group}-${hit.label}`}>
                      <Link
                        to={hit.to}
                        {...(hit.search ? { search: hit.search } : {})}
                        {...(hit.hash ? { hash: hit.hash } : {})}
                        role="option"
                        onClick={() => onOpenChange(false)}
                        className="block rounded-md px-2.5 py-2 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block text-sm text-navy">{hit.label}</span>
                        {hit.meta && (
                          <span className="block text-[0.7rem] text-muted-foreground">
                            {hit.meta}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
