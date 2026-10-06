import { createFileRoute } from "@tanstack/react-router";
import consult from "@/assets/consult.jpg";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { stats, whyUs } from "@/data/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Global Roots Consultants is a premium education and visa consultancy guiding students worldwide.",
      },
      { property: "og:title", content: "About Us — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Our story, values and the team behind Global Roots Consultants.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About us"
        title="Rooted in trust. Global in reach."
        body="For over a decade we have helped students turn ambition into admission letters and visas."
      />
      <section className="container-page section-y grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-4 text-muted-foreground">
          <h2 className="font-display text-2xl font-semibold text-navy md:text-3xl">Our mission</h2>
          <p className="leading-relaxed">
            We believe every capable student deserves honest, expert guidance. Our consultants
            combine country-specific knowledge with a transparent process, so families always know
            where they stand.
          </p>
          <p className="leading-relaxed">
            Today we represent more than 2,000 universities across 30+ countries. Global Roots
            Consultants is SECP Registered, with our office in Faisalabad.
          </p>
          <div className="grid grid-cols-2 gap-5 pt-2">
            {stats.map((s) => (
              <div key={s.label} className="border-l-2 border-royal pl-4">
                <p className="font-display text-2xl font-semibold text-navy md:text-3xl">
                  {s.value}
                </p>
                <p className="mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <img
          src={consult}
          alt="Global Roots consultant with student"
          loading="lazy"
          width={1024}
          height={768}
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      </section>
      <section className="section-y bg-surface">
        <div className="container-page grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {whyUs.map((w, i) => (
            <div key={w.title} className="border-t border-royal/30 pt-4">
              <span className="text-[0.6875rem] font-semibold text-royal">0{i + 1}</span>
              <h3 className="mt-1.5 font-sans text-[0.95rem] font-semibold text-navy">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
