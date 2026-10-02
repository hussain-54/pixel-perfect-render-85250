import { createFileRoute } from "@tanstack/react-router";
import consult from "@/assets/consult.jpg";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { stats, whyUs } from "@/data/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Global Roots Consultants" },
      { name: "description", content: "Global Roots Consultants is a premium education and visa consultancy guiding students worldwide." },
      { property: "og:title", content: "About Us — Global Roots Consultants" },
      { property: "og:description", content: "Our story, values and the team behind 10,000+ student journeys." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="About us" title="Rooted in trust. Global in reach." body="For over a decade we have helped students turn ambition into admission letters and visas." />
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-2">
        <div className="space-y-4 text-muted-foreground">
          <h2 className="font-display text-3xl font-semibold text-navy">Our mission</h2>
          <p>We believe every capable student deserves honest, expert guidance. Our consultants combine country-specific knowledge with a transparent process, so families always know where they stand.</p>
          <p>Today we represent more than 1,500 universities across 50+ countries, with offices in Lahore, Karachi and Islamabad.</p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {stats.map((s) => <div key={s.label} className="border-l-2 border-royal pl-4"><p className="font-display text-3xl font-semibold text-navy">{s.value}</p><p className="text-xs font-semibold uppercase tracking-wider">{s.label}</p></div>)}
          </div>
        </div>
        <img src={consult} alt="Global Roots consultant with student" loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full rounded-xl object-cover" />
      </section>
      <section className="bg-surface py-16">
        <div className="container-page grid gap-4 md:grid-cols-4">
          {whyUs.map((w) => <div key={w.title} className="panel p-6"><h3 className="font-sans font-bold text-navy">{w.title}</h3><p className="mt-2 text-sm text-muted-foreground">{w.body}</p></div>)}
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
