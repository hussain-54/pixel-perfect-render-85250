import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { SocialLinks } from "@/components/site/SocialLinks";
import { getConfiguredSocialLinks, siteContact, utilityQuickLinks } from "@/data/contact";
import { cn } from "@/lib/utils";

export function UtilityBar({ className }: { className?: string }) {
  const social = getConfiguredSocialLinks();

  return (
    <div
      className={cn(
        "hidden border-b border-navy-foreground/10 bg-navy text-navy-foreground md:block",
        className,
      )}
    >
      <div className="mx-auto flex h-10 w-full max-w-[1680px] items-center justify-between gap-4 px-5 text-[12px] md:px-6 lg:px-8 xl:px-10">
        {/* Left — contact */}
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <a
            href={siteContact.phone.href}
            className="inline-flex shrink-0 items-center gap-1.5 text-navy-foreground/85 transition-colors hover:text-bright"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-bright" aria-hidden />
            <span>{siteContact.phone.display}</span>
          </a>
          <span className="hidden h-3 w-px shrink-0 bg-navy-foreground/20 sm:block" aria-hidden />
          <a
            href={siteContact.email.href}
            className="hidden min-w-0 items-center gap-1.5 truncate text-navy-foreground/85 transition-colors hover:text-bright sm:inline-flex"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-bright" aria-hidden />
            <span className="truncate">{siteContact.email.display}</span>
          </a>
          <span className="hidden h-3 w-px shrink-0 bg-navy-foreground/20 lg:block" aria-hidden />
          {siteContact.location.href ? (
            <a
              href={siteContact.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-navy-foreground/85 transition-colors hover:text-bright lg:inline-flex"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-bright" aria-hidden />
              <span>{siteContact.location.shortDisplay}</span>
            </a>
          ) : (
            <span className="hidden items-center gap-1.5 text-navy-foreground/85 lg:inline-flex">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-bright" aria-hidden />
              <span>{siteContact.location.shortDisplay}</span>
            </span>
          )}
        </div>

        {/* Right — social + quick links */}
        <div className="flex shrink-0 items-center gap-3 lg:gap-4">
          <SocialLinks size="utility" surface="navy" />

          {social.length > 0 ? (
            <span className="hidden h-3 w-px shrink-0 bg-navy-foreground/20 xl:block" aria-hidden />
          ) : null}

          <div className="hidden items-center gap-3 xl:flex">
            {utilityQuickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="whitespace-nowrap font-medium text-navy-foreground/85 transition-colors hover:text-bright"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { ContactSocialLinks } from "@/components/site/SocialLinks";
