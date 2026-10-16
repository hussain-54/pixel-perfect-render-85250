/**
 * Read-mostly scholarships live verification (PostgREST).
 * Never prints JWTs, keys, or row bodies. Does not apply migrations.
 *
 * Env: VITE_SUPABASE_URL / SUPABASE_URL
 *      VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 * Optional: SUPABASE_SERVICE_ROLE_KEY (schema/counts only; not for UI claims)
 * Optional: STAGING_ADMIN_JWT or STAGING_CONSULTANT_JWT (staff RLS/CRUD)
 *
 * Usage: node scripts/probe-scholarships-verify.mjs
 */
import { readFileSync, existsSync } from "node:fs";

const EXPECTED_HOST = "gjasuvlqfofpvrqvvnyz.supabase.co";
const EXPECTED_COLS = [
  "id",
  "title",
  "description",
  "provider",
  "university_id",
  "country",
  "study_level",
  "field_of_study",
  "funding_type",
  "funding_description",
  "eligibility",
  "opens_on",
  "closes_on",
  "application_url",
  "status",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
];

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
const service = (
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SECRET_KEY ||
  ""
).trim();
const staffJwt = (
  env.STAGING_ADMIN_JWT ||
  env.STAGING_CONSULTANT_JWT ||
  env.STAGING_ACC_JWT ||
  ""
).trim();

let host = "";
try {
  host = url ? new URL(url).host : "";
} catch {
  host = "invalid";
}

log("PROBE", "scholarships_verify");
log("HOST", host || "missing");
log("HOST_MATCH_EXPECTED", host === EXPECTED_HOST ? "yes" : "no");
log("ANON_KEY", anon ? "present" : "missing");
log("SERVICE_KEY", service ? "present" : "missing");
log("STAFF_JWT", staffJwt ? "present" : "missing");

if (!url || !anon) {
  log("OVERALL", "BLOCKED_missing_supabase_env");
  process.exit(2);
}

const anonHeaders = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
};

async function rest(path, { method = "GET", headers = anonHeaders, body } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

// 1) OpenAPI: table + columns
const openapi = await fetch(`${url}/rest/v1/`, {
  headers: { ...anonHeaders, Accept: "application/openapi+json" },
});
log("OPENAPI_HTTP", openapi.status);
const openapiText = await openapi.text();
const hasScholarshipsDef = /["']scholarships["']/.test(openapiText);
log("OPENAPI_HAS_SCHOLARSHIPS", hasScholarshipsDef ? "yes" : "no");

let missingCols = [];
try {
  const j = JSON.parse(openapiText);
  const props =
    j?.definitions?.scholarships?.properties ||
    j?.components?.schemas?.scholarships?.properties ||
    null;
  if (props) {
    missingCols = EXPECTED_COLS.filter((c) => !Object.prototype.hasOwnProperty.call(props, c));
    log("OPENAPI_SCHOLARSHIPS_COLS", Object.keys(props).sort().join(","));
    log("OPENAPI_MISSING_EXPECTED_COLS", missingCols.length ? missingCols.join(",") : "none");
  } else {
    log("OPENAPI_SCHOLARSHIPS_SCHEMA", "not_in_definitions");
  }
} catch (e) {
  log("OPENAPI_PARSE", e instanceof Error ? e.message : "error");
}

// 2) Anon select (RLS published-only)
const anonSelect = await rest("scholarships?select=id,status&limit=50");
log("ANON_SELECT_HTTP", anonSelect.status);
let anonRows = [];
let anonNonPublished = 0;
if (anonSelect.status === 200) {
  try {
    anonRows = JSON.parse(anonSelect.text);
    if (!Array.isArray(anonRows)) anonRows = [];
    anonNonPublished = anonRows.filter((r) => r.status !== "published").length;
  } catch {
    anonRows = [];
  }
  log("ANON_SELECT_COUNT", anonRows.length);
  log("ANON_NON_PUBLISHED_VISIBLE", anonNonPublished);
  log("ANON_PUBLISHED_ONLY", anonNonPublished === 0 ? "pass" : "FAIL");
} else {
  log("ANON_SELECT_RESULT", "error");
  log("ANON_ERROR_SNIP", anonSelect.text.slice(0, 160).replace(/\s+/g, " "));
}

// 3) Anon insert must fail
const anonInsert = await rest("scholarships", {
  method: "POST",
  headers: {
    ...anonHeaders,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: {
    title: "PROBE_SHOULD_FAIL_ANON_INSERT",
    status: "published",
  },
});
log("ANON_INSERT_HTTP", anonInsert.status);
log(
  "ANON_INSERT_DENIED",
  anonInsert.status === 401 || anonInsert.status === 403 ? "pass" : "FAIL_or_unexpected",
);

// 4) Anon update must fail (use nil UUID)
const anonUpdate = await rest(
  "scholarships?id=eq.00000000-0000-0000-0000-000000000000",
  {
    method: "PATCH",
    headers: {
      ...anonHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: { title: "PROBE_SHOULD_FAIL_ANON_UPDATE" },
  },
);
log("ANON_UPDATE_HTTP", anonUpdate.status);
log(
  "ANON_UPDATE_DENIED",
  anonUpdate.status === 401 ||
    anonUpdate.status === 403 ||
    (anonUpdate.status === 200 && anonUpdate.text === "") ||
    anonUpdate.status === 404
    ? "pass_or_noop"
    : `unexpected_${anonUpdate.status}`,
);

// 5) Service role read-only counts (schema presence), if available
if (service) {
  const svcHeaders = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    Accept: "application/json",
    Prefer: "count=exact",
  };
  const svc = await fetch(`${url}/rest/v1/scholarships?select=id,status&limit=1`, {
    headers: svcHeaders,
  });
  const svcText = await svc.text();
  log("SERVICE_SELECT_HTTP", svc.status);
  const range = svc.headers.get("content-range") || "";
  log("SERVICE_CONTENT_RANGE", range || "none");
  if (svc.status === 200) {
    try {
      const rows = JSON.parse(svcText);
      log("SERVICE_SAMPLE_STATUS", Array.isArray(rows) && rows[0]?.status ? "present" : "empty_table");
    } catch {
      log("SERVICE_SAMPLE_STATUS", "parse_error");
    }
  } else {
    log("SERVICE_ERROR_SNIP", svcText.slice(0, 160).replace(/\s+/g, " "));
  }

  for (const st of ["draft", "published", "archived"]) {
    const r = await fetch(
      `${url}/rest/v1/scholarships?select=id&status=eq.${st}&limit=0`,
      { headers: { ...svcHeaders, Prefer: "count=exact" } },
    );
    const cr = r.headers.get("content-range") || "";
    log(`SERVICE_COUNT_${st.toUpperCase()}`, cr || `http_${r.status}`);
  }
} else {
  log("SERVICE_SELECT", "skipped_no_key");
}

// 6) Staff JWT select/insert/update/cleanup if available
if (staffJwt) {
  const staffHeaders = {
    apikey: anon,
    Authorization: `Bearer ${staffJwt}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const staffList = await fetch(
    `${url}/rest/v1/scholarships?select=id,status&limit=5`,
    { headers: staffHeaders },
  );
  const staffListText = await staffList.text();
  log("STAFF_SELECT_HTTP", staffList.status);
  if (staffList.status !== 200) {
    log("STAFF_SELECT_SNIP", staffListText.slice(0, 160).replace(/\s+/g, " "));
  }

  const probeTitle = `PROBE_SCHOLARSHIP_${Date.now()}`;
  const createRes = await fetch(`${url}/rest/v1/scholarships`, {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({
      title: probeTitle,
      description: "probe row — safe to archive",
      status: "draft",
      funding_type: "partial_funding",
      country: "Probe",
    }),
  });
  const createText = await createRes.text();
  log("STAFF_INSERT_HTTP", createRes.status);
  let probeId = null;
  if (createRes.status === 201 || createRes.status === 200) {
    try {
      const created = JSON.parse(createText);
      probeId = Array.isArray(created) ? created[0]?.id : created?.id;
      log("STAFF_INSERT", probeId ? "pass" : "pass_no_id");
    } catch {
      log("STAFF_INSERT", "pass_parse_issue");
    }
  } else {
    log("STAFF_INSERT", "denied_or_error");
    log("STAFF_INSERT_SNIP", createText.slice(0, 160).replace(/\s+/g, " "));
  }

  if (probeId) {
    const pub = await fetch(`${url}/rest/v1/scholarships?id=eq.${probeId}`, {
      method: "PATCH",
      headers: staffHeaders,
      body: JSON.stringify({ status: "published" }),
    });
    log("STAFF_PUBLISH_HTTP", pub.status);

    const anonSee = await rest(`scholarships?id=eq.${probeId}&select=id,status`);
    let anonSeesProbe = false;
    if (anonSee.status === 200) {
      try {
        const rows = JSON.parse(anonSee.text);
        anonSeesProbe = Array.isArray(rows) && rows.length === 1 && rows[0].status === "published";
      } catch {
        anonSeesProbe = false;
      }
    }
    log("ANON_SEES_PUBLISHED_PROBE", anonSeesProbe ? "pass" : "FAIL");

    const archive = await fetch(`${url}/rest/v1/scholarships?id=eq.${probeId}`, {
      method: "PATCH",
      headers: staffHeaders,
      body: JSON.stringify({ status: "archived" }),
    });
    log("STAFF_ARCHIVE_HTTP", archive.status);

    const anonAfter = await rest(`scholarships?id=eq.${probeId}&select=id`);
    let anonHidden = true;
    if (anonAfter.status === 200) {
      try {
        const rows = JSON.parse(anonAfter.text);
        anonHidden = Array.isArray(rows) && rows.length === 0;
      } catch {
        anonHidden = false;
      }
    }
    log("ANON_HIDDEN_AFTER_ARCHIVE", anonHidden ? "pass" : "FAIL");
  }
} else {
  log("STAFF_CRUD", "BLOCKED_no_staff_jwt");
}

const anonOk =
  anonSelect.status === 200 &&
  anonNonPublished === 0 &&
  (anonInsert.status === 401 || anonInsert.status === 403);

log(
  "OVERALL_ANON_RLS",
  anonOk ? "pass" : anonSelect.status === 200 ? "partial" : "fail_or_blocked",
);
log(
  "OVERALL_TABLE",
  anonSelect.status === 200 || hasScholarshipsDef ? "present" : "missing_or_blocked",
);
log(
  "OVERALL_STAFF_CRUD",
  staffJwt ? "attempted_see_STAFF_*" : "BLOCKED_no_staff_jwt",
);
