import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { ConsultationForm } from "@/components/site/blocks";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Book a Free Consultation — Global Roots Consultants" },
      { name: "description", content: "Book a free study-abroad consultation or contact our Lahore, Karachi and Islamabad offices." },
      { property: "og:title", content: "Book a Free Consultation — Global Roots Consultants" },
      { property: "og:description", content: "Speak with a senior education and visa consultant for free." },
    ],
  }),
  component: Page,
});

function Page() {
  const items = [
    { icon: MapPin, label: "Head office", value: "Gulberg III, Lahore, Pakistan" },
    { icon: Phone, label: "Phone", value: "+92 300 0000000" },
    { icon: MessageCircle, label: "WhatsApp", value: "+92 300 0000000" },
    { icon: Mail, label: "Email", value: "info@globalroots.pk" },
    { icon: Clock, label: "Hours", value: "Mon–Sat, 10:00–19:00" },
  ];
  return (
    <SiteLayout>
      <PageHero eyebrow="Contact" title="Book your free consultation" body="Tell us about your plans. A senior consultant will call you within one working day." />
      <section className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_2fr]">
        <ul className="space-y-5">
          {items.map((i) => (
            <li key={i.label} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-royal"><i.icon className="h-4 w-4" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i.label}</p><p className="font-semibold text-navy">{i.value}</p></div>
            </li>
          ))}
        </ul>
        <ConsultationForm />
      </section>
    </SiteLayout>
  );
}
