/**
 * Live check: does can_mutate_scholarships_catalog exist?
 * Never prints secrets. Exit 0 always; status in JSON.
 */
import fs from "node:fs";

function load(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function get(envText, key) {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const envText = `${load(".env")}\n${load(".env.local")}`;
const url = (get(envText, "VITE_SUPABASE_URL") || get(envText, "SUPABASE_URL")).replace(/\/$/, "");
const anon = get(envText, "VITE_SUPABASE_PUBLISHABLE_KEY") || get(envText, "SUPABASE_ANON_KEY");

if (!url || !anon) {
  console.log(
    JSON.stringify({
      status: "BLOCKED",
      reason: "missing_supabase_url_or_anon_key",
      migrations: [
        "20261016110000_scholarships_mutate_rls_tighten.sql",
        "20261016120000_scholarships_mutate_fn_grants_harden.sql",
      ],
    }),
  );
  process.exit(0);
}

// Anon key + anon JWT: after grants harden, EXECUTE should be denied (401/403)
// or function missing (404/PGRST202) if …16110000 not applied yet.
const res = await fetch(`${url}/rest/v1/rpc/can_mutate_scholarships_catalog`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const text = await res.text();
const missing =
  res.status === 404 ||
  /could not find|PGRST202|does not exist|schema cache/i.test(text);
const denied =
  res.status === 401 ||
  res.status === 403 ||
  /permission denied|42501/i.test(text);

console.log(
  JSON.stringify({
    status: missing
      ? "NOT_APPLIED_OR_UNAVAILABLE"
      : denied
        ? "ANON_EXECUTE_DENIED"
        : "RPC_REACHABLE_BY_ANON",
    httpStatus: res.status,
    bodyPreview: text.slice(0, 160),
    host: new URL(url).host,
    migrations: [
      "20261016110000_scholarships_mutate_rls_tighten.sql",
      "20261016120000_scholarships_mutate_fn_grants_harden.sql",
    ],
    note: "ANON_EXECUTE_DENIED is the desired post-harden outcome when the function exists.",
  }),
);
