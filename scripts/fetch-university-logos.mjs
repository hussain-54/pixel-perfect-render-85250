/**
 * Download brand marks from each university's official domain (Google favicon
 * index of the site's own icon) into public/universities/logos/.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "universities", "logos");
mkdirSync(outDir, { recursive: true });

const dataPath = join(root, "src", "data", "explore-universities.ts");
const src = readFileSync(dataPath, "utf8");
const entries = [];
const blockRe =
  /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*country:\s*"([^"]+)",\s*website:\s*"([^"]+)"/g;
let m;
while ((m = blockRe.exec(src))) {
  entries.push({ id: m[1], name: m[2], website: m[4] });
}

function domainFromWebsite(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const results = [];

for (const entry of entries) {
  const domain = domainFromWebsite(entry.website);
  if (!domain) {
    results.push({ ...entry, ok: false, reason: "bad-url" });
    continue;
  }
  const dest = join(outDir, `${entry.id}.png`);
  const candidates = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent("www." + domain)}&sz=256`,
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/apple-touch-icon.png`,
  ];

  let saved = false;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*", "User-Agent": "GlobalRootsLogoFetch/1.0" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("image") && !url.endsWith(".ico")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue;
      writeFileSync(dest, buf);
      results.push({ ...entry, ok: true, domain, bytes: buf.length, source: url });
      console.log("ok", entry.id, buf.length);
      saved = true;
      break;
    } catch {
      /* try next */
    }
  }
  if (!saved) {
    results.push({ ...entry, ok: false, domain, reason: "no-image" });
    console.warn("fail", entry.id);
  }
  await new Promise((r) => setTimeout(r, 80));
}

const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
console.log(JSON.stringify({ total: entries.length, ok: okIds.size }, null, 2));
writeFileSync(join(outDir, "_fetch-report.json"), JSON.stringify(results, null, 2));

// Patch explore-universities.ts logoPath / logoStatus for successful downloads.
let next = src;
for (const entry of entries) {
  const ok = okIds.has(entry.id);
  const path = ok ? `/universities/logos/${entry.id}.png` : null;
  const status = ok ? "verified_local" : "text_fallback";
  const re = new RegExp(
    `(id:\\s*"${entry.id}"[\\s\\S]*?website:\\s*"[^"]+",\\s*)logoPath:\\s*[^,]+,\\s*logoStatus:\\s*"[^"]+"`,
  );
  if (!re.test(next)) {
    console.warn("patch-miss", entry.id);
    continue;
  }
  next = next.replace(
    re,
    `$1logoPath: ${path ? `"${path}"` : "null"},\n    logoStatus: "${status}"`,
  );
}
writeFileSync(dataPath, next);
console.log("patched explore-universities.ts");
