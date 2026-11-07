import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { MegaMenuPanel } from "@/components/site/MegaMenuPanel";
import { MobileNavDrawer } from "@/components/site/MobileNavDrawer";
import { SiteSearch } from "@/components/site/SiteSearch";
import { UtilityBar } from "@/components/site/UtilityBar";
import { mainNavigation, type MegaMenuId } from "@/data/navigation";
import type { CmsHeaderSettings, CmsNavSettings } from "@/lib/cms-types";
import { cn } from "@/lib/utils";

const navItemClass =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-2 text-[0.8125rem] font-medium leading-none text-navy/75 transition-colors hover:bg-accent/70 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:gap-1.5 2xl:px-2.5 2xl:text-sm";

type HeaderProps = {
  cmsHeader?: CmsHeaderSettings;
  cmsNav?: CmsNavSettings;
};

export function Header({ cmsHeader, cmsNav }: HeaderProps = {}) {
  const [openMenu, setOpenMenu] = useState<MegaMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRegionId = useId();
  const mobileDrawerId = useId();

  const sticky = cmsHeader?.sticky !== false;
  const showUtilityBar = cmsHeader?.showUtilityBar !== false;
  const ctaLabel = cmsHeader?.cta.label?.trim() || "Book Consultation";
  const ctaHref = cmsHeader?.cta.href?.trim() || "/contact";

  const desktopNavigation = (cmsNav?.items?.length ? cmsNav.items : null)
    ? cmsNav!.items
        .filter((item) => item.visible !== false && item.id !== "home")
        .map((item) => {
          const base = mainNavigation.find((m) => m.id === item.id);
          if (item.type === "link") {
            return {
              id: item.id,
              label: item.label || base?.label || item.id,
              type: "link" as const,
              to: (item.href || (base && base.type === "link" ? base.to : "/")) as "/",
            };
          }
          return {
            id: (item.megaId || item.id) as MegaMenuId,
            label: item.label || base?.label || item.id,
            type: "mega" as const,
          };
        })
    : mainNavigation.filter((item) => item.id !== "home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openMenu && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu, searchOpen]);

  useEffect(() => {
    if (!openMenu && !searchOpen) return;
    const onPointer = (e: MouseEvent) => {
      const el = headerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpenMenu(null);
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [openMenu, searchOpen]);

  const toggleMenu = (id: MegaMenuId) => {
    setSearchOpen(false);
    setOpenMenu((current) => (current === id ? null : id));
  };

  const closeMenus = () => {
    setOpenMenu(null);
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
          {/* Logo */}
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

          {/* Navigation — desktop from 1400px so items never collide with actions */}
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-x-2 overflow-hidden min-[1400px]:flex 2xl:gap-x-4"
            aria-label="Primary"
          >
            {desktopNavigation.map((item) => {
              if (item.type === "link") {
                return (
                  <Link
                    key={item.id}
                    to={item.to as "/"}
                    activeOptions={{ exact: item.to === "/" }}
                    onClick={closeMenus}
                    className={navItemClass}
                    activeProps={{ className: "text-navy" }}
                  >
                    {item.label}
                  </Link>
                );
              }

              const isOpen = openMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  aria-controls={isOpen ? menuRegionId : undefined}
                  onClick={() => toggleMenu(item.id)}
                  className={cn(navItemClass, isOpen && "bg-accent text-navy")}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </nav>

          {/* Actions — fixed right cluster with clear separation from nav */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5 border-l border-border pl-4 max-[1399px]:border-0 max-[1399px]:pl-0 min-[1400px]:ml-6 min-[1400px]:gap-3 min-[1400px]:pl-6">
            <SiteSearch
              open={searchOpen}
              onOpenChange={(next) => {
                setSearchOpen(next);
                if (next) setOpenMenu(null);
              }}
              className="hidden 2xl:inline-flex"
            />

            <Button
              asChild
              variant="default"
              size="sm"
              className="hidden h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:inline-flex min-[1400px]:px-4"
            >
              {ctaHref.startsWith("/") ? (
                <Link to={ctaHref as "/contact"} onClick={closeMenus}>
                  {ctaLabel}
                </Link>
              ) : (
                <a href={ctaHref} onClick={closeMenus}>
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[1400px]:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {openMenu && (
          <div className="absolute inset-x-0 top-full z-50 hidden min-[1400px]:block">
            <div className="mx-auto w-full max-w-[1680px] px-5 pb-4 pt-2 md:px-6 lg:px-8 xl:px-10">
              <div id={menuRegionId}>
                <MegaMenuPanel id={openMenu} onNavigate={closeMenus} />
              </div>
            </div>
          </div>
        )}
      </header>

      <MobileNavDrawer
        id={mobileDrawerId}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        cmsNav={cmsNav}
      />
    </>
  );
}
