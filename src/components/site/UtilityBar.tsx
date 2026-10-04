import { Link } from "@tanstack/react-router";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import {
  getConfiguredSocialLinks,
  siteContact,
  utilityQuickLinks,
  type SocialChannelId,
} from "@/data/contact";
import { cn } from "@/lib/utils";

const socialIcons: Partial<Record<SocialChannelId, LucideIcon>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  whatsapp: MessageCircle,
  x: Twitter,
};

export function UtilityBar({ className }: { className?: string }) {
  const social = getConfiguredSocialLinks();

  return (
    <div
      className={cn(
        "hidden border-b border-navy-foreground/10 bg-navy text-navy-foreground md:block",
        className,
      )}
    >
      <div className="mx-auto flex h-9 w-full max-w-[1680px] items-center justify-between gap-4 px-5 text-[12px] md:px-6 lg:px-8 xl:px-10">
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
          {social.length > 0 ? (
            <div className="flex items-center gap-0.5">
              {social.map((item) => {
                const Icon = socialIcons[item.id];
                if (!Icon) return null;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-navy-foreground/80 transition-colors hover:bg-navy-foreground/10 hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright/50"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </a>
                );
              })}
            </div>
          ) : null}

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

export function ContactSocialLinks({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const social = getConfiguredSocialLinks();
  if (social.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {social.map((item) => {
        const Icon = socialIcons[item.id];
        if (!Icon) return null;
        return (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-navy/70 transition-colors hover:bg-accent hover:text-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className={cn("h-4 w-4", iconClassName)} aria-hidden />
          </a>
        );
      })}
    </div>
  );
}
