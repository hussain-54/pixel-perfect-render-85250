import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Mail, MapPin, Phone, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/site/SocialLinks";
import { siteContact } from "@/data/contact";
import { mainNavigation, megaMenus, type MegaMenuId } from "@/data/navigation";
import { cn } from "@/lib/utils";

const sectionLabels: Record<MegaMenuId, string[]> = {
  programs: ["Study Levels", "Popular Fields", "Quick Links"],
  universities: ["Study by Country", "Featured Universities"],
  scholarships: ["Scholarship Types", "Popular Scholarships", "Quick Links"],
  destinations: ["Study Destinations"],
  services: ["Study Abroad Services", "Visa Services", "Student Support"],
  resources: ["Guides", "Explore", "Get Help"],
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function MobileNavDrawer({
  open,
  onClose,
  id,
}: {
  open: boolean;
  onClose: () => void;
  id?: string;
}) {
  const [expanded, setExpanded] = useState<MegaMenuId | null>(null);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      setExpanded(null);
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

    // Focus close control after paint for screen readers / keyboard users
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
      className="fixed inset-0 z-50 xl:hidden"
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
        className="absolute inset-y-0 right-0 flex w-full max-w-[min(100%,24rem)] flex-col border-l border-border bg-white animate-in slide-in-from-right duration-200"
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

          {mainNavigation.map((item) => {
            if (item.type === "link") {
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={onClose}
                  className="block rounded-md px-3 py-3 text-[0.95rem] font-semibold text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              );
            }

            const isOpen = expanded === item.id;
            const menu = megaMenus[item.id];
            const allowed = sectionLabels[item.id];
            const panelId = `mobile-submenu-${item.id}`;

            return (
              <div key={item.id} className="border-b border-border/70 last:border-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-[0.95rem] font-semibold text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOpen && "bg-accent/70 text-navy",
                  )}
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-royal transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                <div
                  id={panelId}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                  inert={isOpen ? undefined : true}
                  aria-hidden={!isOpen}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-4 pb-3 pl-2 pr-1 pt-1">
                      {menu.columns
                        .filter((c) => allowed.includes(c.heading))
                        .map((column) => {
                          const limit =
                            column.heading.includes("Popular") ||
                            column.heading.includes("Featured")
                              ? 8
                              : undefined;
                          const links = limit ? column.links.slice(0, limit) : column.links;
                          return (
                            <div key={column.heading}>
                              <p className="mb-1.5 px-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-royal">
                                {column.heading}
                              </p>
                              <ul className="space-y-0.5">
                                {links.map((link) => (
                                  <li key={`${column.heading}-${link.label}`}>
                                    <Link
                                      to={link.to}
                                      {...(link.search ? { search: link.search } : {})}
                                      {...(link.hash ? { hash: link.hash } : {})}
                                      onClick={onClose}
                                      tabIndex={isOpen ? undefined : -1}
                                      className="block rounded-md px-2 py-2 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      {link.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      <Link
                        to={menu.cta.primary.to}
                        onClick={onClose}
                        tabIndex={isOpen ? undefined : -1}
                        className="mx-2 inline-flex text-sm font-semibold text-royal transition-colors hover:text-navy"
                      >
                        {menu.cta.primary.label} →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-royal">
              {siteContact.location.label}
            </p>
            <ul className="space-y-0.5">
              <li>
                <a
                  href={siteContact.phone.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-navy/90 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Phone className="h-4 w-4 shrink-0 text-royal" aria-hidden />
                  <span>{siteContact.phone.display}</span>
                </a>
              </li>
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

        <div className="shrink-0 border-t border-border bg-white p-4">
          <Button asChild className="h-12 w-full text-base font-semibold">
            <Link to="/contact" onClick={onClose}>
              Book Consultation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
