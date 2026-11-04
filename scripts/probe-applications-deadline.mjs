import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2]
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...loadEnv(path.join(root, ".env")),
  ...loadEnv(path.join(root, ".env.local")),
};
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("NO_URL_OR_KEY");
  process.exit(1);
}
console.log("URL_HOST", new URL(url).host);

async function probe(selectPath) {
  const res = await fetch(`${url}${selectPath}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  console.log(selectPath, res.status, text.slice(0, 400).replace(/\s+/g, " "));
}

await probe("/rest/v1/applications?select=id&limit=0");
await probe("/rest/v1/applications?select=deadline&limit=0");
await probe("/rest/v1/applications?select=id,deadline,intake,university_name&limit=0");
