import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Split a portal deep-link so TanStack navigate keeps query params. */
export function splitPortalHref(href: string): {
  to: string;
  search: Record<string, string>;
} {
  const trimmed = (href || "").trim();
  const qIndex = trimmed.indexOf("?");
  const to = (qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed) || "/";
  const search: Record<string, string> = {};
  if (qIndex >= 0) {
    new URLSearchParams(trimmed.slice(qIndex + 1)).forEach((value, key) => {
      if (key && value) search[key] = value;
    });
  }
  return { to, search };
}
