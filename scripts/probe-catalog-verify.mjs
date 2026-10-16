/**
 * Live catalog probe — universities/programs anon SELECT + write denial.
 * Never prints keys/JWTs. Does not apply migrations.
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

function log(k, v) {
  console.log(`${k}=${v}`);
}

const env = { ...loadEnv(".env"), ...process.env };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
const staffJwt = (
  env.STAGING_ADMIN_JWT ||
  env.STAGING_CONSULTANT_JWT ||
  ""
).trim();

let host = "";
try {
  host = url ? new URL(url).host : "";
} catch {
  host = "invalid";
}

log("PROBE", "catalog_verify");
log("HOST", host || "missing");
log("ANON_KEY", anon ? "present" : "missing");
log("STAFF_JWT", staffJwt ? "present" : "missing");

if (!url || !anon) {
  log("OVERALL", "BLOCKED_missing_env");
  process.exit(2);
}

const anonHeaders = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
};

async function rest(path, opts = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: opts.headers || anonHeaders,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

for (const t of ["universities", "programs"]) {
  const r = await rest(`${t}?select=id,name&limit=5`);
  let count = "?";
  let err = "";
  try {
    const j = JSON.parse(r.text);
    if (Array.isArray(j)) count = String(j.length);
    else err = "not_array";
  } catch {
    err = r.text.slice(0, 120).replace(/\s+/g, " ");
  }
  log(`${t.toUpperCase()}_SELECT_HTTP`, r.status);
  log(`${t.toUpperCase()}_SELECT_COUNT`, count);
  if (err) log(`${t.toUpperCase()}_SELECT_SNIP`, err);
}

const uniInsert = await rest("universities", {
  method: "POST",
  headers: {
    ...anonHeaders,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: { name: "PROBE_ANON_UNI", country: "Probe" },
});
log("ANON_UNI_INSERT_HTTP", uniInsert.status);
log(
  "ANON_UNI_INSERT_DENIED",
  uniInsert.status === 401 || uniInsert.status === 403 ? "pass" : "FAIL",
);

const progInsert = await rest("programs", {
  method: "POST",
  headers: {
    ...anonHeaders,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: {
    university_id: "00000000-0000-0000-0000-000000000000",
    name: "PROBE_ANON_PROG",
  },
});
log("ANON_PROG_INSERT_HTTP", progInsert.status);
log(
  "ANON_PROG_INSERT_DENIED",
  progInsert.status === 401 || progInsert.status === 403 ? "pass" : "FAIL",
);

// Detect whether anon can see rows if any exist (policy applied).
// Prefer header count for empty-vs-denied distinction: both yield [] when no policy rows.
const uniCount = await fetch(`${url}/rest/v1/universities?select=id&limit=0`, {
  headers: { ...anonHeaders, Prefer: "count=exact" },
});
log("ANON_UNI_CONTENT_RANGE", uniCount.headers.get("content-range") || "none");
log("ANON_UNI_COUNT_HTTP", uniCount.status);

if (staffJwt) {
  const staffHeaders = {
    apikey: anon,
    Authorization: `Bearer ${staffJwt}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const list = await fetch(`${url}/rest/v1/universities?select=id,name&limit=3`, {
    headers: staffHeaders,
  });
  log("STAFF_UNI_SELECT_HTTP", list.status);
  const create = await fetch(`${url}/rest/v1/universities`, {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({
      name: `PROBE_UNI_${Date.now()}`,
      country: "ProbeLand",
      city: "Probe City",
    }),
  });
  const createText = await create.text();
  log("STAFF_UNI_INSERT_HTTP", create.status);
  let id = null;
  try {
    const j = JSON.parse(createText);
    id = Array.isArray(j) ? j[0]?.id : j?.id;
  } catch {
    log("STAFF_UNI_INSERT_SNIP", createText.slice(0, 140).replace(/\s+/g, " "));
  }
  if (id) {
    const del = await fetch(`${url}/rest/v1/universities?id=eq.${id}`, {
      method: "DELETE",
      headers: staffHeaders,
    });
    log("STAFF_UNI_DELETE_HTTP", del.status);
  }
} else {
  log("STAFF_CRUD", "BLOCKED_no_staff_jwt");
}

log(
  "OVERALL_ANON_READ",
  uniCount.status === 200 ? "pass_or_empty" : "fail",
);
log(
  "OVERALL_ANON_WRITE",
  (uniInsert.status === 401 || uniInsert.status === 403) &&
    (progInsert.status === 401 || progInsert.status === 403)
    ? "pass"
    : "fail",
);
