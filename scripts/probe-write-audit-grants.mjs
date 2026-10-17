/** Probe write_audit_event EXECUTE with anon key. Never prints secrets. */
import { existsSync, readFileSync } from "node:fs";

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

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
if (!url || !anon) {
  console.log(JSON.stringify({ status: "BLOCKED", reason: "missing_env" }));
  process.exit(0);
}

const res = await fetch(`${url}/rest/v1/rpc/write_audit_event`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    p_action: "probe",
    p_entity_type: "probe",
  }),
});
const text = await res.text();
let code = "none";
let msg = text.slice(0, 140).replace(/\s+/g, " ");
try {
  const j = JSON.parse(text);
  if (j.code) code = j.code;
  if (j.message) msg = String(j.message).slice(0, 160);
} catch {
  /* keep */
}
console.log(
  JSON.stringify({
    host: new URL(url).host,
    http: res.status,
    code,
    msg,
    note: "42501 with anon is expected if EXECUTE was revoked from PUBLIC/anon. Authenticated Front Desk needs EXECUTE granted.",
  }),
);
