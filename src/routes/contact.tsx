import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { ConsultationForm } from "@/components/site/blocks";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Book a Free Consultation — Global Roots Consultants" },
<<<<<<< HEAD
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
=======
      { name: "description", content: "Book a free study-abroad consultation or contact our Lahore, Karachi and Islamabad offices." },
      { property: "og:title", content: "Book a Free Consultation — Global Roots Consultants" },
      { property: "og:description", content: "Speak with a senior education and visa consultant for free." },
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
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
<<<<<<< HEAD
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
=======
      <PageHero eyebrow="Contact" title="Book your free consultation" body="Tell us about your plans. A senior consultant will call you within one working day." />
      <section className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_2fr]">
        <ul className="space-y-5">
          {items.map((i) => (
            <li key={i.label} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-royal"><i.icon className="h-4 w-4" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i.label}</p><p className="font-semibold text-navy">{i.value}</p></div>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
            </li>
          ))}
        </ul>
        <ConsultationForm />
      </section>
    </SiteLayout>
  );
}
