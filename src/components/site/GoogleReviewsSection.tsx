import { ExternalLink, Star } from "lucide-react";
import { SectionHead } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { siteContact } from "@/data/contact";

/**
 * Honest Google Reviews entry point.
 * Does not invent ratings, review counts, or review text.
 * When Place ID / Places API reviews are unavailable, visitors are directed
 * to the official Google Maps listing for authentic reviews.
 */
export function GoogleReviewsSection() {
  const { googleBusiness, brandName } = siteContact;
  const hasVerifiedRating =
    typeof googleBusiness.rating === "number" &&
    typeof googleBusiness.reviewCount === "number" &&
    googleBusiness.reviewCount > 0;

  return (
    <section className="container-page section-y" aria-labelledby="google-reviews-heading">
      <SectionHead
        eyebrow="Google reviews"
        title="What Our Students Say"
        body={`Read genuine feedback from families who worked with ${brandName}. We only surface ratings that come from Google — never invented testimonials.`}
      />

      <div className="rounded-xl border border-border bg-surface px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-royal" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <h3 id="google-reviews-heading" className="mt-3 font-display text-xl font-semibold text-navy">
              Reviews on Google
            </h3>
            {hasVerifiedRating ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-navy">{googleBusiness.rating!.toFixed(1)}</span>{" "}
                average from {googleBusiness.reviewCount} Google reviews
              </p>
            ) : (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Live star ratings and review quotes will appear here once a verified Google Place ID
                is connected. Until then, open our Google listing to read authentic reviews.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="navy" size="lg">
              <a
                href={googleBusiness.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Read all Google reviews for Global Roots Consultants"
              >
                Read All Google Reviews
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
            {googleBusiness.writeReviewUrl ? (
              <Button asChild variant="outline" size="lg">
                <a
                  href={googleBusiness.writeReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Write a Google review for Global Roots Consultants"
                >
                  Write a Review
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg">
                <a
                  href={googleBusiness.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Find Global Roots Consultants on Google Maps to leave a review"
                >
                  Find us on Google
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
