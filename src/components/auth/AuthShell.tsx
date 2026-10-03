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
    <div className="min-h-svh bg-white lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-navy text-navy-foreground lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 20% 20%, oklch(0.5 0.19 257 / 0.55), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, oklch(0.45 0.12 230 / 0.35), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <Logo light to="/" className="w-auto" />
        </div>
        <p className="relative text-xs text-navy-foreground/50">
          © {new Date().getFullYear()} Global Roots Consultants
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-svh flex-col px-5 py-8 sm:px-8 md:px-12 lg:px-14 lg:py-12">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Logo to="/" className="w-auto" />
          <Link to="/" className="text-sm font-medium text-royal hover:text-navy">
            Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-[2rem]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer ? <div className="mt-8 border-t border-border pt-6">{footer}</div> : null}
        </div>

        <p className="mt-10 hidden text-center text-xs text-muted-foreground lg:block">
          <Link to="/" className="font-medium text-royal hover:text-navy">
            ← Back to Global Roots
          </Link>
        </p>
      </div>
    </div>
  );
}