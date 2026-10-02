<<<<<<< HEAD
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
=======
import { createFileRoute } from "@tanstack/react-router";
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { fmtDate } from "@/components/common";
import { resources } from "@/data/site";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources & Guides — Global Roots Consultants" },
<<<<<<< HEAD
      {
        name: "description",
        content:
          "Guides on visas, scholarships, applications and English tests for studying abroad.",
      },
      { property: "og:title", content: "Resources & Guides — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Practical study-abroad guides from our consultants.",
      },
=======
      { name: "description", content: "Guides on visas, scholarships, applications and English tests for studying abroad." },
      { property: "og:title", content: "Resources & Guides — Global Roots Consultants" },
      { property: "og:description", content: "Practical study-abroad guides from our consultants." },
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
<<<<<<< HEAD
      <PageHero
        eyebrow="Resources"
        title="Guides & insights"
        body="Practical advice from consultants who file hundreds of applications every year."
      />
      <section className="container-page section-y">
        <ul className="divide-y border-y border-border">
          {resources.map((r) => (
            <li key={r.title}>
              <Link
                to="/contact"
                className="group flex flex-col gap-2 py-5 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                    {r.tag}
                  </span>
                  <h2 className="mt-1 font-sans text-[1.05rem] font-semibold text-navy group-hover:text-royal">
                    {r.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(r.date)} · {r.read} read
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-royal" />
              </Link>
            </li>
          ))}
        </ul>
=======
      <PageHero eyebrow="Resources" title="Guides & insights" body="Practical advice from consultants who file hundreds of applications every year." />
      <section className="container-page grid gap-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <article key={r.title} className="panel flex flex-col p-6 transition-shadow hover:shadow-soft">
            <span className="self-start rounded bg-accent px-2 py-1 text-xs font-semibold text-royal">{r.tag}</span>
            <h2 className="mt-4 flex-1 font-sans text-lg font-bold text-navy">{r.title}</h2>
            <p className="mt-4 text-xs text-muted-foreground">{fmtDate(r.date)} · {r.read} read</p>
          </article>
        ))}
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
