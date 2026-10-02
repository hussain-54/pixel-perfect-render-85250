import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

<<<<<<< HEAD
export function LogoMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8 shrink-0", className)} aria-hidden>
      <circle cx="20" cy="20" r="18" className={light ? "fill-navy-soft" : "fill-navy"} />
      <path
        d="M4 20h32M20 2c6 6 6 30 0 36M20 2c-6 6-6 30 0 36"
        className="stroke-bright"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M20 30c0-6 0-9-5-12M20 26c0-4 2-7 6-8"
        className="stroke-navy-foreground"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
=======
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <circle cx="20" cy="20" r="18" className="fill-navy" />
      <path d="M4 20h32M20 2c6 6 6 30 0 36M20 2c-6 6-6 30 0 36" className="stroke-bright" strokeWidth="1.6" fill="none" />
      <path d="M20 30c0-6 0-9-5-12M20 26c0-4 2-7 6-8" className="stroke-navy-foreground" strokeWidth="2" fill="none" strokeLinecap="round" />
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
    </svg>
  );
}

<<<<<<< HEAD
export function Logo({
  light = false,
  to = "/",
  showTagline = false,
  className,
}: {
  light?: boolean;
  to?: string;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2.5", className)}
      aria-label="Global Roots Consultants home"
    >
      <LogoMark light={light} className={showTagline ? "h-8 w-8" : "h-8 w-8 sm:h-9 sm:w-9"} />
      <span className="min-w-0 leading-none">
        {showTagline ? (
          <>
            {/* Compact two-line brand — keeps header logo ~190px wide */}
            <span
              className={cn(
                "block whitespace-nowrap font-display text-[0.95rem] font-semibold tracking-tight",
                light ? "text-navy-foreground" : "text-navy",
              )}
            >
              Global Roots
            </span>
            <span
              className={cn(
                "mt-0.5 block text-[0.55rem] font-bold uppercase tracking-[0.16em]",
                light ? "text-bright" : "text-royal",
              )}
            >
              Consultants
            </span>
            <span
              className={cn(
                "mt-1 block truncate text-[0.58rem] font-medium tracking-wide",
                light ? "text-navy-foreground/70" : "text-muted-foreground",
              )}
              title="Global Education & Visa Consultants"
            >
              Global Education & Visa Consultants
            </span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "block font-display text-[0.98rem] font-semibold tracking-tight sm:text-[1.05rem]",
                light ? "text-navy-foreground" : "text-navy",
              )}
            >
              Global Roots
            </span>
            <span
              className={cn(
                "block text-[0.58rem] font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em]",
                light ? "text-bright" : "text-royal",
              )}
            >
              Consultants
            </span>
          </>
        )}
=======
export function Logo({ light = false, to = "/" }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Global Roots Consultants home">
      <LogoMark />
      <span className="leading-none">
        <span className={cn("block font-display text-[1.05rem] font-semibold tracking-tight", light ? "text-navy-foreground" : "text-navy")}>
          Global Roots
        </span>
        <span className={cn("block text-[0.6rem] font-bold uppercase tracking-[0.2em]", light ? "text-bright" : "text-royal")}>
          Consultants
        </span>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
      </span>
    </Link>
  );
}
