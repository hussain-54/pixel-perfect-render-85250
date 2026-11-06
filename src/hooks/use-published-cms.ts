import { useQuery } from "@tanstack/react-query";
import { getPublishedCmsBundle } from "@/services";
import {
  DEFAULT_CMS_FOOTER,
  DEFAULT_CMS_HEADER,
  DEFAULT_CMS_HOME,
  DEFAULT_CMS_NAV,
  DEFAULT_CMS_SEO_GLOBAL,
  DEFAULT_CMS_THEME,
} from "@/lib/cms-defaults";
import type {
  CmsFooterSettings,
  CmsHeaderSettings,
  CmsNavSettings,
  CmsPageContent,
  CmsPublicAnnouncement,
  CmsSeoSettings,
  CmsThemeSettings,
} from "@/lib/cms-types";

export function usePublishedCms() {
  const q = useQuery({
    queryKey: ["public", "cms-bundle"],
    queryFn: () => getPublishedCmsBundle(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const docs = q.data?.documents ?? {};

  return {
    isLoading: q.isLoading,
    source: q.data?.source ?? "fallback",
    schemaReady: Boolean(q.data?.schemaReady),
    header: {
      ...DEFAULT_CMS_HEADER,
      ...((docs["site.header"] as CmsHeaderSettings | undefined) ?? {}),
    } as CmsHeaderSettings,
    nav: {
      ...DEFAULT_CMS_NAV,
      ...((docs["site.nav"] as CmsNavSettings | undefined) ?? {}),
      items:
        (docs["site.nav"] as CmsNavSettings | undefined)?.items ?? DEFAULT_CMS_NAV.items,
    } as CmsNavSettings,
    footer: {
      ...DEFAULT_CMS_FOOTER,
      ...((docs["site.footer"] as CmsFooterSettings | undefined) ?? {}),
    } as CmsFooterSettings,
    theme: {
      ...DEFAULT_CMS_THEME,
      ...((docs["site.theme"] as CmsThemeSettings | undefined) ?? {}),
    } as CmsThemeSettings,
    home: {
      ...DEFAULT_CMS_HOME,
      ...((docs["page.home"] as CmsPageContent | undefined) ?? {}),
      sections:
        (docs["page.home"] as CmsPageContent | undefined)?.sections ?? DEFAULT_CMS_HOME.sections,
    } as CmsPageContent,
    seo: {
      ...DEFAULT_CMS_SEO_GLOBAL,
      ...((docs["seo.global"] as CmsSeoSettings | undefined) ?? {}),
    } as CmsSeoSettings,
    announcements: (q.data?.announcements ?? []) as CmsPublicAnnouncement[],
  };
}
