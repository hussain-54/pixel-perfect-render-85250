import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero, SectionHead } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { services, howItWorks } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/services")({
  head: () =>
    pageHead({
      path: "/services",
      title: "Services — Global Roots Consultants",
      description:
        "Counseling, university selection, applications, scholarships, visa and pre-departure support.",
    }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Services"
        title="Every step, handled by experts"
        body="One team, one plan, one place to track it all."
      />
      <section className="container-page section-y">
        <div className="divide-y border-y border-border">
          {services.map((s, i) => (
            <div
              key={s.title}
              className="grid gap-2 py-6 sm:gap-3 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.6fr)] md:items-start md:gap-6 md:py-7"
            >
              <span className="font-display text-xl font-semibold text-royal md:text-2xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-sans text-base font-semibold text-navy md:text-[1.05rem]">
                {s.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="section-y bg-surface">
        <div className="container-page">
          <SectionHead eyebrow="Process" title="How we work together" />
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
            {howItWorks.map((h, i) => (
              <div
                key={h.title}
                className="rounded-lg border border-border/80 bg-white p-4 md:border-0 md:bg-transparent md:p-0"
              >
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                  Step {i + 1}
                </span>
                <h3 className="mt-2 font-sans text-[0.95rem] font-semibold text-navy">{h.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
