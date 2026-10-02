import { Link } from "@tanstack/react-router";
import { ChevronDown, Eye } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Demo-only role switcher. Replace with real auth roles later. */
export function RoleSwitcher({ current, light = false }: { current: string; light?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
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
        <DropdownMenuItem asChild><Link to="/student/dashboard">Student portal</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/staff/dashboard">Consultant portal</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/admin/dashboard">Admin panel</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
