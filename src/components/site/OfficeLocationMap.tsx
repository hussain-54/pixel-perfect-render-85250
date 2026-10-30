import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { SectionHead } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { siteContact } from "@/data/contact";
import { cn } from "@/lib/utils";

type OfficeLocationMapProps = {
  className?: string | undefined;
  /** Compact footer-adjacent treatment vs full homepage section. */
  variant?: "section" | "compact" | undefined;
};

export function OfficeLocationMap({ className, variant = "section" }: OfficeLocationMapProps) {
  const { location } = siteContact;
  const compact = variant === "compact";

  return (
    <section
      className={cn(compact ? "border-t border-border bg-surface" : "section-y bg-surface", className)}
      aria-labelledby="office-location-heading"
    >
      <div className={cn("container-page", compact && "py-10 md:py-12")}>
        {compact ? (
          <div className="mb-6 max-w-2xl">
            <p className="eyebrow">Visit us</p>
            <h2
              id="office-location-heading"
              className="mt-2.5 font-display text-[1.5rem] font-semibold text-navy md:text-2xl"
            >
              {location.label}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{location.fullDisplay}</p>
          </div>
        ) : (
          <SectionHead
            eyebrow="Visit us"
            title={location.label}
            body={`${location.fullDisplay}. Hours: ${siteContact.hours}.`}
          />
        )}

        <div
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-background shadow-[0_1px_0_rgb(0_0_0_/0.04)]",
            !compact && "mt-2",
          )}
        >
          <div className="relative aspect-[16/10] w-full bg-muted/40 md:aspect-[21/9]">
            <iframe
              title={`Google Map — ${siteContact.brandName}, ${location.display}`}
              src={location.embedSrc}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="flex items-start gap-2 text-sm text-navy">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-royal" aria-hidden />
              <span>
                <span className="font-semibold">{siteContact.brandName}</span>
                <span className="mt-0.5 block text-muted-foreground">{location.fullDisplay}</span>
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="navy">
                <a
                  href={location.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get directions to Global Roots Consultants on Google Maps"
                >
                  <Navigation className="h-4 w-4" aria-hidden />
                  Get Directions
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a
                  href={location.href ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open office location in Google Maps"
                >
                  Open in Maps
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
