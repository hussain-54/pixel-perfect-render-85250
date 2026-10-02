import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Quote, ShieldCheck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import consult from "@/assets/consult.jpg";
import { SiteLayout, SectionHead } from "@/components/site/SiteLayout";
<<<<<<< HEAD
import { DestinationCard, UniversityCard, CtaBand } from "@/components/site/blocks";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  destinations,
  programCategories,
  services,
  visaSteps,
  howItWorks,
  whyUs,
  stories,
  faqs,
  resources,
  stats,
} from "@/data/site";
=======
import { DestinationCard, UniversityCard, ScholarshipCard, CtaBand } from "@/components/site/blocks";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { destinations, programCategories, services, visaSteps, howItWorks, whyUs, stories, faqs, resources, stats } from "@/data/site";
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
import { universities, scholarships } from "@/data/mock";
import { fmtDate } from "@/components/common";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
<<<<<<< HEAD
      { title: "Global Roots Consultants | Global Education & Visa Consultants" },
      {
        name: "description",
        content:
          "Discover world-class universities, scholarships and expert guidance from application to visa with Global Roots Consultants.",
      },
      {
        property: "og:title",
        content: "Global Roots Consultants | Global Education & Visa Consultants",
      },
      {
        property: "og:description",
        content:
          "Your global education journey starts here. Expert guidance from application to visa.",
      },
=======
      { title: "Global Roots Consultants — Study Abroad & Student Visa Experts" },
      { name: "description", content: "Discover world-class universities, scholarships and expert guidance from application to visa with Global Roots Consultants." },
      { property: "og:title", content: "Global Roots Consultants — Study Abroad & Student Visa Experts" },
      { property: "og:description", content: "Your global education journey starts here. Expert guidance from application to visa." },
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
<<<<<<< HEAD
        <img
          src={hero}
          alt="International students on a university campus"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="bg-hero-overlay absolute inset-0" />
        <div className="container-page relative py-16 md:py-20 lg:py-24">
          <p className="font-display text-xl font-semibold tracking-tight text-navy-foreground md:text-2xl">
            Global Roots Consultants
          </p>
          <p className="mt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-bright">
            Global Education & Visa Consultants
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-[2.15rem] font-semibold leading-[1.1] text-navy-foreground md:text-5xl lg:text-[3.25rem]">
            Your Global Education Journey Starts Here.
          </h1>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-navy-foreground/80 md:text-base">
            Discover world-class universities, explore international study opportunities, and get
            expert guidance from application to visa.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="bright" size="lg">
              <Link to="/contact">Book Free Consultation</Link>
            </Button>
            <Button asChild variant="outline-light" size="lg">
              <Link to="/destinations">Explore Study Destinations</Link>
            </Button>
          </div>
        </div>
        <div className="relative border-t border-navy-foreground/10 bg-navy/85">
          <div className="container-page grid grid-cols-2 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="border-navy-foreground/10 py-6 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0"
              >
                <p className="font-display text-2xl font-semibold text-navy-foreground md:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-bright">
                  {s.label}
                </p>
=======
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
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-sm font-semibold text-muted-foreground">
<<<<<<< HEAD
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-royal" /> Official university representatives
          </span>
          <span>British Council trained counselors</span>
          <span>ICEF accredited agency</span>
          <span>Offices in Lahore · Karachi · Islamabad</span>
=======
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-royal" /> Official university representatives</span>
          <span>British Council trained counselors</span><span>ICEF accredited agency</span><span>Offices in Lahore · Karachi · Islamabad</span>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
        </div>
      </section>

      {/* Destinations */}
<<<<<<< HEAD
      <section className="container-page section-y">
        <SectionHead
          eyebrow="Study destinations"
          title="Where will your degree take you?"
          action={
            <Button asChild variant="outline">
              <Link to="/destinations">
                All destinations <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {destinations.slice(0, 8).map((d) => (
            <DestinationCard key={d.name} d={d} />
          ))}
=======
      <section className="container-page py-20">
        <SectionHead eyebrow="Study destinations" title="Where will your degree take you?" action={<Button asChild variant="outline"><Link to="/destinations">All destinations <ArrowRight /></Link></Button>} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {destinations.slice(0, 8).map((d) => <DestinationCard key={d.name} d={d} />)}
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
        </div>
      </section>

      {/* Why */}
<<<<<<< HEAD
      <section className="section-y bg-surface">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <img
            src={consult}
            alt="Consultant advising a student"
            loading="lazy"
            width={1024}
            height={768}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
          <div>
            <SectionHead
              eyebrow="Why Global Roots"
              title="A consultancy built on trust and results"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {whyUs.map((w, i) => (
                <div key={w.title} className="border-t border-royal/40 pt-3.5">
                  <span className="text-[0.6875rem] font-semibold text-royal">0{i + 1}</span>
                  <h3 className="mt-1 font-sans text-[0.95rem] font-semibold text-navy">
                    {w.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
=======
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
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Universities */}
<<<<<<< HEAD
      <section className="container-page section-y">
        <SectionHead
          eyebrow="Featured universities"
          title="Partner institutions students love"
          action={
            <Button asChild variant="outline">
              <Link to="/universities">
                Browse universities <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {universities.slice(0, 4).map((u) => (
            <UniversityCard key={u.id} u={u} />
          ))}
=======
      <section className="container-page py-20">
        <SectionHead eyebrow="Featured universities" title="Partner institutions students love" action={<Button asChild variant="outline"><Link to="/universities">Browse universities <ArrowRight /></Link></Button>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {universities.slice(0, 4).map((u) => <UniversityCard key={u.id} u={u} />)}
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
        </div>
      </section>

      {/* Programs */}
<<<<<<< HEAD
      <section className="section-y bg-surface">
        <div className="container-page">
          <SectionHead
            eyebrow="Popular programs"
            title="Find the field that fits your future"
            action={
              <Button asChild variant="outline">
                <Link to="/programs">
                  All programs <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {programCategories.map((p) => (
              <Link
                key={p.name}
                to="/programs"
                className="group bg-background p-5 transition-colors hover:bg-accent/70 md:p-6"
              >
                <p className="text-[0.6875rem] font-medium text-muted-foreground">
                  {p.count.toLocaleString()} programs
                </p>
                <h3 className="mt-1.5 font-sans text-[0.95rem] font-semibold text-navy">
                  {p.name}
                </h3>
=======
      <section className="bg-surface py-20">
        <div className="container-page">
          <SectionHead eyebrow="Popular programs" title="Find the field that fits your future" action={<Button asChild variant="outline"><Link to="/programs">All programs <ArrowRight /></Link></Button>} />
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {programCategories.map((p) => (
              <Link key={p.name} to="/programs" className="group bg-background p-6 transition-colors hover:bg-accent">
                <p className="text-xs font-semibold text-muted-foreground">{p.count.toLocaleString()} programs</p>
                <h3 className="mt-2 font-sans text-base font-bold text-navy">{p.name}</h3>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
                <p className="mt-1 text-sm text-muted-foreground">{p.examples}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

<<<<<<< HEAD
      {/* Scholarships — editorial list, not identical card grid */}
      <section className="container-page section-y">
        <SectionHead
          eyebrow="Scholarships"
          title="Funding that makes it possible"
          action={
            <Button asChild variant="outline">
              <Link to="/scholarships">
                All scholarships <ArrowRight />
              </Link>
            </Button>
          }
        />
        <ul className="divide-y border-y border-border">
          {scholarships.slice(0, 4).map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={s.funding} />
                  <span className="text-xs text-muted-foreground">{s.country}</span>
                </div>
                <p className="font-semibold text-navy">{s.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {s.level} · {s.field} · Deadline {fmtDate(s.deadline)}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
                <Link to="/contact">Enquire</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* Services */}
      <section className="section-y bg-navy text-navy-foreground">
        <div className="container-page">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Our services
          </p>
          <h2 className="mt-2.5 max-w-2xl font-display text-2xl font-semibold text-navy-foreground md:text-3xl lg:text-[2.125rem]">
            End-to-end support, from first idea to first lecture
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-navy-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <div key={s.title} className="bg-navy p-5 md:p-6">
                <span className="font-display text-2xl font-semibold text-bright">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2.5 font-sans text-[0.95rem] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-foreground/65">{s.body}</p>
=======
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
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visa */}
<<<<<<< HEAD
      <section className="container-page section-y grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <div>
          <SectionHead
            eyebrow="Student visa support"
            title="Embassy-ready files, every time"
            body="Our visa officers handle the details that decide outcomes."
          />
          <Button asChild>
            <Link to="/student-visa">Talk to a Visa Consultant</Link>
          </Button>
        </div>
        <ol className="space-y-0 divide-y border-y border-border">
          {visaSteps.map((v, i) => (
            <li key={v.title} className="flex gap-4 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-royal">
                {i + 1}
              </span>
              <div>
                <h3 className="font-sans text-sm font-semibold text-navy">{v.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{v.body}</p>
              </div>
=======
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
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
            </li>
          ))}
        </ol>
      </section>

      {/* How it works */}
<<<<<<< HEAD
      <section className="section-y bg-surface">
        <div className="container-page">
          <SectionHead eyebrow="How it works" title="Four clear steps" />
          <div className="grid gap-8 md:grid-cols-4 md:gap-6">
            {howItWorks.map((h, i) => (
              <div key={h.title}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-semibold text-royal">{i + 1}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <h3 className="mt-3 font-sans text-[0.95rem] font-semibold text-navy">{h.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
=======
      <section className="bg-surface py-20">
        <div className="container-page">
          <SectionHead eyebrow="How it works" title="Four clear steps" />
          <div className="grid gap-6 md:grid-cols-4">
            {howItWorks.map((h, i) => (
              <div key={h.title}>
                <div className="flex items-center gap-3"><span className="font-display text-4xl font-semibold text-royal">{i + 1}</span><span className="h-px flex-1 bg-border" /></div>
                <h3 className="mt-4 font-sans text-base font-bold text-navy">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
<<<<<<< HEAD
      <section className="container-page section-y">
        <SectionHead
          eyebrow="Success stories"
          title="Students who made it"
          action={
            <Button asChild variant="outline">
              <Link to="/success-stories">
                More stories <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          {stories.slice(0, 2).map((s) => (
            <figure key={s.name} className="border-t border-royal/30 pt-6">
              <Quote className="h-5 w-5 text-bright" aria-hidden />
              <blockquote className="mt-3 font-display text-lg leading-snug text-navy md:text-xl">
                “{s.quote}”
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <b className="font-semibold text-navy">{s.name}</b>{" "}
                <span className="text-muted-foreground">
                  · {s.program}, {s.to}
                </span>
              </figcaption>
=======
      <section className="container-page py-20">
        <SectionHead eyebrow="Success stories" title="Students who made it" action={<Button asChild variant="outline"><Link to="/success-stories">More stories <ArrowRight /></Link></Button>} />
        <div className="grid gap-4 md:grid-cols-2">
          {stories.slice(0, 2).map((s) => (
            <figure key={s.name} className="panel p-8">
              <Quote className="h-6 w-6 text-bright" />
              <blockquote className="mt-4 font-display text-xl leading-snug text-navy">“{s.quote}”</blockquote>
              <figcaption className="mt-6 text-sm"><b className="text-navy">{s.name}</b> <span className="text-muted-foreground">· {s.program}, {s.to}</span></figcaption>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
            </figure>
          ))}
        </div>
      </section>

      {/* Resources + FAQ */}
<<<<<<< HEAD
      <section className="section-y bg-surface">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHead eyebrow="Resources" title="Guides & insights" />
            <ul className="divide-y border-y border-border bg-background">
              {resources.slice(0, 4).map((r) => (
                <li key={r.title}>
                  <Link
                    to="/resources"
                    className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-accent/50"
                  >
                    <div>
                      <p className="text-[0.6875rem] font-semibold text-royal">
                        {r.tag} · {fmtDate(r.date)}
                      </p>
                      <p className="mt-0.5 font-semibold text-navy">{r.title}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
=======
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
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
              ))}
            </ul>
          </div>
          <div>
            <SectionHead eyebrow="FAQ" title="Questions students ask" />
<<<<<<< HEAD
            <Accordion type="single" collapsible className="border-y border-border bg-background">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`f${i}`} className="border-border px-0">
                  <AccordionTrigger className="py-4 text-left text-sm font-semibold text-navy hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm text-muted-foreground">
                    {f.a}
                  </AccordionContent>
=======
            <Accordion type="single" collapsible className="rounded-xl border bg-background px-5">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`f${i}`}>
                  <AccordionTrigger className="text-left font-semibold text-navy">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
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
