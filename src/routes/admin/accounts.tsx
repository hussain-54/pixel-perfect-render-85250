import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Account management lives under Admin → Users & Roles.
 * Keep this route as a redirect so bookmarks/old nav links still work.
 */
export const Route = createFileRoute("/admin/accounts")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/users-roles?tab=users" });
  },
});
