import { useEffect, useId, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXPLORE_UNIVERSITIES_SECTION,
  exploreUniversities,
  splitExploreUniversitiesForCarousel,
  type ExploreUniversity,
} from "@/data/explore-universities";
import { cn } from "@/lib/utils";

function UniversityMark({ university }: { university: ExploreUniversity }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showLogo =
    university.logoStatus === "verified_local" && Boolean(university.logoPath) && !imgFailed;

  return (
    <article
      className="flex w-[11.5rem] shrink-0 flex-col items-center justify-between rounded-xl border border-border/80 bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md sm:w-[13rem] sm:px-4 sm:py-3.5"
      tabIndex={0}
    >
      <div className="flex h-14 w-full items-center justify-center sm:h-16">
        {showLogo ? (
          <img
            src={university.logoPath!}
            alt=""
            width={160}
            height={64}
            loading="lazy"
            decoding="async"
            className="max-h-14 max-w-full object-contain sm:max-h-16"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 font-display text-sm font-semibold text-navy sm:h-14 sm:w-14 sm:text-base"
          >
            {university.name
              .replace(/[^\p{L}\p{N}\s]/gu, " ")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-center text-[0.7rem] font-medium leading-snug text-navy sm:text-xs">
        <span className="sr-only">University: </span>
        {university.name}
      </p>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">{university.country}</p>
    </article>
  );
}

function MarqueeRow({
  items,
  direction,
  paused,
  label,
}: {
  items: ExploreUniversity[];
  direction: "ltr" | "rtl";
  paused: boolean;
  label: string;
}) {
  // Duplicate track for seamless loop.
  const track = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative overflow-hidden" aria-label={label}>
      <div
        className={cn(
          "flex w-max gap-3 py-1 sm:gap-4",
          direction === "ltr" ? "animate-uni-marquee-ltr" : "animate-uni-marquee-rtl",
          paused && "[animation-play-state:paused]",
        )}
      >
        {track.map((u, i) => (
          <UniversityMark key={`${u.id}-${i}`} university={u} />
        ))}
      </div>
    </div>
  );
}

/** Two-row CSS marquee of universities to explore (not a verified partnership claim). */
export function UniversityLogoCarousel() {
  const headingId = useId();
  const { rowA, rowB } = useMemo(() => splitExploreUniversitiesForCarousel(), []);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduceMotion(mq.matches);
      if (mq.matches) setPaused(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <section aria-labelledby={headingId} className="section-y bg-surface">
      <div className="container-page">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">{EXPLORE_UNIVERSITIES_SECTION.eyebrow}</p>
            <h2
              id={headingId}
              className="mt-2 font-display text-2xl font-semibold text-navy md:text-3xl"
            >
              {EXPLORE_UNIVERSITIES_SECTION.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
              {EXPLORE_UNIVERSITIES_SECTION.body}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-start"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden /> Resume scroll
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden /> Pause scroll
              </>
            )}
          </Button>
        </div>

        {reduceMotion ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {exploreUniversities.map((u) => (
              <li key={u.id}>
                <UniversityMark university={u} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="space-y-3 sm:space-y-4"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setPaused(false);
              }
            }}
          >
            <MarqueeRow
              items={rowA}
              direction="ltr"
              paused={paused}
              label="University destinations, row one"
            />
            <MarqueeRow
              items={rowB}
              direction="rtl"
              paused={paused}
              label="University destinations, row two"
            />
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Showing {exploreUniversities.length} institutions. Official logos are added only after
          brand-asset review.
        </p>
      </div>
    </section>
  );
}
