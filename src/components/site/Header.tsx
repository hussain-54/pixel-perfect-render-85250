import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { MobileNavDrawer } from "@/components/site/MobileNavDrawer";
import { SiteSearch } from "@/components/site/SiteSearch";
import { UtilityBar } from "@/components/site/UtilityBar";
import { WhatsAppGlyph } from "@/components/site/WhatsAppFloat";
import { FREE_CONSULTATION_HREF, siteContact } from "@/data/contact";
import { FREE_CONSULTATION_HASH, primaryNavigation } from "@/data/navigation";
import type { CmsHeaderSettings, CmsNavSettings } from "@/lib/cms-types";
import { cn } from "@/lib/utils";

const navItemClass =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-2 text-[0.8125rem] font-medium leading-none text-navy/75 transition-colors duration-150 hover:bg-accent/70 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:px-2.5 2xl:text-sm";

type HeaderProps = {
  cmsHeader?: CmsHeaderSettings;
  cmsNav?: CmsNavSettings;
};

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

export function Header({ cmsHeader, cmsNav }: HeaderProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const mobileDrawerId = useId();

  const sticky = cmsHeader?.sticky !== false;
  const showUtilityBar = cmsHeader?.showUtilityBar !== false;
  const ctaLabel = cmsHeader?.cta.label?.trim() || "Free Consultation";
  const cmsCta = cmsHeader?.cta.href?.trim();
  const ctaIsHash =
    !cmsCta ||
    cmsCta === "/contact" ||
    cmsCta === FREE_CONSULTATION_HREF ||
    cmsCta.endsWith(`#${FREE_CONSULTATION_HASH}`);
  const desktopNavigation = resolvePrimaryNav(cmsNav);
  const showWhatsApp = !siteContact.whatsapp.placeholder;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointer = (e: MouseEvent) => {
      const el = headerRef.current;
      if (el && !el.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [searchOpen]);

  const closeMenus = () => {
    setSearchOpen(false);
  };

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "relative z-50 border-b border-border/80 bg-white/95 backdrop-blur-sm transition-[box-shadow,background-color] duration-300",
          sticky ? "sticky top-0" : "relative",
          scrolled && "border-border bg-white shadow-soft",
        )}
      >
        {showUtilityBar ? <UtilityBar /> : null}

        <div className="mx-auto flex h-[68px] w-full max-w-[1680px] items-center px-5 md:px-6 lg:px-8 xl:px-10">
          {cmsHeader?.logoUrl ? (
            <Link to="/" className="mr-4 shrink-0 xl:mr-6" onClick={closeMenus}>
              <img
                src={cmsHeader.logoUrl}
                alt="Global Roots Consultants"
                style={{ height: cmsHeader.logoHeightPx || 40 }}
                className="w-auto"
              />
            </Link>
          ) : (
            <Logo className="mr-4 shrink-0 xl:mr-6" />
          )}

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-x-0.5 overflow-hidden lg:flex xl:gap-x-1 2xl:gap-x-2"
            aria-label="Primary"
          >
            {desktopNavigation.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                onClick={closeMenus}
                className={navItemClass}
                activeProps={{ className: "bg-accent/80 text-navy" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-border pl-3 max-lg:border-0 max-lg:pl-0 lg:ml-4 lg:gap-2.5 lg:pl-5">
            <SiteSearch
              open={searchOpen}
              onOpenChange={(next) => {
                setSearchOpen(next);
              }}
              className="hidden 2xl:inline-flex"
            />

            {showWhatsApp ? (
              <a
                href={siteContact.whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "gr-whatsapp-help hidden h-10 items-center gap-1.5 rounded-md border border-[#25D366]/35 bg-[#25D366]/10 px-2.5 text-sm font-semibold text-[#128C7E] transition-[background-color,transform,box-shadow] duration-200",
                  "hover:bg-[#25D366] hover:text-white hover:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-1",
                  "motion-reduce:transition-none motion-reduce:hover:transform-none",
                  "md:inline-flex",
                )}
                aria-label="Need help? Chat on WhatsApp with Global Roots Consultants"
              >
                <WhatsAppGlyph className="h-4 w-4 shrink-0" />
                <span className="hidden whitespace-nowrap xl:inline">Need Help?</span>
              </a>
            ) : null}

            <Button
              asChild
              variant="default"
              size="sm"
              className="hidden h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:inline-flex xl:px-4"
            >
              {ctaIsHash ? (
                <Link to="/" hash={FREE_CONSULTATION_HASH} onClick={closeMenus}>
                  {ctaLabel}
                </Link>
              ) : cmsCta!.startsWith("/") ? (
                <Link to={cmsCta as "/contact"} onClick={closeMenus}>
                  {ctaLabel}
                </Link>
              ) : (
                <a href={cmsCta} onClick={closeMenus}>
                  {ctaLabel}
                </a>
              )}
            </Button>

            <Link
              to="/sign-in"
              search={{}}
              onClick={closeMenus}
              className="hidden h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
            >
              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Sign In
            </Link>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls={mobileDrawerId}
              onClick={() => {
                closeMenus();
                setMobileOpen((v) => !v);
              }}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        id={mobileDrawerId}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        {...(cmsNav ? { cmsNav } : {})}
      />
    </>
  );
}
