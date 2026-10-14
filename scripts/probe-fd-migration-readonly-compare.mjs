/**
 * Read-only remote compare for Phase 2 FD migration.
 * Never prints secrets, JWTs, or student row payloads.
 */
import { readFileSync, existsSync } from "node:fs";

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

const env = { ...loadEnv(".env"), ...process.env };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
const service =
  env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim() || "";

function log(k, v) {
  console.log(`${k}=${v}`);
}

if (!url) {
  log("COMPARE_STATUS", "UNVERIFIED");
  log("REASON", "missing_supabase_url");
  process.exit(0);
}

let host = "invalid_url";
try {
  host = new URL(url).host;
} catch {
  /* keep */
}
log("REMOTE_PROJECT_HOST", host);
log("HAS_ANON_KEY", anon ? "yes" : "no");
log("HAS_SERVICE_ROLE_KEY", service ? "yes" : "no");

async function rest(path, key, init = {}) {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 400).replace(/\s+/g, " ") };
}

// --- Anon probes (safe) ---
if (anon) {
  const col = await rest("/rest/v1/students?select=registered_by&limit=0", anon);
  log("ANON_REGISTERED_BY_HTTP", String(col.status));
  if (/registered_by|PGRST204|column .* does not exist/i.test(col.text)) {
    log("ANON_REGISTERED_BY", "COLUMN_MISSING_OR_UNKNOWN");
  } else if (/permission denied|42501/i.test(col.text)) {
    log("ANON_REGISTERED_BY", "TABLE_DENIED_COLUMN_UNKNOWN");
  } else {
    log("ANON_REGISTERED_BY", `HTTP_${col.status}`);
  }

  for (const name of [
    "is_front_desk",
    "list_front_desk_intake_summaries",
    "list_active_counsellor_desks",
    "front_desk_assign_counsellor",
  ]) {
    const body =
      name === "front_desk_assign_counsellor"
        ? {
            p_student_id: "00000000-0000-0000-0000-000000000000",
            p_consultant_id: "00000000-0000-0000-0000-000000000000",
          }
        : {};
    const r = await rest(`/rest/v1/rpc/${name}`, anon, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "" },
      body: JSON.stringify(body),
    });
    const kind =
      r.status === 404 || /Could not find the function|PGRST202/i.test(r.text)
        ? "MISSING"
        : /Not authenticated|Not authorized/i.test(r.text)
          ? "PRESENT_DENIES_NULL_UID"
          : r.status === 200
            ? "PRESENT_EXECUTED"
            : `PRESENT_HTTP_${r.status}`;
    log(`ANON_RPC_${name}`, kind);
  }
}

// --- Service-role schema probes (no row dumps) ---
if (!service) {
  log("SERVICE_COMPARE", "UNVERIFIED");
  log("SERVICE_REASON", "no_service_role_key_in_env");
  log("DDL_ATTEMPTED", "no");
  process.exit(0);
}

{
  // Column existence: HEAD/limit=0 select — never log body rows
  const r = await rest(
    "/rest/v1/students?select=registered_by&limit=0",
    service,
    { headers: { Prefer: "count=exact" } },
  );
  log("SVC_REGISTERED_BY_HTTP", String(r.status));
  if (r.status === 200) log("SVC_REGISTERED_BY", "COLUMN_EXISTS");
  else if (/PGRST204|column .* does not exist|registered_by/i.test(r.text))
    log("SVC_REGISTERED_BY", "COLUMN_MISSING");
  else log("SVC_REGISTERED_BY", `ERROR_NO_PAYLOAD`);

  // Confirm we did not need to fetch student PII columns
  const r2 = await rest(
    "/rest/v1/students?select=id&limit=0",
    service,
  );
  log("SVC_STUDENTS_REACHABLE", r2.status === 200 ? "yes" : "no");
}

// Migration history via PostgREST is usually unavailable; try common schemas.
for (const path of [
  "/rest/v1/schema_migrations?select=version&order=version.desc&limit=20",
  "/rest/v1/supabase_migrations?select=version&order=version.desc&limit=20",
]) {
  const r = await rest(path, service);
  log(
    `MIGRATION_TABLE_PROBE_${path.includes("schema") ? "schema_migrations" : "supabase_migrations"}`,
    r.status === 200
      ? "EXPOSED_VIA_REST"
      : `UNAVAILABLE_HTTP_${r.status}`,
  );
}

// Heuristic: whether hardened gate is live — list_active_counsellor_desks
// with service role still has auth.uid() null → expect Not authenticated
{
  const r = await rest("/rest/v1/rpc/list_active_counsellor_desks", service, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "" },
    body: "{}",
  });
  log(
    "SVC_RPC_list_active_counsellor_desks",
    /Not authenticated/i.test(r.text)
      ? "PRESENT_REQUIRES_AUTH_UID"
      : r.status === 200
        ? "EXECUTED_AS_SERVICE_ROLE"
        : `HTTP_${r.status}`,
  );
}

// Detect is_consultant gate vs front_desk-only: cannot read source via REST.
log("FUNCTION_BODY_COMPARE", "UNVERIFIED_NO_SQL_CATALOG_ACCESS");
log("TRIGGER_COMPARE", "UNVERIFIED_NO_SQL_CATALOG_ACCESS");
log("MIGRATION_HISTORY_COMPARE", "UNVERIFIED_NO_SQL_CATALOG_ACCESS");
log("DDL_ATTEMPTED", "no");
log("COMPARE_STATUS", "PARTIAL");
