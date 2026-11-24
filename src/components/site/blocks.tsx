import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MapPin, Award, CalendarDays, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Initials, fmtDate } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { siteContact } from "@/data/contact";
import { FREE_CONSULTATION_HASH } from "@/data/navigation";
import { mapConsultationFormToPayload } from "@/lib/consultation";
import { submitConsultationRequest } from "@/services";
import { destinations, programCategories, stories } from "@/data/site";
import type { University, Scholarship } from "@/types";
import { cn } from "@/lib/utils";

/** Honest disclosure for mock/sample catalogue listings (not a live CMS inventory). */
export function CatalogueSampleNotice({ kind }: { kind: "universities" | "scholarships" }) {
  const label = kind === "universities" ? "university" : "scholarship";
  return (
    <p
      role="note"
      className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground"
    >
      These {label} entries are <strong className="font-semibold text-navy">sample listings</strong>{" "}
      for browsing this site. They are not a verified live inventory. Confirm availability,
      eligibility and deadlines with a Global Roots consultant before applying.
    </p>
  );
}

export function DestinationCard({
  d,
  variant = "default",
}: {
  d: (typeof destinations)[number];
  /** `feature` matches the European blue-hour card treatment (2×2 section). */
  variant?: "default" | "feature";
}) {
  const feature = variant === "feature";
  return (
    <Link
      to="/destinations"
      hash={d.name.toLowerCase().replace(/\s/g, "-")}
      className={
        feature
          ? "group relative block aspect-[4/3] overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright focus-visible:ring-offset-2"
          : "group relative block aspect-[4/5] overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright focus-visible:ring-offset-2"
      }
    >
      <img
        src={d.img}
        alt={`Study in ${d.name}`}
        loading="lazy"
        width={feature ? 1280 : 1024}
        height={feature ? 960 : 768}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
      />
      <div
        className={
          feature
            ? "absolute inset-0 bg-gradient-to-t from-[#021433]/95 via-[#021433]/45 to-transparent"
            : "bg-card-overlay absolute inset-0"
        }
        aria-hidden
      />
      <div
        className={
          feature
            ? "absolute inset-x-0 bottom-0 p-5 text-navy-foreground md:p-6"
            : "absolute inset-x-0 bottom-0 p-4 text-navy-foreground md:p-5"
        }
      >
        <h3
          className={
            feature
              ? "font-display text-2xl font-semibold text-white md:text-[1.75rem]"
              : "font-display text-xl font-semibold text-navy-foreground md:text-2xl"
          }
        >
          {d.name}
        </h3>
        <p
          className={
            feature
              ? "mt-2 max-w-md text-sm leading-relaxed text-white/90 md:text-[0.95rem]"
              : "mt-1 line-clamp-2 text-xs leading-relaxed text-navy-foreground/80 md:text-sm"
          }
        >
          {d.desc}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-bright">
          Explore
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
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
  const officialUrl = s.applicationUrl?.trim();
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
      {s.provider ? (
        <p className="mt-1 text-xs text-muted-foreground">Provider: {s.provider}</p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-foreground/80">
        <Award className="mr-1 inline h-3.5 w-3.5 text-royal" aria-hidden />
        {s.eligibility}
      </p>
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-navy">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Deadline {fmtDate(s.deadline)}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 self-start">
        {officialUrl ? (
          <Button asChild variant="navy" size="sm">
            <a href={officialUrl} target="_blank" rel="noopener noreferrer">
              Official application
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link to="/contact">Ask a consultant</Link>
        </Button>
      </div>
    </article>
  );
}

const field = "h-11";
const selectClass =
  "h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy focus-visible:border-royal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const QUALIFICATIONS = [
  "Matric / O-Levels",
  "Intermediate / A-Levels",
  "Bachelor's",
  "Master's",
  "PhD",
  "Other",
] as const;

const LANGUAGE_TESTS = [
  "Not taken yet",
  "IELTS",
  "TOEFL",
  "PTE",
  "Duolingo",
  "Other / Not required",
] as const;

const COUNSELLING_MODES = [
  "In-person (Faisalabad office)",
  "Online / Video call",
  "Phone",
] as const;

const FUNDING_MODES = [
  "Self-funded",
  "Family support",
  "Scholarship / funding search",
  "Education loan",
  "Not sure yet",
] as const;

export function ConsultationForm({ className }: { className?: string }) {
  const [doneRef, setDoneRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Stable reference for this submission attempt — reused on Retry (idempotent unique key). */
  const [attemptRef, setAttemptRef] = useState<string | null>(null);

  if (doneRef)
    return (
      <div
        className={cn("panel flex flex-col items-center p-8 text-center md:p-10", className)}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h3 className="mt-4 font-display text-2xl font-semibold text-navy">Request received</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Thank you. A Global Roots consultant will contact you within one working day. Reference:{" "}
          <strong className="text-navy">{doneRef}</strong>
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setDoneRef(null);
            setAttemptRef(null);
            setError(null);
          }}
        >
          Submit another request
        </Button>
      </div>
    );

  return (
    <form
      className={cn("panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6 md:gap-5 md:p-8", className)}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          const form = e.currentTarget;
          const raw = Object.fromEntries(new FormData(form));
          if (raw["privacyConsent"] !== "on" && raw["privacyConsent"] !== "true") {
            setError("Please accept the Terms and Privacy Policy to continue.");
            return;
          }
          const data = mapConsultationFormToPayload(raw);
          const {
            validateConsultationRequest,
            resolveConsultationReference,
            resolveConsultationSubmitUi,
          } = await import("@/lib/consultation");
          const local = validateConsultationRequest(data);
          if (!local.success) {
            setError(local.error.issues[0]?.message ?? "Please check the form and try again.");
            return;
          }
          const ref = resolveConsultationReference(attemptRef);
          setAttemptRef(ref);
          const r = await submitConsultationRequest({ ...data, reference_code: ref });
          const ui = resolveConsultationSubmitUi(r);
          if (ui.kind === "success") {
            setDoneRef(ui.ref);
            setAttemptRef(null);
            return;
          }
          setAttemptRef(ui.ref);
          setError(ui.error ?? "Unable to save your request. Please try again.");
        } catch (err) {
          const { publicConsultationErrorMessage } = await import("@/lib/consultation");
          const rawMsg = err instanceof Error ? err.message : "";
          setError(publicConsultationErrorMessage(rawMsg));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="sm:col-span-2">
        <h3 className="font-display text-2xl font-semibold text-navy">Get Free Consultation</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your goals — a consultant will respond within one working day.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          name="firstName"
          required
          autoComplete="given-name"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          name="lastName"
          required
          autoComplete="family-name"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile Number</Label>
        <Input id="phone" name="phone" type="tel" required autoComplete="tel" className={field} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qualification">Last Qualification</Label>
        <select id="qualification" name="qualification" className={selectClass} required>
          <option value="">Select qualification</option>
          {QUALIFICATIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dest">Preferred Country</Label>
        <select id="dest" name="destination" className={selectClass} required>
          <option value="">Select country</option>
          {destinations.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prog">Field of Interest</Label>
        <select id="prog" name="program" className={selectClass}>
          <option value="">Select field</option>
          {programCategories.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="languageTest">Language Test</Label>
        <select id="languageTest" name="languageTest" className={selectClass}>
          {LANGUAGE_TESTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="counsellingMode">Mode of Counselling</Label>
        <select id="counsellingMode" name="counsellingMode" className={selectClass}>
          {COUNSELLING_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fundingMode">Mode of Funding</Label>
        <select id="fundingMode" name="fundingMode" className={selectClass}>
          {FUNDING_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Additional notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <label className="flex items-start gap-2.5 text-sm text-navy">
          <input
            type="checkbox"
            name="privacyConsent"
            value="on"
            required
            className="mt-1 h-4 w-4 shrink-0 rounded border-input"
          />
          <span>
            I agree to the{" "}
            <Link
              to="/terms"
              className="font-semibold text-royal underline-offset-2 hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="font-semibold text-royal underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="marketingConsent"
            value="on"
            className="mt-1 h-4 w-4 shrink-0 rounded border-input"
          />
          <span>Send me study-abroad updates and reminders (optional).</span>
        </label>
      </div>
      {error && (
        <div className="space-y-2 sm:col-span-2" role="alert" aria-live="assertive">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <Button type="submit" size="lg" className="sm:col-span-2" disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : error ? "Try again" : "Enquire Now"}
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Your enquiry is only confirmed after it is saved securely. We never claim success without a
        confirmed submission.
      </p>
    </form>
  );
}

export function SuccessStoryCard({ story }: { story: (typeof stories)[number] }) {
  return (
    <figure className="flex h-full flex-col border border-border bg-background p-5 md:p-6">
      <Quote className="h-5 w-5 text-bright" aria-hidden />
      <blockquote className="mt-3 flex-1 font-display text-lg leading-snug text-navy md:text-xl">
        “{story.quote}”
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <Initials name={story.name} />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-navy">{story.name}</p>
          <p className="text-muted-foreground">
            {story.from} → {story.to}
          </p>
          <p className="mt-0.5 text-xs font-medium text-royal">{story.program}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function CtaBand() {
  const showWhatsApp = !siteContact.whatsapp.placeholder;
  return (
    <section className="bg-navy text-navy-foreground">
      <div className="container-page flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center md:py-16">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold text-navy-foreground md:text-3xl">
            Ready to start your journey?
          </h2>
          <p className="mt-2 text-sm text-navy-foreground/70 md:text-base">
            Speak with a senior consultant — your first session is free. Message us on WhatsApp for
            a quick reply.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="bright" size="lg">
            <Link to="/" hash={FREE_CONSULTATION_HASH}>
              Free Consultation
            </Link>
          </Button>
          {showWhatsApp ? (
            <Button
              asChild
              size="lg"
              className="border-0 bg-[#25D366] text-white hover:bg-[#1EBE57] hover:text-white"
            >
              <a
                href={siteContact.whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp with Global Roots Consultants"
              >
                Need Help? WhatsApp
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline-light" size="lg">
              <Link to="/destinations">Explore Destinations</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
