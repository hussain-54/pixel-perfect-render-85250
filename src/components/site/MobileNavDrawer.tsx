import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Phone, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/site/SocialLinks";
import { WhatsAppGlyph } from "@/components/site/WhatsAppFloat";
import { siteContact } from "@/data/contact";
import { FREE_CONSULTATION_HASH, primaryNavigation } from "@/data/navigation";
import type { CmsNavSettings } from "@/lib/cms-types";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Always keep the audit six-link primary set; CMS may only override matching labels. */
function resolvePrimaryNav(cmsNav?: CmsNavSettings) {
  if (!cmsNav?.items?.length) return primaryNavigation;

  const labelByPath = new Map<string, string>();
  for (const item of cmsNav.items) {
    if (item.visible === false) continue;
    const href = item.href?.trim();
    const label = item.label?.trim();
    if (href?.startsWith("/") && label) labelByPath.set(href, label);
    if (item.id === "success" && label) labelByPath.set("/success-stories", label);
    if (item.id === "destinations" && label) labelByPath.set("/destinations", label);
    if (item.id === "services" && label) labelByPath.set("/services", label);
    if (item.id === "home" && label) labelByPath.set("/", label);
  }

  return primaryNavigation.map((item) => ({
    ...item,
    label: labelByPath.get(item.to) || item.label,
  }));
}

export function MobileNavDrawer({
  open,
  onClose,
  id,
  cmsNav,
}: {
  open: boolean;
  onClose: () => void;
  id?: string;
  cmsNav?: CmsNavSettings;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const navItems = resolvePrimaryNav(cmsNav);
  const showWhatsApp = !siteContact.whatsapp.placeholder;

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      id={id}
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/35 transition-opacity"
        aria-label="Close menu"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-full max-w-[min(100%,24rem)] flex-col border-l border-border bg-white animate-in slide-in-from-right duration-200 motion-reduce:animate-none motion-reduce:transition-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <p id={titleId} className="text-sm font-semibold text-navy">
            Menu
          </p>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Mobile">
          <form
            className="mb-3 px-1"
            onSubmit={(e) => {
              e.preventDefault();
              onClose();
              const query = q.trim();
              void navigate({
                to: "/universities",
                search: query ? { q: query } : {},
              });
            }}
          >
            <label className="sr-only" htmlFor="mobile-site-search">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                id="mobile-site-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search universities, programs…"
                className="h-11 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </form>

          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              onClick={onClose}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "bg-accent text-navy" }}
              className="block rounded-md px-3 py-3 text-[0.95rem] font-semibold text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-royal">
              {siteContact.location.label}
            </p>
            <ul className="space-y-0.5">
              {!siteContact.phone.placeholder ? (
                <li>
                  <a
                    href={siteContact.phone.href}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-royal" aria-hidden />
                    <span>{siteContact.phone.display}</span>
                  </a>
                </li>
              ) : null}
              {showWhatsApp ? (
                <li>
                  <a
                    href={siteContact.whatsapp.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#25D366]" />
                    <span>Need Help? WhatsApp</span>
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  href={siteContact.email.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Mail className="h-4 w-4 shrink-0 text-royal" aria-hidden />
                  <span className="truncate">{siteContact.email.display}</span>
                </a>
              </li>
              <li>
                {siteContact.location.href ? (
                  <a
                    href={siteContact.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-royal" aria-hidden />
                    <span>{siteContact.location.fullDisplay}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90">
                    <MapPin className="h-4 w-4 shrink-0 text-royal" aria-hidden />
                    <span>{siteContact.location.fullDisplay}</span>
                  </span>
                )}
              </li>
            </ul>
            <SocialLinks className="mt-2 px-1" size="default" />
            <p className="mt-3 px-3 text-xs font-semibold text-royal">{siteContact.registration}</p>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <Link
              to="/sign-in"
              search={{}}
              onClick={onClose}
              className="flex items-center justify-between rounded-md px-3 py-3 text-[0.95rem] font-semibold text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Sign In</span>
              <span className="text-royal" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </nav>

        <div className="shrink-0 space-y-2 border-t border-border bg-white p-4">
          {showWhatsApp ? (
            <Button
              asChild
              variant="outline"
              className="h-12 w-full border-[#25D366]/40 text-base font-semibold text-[#128C7E] hover:bg-[#25D366] hover:text-white"
            >
              <a
                href={siteContact.whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Need Help? WhatsApp
              </a>
            </Button>
          ) : null}
          <Button asChild className="h-12 w-full text-base font-semibold">
            <Link to="/" hash={FREE_CONSULTATION_HASH} onClick={onClose}>
              Free Consultation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
