/** Presence-only env inventory. Never prints secret values. */
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

const fileEnv = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const keys = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "STAGING_ADMIN_JWT",
  "STAGING_CONSULTANT_JWT",
  "STAGING_ACC_JWT",
  "STAGING_STUDENT_JWT",
  "STAGING_FD_JWT",
  "STAGING_ADMISSION_JWT",
  "STAGING_HR_JWT",
  "STAGING_MKT_JWT",
  "STAGING_OPS_JWT",
  "STAGING_MANAGER_JWT",
  "STAGING_SUPERADMIN_JWT",
  "STAGING_STU_NO_QUEUE_ID",
  "STAGING_STU_QUEUE_ID",
  // optional password-based sign-in for matrix (never printed)
  "STAGING_STUDENT_EMAIL",
  "STAGING_STUDENT_PASSWORD",
  "STAGING_FD_EMAIL",
  "STAGING_FD_PASSWORD",
  "STAGING_COUNSELLOR_EMAIL",
  "STAGING_COUNSELLOR_PASSWORD",
  "STAGING_ADMISSION_EMAIL",
  "STAGING_ADMISSION_PASSWORD",
  "STAGING_ACCOUNTS_EMAIL",
  "STAGING_ACCOUNTS_PASSWORD",
  "STAGING_HR_EMAIL",
  "STAGING_HR_PASSWORD",
  "STAGING_MKT_EMAIL",
  "STAGING_MKT_PASSWORD",
  "STAGING_OPS_EMAIL",
  "STAGING_OPS_PASSWORD",
  "STAGING_MANAGER_EMAIL",
  "STAGING_MANAGER_PASSWORD",
  "STAGING_ADMIN_EMAIL",
  "STAGING_ADMIN_PASSWORD",
  "STAGING_SUPERADMIN_EMAIL",
  "STAGING_SUPERADMIN_PASSWORD",
];

for (const k of keys) {
  const v = (process.env[k] || fileEnv[k] || "").trim();
  console.log(`${k}=${v ? `present_len_${v.length}` : "missing"}`);
}

let host = "missing";
const url = (fileEnv.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
try {
  if (url) host = new URL(url).host;
} catch {
  host = "invalid";
}
console.log(`HOST=${host}`);
