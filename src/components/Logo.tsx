import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <circle cx="20" cy="20" r="18" className="fill-navy" />
      <path d="M4 20h32M20 2c6 6 6 30 0 36M20 2c-6 6-6 30 0 36" className="stroke-bright" strokeWidth="1.6" fill="none" />
      <path d="M20 30c0-6 0-9-5-12M20 26c0-4 2-7 6-8" className="stroke-navy-foreground" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

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
      </span>
    </Link>
  );
}
