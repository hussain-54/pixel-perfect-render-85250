<<<<<<< HEAD
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
=======
import { useState, type ReactNode } from "react";
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import { Menu, Search, X, Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./RoleSwitcher";

const nav: { to: NonNullable<LinkProps["to"]>; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/destinations", label: "Study Destinations" },
  { to: "/universities", label: "Universities" },
  { to: "/programs", label: "Programs" },
  { to: "/scholarships", label: "Scholarships" },
  { to: "/services", label: "Services" },
  { to: "/success-stories", label: "Success Stories" },
  { to: "/resources", label: "Resources" },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 xl:flex">
          {nav.map((n) => (
            <Link key={n.label} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-2.5 py-2 text-[0.82rem] font-semibold text-muted-foreground transition-colors hover:text-navy"
              activeProps={{ className: "text-navy" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {searching ? (
            <form onSubmit={(e) => { e.preventDefault(); setSearching(false); navigate({ to: "/universities", search: { q } }); }}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setSearching(false)}
                placeholder="Search universities…" className="h-9 w-44 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </form>
          ) : (
            <button aria-label="Search" onClick={() => setSearching(true)} className="hidden h-9 w-9 items-center justify-center rounded-md text-navy hover:bg-accent sm:flex">
              <Search className="h-4 w-4" />
            </button>
          )}
          <div className="hidden md:block"><RoleSwitcher current="Public" /></div>
          <Button asChild variant="default" size="sm"><Link to="/contact">Book Consultation</Link></Button>
          <button aria-label="Menu" onClick={() => setOpen(!open)} className="flex h-9 w-9 items-center justify-center rounded-md text-navy hover:bg-accent xl:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t bg-background xl:hidden">
          <nav className="container-page grid gap-1 py-4">
            {[...nav, { to: "/student-visa" as const, label: "Student Visa" }, { to: "/about" as const, label: "About" }, { to: "/contact" as const, label: "Contact" }].map((n) => (
              <Link key={n.label} to={n.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-navy hover:bg-accent">{n.label}</Link>
            ))}
            <div className="pt-2 md:hidden"><RoleSwitcher current="Public" /></div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="container-page grid gap-10 py-16 md:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm text-navy-foreground/70">Global Education & Visa Consultants. Guiding students from first conversation to first day on campus.</p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-4 space-y-2 text-sm text-navy-foreground/80">
            <li><Link to="/destinations" className="hover:text-bright">Study Destinations</Link></li>
            <li><Link to="/universities" className="hover:text-bright">Universities</Link></li>
            <li><Link to="/programs" className="hover:text-bright">Programs</Link></li>
            <li><Link to="/scholarships" className="hover:text-bright">Scholarships</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Company</p>
          <ul className="mt-4 space-y-2 text-sm text-navy-foreground/80">
            <li><Link to="/about" className="hover:text-bright">About Us</Link></li>
            <li><Link to="/services" className="hover:text-bright">Services</Link></li>
            <li><Link to="/student-visa" className="hover:text-bright">Student Visa</Link></li>
            <li><Link to="/success-stories" className="hover:text-bright">Success Stories</Link></li>
            <li><Link to="/resources" className="hover:text-bright">Resources</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-navy-foreground/80">
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bright" /> Gulberg III, Lahore, Pakistan</li>
            <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-bright" /> +92 300 0000000</li>
            <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-bright" /> info@globalroots.pk</li>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10">
<<<<<<< HEAD
        <div className="container-page flex flex-col justify-between gap-2 py-5 text-xs text-navy-foreground/50 sm:flex-row sm:items-center">
          <span>© 2026 Global Roots Consultants. All rights reserved.</span>
          <span>Global Education & Visa Consultants</span>
=======
        <div className="container-page flex flex-col justify-between gap-2 py-6 text-xs text-navy-foreground/60 sm:flex-row">
          <span>© 2026 Global Roots Consultants. All rights reserved.</span>
          <span>Privacy · Terms</span>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
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
<<<<<<< HEAD
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
=======
export function PageHero({ eyebrow, title, body, children }: { eyebrow: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <section className="bg-navy text-navy-foreground">
      <div className="container-page py-16 md:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-6xl">{title}</h1>
        {body && <p className="mt-5 max-w-2xl text-base text-navy-foreground/75 md:text-lg">{body}</p>}
        {children && <div className="mt-8">{children}</div>}
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
      </div>
    </section>
  );
}

<<<<<<< HEAD
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
=======
export function SectionHead({ eyebrow, title, body, action }: { eyebrow: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-navy md:text-4xl">{title}</h2>
        {body && <p className="mt-3 text-muted-foreground">{body}</p>}
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
      </div>
      {action}
    </div>
  );
}
