/*
 * Types for the parts of site.mjs the application imports (app-shell/siteTitles.ts
 * reads the public pages' titles from here). The build scripts use the plain module.
 */
export interface PageMeta { title: string; description: string; h1: string }
export interface SitePage {
  path: string;
  index: boolean;
  meta: Record<string, PageMeta>;
}
export const SITE: { origin: string; name: string; canonicalLocale: string; locales: string[] };
export const PAGES: SitePage[];
export function metaFor(page: SitePage, locale: string): PageMeta;
