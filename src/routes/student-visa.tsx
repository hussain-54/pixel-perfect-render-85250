import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { Button } from "@/components/ui/button";
import { visaSteps } from "@/data/site";

export const Route = createFileRoute("/student-visa")({
  head: () => ({
    meta: [
      { title: "Student Visa Support — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Document preparation, financial evidence, interview prep and full visa application support.",
      },
      { property: "og:title", content: "Student Visa Support — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Embassy-ready student visa files with a 98% success rate.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Student visa"
        title="Your visa, prepared properly"
        body="Visa decisions hinge on detail. Our dedicated visa officers make sure nothing is left to chance."
      >
        <Button asChild variant="bright" size="lg">
          <Link to="/contact">Talk to a Visa Consultant</Link>
        </Button>
      </PageHero>
      <section className="container-page section-y grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
        <ol className="divide-y border-y border-border">
          {visaSteps.map((v, i) => (
            <li key={v.title} className="py-5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                Step {i + 1}
              </span>
              <h2 className="mt-1.5 font-sans text-[1.05rem] font-semibold text-navy">{v.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </li>
          ))}
        </ol>
        <aside className="h-fit bg-navy p-6 text-navy-foreground md:p-7">
          <h2 className="font-sans text-[1.05rem] font-semibold">What's included</h2>
          <ul className="mt-5 space-y-2.5 text-sm text-navy-foreground/85">
            {[
              "Country-specific checklist",
              "CAS / LOA / I-20 guidance",
              "Bank statement review",
              "Mock embassy interview",
              "Biometrics booking",
              "Post-decision support",
            ].map((x) => (
              <li key={x} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bright" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
