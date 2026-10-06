import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[oklch(0.985_0.004_250)] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-navy text-navy-foreground lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 55% at 15% 15%, oklch(0.5 0.14 257 / 0.45), transparent 60%), linear-gradient(180deg, transparent 40%, oklch(0.18 0.06 258 / 0.55) 100%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <Logo light to="/" className="w-auto" />
        </div>

        <div className="relative max-w-md space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-bright/90">
            Client Portal
          </p>
          <h1 className="font-display text-[2.15rem] font-semibold leading-[1.15] tracking-tight text-balance xl:text-[2.35rem]">
            Your journey starts here.
          </h1>
          <p className="max-w-sm text-[0.95rem] leading-relaxed text-navy-foreground/70">
            Manage applications, documents, appointments and application progress from one place.
          </p>
        </div>

        <p className="relative text-xs text-navy-foreground/45">
          © {new Date().getFullYear()} Global Roots Consultants
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 md:px-12 lg:px-14">
          <div className="lg:invisible lg:pointer-events-none">
            <Logo to="/" className="w-auto" />
          </div>
          <Link
            to="/"
            className="shrink-0 text-sm font-medium text-royal transition-colors hover:text-navy"
          >
            Back to Website
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 pb-10 pt-2 sm:px-8 lg:px-0 lg:pb-16">
          <div key={title} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="mb-8">
              <h2 className="font-display text-[1.75rem] font-semibold tracking-tight text-navy text-balance sm:text-[2rem]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {subtitle}
              </p>
            </div>

            {children}

            {footer ? <div className="mt-8 border-t border-border pt-6">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
