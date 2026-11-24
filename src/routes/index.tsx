import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { SiteLayout, SectionHead } from "@/components/site/SiteLayout";
import { ConsultationForm, DestinationCard, SuccessStoryCard } from "@/components/site/blocks";
import { OfficeLocationMap } from "@/components/site/OfficeLocationMap";
import { Button } from "@/components/ui/button";
import { siteContact } from "@/data/contact";
import { FREE_CONSULTATION_HASH } from "@/data/navigation";
import { usePublishedCms } from "@/hooks/use-published-cms";
import { topDestinations, services, howItWorks, stories, stats, trustSignals } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      path: "/",
      title: "Global Roots Consultants | Global Education & Visa Consultants",
      description:
        "Discover world-class universities, scholarships and expert guidance from application to visa with Global Roots Consultants.",
    }),
  component: Home,
});

function Home() {
  const cms = usePublishedCms();
  const heroSection = cms.home.sections.find((s) => s.id === "hero" || s.type === "hero");
  const sectionOf = (id: string) => cms.home.sections.find((s) => s.id === id || s.type === id);
  const sectionVisible = (id: string) => {
    const found = sectionOf(id);
    return found ? found.visible !== false : true;
  };
  const heroTitle = heroSection?.title || "Your Global Education Journey Starts Here.";
  const heroBody =
    heroSection?.body ||
    "Discover universities abroad and get clear guidance from application through visa — starting with a free consultation.";
  const heroEyebrow = heroSection?.eyebrow || "Global Education & Visa Consultants";
  const heroCtaHref = heroSection?.primaryCta?.href || `/#${FREE_CONSULTATION_HASH}`;
  const heroSecondaryLabel = heroSection?.secondaryCta?.label || "Explore Study Destinations";
  const heroSecondaryHref = heroSection?.secondaryCta?.href || "/destinations";
  const useConsultHash =
    !heroSection?.primaryCta?.href ||
    heroCtaHref === "/contact" ||
    heroCtaHref.endsWith(`#${FREE_CONSULTATION_HASH}`);
  const heroCtaLabel = useConsultHash
    ? "Free Consultation"
    : heroSection?.primaryCta?.label || "Free Consultation";

  return (
    <SiteLayout>
      {/* Hero */}
      {sectionVisible("hero") ? (
        <section className="relative overflow-hidden bg-navy text-navy-foreground">
          <img
            src={heroSection?.imageUrl || hero}
            alt="International students on a university campus"
            width={1920}
            height={1080}
            className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
          />
          <div className="bg-hero-overlay absolute inset-0" />
          <div className="container-page relative py-16 md:py-20 lg:py-24">
            <p className="font-display text-xl font-semibold tracking-tight text-navy-foreground sm:text-2xl md:text-[1.75rem]">
              Global Roots Consultants
            </p>
            <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-bright">
              {heroEyebrow}
            </p>
            <h1 className="mt-5 max-w-2xl font-display text-[2rem] font-semibold leading-[1.1] tracking-tight text-navy-foreground sm:text-[2.35rem] md:text-5xl lg:text-[3.15rem]">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-navy-foreground/80 sm:text-base md:text-[1.05rem]">
              {heroBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="bright" size="lg">
                {useConsultHash ? (
                  <Link to="/" hash={FREE_CONSULTATION_HASH}>
                    {heroCtaLabel}
                  </Link>
                ) : heroCtaHref.startsWith("/") ? (
                  <Link to={heroCtaHref as "/contact"}>{heroCtaLabel}</Link>
                ) : (
                  <a href={heroCtaHref}>{heroCtaLabel}</a>
                )}
              </Button>
              {!siteContact.whatsapp.placeholder ? (
                <Button
                  asChild
                  size="lg"
                  className="border-0 bg-[#25D366] text-white hover:bg-[#1EBE57] hover:text-white"
                >
                  <a
                    href={siteContact.whatsapp.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Need help? Chat on WhatsApp with Global Roots Consultants"
                  >
                    Need Help? WhatsApp
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline-light" size="lg">
                {heroSecondaryHref.startsWith("/") ? (
                  <Link to={heroSecondaryHref as "/destinations"}>{heroSecondaryLabel}</Link>
                ) : (
                  <a href={heroSecondaryHref}>{heroSecondaryLabel}</a>
                )}
              </Button>
            </div>
          </div>
          <div className="relative border-t border-navy-foreground/10 bg-navy/90 backdrop-blur-[2px]">
            <div className="container-page grid grid-cols-2 gap-y-1 md:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="border-navy-foreground/10 py-5 md:border-l md:px-6 md:py-6 md:first:border-l-0 md:first:pl-0"
                >
                  <p className="font-display text-2xl font-semibold text-navy-foreground md:text-[1.75rem]">
                    {s.value}
                  </p>
                  <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-bright/90">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Compact trust — does not interrupt the audit sequence */}
      {sectionVisible("trust") ? (
        <section className="border-b">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-sm font-semibold text-muted-foreground">
            {trustSignals.map((signal, i) => (
              <span key={signal} className="flex items-center gap-2">
                {i === 0 ? <ShieldCheck className="h-4 w-4 text-royal" aria-hidden /> : null}
                {signal}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* 1. Study Destinations */}
      {sectionVisible("destinations") ? (
        <section className="container-page section-y">
          <SectionHead
            eyebrow={sectionOf("destinations")?.eyebrow || "Study destinations"}
            title={sectionOf("destinations")?.title || "Where will your degree take you?"}
            action={
              <Button asChild variant="outline">
                <Link to="/destinations">
                  {sectionOf("destinations")?.primaryCta?.label || "Explore destinations"}{" "}
                  <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {topDestinations.map((d) => (
              <DestinationCard key={d.name} d={d} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 2. Our Services */}
      {sectionVisible("services") ? (
        <section className="section-y bg-navy text-navy-foreground">
          <div className="container-page">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
              {sectionOf("services")?.eyebrow || "Our services"}
            </p>
            <h2 className="mt-2.5 max-w-2xl font-display text-2xl font-semibold text-navy-foreground md:text-3xl lg:text-[2.125rem]">
              {sectionOf("services")?.title ||
                "End-to-end support, from first idea to first lecture"}
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-navy-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((s, i) => (
                <div key={s.title} className="bg-navy p-5 md:p-6">
                  <span className="font-display text-2xl font-semibold text-bright">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2.5 font-sans text-[0.95rem] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-navy-foreground/65">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild variant="outline-light">
                <Link to="/services">
                  View all services <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* 3. Our Process — Step by Step */}
      {sectionVisible("how_it_works") ? (
        <section className="section-y bg-surface">
          <div className="container-page">
            <SectionHead
              eyebrow={sectionOf("how_it_works")?.eyebrow || "Our process"}
              title={
                sectionOf("how_it_works")?.title || "Step by step — how GlobalRoots assists you"
              }
              body="Clear guidance at every stage. We do not guarantee admission or visa outcomes — we prepare strong, complete applications."
            />
            <div className="grid gap-8 md:grid-cols-4 md:gap-6">
              {howItWorks.map((h, i) => (
                <div key={h.title}>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-3xl font-semibold text-royal">{i + 1}</span>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </div>
                  <h3 className="mt-3 font-sans text-[0.95rem] font-semibold text-navy">
                    {h.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 4. Student Success Stories */}
      {sectionVisible("stories") && stories.length > 0 ? (
        <section className="container-page section-y">
          <SectionHead
            eyebrow={sectionOf("stories")?.eyebrow || "Student success stories"}
            title={sectionOf("stories")?.title || "Students who made it abroad"}
            body="Authentic student journeys shared for public display. No fabricated visas or stock photos presented as real students."
            action={
              <Button asChild variant="outline">
                <Link to="/success-stories">
                  View all success stories <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {stories.slice(0, 4).map((s) => (
              <SuccessStoryCard key={s.name} story={s} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Free Consultation + Google Maps */}
      <section
        id={FREE_CONSULTATION_HASH}
        className="section-y scroll-mt-24 border-t border-border bg-surface"
        aria-labelledby="free-consultation-heading"
      >
        <div className="container-page">
          <div className="mb-8 max-w-2xl md:mb-10">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-royal">
              Visit & enquire
            </p>
            <h2
              id="free-consultation-heading"
              className="mt-2.5 font-display text-2xl font-semibold text-navy md:text-3xl"
            >
              Free consultation at our Faisalabad office
            </h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Meet us in person or enquire online. One official office location —{" "}
              {siteContact.location.fullDisplay}.
            </p>
          </div>
          <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
            <OfficeLocationMap variant="panel" />
            <ConsultationForm />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
