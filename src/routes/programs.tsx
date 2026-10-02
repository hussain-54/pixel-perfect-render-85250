import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { programCategories } from "@/data/site";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Programs — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Business, Computer Science, Engineering, Medicine, Data Science and more — find your program abroad.",
      },
      { property: "og:title", content: "Programs — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Explore thousands of international degree programs across 8 fields.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Programs"
        title="Thousands of programs. Eight fields."
        body="From foundation year to PhD — we match you with programs that fit your grades, budget and goals."
      />
      <section className="container-page section-y">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {programCategories.map((p, i) => (
            <Link
              key={p.name}
              to="/contact"
              className="group flex flex-col bg-background p-5 transition-colors hover:bg-accent/60 md:p-6"
            >
              <span className="font-display text-2xl font-semibold text-royal">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-3 font-sans text-[0.95rem] font-semibold text-navy">{p.name}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {p.examples}
              </p>
              <p className="mt-5 flex items-center justify-between text-sm font-semibold text-navy">
                {p.count.toLocaleString()} programs
                <ArrowRight className="h-4 w-4 text-royal transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
