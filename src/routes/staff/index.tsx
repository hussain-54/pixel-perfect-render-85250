import { createFileRoute, redirect } from "@tanstack/react-router";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import type { BusinessRole } from "@/lib/business-permissions";

export const Route = createFileRoute("/staff/")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: BusinessRole | null } }).auth;
    if (isFrontDeskBusinessRole(auth?.businessRole)) {
      throw redirect({ to: "/staff/front-desk" });
    }
    throw redirect({ to: "/staff/dashboard" });
  },
});
