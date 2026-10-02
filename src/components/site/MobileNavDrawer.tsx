import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginLinks, mainNavigation, megaMenus, type MegaMenuId } from "@/data/navigation";
import { cn } from "@/lib/utils";

const sectionLabels: Record<MegaMenuId, string[]> = {
  programs: ["Study Levels", "Popular Fields", "Quick Links"],
  universities: ["Study by Country", "Featured Universities"],
  scholarships: ["Scholarship Types", "Popular Scholarships", "Quick Links"],
  destinations: ["Study Destinations"],
  services: ["Study Abroad Services", "Visa Services", "Student Support"],
  resources: ["Guides", "Explore", "Get Help"],
};

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<MegaMenuId | null>(null);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      setQ("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-xl">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <p className="text-sm font-semibold text-navy">Menu</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
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
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                id="mobile-site-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search universities, programs…"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  className="block rounded-md px-3 py-2.5 text-sm font-semibold text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              );
            }

            const isOpen = expanded === item.id;
            const menu = megaMenus[item.id];
            const allowed = sectionLabels[item.id];

            return (
              <div key={item.id} className="border-b border-border/70 last:border-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOpen && "bg-accent/80",
                  )}
                >
                  {item.label}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div className="space-y-4 pb-3 pl-2 pr-1 pt-1">
                    {menu.columns
                      .filter((c) => allowed.includes(c.heading))
                      .map((column) => {
                        const limit =
                          column.heading.includes("Popular") || column.heading.includes("Featured")
                            ? 8
                            : undefined;
                        const links = limit ? column.links.slice(0, limit) : column.links;
                        return (
                          <div key={column.heading}>
                            <p className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-royal">
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
                                    className="block rounded-md px-2 py-1.5 text-[0.875rem] text-navy/90 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="mx-2 inline-flex text-sm font-semibold text-royal hover:text-navy"
                    >
                      {menu.cta.primary.label} →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 space-y-1 border-t border-border pt-4">
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-royal">
              Login
            </p>
            {loginLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={onClose}
                className="block rounded-md px-3 py-2 text-sm text-navy hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <Button asChild className="w-full" size="sm">
            <Link to="/contact" onClick={onClose}>
              Book Consultation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
