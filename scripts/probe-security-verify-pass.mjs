/**
 * Live security verification pass (read/mutate probes).
 * Never prints JWTs, keys, passwords, or PII row bodies.
 * Does not apply migrations.
 *
 * Env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 * Optional authenticated:
 *   STAGING_*_JWT or STAGING_*_EMAIL + STAGING_*_PASSWORD for roles
 */
import { existsSync, readFileSync } from "node:fs";

const EXPECTED_HOST = "gjasuvlqfofpvrqvvnyz.supabase.co";

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function log(k, v) {
  console.log(`${k}=${v}`);
}

function verdict(ok, blocked = false) {
  if (blocked) return "BLOCKED";
  return ok ? "PASS" : "FAIL";
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();

let host = "";
try {
  host = url ? new URL(url).host : "";
} catch {
  host = "invalid";
}

log("PROBE", "security_verify_pass");
log("HOST", host || "missing");
log("HOST_MATCH_EXPECTED", host === EXPECTED_HOST ? "yes" : "no");
log("ANON_KEY", anon ? "present" : "missing");

if (!url || !anon) {
  log("OVERALL", "BLOCKED_missing_supabase_env");
  process.exit(2);
}

const anonHeaders = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function rest(path, { method = "GET", headers = anonHeaders, body } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function rpc(name, headers = anonHeaders, body = {}) {
  return rest(`rpc/${name}`, { method: "POST", headers, body });
}

function classifyRpc(res) {
  const missing =
    res.status === 404 ||
    /could not find|PGRST202|does not exist|schema cache/i.test(res.text);
  const denied =
    res.status === 401 ||
    res.status === 403 ||
    /permission denied|42501|not authorized|JWT/i.test(res.text);
  if (missing) return "missing";
  if (denied) return "denied";
  if (res.status === 200 || res.status === 204) return "ok";
  return `http_${res.status}`;
}

// ---------------------------------------------------------------------------
// 1) Grants harden: can_mutate_scholarships_catalog
// ---------------------------------------------------------------------------
const anonMutate = await rpc("can_mutate_scholarships_catalog");
const anonClass = classifyRpc(anonMutate);
log("MUTATE_FN_ANON_HTTP", anonMutate.status);
log("MUTATE_FN_ANON_CLASS", anonClass);
log(
  "MUTATE_FN_ANON_BODY_KIND",
  anonMutate.text === "true" || anonMutate.text === "false"
    ? "boolean"
    : anonMutate.text.trim()
      ? "error_or_other"
      : "empty",
);
// Desired after 16120000: denied. If boolean returned → PUBLIC/anon still has EXECUTE.
const grantsAnonDeny = anonClass === "denied";
const grantsFnPresent = anonClass !== "missing";
log(
  "ITEM1_GRANTS_HARDEN_16120000",
  verdict(grantsAnonDeny, !grantsFnPresent && anonClass === "missing"),
);
if (!grantsFnPresent) {
  log("ITEM1_NOTE", "function_missing_or_16110000_not_applied");
} else if (!grantsAnonDeny) {
  log("ITEM1_NOTE", "anon_still_has_execute_migration_not_applied_or_ineffective");
} else {
  log("ITEM1_NOTE", "anon_execute_denied_as_desired");
}

// ---------------------------------------------------------------------------
// Role credentials (JWT preferred; email/password optional)
// ---------------------------------------------------------------------------
const ROLE_SPECS = [
  { id: "student", jwt: "STAGING_STUDENT_JWT", email: "STAGING_STUDENT_EMAIL", password: "STAGING_STUDENT_PASSWORD" },
  { id: "front_desk", jwt: "STAGING_FD_JWT", email: "STAGING_FD_EMAIL", password: "STAGING_FD_PASSWORD" },
  { id: "counsellor", jwt: "STAGING_CONSULTANT_JWT", email: "STAGING_COUNSELLOR_EMAIL", password: "STAGING_COUNSELLOR_PASSWORD" },
  { id: "admission", jwt: "STAGING_ADMISSION_JWT", email: "STAGING_ADMISSION_EMAIL", password: "STAGING_ADMISSION_PASSWORD" },
  { id: "accounts", jwt: "STAGING_ACC_JWT", email: "STAGING_ACCOUNTS_EMAIL", password: "STAGING_ACCOUNTS_PASSWORD" },
  { id: "hr", jwt: "STAGING_HR_JWT", email: "STAGING_HR_EMAIL", password: "STAGING_HR_PASSWORD" },
  { id: "marketing", jwt: "STAGING_MKT_JWT", email: "STAGING_MKT_EMAIL", password: "STAGING_MKT_PASSWORD" },
  { id: "ops", jwt: "STAGING_OPS_JWT", email: "STAGING_OPS_EMAIL", password: "STAGING_OPS_PASSWORD" },
  { id: "manager", jwt: "STAGING_MANAGER_JWT", email: "STAGING_MANAGER_EMAIL", password: "STAGING_MANAGER_PASSWORD" },
  { id: "admin", jwt: "STAGING_ADMIN_JWT", email: "STAGING_ADMIN_EMAIL", password: "STAGING_ADMIN_PASSWORD" },
  { id: "super_admin", jwt: "STAGING_SUPERADMIN_JWT", email: "STAGING_SUPERADMIN_EMAIL", password: "STAGING_SUPERADMIN_PASSWORD" },
];

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, token: "" };
  }
  try {
    const j = JSON.parse(text);
    return { ok: Boolean(j.access_token), status: res.status, token: j.access_token || "" };
  } catch {
    return { ok: false, status: res.status, token: "" };
  }
}

const sessions = {};
for (const spec of ROLE_SPECS) {
  const jwt = (env[spec.jwt] || "").trim();
  const email = (env[spec.email] || "").trim();
  const password = (env[spec.password] || "").trim();
  if (jwt) {
    sessions[spec.id] = { source: "jwt", token: jwt, status: "ready" };
    log(`ROLE_${spec.id.toUpperCase()}_CREDS`, "jwt_present");
  } else if (email && password) {
    const signed = await signIn(email, password);
    sessions[spec.id] = {
      source: "password",
      token: signed.token,
      status: signed.ok ? "ready" : `sign_in_fail_http_${signed.status}`,
    };
    log(
      `ROLE_${spec.id.toUpperCase()}_CREDS`,
      signed.ok ? "password_sign_in_ok" : `password_sign_in_fail_${signed.status}`,
    );
  } else {
    sessions[spec.id] = { source: "none", token: "", status: "missing" };
    log(`ROLE_${spec.id.toUpperCase()}_CREDS`, "missing");
  }
}

function authHeaders(token) {
  return {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

// Prefer admin/admission for authenticated EXECUTE check
const authTokenForMutate =
  sessions.admin?.token ||
  sessions.super_admin?.token ||
  sessions.admission?.token ||
  sessions.manager?.token ||
  sessions.counsellor?.token ||
  "";

if (authTokenForMutate) {
  const authMutate = await rpc(
    "can_mutate_scholarships_catalog",
    authHeaders(authTokenForMutate),
  );
  const authClass = classifyRpc(authMutate);
  log("MUTATE_FN_AUTH_HTTP", authMutate.status);
  log("MUTATE_FN_AUTH_CLASS", authClass);
  log(
    "MUTATE_FN_AUTH_BODY_KIND",
    authMutate.text === "true" || authMutate.text === "false"
      ? "boolean"
      : authMutate.text.trim()
        ? "error_or_other"
        : "empty",
  );
  const authCanExecute = authClass === "ok";
  log("ITEM2_AUTH_CAN_EXECUTE_MUTATE_FN", verdict(authCanExecute));
  log(
    "ITEM2_ANON_DENY_AND_AUTH_ALLOW",
    verdict(grantsAnonDeny && authCanExecute, !grantsFnPresent),
  );
} else {
  log("MUTATE_FN_AUTH", "BLOCKED_no_authenticated_session");
  log("ITEM2_AUTH_CAN_EXECUTE_MUTATE_FN", "BLOCKED");
  log(
    "ITEM2_ANON_DENY_AND_AUTH_ALLOW",
    grantsAnonDeny ? "BLOCKED_auth_half" : verdict(false),
  );
}

// ---------------------------------------------------------------------------
// 3) Scholarship anon/unauthorized mutation probes
// ---------------------------------------------------------------------------
const anonInsert = await rest("scholarships", {
  method: "POST",
  headers: { ...anonHeaders, Prefer: "return=minimal" },
  body: { title: "PROBE_ANON_INSERT_SHOULD_FAIL", status: "published" },
});
log("SCHOLARSHIP_ANON_INSERT_HTTP", anonInsert.status);
log(
  "SCHOLARSHIP_ANON_INSERT_DENIED",
  verdict(anonInsert.status === 401 || anonInsert.status === 403),
);

const anonUpdate = await rest(
  "scholarships?id=eq.00000000-0000-0000-0000-000000000000",
  {
    method: "PATCH",
    headers: { ...anonHeaders, Prefer: "return=minimal" },
    body: { title: "PROBE_ANON_UPDATE_SHOULD_FAIL" },
  },
);
const anonUpdateDenied =
  anonUpdate.status === 401 ||
  anonUpdate.status === 403 ||
  anonUpdate.status === 404 ||
  (anonUpdate.status === 200 && (anonUpdate.text === "" || anonUpdate.text === "[]"));
log("SCHOLARSHIP_ANON_UPDATE_HTTP", anonUpdate.status);
log("SCHOLARSHIP_ANON_UPDATE_DENIED", verdict(anonUpdateDenied));

const anonDelete = await rest(
  "scholarships?id=eq.00000000-0000-0000-0000-000000000000",
  {
    method: "DELETE",
    headers: { ...anonHeaders, Prefer: "return=minimal" },
  },
);
const anonDeleteDenied =
  anonDelete.status === 401 ||
  anonDelete.status === 403 ||
  anonDelete.status === 404 ||
  (anonDelete.status === 200 && (anonDelete.text === "" || anonDelete.text === "[]"));
log("SCHOLARSHIP_ANON_DELETE_HTTP", anonDelete.status);
log("SCHOLARSHIP_ANON_DELETE_DENIED", verdict(anonDeleteDenied));

const anonSelect = await rest("scholarships?select=id,status&limit=20");
let anonNonPublished = 0;
let anonCount = 0;
if (anonSelect.status === 200) {
  try {
    const rows = JSON.parse(anonSelect.text);
    if (Array.isArray(rows)) {
      anonCount = rows.length;
      anonNonPublished = rows.filter((r) => r.status !== "published").length;
    }
  } catch {
    /* ignore */
  }
}
log("SCHOLARSHIP_ANON_SELECT_HTTP", anonSelect.status);
log("SCHOLARSHIP_ANON_SELECT_COUNT", anonCount);
log("SCHOLARSHIP_ANON_NON_PUBLISHED", anonNonPublished);
log(
  "SCHOLARSHIP_ANON_PUBLISHED_ONLY",
  verdict(anonSelect.status === 200 && anonNonPublished === 0),
);

// Unauthorized role: counsellor/FD/student attempting insert (if sessions exist)
const unauthorizedRoles = ["student", "front_desk", "counsellor", "accounts", "hr", "marketing", "ops"];
let unauthorizedMutateResults = [];
for (const rid of unauthorizedRoles) {
  const tok = sessions[rid]?.token;
  if (!tok || sessions[rid].status !== "ready") {
    unauthorizedMutateResults.push({ rid, status: "skipped_no_session" });
    continue;
  }
  const res = await rest("scholarships", {
    method: "POST",
    headers: { ...authHeaders(tok), Prefer: "return=minimal" },
    body: {
      title: `PROBE_UNAUTH_${rid}_${Date.now()}`,
      status: "draft",
    },
  });
  const denied = res.status === 401 || res.status === 403;
  unauthorizedMutateResults.push({ rid, http: res.status, denied });
  log(`SCHOLARSHIP_UNAUTH_INSERT_${rid.toUpperCase()}_HTTP`, res.status);
  log(`SCHOLARSHIP_UNAUTH_INSERT_${rid.toUpperCase()}_DENIED`, verdict(denied));
}
const unauthAttempted = unauthorizedMutateResults.filter((r) => r.http !== undefined);
const unauthAllDenied =
  unauthAttempted.length > 0 && unauthAttempted.every((r) => r.denied);
log(
  "ITEM3_ANON_UNAUTHORIZED_MUTATION_PROBES",
  unauthAttempted.length === 0
    ? verdict(
        (anonInsert.status === 401 || anonInsert.status === 403) && anonUpdateDenied,
      )
      ? "PASS_anon_only_roles_BLOCKED"
      : "FAIL"
    : verdict(
        (anonInsert.status === 401 || anonInsert.status === 403) &&
          anonUpdateDenied &&
          unauthAllDenied,
      ),
);

// ---------------------------------------------------------------------------
// 4) Pending migrations: organization_settings + catalog DELETE grants
// ---------------------------------------------------------------------------
const openapi = await fetch(`${url}/rest/v1/`, {
  headers: { ...anonHeaders, Accept: "application/openapi+json" },
});
const openapiText = await openapi.text();
const hasOrgSettings = /["']organization_settings["']/.test(openapiText);
log("OPENAPI_HAS_ORGANIZATION_SETTINGS", hasOrgSettings ? "yes" : "no");

const orgAnon = await rest("organization_settings?select=id&limit=1");
log("ORG_SETTINGS_ANON_HTTP", orgAnon.status);
// 404 / PGRST205 = table missing; 401/403 or empty = table may exist with RLS
const orgMissing =
  orgAnon.status === 404 ||
  /PGRST205|does not exist|Could not find the table|relation/i.test(orgAnon.text);
log("ORG_SETTINGS_TABLE", orgMissing ? "absent_or_hidden" : "reachable_or_rls");
log(
  "ITEM4A_ORG_SETTINGS_MIGRATION_16100000",
  orgMissing ? "BLOCKED_or_NOT_APPLIED" : "LIKELY_APPLIED_object_present",
);

// Catalog DELETE grant: attempt staff delete if admin JWT; else probe privilege via OpenAPI paths
const adminTok = sessions.admin?.token || sessions.super_admin?.token || "";
if (adminTok) {
  const staffH = { ...authHeaders(adminTok), Prefer: "return=representation" };
  const create = await fetch(`${url}/rest/v1/universities`, {
    method: "POST",
    headers: staffH,
    body: JSON.stringify({
      name: `PROBE_DEL_${Date.now()}`,
      country: "ProbeLand",
    }),
  });
  const createText = await create.text();
  let id = null;
  try {
    const j = JSON.parse(createText);
    id = Array.isArray(j) ? j[0]?.id : j?.id;
  } catch {
    /* ignore */
  }
  log("CATALOG_ADMIN_UNI_INSERT_HTTP", create.status);
  if (id) {
    const del = await fetch(`${url}/rest/v1/universities?id=eq.${id}`, {
      method: "DELETE",
      headers: staffH,
    });
    const delText = await del.text();
    log("CATALOG_ADMIN_UNI_DELETE_HTTP", del.status);
    const deleteOk = del.status === 200 || del.status === 204;
    const privilegeDenied =
      del.status === 401 ||
      del.status === 403 ||
      /permission denied|42501/i.test(delText);
    log(
      "ITEM4B_CATALOG_DELETE_GRANTS_16040000",
      deleteOk
        ? "PASS_delete_works"
        : privilegeDenied
          ? "FAIL_or_NOT_APPLIED_delete_denied"
          : `INCONCLUSIVE_http_${del.status}`,
    );
    if (!deleteOk) {
      log("ITEM4B_NOTE", "insert_succeeded_delete_failed_probe_row_may_remain");
    }
  } else {
    log("ITEM4B_CATALOG_DELETE_GRANTS_16040000", "BLOCKED_admin_insert_failed");
  }
} else {
  // Without admin: check OpenAPI for delete method exposure (weak signal)
  const uniHasDelete = /\/universities[\s\S]{0,400}delete/i.test(openapiText);
  log("OPENAPI_UNI_MENTIONS_DELETE", uniHasDelete ? "yes" : "no_or_unclear");
  log("ITEM4B_CATALOG_DELETE_GRANTS_16040000", "BLOCKED_no_admin_session");
}

// ---------------------------------------------------------------------------
// 5–6) Role matrix: profiles self-read, portal-ish tables, cross-student, mutate
// ---------------------------------------------------------------------------
async function profileSelf(token) {
  const res = await rest("profiles?select=id,role,business_role&limit=1", {
    headers: authHeaders(token),
  });
  let role = null;
  let business = null;
  let id = null;
  if (res.status === 200) {
    try {
      const rows = JSON.parse(res.text);
      if (Array.isArray(rows) && rows[0]) {
        id = rows[0].id || null;
        role = rows[0].role || null;
        business = rows[0].business_role || null;
      }
    } catch {
      /* ignore */
    }
  }
  return { status: res.status, id, role, business };
}

async function studentsSample(token) {
  const res = await rest("students?select=id&limit=5", {
    headers: authHeaders(token),
  });
  let count = -1;
  if (res.status === 200) {
    try {
      const rows = JSON.parse(res.text);
      count = Array.isArray(rows) ? rows.length : -1;
    } catch {
      count = -1;
    }
  }
  return { status: res.status, count };
}

async function studentsOther(token, otherId) {
  if (!otherId) return { status: "skipped", visible: null };
  const res = await rest(`students?select=id&id=eq.${otherId}`, {
    headers: authHeaders(token),
  });
  let visible = null;
  if (res.status === 200) {
    try {
      const rows = JSON.parse(res.text);
      visible = Array.isArray(rows) && rows.length > 0;
    } catch {
      visible = null;
    }
  }
  return { status: res.status, visible };
}

const readyRoles = ROLE_SPECS.filter((s) => sessions[s.id]?.status === "ready");
log("ROLE_MATRIX_READY_COUNT", readyRoles.length);
log(
  "ROLE_MATRIX_READY_IDS",
  readyRoles.map((s) => s.id).join(",") || "none",
);

const profileByRole = {};
for (const spec of readyRoles) {
  const p = await profileSelf(sessions[spec.id].token);
  profileByRole[spec.id] = p;
  log(
    `MATRIX_${spec.id.toUpperCase()}_PROFILE`,
    `http_${p.status}_app_${p.role || "null"}_biz_${p.business || "null"}`,
  );
  const stu = await studentsSample(sessions[spec.id].token);
  log(
    `MATRIX_${spec.id.toUpperCase()}_STUDENTS_SAMPLE`,
    `http_${stu.status}_count_${stu.count}`,
  );
}

// Cross-student: if student session + another student id from admin listing
let crossStudentVerdict = "BLOCKED";
if (sessions.student?.status === "ready" && sessions.admin?.status === "ready") {
  const adminStu = await rest("students?select=id,profile_id&limit=10", {
    headers: authHeaders(sessions.admin.token),
  });
  let otherId = null;
  const selfProfile = profileByRole.student?.id;
  if (adminStu.status === 200) {
    try {
      const rows = JSON.parse(adminStu.text);
      if (Array.isArray(rows)) {
        const other = rows.find((r) => r.profile_id && r.profile_id !== selfProfile);
        otherId = other?.id || null;
      }
    } catch {
      /* ignore */
    }
  }
  if (!otherId) {
    log("CROSS_STUDENT", "BLOCKED_no_other_student_id");
    crossStudentVerdict = "BLOCKED";
  } else {
    const x = await studentsOther(sessions.student.token, otherId);
    log("CROSS_STUDENT_HTTP", x.status);
    log("CROSS_STUDENT_VISIBLE", String(x.visible));
    crossStudentVerdict = x.visible === false ? "PASS" : x.visible === true ? "FAIL" : "BLOCKED";
  }
} else {
  log("CROSS_STUDENT", "BLOCKED_need_student_and_admin_sessions");
}
log("ITEM6_CROSS_STUDENT_ACCESS", crossStudentVerdict);

// Expected app_role / business_role hints (soft check when profile readable)
const EXPECTED = {
  student: { app: ["student"], biz: ["student_portal", null] },
  front_desk: { app: ["consultant"], biz: ["front_desk_student_affairs"] },
  counsellor: { app: ["consultant"], biz: ["counsellor_consultant"] },
  admission: { app: ["consultant"], biz: ["admission_team"] },
  accounts: { app: ["consultant"], biz: ["accounts_banking_finance"] },
  hr: { app: ["consultant"], biz: ["hr_system"] },
  marketing: { app: ["consultant"], biz: ["digital_manager"] },
  ops: { app: ["consultant"], biz: ["office_ops"] },
  manager: { app: ["consultant", "admin"], biz: ["manager"] },
  admin: { app: ["admin"], biz: ["admin", null] },
  super_admin: { app: ["super_admin"], biz: ["admin", null] },
};

let matrixRoleOk = 0;
let matrixRoleFail = 0;
for (const spec of readyRoles) {
  const p = profileByRole[spec.id];
  const exp = EXPECTED[spec.id];
  if (!p || p.status !== 200 || !p.role) {
    log(`MATRIX_${spec.id.toUpperCase()}_ROLE_MATCH`, "BLOCKED_no_profile");
    continue;
  }
  const appOk = exp.app.includes(p.role);
  const bizOk =
    exp.biz.includes(p.business) ||
    (p.business === null && exp.biz.includes(null));
  const ok = appOk && bizOk;
  if (ok) matrixRoleOk += 1;
  else matrixRoleFail += 1;
  log(
    `MATRIX_${spec.id.toUpperCase()}_ROLE_MATCH`,
    ok ? "PASS" : `FAIL_got_app_${p.role}_biz_${p.business}`,
  );
}

const allEleven = ROLE_SPECS.length;
const readyCount = readyRoles.length;
log(
  "ITEM5_ROLE_MATRIX",
  readyCount === 0
    ? "BLOCKED_no_staging_sessions"
    : readyCount < allEleven
      ? matrixRoleFail > 0
        ? "FAIL_partial_with_mismatches"
        : `BLOCKED_partial_${readyCount}_of_${allEleven}`
      : matrixRoleFail > 0
        ? "FAIL"
        : "PASS",
);

// Session / role change soft probe: call auth user endpoint
if (sessions.admin?.status === "ready") {
  const u = await fetch(`${url}/auth/v1/user`, {
    headers: authHeaders(sessions.admin.token),
  });
  log("SESSION_ADMIN_USER_HTTP", u.status);
  log("ITEM6_SESSION_VALID", verdict(u.status === 200));
} else {
  log("ITEM6_SESSION_VALID", "BLOCKED_no_admin_session");
}

// Direct route checks require a running app — mark via env APP_ORIGIN if set
const appOrigin = (env.STAGING_APP_ORIGIN || env.APP_ORIGIN || "").replace(/\/$/, "");
if (appOrigin) {
  for (const path of [
    "/student/dashboard",
    "/staff/dashboard",
    "/admin/dashboard",
    "/admin/settings",
    "/staff/finance",
    "/staff/hr",
  ]) {
    const r = await fetch(`${appOrigin}${path}`, { redirect: "manual" });
    log(`ROUTE_${path.replace(/\//g, "_")}_HTTP`, r.status);
  }
  log("ITEM6_DIRECT_ROUTES", "attempted_see_ROUTE_*");
} else {
  log("ITEM6_DIRECT_ROUTES", "BLOCKED_no_STAGING_APP_ORIGIN");
}

log("ITEM4_PENDING_MIGRATIONS_SUMMARY", "see_ITEM4A_ITEM4B");
log(
  "SUMMARY_GRANTS",
  grantsAnonDeny
    ? authTokenForMutate
      ? "anon_deny_auth_checked"
      : "anon_deny_auth_BLOCKED"
    : grantsFnPresent
      ? "anon_still_allowed_FAIL"
      : "fn_missing_BLOCKED",
);
