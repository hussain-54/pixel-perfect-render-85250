import { createFileRoute } from "@tanstack/react-router";
import { Quote } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { Initials } from "@/components/common";
import { stories } from "@/data/site";

export const Route = createFileRoute("/success-stories")({
  head: () => ({
    meta: [
      { title: "Success Stories — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Real students who reached top universities in the UK, Canada, Germany and Australia.",
      },
      { property: "og:title", content: "Success Stories — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Hear from students we guided to their dream universities.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Success stories" title="500+ students guided. Countless journeys." />
      <section className="container-page section-y grid gap-10 md:grid-cols-2 md:gap-x-12 md:gap-y-14">
        {stories.map((s) => (
          <figure key={s.name} className="border-t border-royal/25 pt-6">
            <Quote className="h-5 w-5 text-bright" aria-hidden />
            <blockquote className="mt-3 font-display text-lg leading-snug text-navy md:text-xl">
              “{s.quote}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <Initials name={s.name} />
              <div className="text-sm">
                <p className="font-semibold text-navy">
                  {s.name} <span className="font-normal text-muted-foreground">from {s.from}</span>
                </p>
                <p className="text-muted-foreground">
                  {s.program} · {s.to}
                </p>
              </div>
            </figcaption>
          </figure>
        ))}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
