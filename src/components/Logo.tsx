import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/brand/global-roots-logo.png";

/** Full brand lockup as provided by GlobalRoots Consultants. */
export function LogoMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      width={220}
      height={72}
      decoding="async"
      className={cn(
        "h-9 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-10",
        light && "rounded-sm bg-white px-1.5 py-0.5",
        className,
      )}
      aria-hidden
    />
  );
}

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
      className={cn("inline-flex max-w-full items-center", className)}
      aria-label="Global Roots Consultants home"
    >
      <img
        src={LOGO_SRC}
        alt="GlobalRoots Consultants — Global Education & Visa Consultants"
        width={280}
        height={92}
        decoding="async"
        className={cn(
          "h-10 w-auto max-w-[min(100%,240px)] object-contain object-left sm:h-11",
          showTagline && "sm:h-12 sm:max-w-[280px]",
          light && "rounded-md bg-white px-2 py-1",
        )}
      />
    </Link>
  );
}
