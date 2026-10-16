import fs from "node:fs";

const p = "src/routeTree.gen.ts";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("AdminBankingRouteImport")) {
  s = s.replace(
    "import { Route as AdminAuditLogsRouteImport } from './routes/admin/audit-logs'",
    "import { Route as AdminAuditLogsRouteImport } from './routes/admin/audit-logs'\nimport { Route as AdminBankingRouteImport } from './routes/admin/banking'",
  );
}

if (!s.includes("AdminUsersRolesRouteImport")) {
  s = s.replace(
    "import { Route as AdminUniversitiesRouteImport } from './routes/admin/universities'",
    "import { Route as AdminUniversitiesRouteImport } from './routes/admin/universities'\nimport { Route as AdminUsersRolesRouteImport } from './routes/admin/users-roles'",
  );
}

const bankingConst = `const AdminBankingRoute = AdminBankingRouteImport.update({
  id: '/banking',
  path: '/banking',
  getParentRoute: () => AdminRouteRoute,
} as any)
`;

const usersConst = `const AdminUsersRolesRoute = AdminUsersRolesRouteImport.update({
  id: '/users-roles',
  path: '/users-roles',
  getParentRoute: () => AdminRouteRoute,
} as any)
`;

if (!s.includes("id: '/banking'")) {
  s = s.replace(
    "const AdminConsultantsRoute = AdminConsultantsRouteImport.update({",
    `${bankingConst}const AdminConsultantsRoute = AdminConsultantsRouteImport.update({`,
  );
}

if (!s.includes("id: '/users-roles'")) {
  s = s.replace(
    "const AdminUniversitiesRoute = AdminUniversitiesRouteImport.update({",
    `${usersConst}const AdminUniversitiesRoute = AdminUniversitiesRouteImport.update({`,
  );
}

// FileRoutesByFullPath / To / Id maps — insert after finance entries
const mapEntries = [
  ["'/admin/banking': typeof AdminBankingRoute", "'/admin/finance': typeof AdminFinanceRoute"],
  ["'/admin/users-roles': typeof AdminUsersRolesRoute", "'/admin/universities': typeof AdminUniversitiesRoute"],
];

for (const [insert, after] of mapEntries) {
  // Insert in all three FileRoute type maps (appear multiple times)
  let idx = 0;
  while (true) {
    const pos = s.indexOf(after, idx);
    if (pos < 0) break;
    const checkFrom = Math.max(0, pos - 80);
    if (!s.slice(checkFrom, pos + after.length + 40).includes(insert.split(":")[0])) {
      s = s.slice(0, pos) + insert + "\n  " + s.slice(pos);
    }
    idx = pos + after.length + insert.length + 5;
  }
}

// path union strings
if (!s.includes("| '/admin/banking'")) {
  s = s.replace("| '/admin/finance'", "| '/admin/banking'\n    | '/admin/finance'");
}
if (!s.includes("| '/admin/users-roles'")) {
  s = s.replace("| '/admin/universities'", "| '/admin/universities'\n    | '/admin/users-roles'");
}

// FileRoutesByPath interface blocks
if (!s.includes("'/admin/banking': {")) {
  const financeBlock = s.match(/'\/admin\/finance': \{[\s\S]*?\n    \}/);
  if (financeBlock) {
    const bankingBlock = financeBlock[0]
      .replaceAll("/admin/finance", "/admin/banking")
      .replaceAll("/finance", "/banking")
      .replaceAll("AdminFinanceRoute", "AdminBankingRoute")
      .replaceAll("AdminFinanceRouteImport", "AdminBankingRouteImport");
    s = s.replace(financeBlock[0], `${bankingBlock}\n    ${financeBlock[0]}`);
  }
}

if (!s.includes("'/admin/users-roles': {")) {
  const uniBlock = s.match(/'\/admin\/universities': \{[\s\S]*?\n    \}/);
  if (uniBlock) {
    const usersBlock = uniBlock[0]
      .replaceAll("/admin/universities", "/admin/users-roles")
      .replaceAll("/universities", "/users-roles")
      .replaceAll("AdminUniversitiesRoute", "AdminUsersRolesRoute")
      .replaceAll("AdminUniversitiesRouteImport", "AdminUsersRolesRouteImport");
    s = s.replace(uniBlock[0], `${usersBlock}\n    ${uniBlock[0]}`);
  }
}

// Children interface + object
if (!s.includes("AdminBankingRoute: typeof AdminBankingRoute")) {
  s = s.replace(
    "AdminFinanceRoute: typeof AdminFinanceRoute",
    "AdminBankingRoute: typeof AdminBankingRoute\n  AdminFinanceRoute: typeof AdminFinanceRoute",
  );
}
if (!s.includes("AdminUsersRolesRoute: typeof AdminUsersRolesRoute")) {
  s = s.replace(
    "AdminUniversitiesRoute: typeof AdminUniversitiesRoute",
    "AdminUniversitiesRoute: typeof AdminUniversitiesRoute\n  AdminUsersRolesRoute: typeof AdminUsersRolesRoute",
  );
}

if (!s.includes("AdminBankingRoute: AdminBankingRoute")) {
  s = s.replace(
    "AdminFinanceRoute: AdminFinanceRoute,",
    "AdminBankingRoute: AdminBankingRoute,\n  AdminFinanceRoute: AdminFinanceRoute,",
  );
}
if (!s.includes("AdminUsersRolesRoute: AdminUsersRolesRoute,")) {
  s = s.replace(
    "AdminUniversitiesRoute: AdminUniversitiesRoute,",
    "AdminUniversitiesRoute: AdminUniversitiesRoute,\n  AdminUsersRolesRoute: AdminUsersRolesRoute,",
  );
}

fs.writeFileSync(p, s);
console.log("routeTree.gen.ts patched for banking + users-roles");
