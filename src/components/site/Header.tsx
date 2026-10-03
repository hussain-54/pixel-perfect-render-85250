import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MegaMenuPanel } from "@/components/site/MegaMenuPanel";
import { MobileNavDrawer } from "@/components/site/MobileNavDrawer";
import { SiteSearch } from "@/components/site/SiteSearch";
import { loginLinks, mainNavigation, type MegaMenuId } from "@/data/navigation";
import { cn } from "@/lib/utils";

const navItemClass =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1 py-1.5 text-[0.8125rem] font-medium text-navy/75 transition-colors hover:bg-accent/80 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:gap-1.5 2xl:px-1.5 2xl:text-sm";

export function Header() {
  const [openMenu, setOpenMenu] = useState<MegaMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRegionId = useId();
  const mobileDrawerId = useId();

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
          "relative sticky top-0 z-50 border-b border-border/80 bg-white/95 backdrop-blur-sm transition-[box-shadow,background-color] duration-300",
          scrolled && "border-border bg-white shadow-soft",
        )}
      >
        {/* Zone model: Logo | Nav | Actions — separate spacing budgets */}
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center px-4 sm:px-5 md:px-6 xl:px-5">
          {/* ZONE 1 — Logo (compact on mobile/tablet, fuller on wide desktop) */}
          <Logo
            showTagline
            className="w-[152px] max-w-[152px] shrink-0 sm:w-[160px] sm:max-w-[160px] xl:w-[160px] xl:max-w-[160px] 2xl:w-[185px] 2xl:max-w-[185px]"
          />

          {/* ZONE 2 — Primary navigation (desktop only; tablet/mobile use drawer) */}
          <nav
            className="ml-3 hidden min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap xl:flex 2xl:ml-4 2xl:gap-3"
            aria-label="Primary"
          >
            {mainNavigation.map((item) => {
              if (item.type === "link") {
                return (
                  <Link
                    key={item.id}
                    to={item.to}
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
                  <span className="whitespace-nowrap">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </nav>

          {/* ZONE 3 — Desktop actions; mobile/tablet = menu only */}
          <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-5 2xl:ml-7 2xl:gap-3">
            <SiteSearch
              open={searchOpen}
              onOpenChange={(next) => {
                setSearchOpen(next);
                if (next) setOpenMenu(null);
              }}
              className="hidden 2xl:block"
            />

            <div className="hidden xl:block">
              <Button
                asChild
                variant="default"
                size="sm"
                className="h-[42px] shrink-0 whitespace-nowrap px-3 text-sm 2xl:px-4"
              >
                <Link to="/contact" onClick={closeMenus}>
                  Book Consultation
                </Link>
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 text-sm font-medium text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:inline-flex 2xl:px-3"
                aria-label="Login options"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Login
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {loginLinks.map((link) => (
                  <DropdownMenuItem key={link.label} asChild>
                    <Link to={link.to}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls={mobileDrawerId}
              onClick={() => {
                closeMenus();
                setMobileOpen((v) => !v);
              }}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
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
          <div className="absolute inset-x-0 top-full z-50 hidden xl:block">
            <div className="mx-auto w-full max-w-[1400px] px-4 pb-4 pt-2 sm:px-5 md:px-6">
              <div id={menuRegionId}>
                <MegaMenuPanel id={openMenu} onNavigate={closeMenus} />
              </div>
            </div>
          </div>
        )}
      </header>

      <MobileNavDrawer id={mobileDrawerId} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
