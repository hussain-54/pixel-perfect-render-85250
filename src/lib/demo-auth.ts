/**
 * Demo authentication — development only.
 * Production builds always disable demo auth, even if VITE_ENABLE_DEMO_AUTH is set.
 */
import type { BusinessRole } from "@/lib/business-permissions";

export function resolveDemoAuthEnabled(env: {
  PROD?: boolean;
  DEV?: boolean;
  VITE_ENABLE_DEMO_AUTH?: string;
}): boolean {
  if (env.PROD) return false;
  return Boolean(env.DEV);
}

export function isDemoAuthEnabled(): boolean {
  const env: {
    PROD?: boolean;
    DEV?: boolean;
    VITE_ENABLE_DEMO_AUTH?: string;
  } = {
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
  };
  const flag = import.meta.env.VITE_ENABLE_DEMO_AUTH;
  if (typeof flag === "string") env.VITE_ENABLE_DEMO_AUTH = flag;
  return resolveDemoAuthEnabled(env);
}

export type DemoAccount = {
  email: string;
  password: string;
  role: "student" | "consultant" | "admin";
  /** Mock consultant id used for assignment scoping in demo data. */
  consultantId?: string;
  /** Trusted specialty desk — re-derived from allow-list on every request. */
  businessRole?: BusinessRole;
};

/** Credentials exist only in development bundles — never shipped in production. */
export const DEMO_ACCOUNTS: DemoAccount[] = import.meta.env.DEV
  ? [
      {
        // Must match a mock student email — never fall back to an unrelated record.
        email: "ayesha@globalroots.pk",
        password: "demo1234",
        role: "student",
        businessRole: "student_portal",
      },
      {
        email: "consultant@globalroots.pk",
        password: "demo1234",
        role: "consultant",
        consultantId: "c1",
        businessRole: "counsellor_consultant",
      },
      // Admission Team is live-only (Supabase staff accounts). Never mint admission_team via demo auth.
      {
        email: "admin@globalroots.pk",
        password: "demo1234",
        role: "admin",
        businessRole: "admin",
      },
    ]
  : [];

export function findDemoAccount(email: string, password: string): DemoAccount | null {
  if (!isDemoAuthEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized && a.password === password) ?? null;
}

export function findDemoAccountByEmail(email: string): DemoAccount | null {
  if (!isDemoAuthEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized) ?? null;
}
