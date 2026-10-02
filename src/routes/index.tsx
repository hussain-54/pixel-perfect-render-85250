import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Quote, ShieldCheck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import consult from "@/assets/consult.jpg";
import { SiteLayout, SectionHead } from "@/components/site/SiteLayout";
import { DestinationCard, UniversityCard, ScholarshipCard, CtaBand } from "@/components/site/blocks";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { destinations, programCategories, services, visaSteps, howItWorks, whyUs, stories, faqs, resources, stats } from "@/data/site";
import { universities, scholarships } from "@/data/mock";
import { fmtDate } from "@/components/common";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Global Roots Consultants — Study Abroad & Student Visa Experts" },
      { name: "description", content: "Discover world-class universities, scholarships and expert guidance from application to visa with Global Roots Consultants." },
      { property: "og:title", content: "Global Roots Consultants — Study Abroad & Student Visa Experts" },
      { property: "og:description", content: "Your global education journey starts here. Expert guidance from application to visa." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <img src={hero} alt="International students on a university campus" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover" />
        <div className="bg-hero-overlay absolute inset-0" />
        <div className="container-page relative py-24 md:py-36">
          <p className="eyebrow">Global Education & Visa Consultants</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] md:text-7xl">Your Global Education Journey Starts Here.</h1>
          <p className="mt-6 max-w-xl text-lg text-navy-foreground/80">Discover world-class universities, explore international study opportunities, and get expert guidance from application to visa.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild variant="bright" size="lg"><Link to="/contact">Book Free Consultation</Link></Button>
            <Button asChild variant="outline-light" size="lg"><Link to="/destinations">Explore Study Destinations</Link></Button>
          </div>
        </div>
        <div className="relative border-t border-navy-foreground/10 bg-navy/80">
          <div className="container-page grid grid-cols-2 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="border-navy-foreground/10 py-7 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0">
                <p className="font-display text-3xl font-semibold md:text-4xl">{s.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-bright">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-sm font-semibold text-muted-foreground">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-royal" /> Official university representatives</span>
          <span>British Council trained counselors</span><span>ICEF accredited agency</span><span>Offices in Lahore · Karachi · Islamabad</span>
        </div>
      </section>

      {/* Destinations */}
      <section className="container-page py-20">
        <SectionHead eyebrow="Study destinations" title="Where will your degree take you?" action={<Button asChild variant="outline"><Link to="/destinations">All destinations <ArrowRight /></Link></Button>} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {destinations.slice(0, 8).map((d) => <DestinationCard key={d.name} d={d} />)}
        </div>
      </section>

      {/* Why */}
      <section className="bg-surface py-20">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <img src={consult} alt="Consultant advising a student" loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full rounded-xl object-cover" />
          <div>
            <SectionHead eyebrow="Why Global Roots" title="A consultancy built on trust and results" />
            <div className="grid gap-6 sm:grid-cols-2">
              {whyUs.map((w, i) => (
                <div key={w.title} className="border-t-2 border-royal pt-4">
                  <span className="text-xs font-bold text-royal">0{i + 1}</span>
                  <h3 className="mt-1 font-sans text-base font-bold text-navy">{w.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Universities */}
      <section className="container-page py-20">
        <SectionHead eyebrow="Featured universities" title="Partner institutions students love" action={<Button asChild variant="outline"><Link to="/universities">Browse universities <ArrowRight /></Link></Button>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {universities.slice(0, 4).map((u) => <UniversityCard key={u.id} u={u} />)}
        </div>
      </section>

      {/* Programs */}
      <section className="bg-surface py-20">
        <div className="container-page">
          <SectionHead eyebrow="Popular programs" title="Find the field that fits your future" action={<Button asChild variant="outline"><Link to="/programs">All programs <ArrowRight /></Link></Button>} />
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {programCategories.map((p) => (
              <Link key={p.name} to="/programs" className="group bg-background p-6 transition-colors hover:bg-accent">
                <p className="text-xs font-semibold text-muted-foreground">{p.count.toLocaleString()} programs</p>
                <h3 className="mt-2 font-sans text-base font-bold text-navy">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.examples}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Scholarships */}
      <section className="container-page py-20">
        <SectionHead eyebrow="Scholarships" title="Funding that makes it possible" action={<Button asChild variant="outline"><Link to="/scholarships">All scholarships <ArrowRight /></Link></Button>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scholarships.slice(0, 3).map((s) => <ScholarshipCard key={s.id} s={s} />)}
        </div>
      </section>

      {/* Services */}
      <section className="bg-navy py-20 text-navy-foreground">
        <div className="container-page">
          <p className="eyebrow">Our services</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold md:text-4xl">End-to-end support, from first idea to first lecture</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl bg-navy-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <div key={s.title} className="bg-navy p-6">
                <span className="font-display text-3xl font-semibold text-bright">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-sans text-base font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-navy-foreground/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visa */}
      <section className="container-page grid gap-12 py-20 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHead eyebrow="Student visa support" title="Embassy-ready files, every time" body="Our visa officers handle the details that decide outcomes." />
          <Button asChild><Link to="/student-visa">Talk to a Visa Consultant</Link></Button>
        </div>
        <ol className="space-y-3">
          {visaSteps.map((v, i) => (
            <li key={v.title} className="panel flex gap-4 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-royal">{i + 1}</span>
              <div><h3 className="font-sans text-sm font-bold text-navy">{v.title}</h3><p className="text-sm text-muted-foreground">{v.body}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* How it works */}
      <section className="bg-surface py-20">
        <div className="container-page">
          <SectionHead eyebrow="How it works" title="Four clear steps" />
          <div className="grid gap-6 md:grid-cols-4">
            {howItWorks.map((h, i) => (
              <div key={h.title}>
                <div className="flex items-center gap-3"><span className="font-display text-4xl font-semibold text-royal">{i + 1}</span><span className="h-px flex-1 bg-border" /></div>
                <h3 className="mt-4 font-sans text-base font-bold text-navy">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="container-page py-20">
        <SectionHead eyebrow="Success stories" title="Students who made it" action={<Button asChild variant="outline"><Link to="/success-stories">More stories <ArrowRight /></Link></Button>} />
        <div className="grid gap-4 md:grid-cols-2">
          {stories.slice(0, 2).map((s) => (
            <figure key={s.name} className="panel p-8">
              <Quote className="h-6 w-6 text-bright" />
              <blockquote className="mt-4 font-display text-xl leading-snug text-navy">“{s.quote}”</blockquote>
              <figcaption className="mt-6 text-sm"><b className="text-navy">{s.name}</b> <span className="text-muted-foreground">· {s.program}, {s.to}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Resources + FAQ */}
      <section className="bg-surface py-20">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHead eyebrow="Resources" title="Guides & insights" />
            <ul className="divide-y rounded-xl border bg-background">
              {resources.slice(0, 4).map((r) => (
                <li key={r.title}><Link to="/resources" className="flex items-center justify-between gap-4 p-5 hover:bg-accent">
                  <div><p className="text-xs font-semibold text-royal">{r.tag} · {fmtDate(r.date)}</p><p className="mt-1 font-semibold text-navy">{r.title}</p></div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link></li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHead eyebrow="FAQ" title="Questions students ask" />
            <Accordion type="single" collapsible className="rounded-xl border bg-background px-5">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`f${i}`}>
                  <AccordionTrigger className="text-left font-semibold text-navy">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <CtaBand />
    </SiteLayout>
  );
}
