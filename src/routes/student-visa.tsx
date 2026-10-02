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
      { name: "description", content: "Document preparation, financial evidence, interview prep and full visa application support." },
      { property: "og:title", content: "Student Visa Support — Global Roots Consultants" },
      { property: "og:description", content: "Embassy-ready student visa files with a 98% success rate." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Student visa" title="Your visa, prepared properly" body="Visa decisions hinge on detail. Our dedicated visa officers make sure nothing is left to chance.">
        <Button asChild variant="bright" size="lg"><Link to="/contact">Talk to a Visa Consultant</Link></Button>
      </PageHero>
      <section className="container-page grid gap-4 py-16 md:grid-cols-2 lg:grid-cols-3">
        {visaSteps.map((v, i) => (
          <div key={v.title} className="panel p-6">
            <span className="text-xs font-bold uppercase tracking-wider text-royal">Step {i + 1}</span>
            <h2 className="mt-2 font-sans text-lg font-bold text-navy">{v.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
          </div>
        ))}
        <div className="rounded-xl bg-navy p-6 text-navy-foreground">
          <h2 className="font-sans text-lg font-bold">What's included</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {["Country-specific checklist", "CAS / LOA / I-20 guidance", "Bank statement review", "Mock embassy interview", "Biometrics booking", "Post-decision support"].map((x) => (
              <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-bright" />{x}</li>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
