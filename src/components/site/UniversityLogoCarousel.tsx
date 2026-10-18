import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXPLORE_UNIVERSITIES_SECTION,
  exploreUniversities,
  type ExploreUniversity,
} from "@/data/explore-universities";
import { cn } from "@/lib/utils";

function UniversityMark({ university }: { university: ExploreUniversity }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showLogo = Boolean(university.logoPath) && !imgFailed;

  return (
    <article
      className="group flex w-[12.5rem] shrink-0 flex-col items-center rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(2,20,51,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-royal/25 hover:shadow-md focus-within:border-royal/30 focus-within:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-[14rem]"
      tabIndex={0}
    >
      <div className="flex h-16 w-full items-center justify-center rounded-xl bg-surface/80 px-3 sm:h-[4.5rem]">
        {showLogo ? (
          <img
            src={university.logoPath!}
            alt={`${university.name} logo`}
            width={180}
            height={72}
            loading="lazy"
            decoding="async"
            className="max-h-14 max-w-full object-contain sm:max-h-16"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="px-1 text-center font-display text-sm font-semibold leading-tight text-navy">
            {university.name.split(",")[0]}
          </span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-center text-xs font-semibold leading-snug text-navy sm:text-[0.8125rem]">
        {university.name}
      </p>
      <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {university.country}
      </p>
    </article>
  );
}

function MarqueeRow({
  items,
  paused,
}: {
  items: ExploreUniversity[];
  paused: boolean;
}) {
  const track = useMemo(() => [...items, ...items], [items]);

  return (
    <div
      className="relative overflow-hidden"
      aria-label="Partnered universities scrolling horizontally"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-surface to-transparent sm:w-16"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface to-transparent sm:w-16"
        aria-hidden
      />
      <div
        className={cn(
          "flex w-max gap-4 py-2 sm:gap-5",
          "animate-uni-marquee-ltr",
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

/** Single-row partnered-universities marquee with Explore more CTA. */
export function UniversityLogoCarousel() {
  const headingId = useId();
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
          {!reduceMotion ? (
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
                  <Play className="h-3.5 w-3.5" aria-hidden /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
                </>
              )}
            </Button>
          ) : null}
        </div>

        {reduceMotion ? (
          <ul className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {exploreUniversities.map((u) => (
              <li key={u.id}>
                <UniversityMark university={u} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setPaused(false);
              }
            }}
          >
            <MarqueeRow items={exploreUniversities} paused={paused} />
          </div>
        )}

        {/* Explore more */}
        <div className="mt-10 rounded-2xl border border-border/80 bg-white px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-royal">
                More partnered universities
              </p>
              <h3 className="mt-1.5 font-display text-xl font-semibold text-navy md:text-2xl">
                Looking for the right partnered university?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Browse the full list of partnered universities, or book a free consultation and
                we will shortlist options around your goals, budget, and destination.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="navy" size="lg">
                <Link to="/universities">
                  View all partnered universities <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/contact">Book free consultation</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
