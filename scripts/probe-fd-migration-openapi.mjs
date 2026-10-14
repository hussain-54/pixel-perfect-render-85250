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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/openapi+json",
};

const res = await fetch(`${url}/rest/v1/`, { headers });
console.log(`OPENAPI_HTTP=${res.status}`);
const text = await res.text();
console.log(`OPENAPI_HAS_REGISTERED_BY=${/registered_by/.test(text)}`);
try {
  const j = JSON.parse(text);
  const props =
    j?.definitions?.students?.properties ||
    j?.components?.schemas?.students?.properties;
  if (props) {
    console.log(
      `STUDENTS_PROPS_HAS_REGISTERED_BY=${Object.prototype.hasOwnProperty.call(props, "registered_by")}`,
    );
  } else {
    console.log("STUDENTS_SCHEMA=not_in_openapi_definitions");
  }
} catch (e) {
  console.log(`OPENAPI_PARSE=${e instanceof Error ? e.message : String(e)}`);
}

const rpcHeaders = { ...headers, "Content-Type": "application/json", Accept: "application/json" };
for (const name of [
  "list_front_desk_intake_summaries",
  "list_active_counsellor_desks",
  "front_desk_assign_counsellor",
  "is_front_desk",
]) {
  const body =
    name === "front_desk_assign_counsellor"
      ? {
          p_student_id: "00000000-0000-0000-0000-000000000000",
          p_consultant_id: "00000000-0000-0000-0000-000000000000",
        }
      : {};
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: rpcHeaders,
    body: JSON.stringify(body),
  });
  const t = (await r.text()).slice(0, 220).replace(/\s+/g, " ");
  console.log(`RPC_${name}=${r.status} ${t}`);
}
