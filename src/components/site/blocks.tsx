import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MapPin, Award, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/components/common";
import { submitConsultationRequest } from "@/services";
import { destinations } from "@/data/site";
import type { University, Scholarship } from "@/types";

export function DestinationCard({ d }: { d: (typeof destinations)[number] }) {
  return (
    <Link
      to="/destinations"
      hash={d.name.toLowerCase().replace(/\s/g, "-")}
      className="group relative block aspect-[4/5] overflow-hidden rounded-lg"
    >
      <img
        src={d.img}
        alt={`Study in ${d.name}`}
        loading="lazy"
        width={1024}
        height={768}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
      />
      <div className="bg-card-overlay absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-navy-foreground md:p-5">
        <h3 className="font-display text-xl font-semibold text-navy-foreground md:text-2xl">
          {d.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-navy-foreground/80 md:text-sm">
          {d.desc}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-bright">
          Explore
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function UniversityCard({ u }: { u: University }) {
  return (
    <article className="flex flex-col border-b border-border pb-5 transition-colors hover:border-royal/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded bg-navy font-display text-base font-semibold text-navy-foreground">
          {u.name.replace(/University of |The /g, "")[0]}
        </div>
        {u.scholarship && <StatusBadge status="Scholarships" />}
      </div>
      <h3 className="mt-3 font-sans text-[0.95rem] font-semibold text-navy">{u.name}</h3>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" aria-hidden /> {u.city}, {u.country}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{u.ranking}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {u.programs.slice(0, 3).map((p) => (
          <span key={p} className="rounded bg-surface px-2 py-0.5 text-[0.6875rem] text-navy/80">
            {p}
          </span>
        ))}
      </div>
      <Link
        to="/contact"
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-royal hover:text-navy"
      >
        Enquire <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

export function ScholarshipCard({ s }: { s: Scholarship }) {
  return (
    <article className="panel flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={s.funding} />
        <span className="text-xs font-medium text-muted-foreground">{s.country}</span>
      </div>
      <h3 className="mt-3 font-sans text-[0.95rem] font-semibold text-navy">{s.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {s.level} · {s.field}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground/80">
        <Award className="mr-1 inline h-3.5 w-3.5 text-royal" aria-hidden />
        {s.eligibility}
      </p>
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-navy">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Deadline {fmtDate(s.deadline)}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-5 self-start">
        <Link to="/contact">View Scholarship</Link>
      </Button>
    </article>
  );
}

const field = "h-11";
export function ConsultationForm() {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (done)
    return (
      <div className="panel flex flex-col items-center p-8 text-center md:p-10">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-navy">Request received</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Thank you. A Global Roots consultant will contact you within one working day. Reference:{" "}
          <b className="text-navy">{done}</b>
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setDone(null)}>
          Submit another request
        </Button>
      </div>
    );
  return (
    <form
      className="panel grid gap-4 p-6 sm:grid-cols-2 md:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        const r = await submitConsultationRequest(data);
        setBusy(false);
        setDone(r.ref);
      }}
    >
      <div className="sm:col-span-2">
        <h3 className="font-display text-2xl font-semibold text-navy">Book Free Consultation</h3>
        <p className="mt-1 text-sm text-muted-foreground">Takes less than two minutes.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" required className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" required className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa">WhatsApp</Label>
        <Input id="wa" name="whatsapp" className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dest">Preferred Destination</Label>
        <select
          id="dest"
          name="destination"
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy focus-visible:border-royal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {destinations.map((d) => (
            <option key={d.name}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="level">Study Level</Label>
        <select
          id="level"
          name="level"
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy focus-visible:border-royal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {["Foundation", "Bachelor's", "Master's", "PhD"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prog">Interested Program</Label>
        <Input id="prog" name="program" className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date">Preferred Date</Label>
        <Input id="date" name="date" type="date" className={field} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="msg">Message</Label>
        <Textarea id="msg" name="message" rows={3} />
      </div>
      <Button type="submit" size="lg" className="sm:col-span-2" disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : "Request Consultation"}
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Demo form — submissions are simulated locally and not stored on a server yet.
      </p>
    </form>
  );
}

export function CtaBand() {
  return (
    <section className="bg-navy text-navy-foreground">
      <div className="container-page flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center md:py-16">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold text-navy-foreground md:text-3xl">
            Ready to start your journey?
          </h2>
          <p className="mt-2 text-sm text-navy-foreground/70 md:text-base">
            Speak with a senior consultant — your first session is free.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="bright" size="lg">
            <Link to="/contact">Book Free Consultation</Link>
          </Button>
          <Button asChild variant="outline-light" size="lg">
            <Link to="/destinations">Explore Destinations</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
