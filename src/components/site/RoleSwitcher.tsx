import { Link } from "@tanstack/react-router";
import { ChevronDown, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDemoAuthEnabled } from "@/lib/demo-auth";
import { cn } from "@/lib/utils";

/** Demo-only helper. Does not bypass route guards — switch accounts via sign-in. */
export function RoleSwitcher({ current, light = false }: { current: string; light?: boolean }) {
  if (!isDemoAuthEnabled()) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          light ? "border-navy-foreground/20 text-navy-foreground" : "border-border text-navy",
        )}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Demo:</span> {current}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Demo auth enabled</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">Public website</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/sign-in" search={{}}>Sign in with another demo account</Link>
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-[0.7rem] leading-snug text-muted-foreground">
          Portal URLs are role-guarded. Use ayesha@, consultant@, or admin@ demo accounts.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}