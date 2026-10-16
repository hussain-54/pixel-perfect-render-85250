/** Presence probe for organization_settings + related RPCs. No secrets printed. */
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
const h = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

const paths = [
  { path: "organization_settings?select=id&limit=1", method: "GET" },
  { path: "rpc/can_view_organization_settings", method: "POST", body: "{}" },
  { path: "rpc/can_mutate_organization_settings", method: "POST", body: "{}" },
  { path: "rpc/can_mutate_scholarships_catalog", method: "POST", body: "{}" },
];

for (const p of paths) {
  const r = await fetch(`${url}/rest/v1/${p.path}`, {
    method: p.method,
    headers: h,
    body: p.body,
  });
  const t = await r.text();
  let code = "none";
  let msg = t.slice(0, 100).replace(/\s+/g, " ");
  try {
    const j = JSON.parse(t);
    if (j.code) code = j.code;
    if (j.message) msg = String(j.message).slice(0, 120);
  } catch {
    /* keep snip */
  }
  const label = p.path.split("?")[0];
  console.log(`${label}_HTTP=${r.status} CODE=${code} MSG=${msg}`);
}
