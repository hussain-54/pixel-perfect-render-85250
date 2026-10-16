/** Anon PostgREST probe for catalog tables. Never prints keys. */
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
const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };

for (const t of ["universities", "programs", "scholarships"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=3`, { headers });
  const text = await r.text();
  let count = "?";
  try {
    const j = JSON.parse(text);
    count = Array.isArray(j) ? String(j.length) : "na";
  } catch {
    count = "parse_err";
  }
  console.log(
    `${t}_HTTP=${r.status} count=${count} snip=${text.slice(0, 100).replace(/\s+/g, " ")}`,
  );
}
