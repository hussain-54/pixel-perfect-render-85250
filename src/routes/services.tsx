import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero, SectionHead } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { services, howItWorks } from "@/data/site";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Global Roots Consultants" },
      { name: "description", content: "Counseling, university selection, applications, scholarships, visa and pre-departure support." },
      { property: "og:title", content: "Services — Global Roots Consultants" },
      { property: "og:description", content: "Eight services covering every step of studying abroad." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Services" title="Every step, handled by experts" body="One team, one plan, one place to track it all." />
      <section className="container-page py-16">
        <div className="divide-y rounded-xl border">
          {services.map((s, i) => (
            <div key={s.title} className="grid gap-4 p-6 md:grid-cols-[120px_1fr_2fr] md:items-center md:p-8">
              <span className="font-display text-4xl font-semibold text-royal">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-sans text-lg font-bold text-navy">{s.title}</h2>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-surface py-16">
        <div className="container-page">
          <SectionHead eyebrow="Process" title="How we work together" />
          <div className="grid gap-6 md:grid-cols-4">
            {howItWorks.map((h, i) => (
              <div key={h.title} className="panel p-6"><span className="text-sm font-bold text-royal">Step {i + 1}</span><h3 className="mt-2 font-sans font-bold text-navy">{h.title}</h3><p className="mt-1 text-sm text-muted-foreground">{h.body}</p></div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
