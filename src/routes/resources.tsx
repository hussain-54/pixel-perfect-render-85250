import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { fmtDate } from "@/components/common";
import { resources } from "@/data/site";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources & Guides — Global Roots Consultants" },
      { name: "description", content: "Guides on visas, scholarships, applications and English tests for studying abroad." },
      { property: "og:title", content: "Resources & Guides — Global Roots Consultants" },
      { property: "og:description", content: "Practical study-abroad guides from our consultants." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Resources" title="Guides & insights" body="Practical advice from consultants who file hundreds of applications every year." />
      <section className="container-page grid gap-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <article key={r.title} className="panel flex flex-col p-6 transition-shadow hover:shadow-soft">
            <span className="self-start rounded bg-accent px-2 py-1 text-xs font-semibold text-royal">{r.tag}</span>
            <h2 className="mt-4 flex-1 font-sans text-lg font-bold text-navy">{r.title}</h2>
            <p className="mt-4 text-xs text-muted-foreground">{fmtDate(r.date)} · {r.read} read</p>
          </article>
        ))}
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
