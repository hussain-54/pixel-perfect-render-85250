/**
 * Rules for public marketing catalog reads (universities).
 * Production never serves demo fixtures; DEV may when live plane is unavailable.
 */
import { resolveDemoAuthEnabled } from "@/lib/demo-auth";

export function mayServePublicCatalogDemo(env: {
  PROD?: boolean;
  DEV?: boolean;
}): boolean {
  return resolveDemoAuthEnabled(env);
}

export function resolvePublicCatalogSource(input: {
  liveOk: boolean;
  allowDemo: boolean;
}): "live" | "demo" | "unavailable" {
  if (input.liveOk) return "live";
  if (input.allowDemo) return "demo";
  return "unavailable";
}
