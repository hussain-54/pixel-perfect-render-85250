/**
 * Patches src/routeTree.gen.ts to register specialty staff module routes.
 * Prefer `npx @tanstack/router-cli generate` when the environment allows file rename.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/routeTree.gen.ts");
let src = fs.readFileSync(file, "utf8");

if (src.includes("StaffHrRouteImport")) {
  console.log("routeTree already includes specialty staff routes");
  process.exit(0);
}

const imports = `
import { Route as StaffBankingRouteImport } from './routes/staff/banking'
import { Route as StaffFinanceRouteImport } from './routes/staff/finance'
import { Route as StaffHrRouteImport } from './routes/staff/hr'
import { Route as StaffMarketingRouteImport } from './routes/staff/marketing'
import { Route as StaffOperationsRouteImport } from './routes/staff/operations'
`;

src = src.replace(
  "import { Route as StaffDashboardRouteImport } from './routes/staff/dashboard'\n",
  "import { Route as StaffDashboardRouteImport } from './routes/staff/dashboard'\n" + imports,
);

const defs = `
const StaffBankingRoute = StaffBankingRouteImport.update({
  id: '/banking',
  path: '/banking',
  getParentRoute: () => StaffRouteRoute,
} as any)
const StaffFinanceRoute = StaffFinanceRouteImport.update({
  id: '/finance',
  path: '/finance',
  getParentRoute: () => StaffRouteRoute,
} as any)
const StaffHrRoute = StaffHrRouteImport.update({
  id: '/hr',
  path: '/hr',
  getParentRoute: () => StaffRouteRoute,
} as any)
const StaffMarketingRoute = StaffMarketingRouteImport.update({
  id: '/marketing',
  path: '/marketing',
  getParentRoute: () => StaffRouteRoute,
} as any)
const StaffOperationsRoute = StaffOperationsRouteImport.update({
  id: '/operations',
  path: '/operations',
  getParentRoute: () => StaffRouteRoute,
} as any)
`;

src = src.replace(
  "const StaffDashboardRoute = StaffDashboardRouteImport.update({",
  defs + "const StaffDashboardRoute = StaffDashboardRouteImport.update({",
);

// Inject into FileRoutesByPath interface blocks — three near-identical maps.
for (const key of [
  "/staff/banking",
  "/staff/finance",
  "/staff/hr",
  "/staff/marketing",
  "/staff/operations",
]) {
  const typeName =
    key === "/staff/banking"
      ? "StaffBankingRoute"
      : key === "/staff/finance"
        ? "StaffFinanceRoute"
        : key === "/staff/hr"
          ? "StaffHrRoute"
          : key === "/staff/marketing"
            ? "StaffMarketingRoute"
            : "StaffOperationsRoute";
  const needle = "  '/staff/dashboard': typeof StaffDashboardRoute\n";
  const insert = `  '${key}': typeof ${typeName}\n` + needle;
  // Replace all occurrences of the dashboard line in type maps.
  src = src.split(needle).join(insert);
}

// Union path strings
for (const key of [
  "/staff/banking",
  "/staff/finance",
  "/staff/hr",
  "/staff/marketing",
  "/staff/operations",
]) {
  const needle = "    | '/staff/dashboard'\n";
  const insert = `    | '${key}'\n` + needle;
  src = src.split(needle).join(insert);
}

// FileRoutesByFullPath detailed entries — copy dashboard block pattern
const dashboardBlock = `    '/staff/dashboard': {
      id: '/staff/dashboard'
      path: '/dashboard'
      fullPath: '/staff/dashboard'
      preLoaderRoute: typeof StaffDashboardRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }`;

const extraBlocks = `
    '/staff/banking': {
      id: '/staff/banking'
      path: '/banking'
      fullPath: '/staff/banking'
      preLoaderRoute: typeof StaffBankingRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }
    '/staff/finance': {
      id: '/staff/finance'
      path: '/finance'
      fullPath: '/staff/finance'
      preLoaderRoute: typeof StaffFinanceRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }
    '/staff/hr': {
      id: '/staff/hr'
      path: '/hr'
      fullPath: '/staff/hr'
      preLoaderRoute: typeof StaffHrRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }
    '/staff/marketing': {
      id: '/staff/marketing'
      path: '/marketing'
      fullPath: '/staff/marketing'
      preLoaderRoute: typeof StaffMarketingRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }
    '/staff/operations': {
      id: '/staff/operations'
      path: '/operations'
      fullPath: '/staff/operations'
      preLoaderRoute: typeof StaffOperationsRouteImport
      parentRoute: typeof StaffRouteRouteImport
    }
`;

if (!src.includes(dashboardBlock)) {
  console.error("Could not find dashboard FileRoutesByPath block");
  process.exit(1);
}
src = src.replace(dashboardBlock, extraBlocks + dashboardBlock);

// Children interface + object
src = src.replace(
  `interface StaffRouteRouteChildren {
  StaffActivityRoute: typeof StaffActivityRoute
  StaffApplicationsRoute: typeof StaffApplicationsRoute
  StaffAppointmentsRoute: typeof StaffAppointmentsRoute
  StaffDashboardRoute: typeof StaffDashboardRoute`,
  `interface StaffRouteRouteChildren {
  StaffActivityRoute: typeof StaffActivityRoute
  StaffApplicationsRoute: typeof StaffApplicationsRoute
  StaffAppointmentsRoute: typeof StaffAppointmentsRoute
  StaffBankingRoute: typeof StaffBankingRoute
  StaffFinanceRoute: typeof StaffFinanceRoute
  StaffHrRoute: typeof StaffHrRoute
  StaffMarketingRoute: typeof StaffMarketingRoute
  StaffOperationsRoute: typeof StaffOperationsRoute
  StaffDashboardRoute: typeof StaffDashboardRoute`,
);

src = src.replace(
  `const StaffRouteRouteChildren: StaffRouteRouteChildren = {
  StaffActivityRoute: StaffActivityRoute,
  StaffApplicationsRoute: StaffApplicationsRoute,
  StaffAppointmentsRoute: StaffAppointmentsRoute,
  StaffDashboardRoute: StaffDashboardRoute,`,
  `const StaffRouteRouteChildren: StaffRouteRouteChildren = {
  StaffActivityRoute: StaffActivityRoute,
  StaffApplicationsRoute: StaffApplicationsRoute,
  StaffAppointmentsRoute: StaffAppointmentsRoute,
  StaffBankingRoute: StaffBankingRoute,
  StaffFinanceRoute: StaffFinanceRoute,
  StaffHrRoute: StaffHrRoute,
  StaffMarketingRoute: StaffMarketingRoute,
  StaffOperationsRoute: StaffOperationsRoute,
  StaffDashboardRoute: StaffDashboardRoute,`,
);

fs.writeFileSync(file, src);
console.log("Patched routeTree.gen.ts with specialty staff routes");
