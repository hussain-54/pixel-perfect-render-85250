import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { ConsultationForm } from "@/components/site/blocks";
import { siteContact } from "@/data/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Book a Free Consultation — Global Roots Consultants" },
      {
        name: "description",
        content:
          "Book a free study-abroad consultation or contact our Lahore, Karachi and Islamabad offices.",
      },
      { property: "og:title", content: "Book a Free Consultation — Global Roots Consultants" },
      {
        property: "og:description",
        content: "Speak with a senior education and visa consultant for free.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const items = [
    { icon: MapPin, label: "Head office", value: siteContact.location.fullDisplay },
    { icon: Phone, label: "Phone", value: siteContact.phone.display },
    { icon: MessageCircle, label: "WhatsApp", value: siteContact.whatsapp.display },
    { icon: Mail, label: "Email", value: siteContact.email.display },
    { icon: Clock, label: "Hours", value: siteContact.hours },
  ];
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact"
        title="Book your free consultation"
        body="Tell us about your plans. A senior consultant will call you within one working day."
      />
      <section className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-14">
        <ul className="space-y-5">
          {items.map((i) => (
            <li key={i.label} className="flex gap-3.5 border-b border-border/80 pb-4 last:border-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent text-royal">
                <i.icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {i.label}
                </p>
                <p className="mt-0.5 font-semibold text-navy">{i.value}</p>
              </div>
            </li>
          ))}
        </ul>
        <ConsultationForm />
      </section>
    </SiteLayout>
  );
}
