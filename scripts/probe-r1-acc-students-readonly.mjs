/**
 * R1a / R1b — authenticated Accounts JWT, read-only students GET probes.
 *
 * Option 6/7 style: PostgREST against the intended project with ACC session JWT.
 * Never prints JWTs, Authorization headers, or student row bodies.
 *
 * Required env (names only — values stay in untracked .env / shell):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY
 *   STAGING_ACC_JWT          — access_token from ACC sign-in (not service_role)
 *   STAGING_STU_NO_QUEUE_ID  — UUID: student with NO unpaid/claimed signup fee
 *   STAGING_STU_QUEUE_ID     — UUID: student WITH unpaid or claimed signup fee
 *
 * Obtain STAGING_ACC_JWT locally (operator):
 *   1. Confirm Dashboard project ref gjasuvlqfofpvrqvvnyz
 *   2. Provision ACC per docs/testing/STAGING-TEST-ACCOUNTS.md
 *      (consultant + accounts_banking_finance; not admin)
 *   3. Sign in at /sign-in as ACC
 *   4. Copy session access_token from browser Application/Network for that origin
 *      into STAGING_ACC_JWT (vault / untracked .env) — never paste into chat/git
 *
 * Operator preconditions (script cannot prove without extra queries; you must confirm):
 *   - ACC is fee verifier (can_verify_signup_fee); not admin
 *   - Stu-NoQueue: no unpaid|claimed fee; not assigned to ACC; not ACC profile_id
 *   - Stu-Queue: unpaid or claimed fee exists
 *   - Both student rows exist (Admin/catalog check; 200+[] alone is not R1a PASS)
 *
 * Usage: node scripts/probe-r1-acc-students-readonly.mjs
 * Does not: RPC, INSERT/UPDATE/DELETE, migrations, ledger edits.
 */
import { readFileSync, existsSync } from "node:fs";

const EXPECTED_HOST = "gjasuvlqfofpvrqvvnyz.supabase.co";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function sanitizeErrorCategory(status, text) {
  const t = (text || "").slice(0, 400);
  if (status === 401 || /JWT|PGRST301|not authenticated/i.test(t)) return "auth";
  if (status === 403 || /42501|permission denied|RLS|row-level/i.test(t))
    return "permission";
  if (status === 404 || /PGRST116/i.test(t)) return "not_found";
  if (status >= 500) return "server";
  if (status >= 400) return "client_error";
  return "none";
}

function classifyOutcome(status, text) {
  if (status === 401 || status === 403) {
    return { outcome: "denied", errorCategory: sanitizeErrorCategory(status, text) };
  }
  if (status !== 200) {
    return { outcome: "error", errorCategory: sanitizeErrorCategory(status, text) };
  }
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      if (data.length === 0) return { outcome: "empty", errorCategory: "none" };
      return { outcome: "allowed", errorCategory: "none" };
    }
    if (data && typeof data === "object") {
      return { outcome: "allowed", errorCategory: "none" };
    }
  } catch {
    return { outcome: "error", errorCategory: "parse" };
  }
  return { outcome: "error", errorCategory: "unexpected_body" };
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
const accJwt = (env.STAGING_ACC_JWT || "").trim();
const stuNoQueue = (env.STAGING_STU_NO_QUEUE_ID || "").trim();
const stuQueue = (env.STAGING_STU_QUEUE_ID || "").trim();

let host = "";
try {
  host = url ? new URL(url).host : "";
} catch {
  host = "invalid_url";
}

log("PROBE", "r1_acc_students_readonly");
log("REMOTE_PROJECT_HOST", host || "missing");
log("EXPECTED_HOST", EXPECTED_HOST);

const blockers = [];
if (!url) blockers.push("missing_VITE_SUPABASE_URL_or_SUPABASE_URL");
if (!anonKey) blockers.push("missing_VITE_SUPABASE_PUBLISHABLE_KEY_or_SUPABASE_ANON_KEY");
if (host && host !== EXPECTED_HOST) blockers.push("host_mismatch_expected_gjasuvlqfofpvrqvvnyz");
if (!accJwt) blockers.push("missing_STAGING_ACC_JWT");
if (!stuNoQueue) blockers.push("missing_STAGING_STU_NO_QUEUE_ID");
else if (!UUID_RE.test(stuNoQueue)) blockers.push("invalid_STAGING_STU_NO_QUEUE_ID");
if (!stuQueue) blockers.push("missing_STAGING_STU_QUEUE_ID");
else if (!UUID_RE.test(stuQueue)) blockers.push("invalid_STAGING_STU_QUEUE_ID");
if (stuNoQueue && stuQueue && stuNoQueue === stuQueue) {
  blockers.push("stu_ids_must_differ");
}

log(
  "OPERATOR_PRECONDITIONS",
  "unverified_by_script_confirm_ACC_fee_verifier_not_admin_and_fee_queue_labels",
);

if (blockers.length) {
  log("PRECONDITION", "BLOCKED");
  for (const b of blockers) log("BLOCKER", b);
  log("LIVE_JWT_VERIFICATION", "NOT_RUN");
  log(
    "NEXT",
    "Set missing env (names in script header), confirm ACC+student preconditions, re-run",
  );
  process.exit(0);
}

log("PRECONDITION", "ENV_OK_OPERATOR_ROLE_FEE_CHECKS_STILL_REQUIRED");

async function getStudent(caseLabel, studentId) {
  const path = `/rest/v1/students?select=*&id=eq.${encodeURIComponent(studentId)}`;
  const res = await fetch(`${url}${path}`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accJwt}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  const { outcome, errorCategory } = classifyOutcome(res.status, text);
  log("CASE", caseLabel);
  log("HTTP_STATUS", String(res.status));
  log("OUTCOME", outcome);
  log("ERROR_CATEGORY", errorCategory);
}

await getStudent("R1a_StuNoQueue", stuNoQueue);
await getStudent("R1b_StuQueue", stuQueue);

log("NOTE", "200+empty for R1a is not PASS without operator proof row exists");
log("NOTE", "R1b allowed still exposes full students.* columns (accepted residual)");
log("LIVE_JWT_VERIFICATION", "EXECUTED_SEE_CASE_OUTCOMES");
log("APPLY_STATUS", "NOT_ATTEMPTED");
