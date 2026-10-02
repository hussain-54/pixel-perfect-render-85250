import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero, SectionHead } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { services, howItWorks } from "@/data/site";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Global Roots Consultants" },
<<<<<<< HEAD
      {
        name: "description",
        content:
          "Counseling, university selection, applications, scholarships, visa and pre-departure support.",
      },
      { property: "og:title", content: "Services — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Eight services covering every step of studying abroad.",
      },
=======
      { name: "description", content: "Counseling, university selection, applications, scholarships, visa and pre-departure support." },
      { property: "og:title", content: "Services — Global Roots Consultants" },
      { property: "og:description", content: "Eight services covering every step of studying abroad." },
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
        eyebrow="Services"
        title="Every step, handled by experts"
        body="One team, one plan, one place to track it all."
      />
      <section className="container-page section-y">
        <div className="divide-y border-y border-border">
          {services.map((s, i) => (
            <div
              key={s.title}
              className="grid gap-3 py-6 md:grid-cols-[5rem_1fr_1.6fr] md:items-start md:gap-6 md:py-7"
            >
              <span className="font-display text-2xl font-semibold text-royal">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-sans text-[1.05rem] font-semibold text-navy">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
                {s.body}
              </p>
=======
      <PageHero eyebrow="Services" title="Every step, handled by experts" body="One team, one plan, one place to track it all." />
      <section className="container-page py-16">
        <div className="divide-y rounded-xl border">
          {services.map((s, i) => (
            <div key={s.title} className="grid gap-4 p-6 md:grid-cols-[120px_1fr_2fr] md:items-center md:p-8">
              <span className="font-display text-4xl font-semibold text-royal">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-sans text-lg font-bold text-navy">{s.title}</h2>
              <p className="text-muted-foreground">{s.body}</p>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
            </div>
          ))}
        </div>
      </section>
<<<<<<< HEAD
      <section className="section-y bg-surface">
        <div className="container-page">
          <SectionHead eyebrow="Process" title="How we work together" />
          <div className="grid gap-8 md:grid-cols-4 md:gap-6">
            {howItWorks.map((h, i) => (
              <div key={h.title}>
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
                  Step {i + 1}
                </span>
                <h3 className="mt-2 font-sans text-[0.95rem] font-semibold text-navy">{h.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
=======
      <section className="bg-surface py-16">
        <div className="container-page">
          <SectionHead eyebrow="Process" title="How we work together" />
          <div className="grid gap-6 md:grid-cols-4">
            {howItWorks.map((h, i) => (
              <div key={h.title} className="panel p-6"><span className="text-sm font-bold text-royal">Step {i + 1}</span><h3 className="mt-2 font-sans font-bold text-navy">{h.title}</h3><p className="mt-1 text-sm text-muted-foreground">{h.body}</p></div>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}
