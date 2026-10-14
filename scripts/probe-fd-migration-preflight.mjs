/**
 * Read-only remote probe for Front Desk Phase 2 migration readiness.
 * Uses publishable/anon key only — never prints secrets.
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
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";

function log(k, v) {
  console.log(`${k}=${v}`);
}

if (!url || !key) {
  log("REMOTE_STATUS", "UNVERIFIED");
  log("REASON", "missing_supabase_url_or_anon_key");
  process.exit(0);
}

let host = "invalid_url";
try {
  host = new URL(url).host;
} catch {
  /* keep */
}
log("REMOTE_PROJECT_HOST", host);

async function probe(path, init) {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 220).replace(/\s+/g, " ") };
}

// Column presence: select registered_by
{
  const r = await probe("/rest/v1/students?select=registered_by&limit=1");
  log("STUDENTS_REGISTERED_BY_HTTP", String(r.status));
  if (r.status === 200) log("STUDENTS_REGISTERED_BY", "COLUMN_EXISTS");
  else if (/registered_by|PGRST204|column/i.test(r.text))
    log("STUDENTS_REGISTERED_BY", "COLUMN_MISSING");
  else log("STUDENTS_REGISTERED_BY", `UNKNOWN:${r.text}`);
}

// Phase 1 table still present
{
  const r = await probe(
    "/rest/v1/business_module_permissions?select=business_role&limit=1",
  );
  log("PHASE1_MATRIX_HTTP", String(r.status));
  log(
    "PHASE1_MATRIX",
    r.status === 200 ? "TABLE_PRESENT" : `UNEXPECTED:${r.text}`,
  );
}

const rpcs = [
  "is_front_desk",
  "list_front_desk_intake_summaries",
  "front_desk_assign_counsellor",
  "list_active_counsellor_desks",
];

for (const name of rpcs) {
  const body =
    name === "front_desk_assign_counsellor"
      ? {
          p_student_id: "00000000-0000-0000-0000-000000000000",
          p_consultant_id: "00000000-0000-0000-0000-000000000000",
        }
      : {};
  const r = await probe(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  log(`RPC_${name}_HTTP`, String(r.status));
  if (/Could not find the function|PGRST202|404/i.test(r.text) || r.status === 404) {
    log(`RPC_${name}`, "MISSING");
  } else if (/Not authenticated|JWT|permission denied|42501|Not authorized/i.test(r.text)) {
    log(`RPC_${name}`, "PRESENT_AUTH_REQUIRED_OR_DENIED");
  } else {
    log(`RPC_${name}`, `RESPONSE:${r.text}`);
  }
}

log("NOTE", "Anon probes only; authenticated role tests require provisioned JWTs.");
log("APPLY_STATUS", "NOT_ATTEMPTED_NO_AUTHORIZATION");
