/**
 * Demo authentication — only active when explicitly enabled.
 * Production builds exclude credentials unless VITE_ENABLE_DEMO_AUTH=true.
 */
export function isDemoAuthEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_AUTH === "true";
}

export type DemoAccount = {
  email: string;
  password: string;
  role: "student" | "consultant" | "admin";
  /** Mock consultant id used for assignment scoping in demo data. */
  consultantId?: string;
};

/** Eliminated from production bundles when demo auth is disabled at build time. */
export const DEMO_ACCOUNTS: DemoAccount[] =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_AUTH === "true"
    ? [
        {
          // Must match a mock student email — never fall back to an unrelated record.
          email: "ayesha@globalroots.pk",
          password: "demo1234",
          role: "student",
        },
        {
          email: "consultant@globalroots.pk",
          password: "demo1234",
          role: "consultant",
          consultantId: "c1",
        },
        {
          email: "admin@globalroots.pk",
          password: "demo1234",
          role: "admin",
        },
      ]
    : [];

export function findDemoAccount(email: string, password: string): DemoAccount | null {
  if (!isDemoAuthEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_ACCOUNTS.find((a) => a.email === normalized && a.password === password) ?? null
  );
}

export function findDemoAccountByEmail(email: string): DemoAccount | null {
  if (!isDemoAuthEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized) ?? null;
}