import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { Button } from "@/components/ui/button";
import { destinations } from "@/data/site";

export const Route = createFileRoute("/destinations")({
  head: () => ({
    meta: [
      { title: "Study Destinations — Global Roots Consultants" },
      { name: "description", content: "Study in the UK, Canada, Australia, Germany, USA and 7 more countries with expert guidance." },
      { property: "og:title", content: "Study Destinations — Global Roots Consultants" },
      { property: "og:description", content: "Compare 12 leading study destinations: work rights, intakes and opportunities." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Study destinations" title="Twelve countries. One trusted guide." body="Compare work rights, intakes and opportunities, then let our country specialists build your plan." />
      <section className="container-page space-y-6 py-16">
        {destinations.map((d, i) => (
          <article key={d.name} id={d.name.toLowerCase().replace(/\s/g, "-")} className="panel grid scroll-mt-24 overflow-hidden md:grid-cols-[1fr_1.3fr]">
            <img src={d.img} alt={`Study in ${d.name}`} loading="lazy" width={1024} height={768} className={`h-64 w-full object-cover md:h-full ${i % 2 ? "md:order-2" : ""}`} />
            <div className="p-8">
              <p className="eyebrow">Study in</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-navy">{d.name}</h2>
              <p className="mt-3 text-muted-foreground">{d.desc}</p>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post-study work</dt><dd className="mt-1 font-semibold text-navy">{d.work}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intakes</dt><dd className="mt-1 font-semibold text-navy">{d.intake}</dd></div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild><Link to="/contact">Explore {d.name}</Link></Button>
                <Button asChild variant="outline"><Link to="/universities" search={{ country: d.name }}>View universities</Link></Button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
