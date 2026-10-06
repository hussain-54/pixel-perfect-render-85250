import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { Button } from "@/components/ui/button";
import { destinations } from "@/data/site";

export const Route = createFileRoute("/destinations")({
  head: () => ({
    meta: [
      { title: "Study Destinations — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Explore study destinations across Europe, North America, Asia and beyond with Global Roots Consultants.",
      },
      { property: "og:title", content: "Study Destinations — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Compare leading study destinations: work rights, intakes and opportunities.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Study destinations"
        title="Study destinations worldwide."
        body="Compare work rights, intakes and opportunities across our partner countries, then let our specialists build your plan."
      />
      <section className="container-page space-y-10 py-12 md:space-y-14 md:py-16">
        {destinations.map((d, i) => (
          <article
            key={d.name}
            id={d.name.toLowerCase().replace(/\s/g, "-")}
            className="grid scroll-mt-24 gap-6 border-b border-border pb-10 last:border-0 md:grid-cols-2 md:gap-10 md:pb-14"
          >
            <img
              src={d.img}
              alt={`Study in ${d.name}`}
              loading="lazy"
              width={1024}
              height={768}
              className={`aspect-[16/10] w-full rounded-lg object-cover ${i % 2 ? "md:order-2" : ""}`}
            />
            <div className="flex flex-col justify-center">
              <p className="eyebrow">Study in</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-navy md:text-3xl">
                {d.name}
              </h2>
              <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-muted-foreground">
                {d.desc}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Post-study work
                  </dt>
                  <dd className="mt-1 font-semibold text-navy">{d.work}</dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Intakes
                  </dt>
                  <dd className="mt-1 font-semibold text-navy">{d.intake}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/contact">Explore {d.name}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/universities" search={{ country: d.name }}>
                    View universities
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
