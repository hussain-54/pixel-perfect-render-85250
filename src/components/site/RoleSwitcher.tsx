import { Link } from "@tanstack/react-router";
import { ChevronDown, Eye } from "lucide-react";
import {
<<<<<<< HEAD
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
=======
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Demo-only role switcher. Replace with real auth roles later. */
export function RoleSwitcher({ current, light = false }: { current: string; light?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
<<<<<<< HEAD
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          light ? "border-navy-foreground/20 text-navy-foreground" : "border-border text-navy",
        )}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Demo:</span> {current}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Preview portals (no auth)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">Public website</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/student/dashboard">Student portal</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/staff/dashboard">Consultant portal</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/dashboard">Admin panel</Link>
        </DropdownMenuItem>
=======
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold",
          light ? "border-navy-foreground/20 text-navy-foreground" : "border-border text-navy",
        )}
      >
        <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Demo:</span> {current}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Switch demo view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/">Public website</Link></DropdownMenuItem>
        <DropdownMenuItem disabled>Student portal (coming soon)</DropdownMenuItem>
        <DropdownMenuItem disabled>Consultant portal (coming soon)</DropdownMenuItem>
        <DropdownMenuItem disabled>Admin panel (coming soon)</DropdownMenuItem>
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
