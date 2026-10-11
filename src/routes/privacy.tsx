import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { siteContact } from "@/data/contact";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      path: "/privacy",
      title: "Privacy Policy — Global Roots Consultants",
      description:
        "How Global Roots Consultants handles personal information submitted through this website.",
    }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        body="This summary explains how we handle information you share with Global Roots Consultants through this website. It is not a substitute for formal legal advice."
      />
      <section className="container-page section-y max-w-3xl space-y-8 text-sm leading-relaxed text-muted-foreground">
        <p className="border border-border bg-surface px-4 py-3 text-navy">
          <strong className="font-semibold">Owner review required:</strong> confirm company legal
          name, data controller contact, retention periods, and any third-party processors before
          treating this page as final.
        </p>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Who we are</h2>
          <p>
            Global Roots Consultants operates this website and related consultation services from
            our office in Faisalabad, Pakistan ({siteContact.location.fullDisplay}). Contact:{" "}
            <a className="font-medium text-royal hover:underline" href={siteContact.email.href}>
              {siteContact.email.display}
            </a>
            .
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Information we collect</h2>
          <p>
            When you use the consultation form or create an account, you may provide details such as
            your name, email address, phone number, preferred study destination, and a short message.
            We also receive standard technical data that your browser sends (for example IP address
            and device type) when you visit the site.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">How we use information</h2>
          <p>
            We use submitted details to respond to consultation requests, provide education and visa
            guidance, operate student or staff accounts you create, and improve the reliability of
            this website. We do not sell your personal information.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Sharing</h2>
          <p>
            We may share information with service providers that host this website or store form
            submissions on our behalf, and with partner institutions or authorities only when needed
            to deliver a service you requested. [Owner: list named processors and hosting regions.]
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Retention and security</h2>
          <p>
            We keep personal information only as long as needed for the purposes above or as required
            by applicable law. [Owner: state retention periods.] We apply reasonable technical and
            organisational measures to protect data; no method of transmission is completely secure.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Your choices</h2>
          <p>
            To request access, correction, or deletion of personal information we hold about you,
            email {siteContact.email.display}. We will respond within a reasonable time under
            applicable law.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Updates</h2>
          <p>
            We may update this policy from time to time. The version published on this page is the
            current one. Related:{" "}
            <Link to="/terms" className="font-medium text-royal hover:underline">
              Terms of Use
            </Link>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}