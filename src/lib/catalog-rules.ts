/**
 * Pure validation / pagination for universities + programs catalog.
 * Schema has no publication status — public RLS exposes all rows allowed to anon.
 */
export type UniversityWriteInput = {
  name: string;
  country: string;
  city?: string | null;
  website?: string | null;
  logoUrl?: string | null;
};

export type ProgramWriteInput = {
  universityId: string;
  name: string;
  level?: string | null;
  duration?: string | null;
  tuitionFee?: string | null;
};

export type CatalogListFilters = {
  q?: string;
  country?: string;
  level?: string;
  universityId?: string;
  page?: number;
  pageSize?: number;
};

export const CATALOG_PAGE_SIZE = 24;

export function resolveCatalogPage(filters: CatalogListFilters): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize ?? CATALOG_PAGE_SIZE)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function normalizeOptionalUrl(value: string | null | undefined): string | null | "invalid" {
  if (value == null || value.trim() === "") return null;
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return "invalid";
  return v;
}

export function validateUniversityWrite(
  input: UniversityWriteInput,
): { ok: true; normalized: NormalizedUniversityWrite } | { ok: false; error: string } {
  const name = input.name?.trim() ?? "";
  const country = input.country?.trim() ?? "";
  if (name.length < 2) return { ok: false, error: "University name is required (min 2 characters)." };
  if (name.length > 200) return { ok: false, error: "University name is too long." };
  if (country.length < 2) return { ok: false, error: "Country is required." };
  if (country.length > 100) return { ok: false, error: "Country is too long." };

  const website = normalizeOptionalUrl(input.website);
  if (website === "invalid") {
    return { ok: false, error: "Website must start with http:// or https://." };
  }
  const logoUrl = normalizeOptionalUrl(input.logoUrl);
  if (logoUrl === "invalid") {
    return { ok: false, error: "Logo URL must start with http:// or https://." };
  }

  return {
    ok: true,
    normalized: {
      name,
      country,
      city: (input.city ?? "").trim() || null,
      website,
      logoUrl,
    },
  };
}

export type NormalizedUniversityWrite = {
  name: string;
  country: string;
  city: string | null;
  website: string | null;
  logoUrl: string | null;
};

export function validateProgramWrite(
  input: ProgramWriteInput,
): { ok: true; normalized: NormalizedProgramWrite } | { ok: false; error: string } {
  const universityId = input.universityId?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  if (!universityId) return { ok: false, error: "University is required." };
  if (name.length < 2) return { ok: false, error: "Program name is required (min 2 characters)." };
  if (name.length > 200) return { ok: false, error: "Program name is too long." };

  return {
    ok: true,
    normalized: {
      universityId,
      name,
      level: (input.level ?? "").trim() || null,
      duration: (input.duration ?? "").trim() || null,
      tuitionFee: (input.tuitionFee ?? "").trim() || null,
    },
  };
}

export type NormalizedProgramWrite = {
  universityId: string;
  name: string;
  level: string | null;
  duration: string | null;
  tuitionFee: string | null;
};

/** Schema has no draft/published flag — document that for tests/UI. */
export function catalogHasPublicationStatus(): boolean {
  return false;
}
