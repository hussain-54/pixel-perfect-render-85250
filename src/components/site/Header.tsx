import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, UserRound } from "lucide-react";
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
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-navy/75 transition-colors hover:bg-accent/80 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Header() {
  const [openMenu, setOpenMenu] = useState<MegaMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRegionId = useId();

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
        <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center gap-4 px-6 xl:gap-5 xl:px-8">
          {/* Logo — fixed width budget, never shrink */}
          <Logo showTagline className="w-[190px] max-w-[190px] shrink-0" />

          {/* Nav — takes remaining space; items never wrap */}
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap xl:flex 2xl:gap-1"
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

          {/* Actions — never shrink; stay grouped on the right */}
          <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
            <SiteSearch
              open={searchOpen}
              onOpenChange={(next) => {
                setSearchOpen(next);
                if (next) setOpenMenu(null);
              }}
              className="hidden sm:block"
            />

            <Button
              asChild
              variant="default"
              size="sm"
              className="h-10 shrink-0 whitespace-nowrap px-4 text-sm"
            >
              <Link to="/contact" onClick={closeMenus}>
                Book Consultation
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
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
              onClick={() => {
                closeMenus();
                setMobileOpen((v) => !v);
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {openMenu && (
          <div className="absolute inset-x-0 top-full z-50 hidden xl:block">
            <div className="mx-auto w-full max-w-[1360px] px-6 pb-4 pt-2 xl:px-8">
              <div id={menuRegionId}>
                <MegaMenuPanel id={openMenu} onNavigate={closeMenus} />
              </div>
            </div>
          </div>
        )}
      </header>

      <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
