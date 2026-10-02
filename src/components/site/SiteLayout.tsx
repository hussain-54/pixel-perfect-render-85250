import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Header } from "@/components/site/Header";

function Footer() {
  return (
    <footer className="border-t border-navy-soft/20 bg-navy text-navy-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 md:py-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-foreground/65">
            Global Education & Visa Consultants. Guiding students from first conversation to first
            day on campus.
          </p>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Study Abroad
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-foreground/75">
            <li>
              <Link to="/destinations" className="transition-colors hover:text-bright">
                Destinations
              </Link>
            </li>
            <li>
              <Link to="/universities" className="transition-colors hover:text-bright">
                Universities
              </Link>
            </li>
            <li>
              <Link to="/programs" className="transition-colors hover:text-bright">
                Programs
              </Link>
            </li>
            <li>
              <Link to="/scholarships" className="transition-colors hover:text-bright">
                Scholarships
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Services
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-foreground/75">
            <li>
              <Link to="/services" className="transition-colors hover:text-bright">
                All Services
              </Link>
            </li>
            <li>
              <Link to="/student-visa" className="transition-colors hover:text-bright">
                Student Visa
              </Link>
            </li>
            <li>
              <Link to="/contact" className="transition-colors hover:text-bright">
                Consultation
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Company
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-navy-foreground/75">
            <li>
              <Link to="/about" className="transition-colors hover:text-bright">
                About Us
              </Link>
            </li>
            <li>
              <Link to="/success-stories" className="transition-colors hover:text-bright">
                Success Stories
              </Link>
            </li>
            <li>
              <Link to="/resources" className="transition-colors hover:text-bright">
                Resources
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
            Contact
          </p>
          <ul className="mt-4 space-y-3 text-sm text-navy-foreground/75">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bright" aria-hidden />
              Gulberg III, Lahore
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-bright" aria-hidden />
              +92 300 0000000
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-bright" aria-hidden />
              info@globalroots.pk
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10">
        <div className="container-page flex flex-col justify-between gap-2 py-5 text-xs text-navy-foreground/50 sm:flex-row sm:items-center">
          <span>© 2026 Global Roots Consultants. All rights reserved.</span>
          <span>Global Education & Visa Consultants</span>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Interior page banner. */
export function PageHero({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-navy-soft/30 bg-navy text-navy-foreground">
      <div className="container-page py-12 md:py-16">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-bright">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-navy-foreground md:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        {body && (
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-navy-foreground/70 md:text-base">
            {body}
          </p>
        )}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:mb-10 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2.5 font-display text-[1.75rem] font-semibold text-navy md:text-3xl lg:text-[2.125rem]">
          {title}
        </h2>
        {body && <p className="mt-2.5 max-w-xl text-[0.95rem] text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}
